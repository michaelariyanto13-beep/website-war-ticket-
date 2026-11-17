import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { supabase } from './supabase.js';
import { login, requireAdmin } from './auth.js';
import { validateEventInput, validateAnswers } from './validate.js';
import { mailEnabled } from './mailer.js';
import { TICKET_RE, extractCode, deliverTicket, maskEmail } from './tickets.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel/Netlify di depan → IP asli dari X-Forwarded-For
app.use(helmet());

// Di Vercel frontend & API satu domain, jadi CORS tidak dibutuhkan.
// Isi CORS_ORIGIN hanya bila frontend di domain lain.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
}

const smallJson = express.json({ limit: '20kb' });  // form peserta
const bigJson = express.json({ limit: '400kb' });   // event + deskripsi (admin)

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Server sedang sibuk, coba lagi sebentar' });
});

// IP asli pengunjung. Header ini ditulis oleh platform (tidak bisa dipalsukan user):
// Netlify → x-nf-client-connection-ip, Vercel → x-real-ip. Lokal → req.ip.
const clientIp = (req) => {
  const ip = req.headers['x-nf-client-connection-ip'] || req.headers['x-real-ip'] || req.ip || 'unknown';
  // IPv6: kelompokkan per /64 agar satu pengguna tidak bisa ganti-ganti alamat
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip;
};

const tooMany = { error: 'Terlalu banyak percobaan, tunggu sebentar lalu coba lagi' };
const limiterBase = { standardHeaders: true, legacyHeaders: false, message: tooMany, keyGenerator: clientIp, validate: false };
const loginLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, limit: 10 });
// Longgar: banyak pengguna seluler berbagi IP (CGNAT). Kuota tetap dijaga database.
const registerLimiter = rateLimit({ ...limiterBase, windowMs: 60 * 1000, limit: 60 });
const ticketLimiter = rateLimit({ ...limiterBase, windowMs: 60 * 1000, limit: 30 });

const checkCode = (req, res, next) =>
  TICKET_RE.test(req.params.code) ? next() : res.status(404).json({ error: 'Tiket tidak ditemukan' });
const REG_COLS = 'id,event_id,answers,created_at,ticket_code,ticket_no,checked_in_at,email_sent_at';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkId = (req, res, next) =>
  UUID.test(req.params.id) ? next() : res.status(404).json({ error: 'Tidak ditemukan' });

// Response publik di-cache CDN Vercel 2 detik: ribuan user yang polling
// hanya menghasilkan ±1 query DB per 2 detik per region.
const edgeCache = (res, seconds = 2) => {
  res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=5`);
  res.set('Netlify-CDN-Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=5`); // untuk Netlify
};
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

const shape = (e) => {
  const registered = e.registered_count ?? 0;
  return { ...e, registered, is_full: e.quota !== null && registered >= e.quota, open_at: e.open_at ?? null };
};

// Cache definisi form per instance (hemat 1 query di jalur pendaftaran).
const fieldsCache = new Map();
async function getEventFields(id) {
  const hit = fieldsCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.value;
  const { data, error } = await supabase.from('events').select('id,fields').eq('id', id).maybeSingle();
  if (error) throw error;
  fieldsCache.set(id, { value: data, exp: Date.now() + 10_000 });
  return data;
}

app.get('/', (_req, res) => res.json({ ok: true, service: 'war-ticket-api' }));
app.get('/api/health', noStore, (_req, res) => res.json({ ok: true, now: Date.now() }));

// ---------- PUBLIC ----------
app.get('/api/events', wrap(async (_req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,event_date,location,quota,is_open,open_at,registered_count,created_at')
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  edgeCache(res);
  res.json(data.map(shape));
}));

app.get('/api/events/:id', checkId, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,event_date,location,quota,is_open,open_at,fields,registered_count,full_message')
    .eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Event tidak ditemukan' });
  const out = shape(data);
  if (!out.is_full) delete out.full_message; // pesan hanya dikirim saat slot benar-benar habis
  edgeCache(res);
  res.json(out);
}));

