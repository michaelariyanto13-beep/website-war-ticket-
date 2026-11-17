export const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
    : 'Tanggal belum ditentukan';

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });

// ISO -> nilai untuk <input type="datetime-local">
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Deskripsi lama berupa teks biasa -> bungkus jadi paragraf HTML
export function toHtml(s = '') {
  if (!s) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(s)) return s;
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export const answerText = (v) => (Array.isArray(v) ? v.join(', ') : v ?? '');

export const newFieldId = () => 'f' + Math.random().toString(36).slice(2, 9);

const GRADIENTS = [
  ['#ff6a2b', '#ff2e63'],
  ['#7c3aed', '#2563eb'],
  ['#06b6d4', '#10b981'],
  ['#f59e0b', '#ef4444'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#3b82f6'],
];
export function gradientFor(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function dateParts(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('id-ID', { day: '2-digit' }),
    mon: d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase(),
    year: d.getFullYear(),
    time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** true bila war dijadwalkan dan jam bukanya belum tiba. */
export const isUpcoming = (e, now = Date.now()) => Boolean(e.open_at) && new Date(e.open_at).getTime() > now;

export const fmtOpenAt = (iso) =>
  new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function statusOf(e, now) {
  if (!e.is_open) return { label: 'Ditutup', cls: 'closed' };
  if (isUpcoming(e, now)) return { label: 'Segera dibuka', cls: 'soon' };
  if (e.is_full) return { label: 'Penuh', cls: 'full' };
  return { label: 'Dibuka', cls: 'open' };
}
