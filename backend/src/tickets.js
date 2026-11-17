import QRCode from 'qrcode';
import { supabase } from './supabase.js';
import { sendMail } from './mailer.js';

export const TICKET_RE = /^[0-9a-f]{32}$/;

/** Ambil kode tiket dari teks hasil scan (bisa kode polos atau URL .../ticket/<kode>). */
export const extractCode = (input) => String(input ?? '').toLowerCase().match(/[0-9a-f]{32}/)?.[0] ?? null;

export const siteUrl = (req) =>
  (process.env.SITE_URL || process.env.URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

export const ticketUrl = (req, code) => `${siteUrl(req)}/ticket/${code}`;

export const maskEmail = (e) => e.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => `${a}***${b}`);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = (iso) => (iso
  ? `${new Date(iso).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB`
  : 'Menyusul');

/** Alamat email peserta = jawaban isian bertipe "email" pertama pada form event. */
export function recipientOf(fields, answers) {
  const f = (fields || []).find((x) => x.type === 'email');
  const v = f ? answers?.[f.id] : null;
  return typeof v === 'string' && v ? v : null;
}

export async function buildEmail(req, event, reg) {
  const url = ticketUrl(req, reg.ticket_code);
  const qr = await QRCode.toBuffer(url, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
  const no = `#${String(reg.ticket_no ?? '').padStart(3, '0')}`;
  const details = (event.fields || [])
    .filter((f) => f.type !== 'email')
    .slice(0, 6)
    .map((f) => {
      const v = reg.answers?.[f.id];
      return [f.label, Array.isArray(v) ? v.join(', ') : v];
    })
    .filter(([, v]) => v !== '' && v !== undefined && v !== null);

  const row = (k, v) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%">${esc(k)}</td><td style="padding:6px 0;font-weight:600;font-size:14px;color:#111827">${esc(v)}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#ff5a2b;background:linear-gradient(135deg,#ff6a2b,#ff2e63);padding:24px;color:#ffffff">
    <div style="font-size:11px;letter-spacing:2px;font-weight:bold;opacity:.9">TIKET PESERTA</div>
    <div style="font-size:22px;font-weight:bold;margin-top:6px">${esc(event.title)}</div>
  </td></tr>
  <tr><td style="padding:24px;text-align:center">
    <p style="margin:0 0 4px;color:#374151;font-size:14px">Tunjukkan QR ini ke panitia saat registrasi ulang.</p>
    <img src="cid:tiketqr" width="240" height="240" alt="QR tiket" style="display:block;margin:16px auto;border:1px solid #e5e7eb;border-radius:12px">
    <div style="font-size:28px;font-weight:bold;color:#ff5a2b">${esc(no)}</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:4px;font-family:monospace">${esc(reg.ticket_code)}</div>
  </td></tr>
  <tr><td style="padding:0 24px 8px"><table role="presentation" width="100%" style="border-top:2px dashed #e5e7eb;padding-top:12px">
    ${row('Tanggal', fmtDate(event.event_date))}
    ${row('Lokasi', event.location || '—')}
    ${details.map(([k, v]) => row(k, v)).join('')}
  </table></td></tr>
  <tr><td style="padding:16px 24px 28px;text-align:center">
    <a href="${esc(url)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;font-size:14px">Buka tiket online</a>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">Jangan bagikan QR ini — satu QR hanya bisa dipakai check-in satu kali.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `TIKET PESERTA — ${event.title}`,
    `No. peserta: ${no}`,
    `Tanggal: ${fmtDate(event.event_date)}`,
    `Lokasi: ${event.location || '-'}`,
    ...details.map(([k, v]) => `${k}: ${v}`),
    '',
    `Tiket online (QR): ${url}`,
  ].join('\n');

  return {
    subject: `🎟️ Tiket ${event.title} — No. ${no}`,
    html,
    text,
    attachments: [{ filename: 'tiket-qr.png', content: qr, cid: 'tiketqr' }],
  };
}

/**
 * Kirim email tiket untuk satu pendaftaran. Return alamat tujuan, atau null bila
 * form event tidak punya isian email / peserta tidak mengisinya.
 */
export async function deliverTicket(req, reg) {
  const { data: event, error } = await supabase
    .from('events').select('id,title,event_date,location,fields').eq('id', reg.event_id).single();
  if (error) throw error;
  const to = recipientOf(event.fields, reg.answers);
  if (!to) return null;
  await sendMail({ to, ...(await buildEmail(req, event, reg)) });
  return to;
}