app.post('/api/events/:id/register', noStore, registerLimiter, checkId, smallJson, wrap(async (req, res) => {
  const event = await getEventFields(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event tidak ditemukan' });

  const { error: vErr, value } = validateAnswers(event.fields, req.body?.answers);
  if (vErr) return res.status(400).json({ error: vErr });

  const { data: result, error: rpcErr } = await supabase.rpc('register_for_event', {
    p_event_id: event.id, p_answers: value,
  });
  if (rpcErr) throw rpcErr;
  if (!result.ok) {
    const map = {
      FULL: [409, 'Maaf, kuota war sudah penuh'],
      CLOSED: [409, 'Pendaftaran sudah ditutup'],
      NOT_YET: [409, 'War belum dibuka, tunggu hitung mundurnya selesai'],
      NOT_FOUND: [404, 'Event tidak ditemukan'],
    };
    const [status, msg] = map[result.code] || [400, 'Gagal mendaftar'];
    return res.status(status).json({ error: msg, code: result.code });
  }
  res.status(201).json({ ok: true, id: result.id, position: result.position, ticket_code: result.ticket_code });
}));

// Tiket online (dibuka dari link email / QR). Hanya info minimal, tanpa data pribadi.
app.get('/api/tickets/:code', noStore, ticketLimiter, checkCode, wrap(async (req, res) => {
  const { data: reg, error } = await supabase
    .from('registrations').select('event_id,ticket_no,ticket_code,checked_in_at,created_at')
    .eq('ticket_code', req.params.code).maybeSingle();
  if (error) throw error;
  if (!reg) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  const { data: event, error: eErr } = await supabase
    .from('events').select('id,title,event_date,location').eq('id', reg.event_id).single();
  if (eErr) throw eErr;
  const { event_id: _omit, ...ticket } = reg;
  res.json({ ...ticket, event });
}));

// Kirim email tiket — dipanggil halaman sukses SETELAH pendaftaran (jalur daftar tetap cepat).
// Hanya bisa sekali per tiket (anti-spam); kirim ulang hanya lewat admin.
app.post('/api/tickets/:code/email', noStore, ticketLimiter, checkCode, wrap(async (req, res) => {
  if (!mailEnabled) return res.status(503).json({ error: 'Pengiriman email belum diaktifkan', code: 'MAIL_DISABLED' });
  const { data: reg, error } = await supabase
    .from('registrations').update({ email_sent_at: new Date().toISOString() })
    .eq('ticket_code', req.params.code).is('email_sent_at', null)
    .select(REG_COLS).maybeSingle();
  if (error) throw error;
  if (!reg) return res.json({ ok: true, already: true });

  const release = () => supabase.from('registrations').update({ email_sent_at: null }).eq('id', reg.id);
  try {
    const to = await deliverTicket(req, reg);
    if (!to) { await release(); return res.json({ ok: false, code: 'NO_EMAIL' }); }
    res.json({ ok: true, to: maskEmail(to) });
  } catch (e) {
    console.error('Email gagal:', e.message);
    await release();
    res.status(502).json({ error: 'Email gagal terkirim, simpan QR di layar ini', code: 'MAIL_FAILED' });
  }
}));

// ---------- ADMIN ----------
app.post('/api/admin/login', noStore, loginLimiter, smallJson, async (req, res) => {
  const token = login(req.body?.username, req.body?.password);
  if (!token) {
    await new Promise((r) => setTimeout(r, 800)); // perlambat brute force
    return res.status(401).json({ error: 'Username / password salah' });
  }
  res.json({ token });
});

const admin = express.Router();
admin.use(noStore, requireAdmin, bigJson);
admin.param('id', (req, res, next) => checkId(req, res, next));

admin.get('/events', wrap(async (_req, res) => {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data.map(shape));
}));

admin.post('/events', wrap(async (req, res) => {
  const { error: vErr, value } = validateEventInput(req.body);
  if (vErr) return res.status(400).json({ error: vErr });
  const { data, error } = await supabase.from('events').insert(value).select().single();
  if (error) throw error;
  res.status(201).json(data);
}));

admin.put('/events/:id', wrap(async (req, res) => {
  const { error: vErr, value } = validateEventInput(req.body);
  if (vErr) return res.status(400).json({ error: vErr });
  const { data, error } = await supabase.from('events').update(value).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Event tidak ditemukan' });
  fieldsCache.delete(req.params.id);
  res.json(data);
}));

admin.patch('/events/:id/open', wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('events').update({ is_open: !!req.body?.is_open }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Event tidak ditemukan' });
  res.json(data);
}));

admin.delete('/events/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('events').delete().eq('id', req.params.id);
  if (error) throw error;
  fieldsCache.delete(req.params.id);
  res.json({ ok: true });
}));

// Rekap: ambil semua pendaftar per 1000 baris (batas default Supabase)
admin.get('/events/:id/recap', wrap(async (req, res) => {
  const { data: event, error } = await supabase.from('events').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!event) return res.status(404).json({ error: 'Event tidak ditemukan' });
  const registrations = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: rErr } = await supabase
      .from('registrations').select(REG_COLS)
      .eq('event_id', event.id)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(from, from + 999);
    if (rErr) throw rErr;
    registrations.push(...data);
    if (data.length < 1000) break;
  }
  res.json({ event: shape(event), registrations, mail_enabled: mailEnabled });
}));

// ----- Kehadiran (scan QR) -----
const countCheckedIn = async (eventId) => {
  const { count, error } = await supabase.from('registrations')
    .select('id', { count: 'exact', head: true }).eq('event_id', eventId).not('checked_in_at', 'is', null);
  if (error) throw error;
  return count ?? 0;
};

