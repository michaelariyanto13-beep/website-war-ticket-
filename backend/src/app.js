import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { supabase } from './supabase.js';
import { login, requireAdmin } from './auth.js';
import { validateEventInput, validateAnswers } from './validate.js';

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
  return { ...e, registered, is_full: e.quota !== null && registered >= e.quota };
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
app.get('/api/health', noStore, (_req, res) => res.json({ ok: true }));

// ---------- PUBLIC ----------
app.get('/api/events', wrap(async (_req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,event_date,location,quota,is_open,registered_count,created_at')
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  edgeCache(res);
  res.json(data.map(shape));
}));

app.get('/api/events/:id', checkId, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,event_date,location,quota,is_open,fields,registered_count')
    .eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Event tidak ditemukan' });
  edgeCache(res);
  res.json(shape(data));
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
      NOT_FOUND: [404, 'Event tidak ditemukan'],
    };
    const [status, msg] = map[result.code] || [400, 'Gagal mendaftar'];
    return res.status(status).json({ error: msg, code: result.code });
  }
  res.status(201).json({ ok: true, id: result.id, position: result.position });
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
      .from('registrations').select('id,answers,created_at')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(from, from + 999);
    if (rErr) throw rErr;
    registrations.push(...data);
    if (data.length < 1000) break;
  }
  res.json({ event: shape(event), registrations });
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
