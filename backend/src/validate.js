import { sanitizeRich } from './sanitize.js';

export const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'select', 'radio', 'checkbox'];
// Ketat & sederhana (tanpa komentar/quote RFC 5322) agar aman diteruskan ke SMTP
const EMAIL_RE = /^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/;
const CHOICE_TYPES = ['select', 'radio', 'checkbox'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Validasi + normalisasi data event dari admin. Return { error } atau { value }. */
export function validateEventInput(body) {
  const title = str(body.title);
  if (!title) return { error: 'Judul wajib diisi' };
  if (title.length > 200) return { error: 'Judul terlalu panjang' };

  const description = sanitizeRich(body.description);
  if (description.length > 120000) return { error: 'Deskripsi terlalu panjang' };

  const full_message = sanitizeRich(body.full_message);
  if (full_message.length > 50000) return { error: 'Pesan slot penuh terlalu panjang' };

  let quota = null;
  if (body.quota !== null && body.quota !== undefined && body.quota !== '') {
    quota = Number(body.quota);
    if (!Number.isInteger(quota) || quota < 1) return { error: 'Limit harus bilangan bulat ≥ 1 (kosongkan untuk tanpa batas)' };
  }

  let event_date = null;
  if (body.event_date) {
    const d = new Date(body.event_date);
    if (Number.isNaN(d.getTime())) return { error: 'Tanggal tidak valid' };
    event_date = d.toISOString();
  }

  if (!Array.isArray(body.fields)) return { error: 'fields harus array' };
  if (body.fields.length > 30) return { error: 'Maksimal 30 isian' };
  const seen = new Set();
  const fields = [];
  for (const [i, f] of body.fields.entries()) {
    const label = str(f?.label);
    if (!label) return { error: `Isian #${i + 1}: label wajib diisi` };
    if (!FIELD_TYPES.includes(f.type)) return { error: `Isian "${label}": tipe tidak valid` };
    const id = str(f.id);
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id) || seen.has(id)) return { error: `Isian "${label}": id tidak valid/duplikat` };
    seen.add(id);
    const field = { id, label, type: f.type, required: !!f.required };
    if (CHOICE_TYPES.includes(f.type)) {
      const options = [...new Set((Array.isArray(f.options) ? f.options : []).map(str).filter(Boolean))];
      if (options.length < 1) return { error: `Isian "${label}": minimal 1 pilihan` };
      field.options = options;
    }
    fields.push(field);
  }

  return {
    value: {
      title,
      description,
      full_message,
      location: str(body.location),
      event_date,
      quota,
      is_open: body.is_open !== false,
      fields,
    },
  };
}

/** Validasi jawaban peserta terhadap definisi form. Return { error } atau { value }. */
export function validateAnswers(fields, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { error: 'Format jawaban salah' };
  const out = {};
  for (const f of fields) {
    const raw = answers[f.id];
    let val;
    if (f.type === 'checkbox') {
      const arr = Array.isArray(raw) ? raw : [];
      if (arr.some((x) => !f.options.includes(x))) return { error: `Pilihan "${f.label}" tidak valid` };
      val = [...new Set(arr)];
      if (f.required && val.length === 0) return { error: `"${f.label}" wajib diisi` };
    } else if (f.type === 'select' || f.type === 'radio') {
      val = str(raw);
      if (val && !f.options.includes(val)) return { error: `Pilihan "${f.label}" tidak valid` };
      if (f.required && !val) return { error: `"${f.label}" wajib diisi` };
    } else if (f.type === 'email') {
      val = str(raw).toLowerCase();
      if (val && (val.length > 254 || !EMAIL_RE.test(val))) return { error: `"${f.label}" bukan alamat email yang valid` };
      if (f.required && !val) return { error: `"${f.label}" wajib diisi` };
    } else if (f.type === 'number') {
      val = raw === '' || raw === null || raw === undefined ? '' : Number(raw);
      if (val !== '' && !Number.isFinite(val)) return { error: `"${f.label}" harus angka` };
      if (f.required && val === '') return { error: `"${f.label}" wajib diisi` };
    } else {
      val = str(raw);
      if (val.length > 2000) return { error: `"${f.label}" terlalu panjang` };
      if (f.required && !val) return { error: `"${f.label}" wajib diisi` };
    }
    out[f.id] = val;
  }
  return { value: out };
}