admin.post('/checkin', wrap(async (req, res) => {
  const code = extractCode(req.body?.code);
  if (!code) return res.status(400).json({ status: 'invalid', error: 'QR bukan tiket WarLari' });

  const { data: reg, error } = await supabase.from('registrations').select(REG_COLS).eq('ticket_code', code).maybeSingle();
  if (error) throw error;
  if (!reg) return res.status(404).json({ status: 'invalid', error: 'Tiket tidak ditemukan' });

  const { data: event, error: eErr } = await supabase
    .from('events').select('id,title,fields,registered_count').eq('id', reg.event_id).single();
  if (eErr) throw eErr;

  const base = { event: { id: event.id, title: event.title, fields: event.fields }, registration: reg };
  const wanted = req.body?.event_id;
  if (wanted && wanted !== reg.event_id) {
    return res.status(409).json({ ...base, status: 'wrong_event', error: `Tiket ini untuk event "${event.title}"` });
  }

  // Update bersyarat: aman walau 2 panitia scan QR yang sama bersamaan
  const { data: updated, error: uErr } = await supabase.from('registrations')
    .update({ checked_in_at: new Date().toISOString() })
    .eq('id', reg.id).is('checked_in_at', null).select(REG_COLS).maybeSingle();
  if (uErr) throw uErr;

  const stats = { checked_in: await countCheckedIn(event.id), registered: event.registered_count };
  if (!updated) return res.json({ ...base, status: 'already', stats });
  res.json({ ...base, registration: updated, status: 'ok', stats });
}));

admin.patch('/registrations/:id/checkin', wrap(async (req, res) => {
  const { data, error } = await supabase.from('registrations')
    .update({ checked_in_at: req.body?.checked_in ? new Date().toISOString() : null })
    .eq('id', req.params.id).select(REG_COLS).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  res.json(data);
}));

// ----- Email tiket (admin) -----
admin.post('/registrations/:id/email', wrap(async (req, res) => {
  if (!mailEnabled) return res.status(503).json({ error: 'SMTP belum dikonfigurasi di Environment Variables' });
  const { data: reg, error } = await supabase.from('registrations').select(REG_COLS).eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!reg) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  try {
    const to = await deliverTicket(req, reg);
    if (!to) return res.status(400).json({ error: 'Peserta ini tidak mengisi email' });
    const { data } = await supabase.from('registrations')
      .update({ email_sent_at: new Date().toISOString() }).eq('id', reg.id).select(REG_COLS).single();
    res.json({ ok: true, to, registration: data });
  } catch (e) {
    console.error('Email gagal:', e.message);
    res.status(502).json({ error: `Email gagal terkirim: ${e.message}` });
  }
}));

// Kirim email yang tertunda per batch kecil (batas waktu function ±10 detik)
admin.post('/events/:id/email-pending', wrap(async (req, res) => {
  if (!mailEnabled) return res.status(503).json({ error: 'SMTP belum dikonfigurasi di Environment Variables' });
  const started = Date.now();
  const { data: event, error: eErr } = await supabase.from('events').select('fields').eq('id', req.params.id).maybeSingle();
  if (eErr) throw eErr;
  if (!event) return res.status(404).json({ error: 'Event tidak ditemukan' });
  const emailField = event.fields.find((f) => f.type === 'email');
  if (!emailField) return res.status(400).json({ error: 'Form event ini tidak punya isian bertipe Email' });

  // Hanya peserta yang mengisi email & belum terkirim
  const pending = (cols, opts) => supabase.from('registrations').select(cols, opts)
    .eq('event_id', req.params.id).is('email_sent_at', null)
    .not(`answers->>${emailField.id}`, 'is', null).neq(`answers->>${emailField.id}`, '');

  const { data: regs, error } = await pending(REG_COLS).order('created_at').limit(8);
  if (error) throw error;
  let sent = 0, failed = 0;
  for (const reg of regs) {
    if (Date.now() - started > 6500) break;
    try {
      await deliverTicket(req, reg);
      await supabase.from('registrations').update({ email_sent_at: new Date().toISOString() }).eq('id', reg.id);
      sent++;
    } catch (e) {
      console.error('Email gagal:', e.message);
      failed++;
    }
  }
  const { count: remaining } = await pending('id', { count: 'exact', head: true });
  res.json({ sent, failed, remaining: remaining ?? 0 });
}));

admin.delete('/registrations/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('registrations').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

app.use('/api/admin', admin);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// Error parser (JSON rusak, body terlalu besar, dll) → JSON singkat tanpa stack trace
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  const msg = status === 413 ? 'Data terlalu besar'
    : status === 400 ? 'Format data tidak valid'
    : 'Server sedang sibuk, coba lagi sebentar';
  res.status(status).json({ error: msg });
});

export default app;
