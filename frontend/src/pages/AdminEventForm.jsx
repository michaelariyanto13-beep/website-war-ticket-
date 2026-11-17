import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtOpenAt, newFieldId, toLocalInput } from '../util.js';
import RichEditor from '../components/RichEditor.jsx';

const TYPES = [
  { value: 'text', label: 'Teks singkat (ketik)' },
  { value: 'textarea', label: 'Teks panjang (ketik)' },
  { value: 'number', label: 'Angka (ketik)' },
  { value: 'email', label: 'Email (tiket QR dikirim ke sini)' },
  { value: 'select', label: 'Pilihan — dropdown' },
  { value: 'radio', label: 'Pilihan — pilih satu' },
  { value: 'checkbox', label: 'Pilihan — banyak' },
];
const isChoice = (t) => ['select', 'radio', 'checkbox'].includes(t);

const blank = () => ({
  title: '', description: '', full_message: '', location: '', event_date: '', quota: '', is_open: true,
  open_mode: 'now', open_at: '',
  fields: [
    { id: newFieldId(), label: 'Nama lengkap', type: 'text', required: true, options: [] },
    { id: newFieldId(), label: 'Email', type: 'email', required: true, options: [] },
    { id: newFieldId(), label: 'Nomor WhatsApp', type: 'text', required: true, options: [] },
    { id: newFieldId(), label: 'Ukuran jersey', type: 'select', required: true, options: ['S', 'M', 'L', 'XL'] },
  ],
});

export default function AdminEventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(id ? null : blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.recap(id).then(({ event }) =>
      setForm({
        ...event,
        event_date: toLocalInput(event.event_date),
        open_mode: event.open_at && new Date(event.open_at) > new Date() ? 'later' : 'now',
        open_at: event.open_at && new Date(event.open_at) > new Date() ? toLocalInput(event.open_at) : '',
        quota: event.quota ?? '',
        full_message: event.full_message ?? '',
        fields: event.fields.map((f) => ({ options: [], ...f })),
      })
    ).catch((e) => setError(e.message));
  }, [id]);

  if (!form) return <p className="a-sub">{error || 'Memuat…'}</p>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (i, patch) => set('fields', form.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i, d) => {
    const arr = [...form.fields];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set('fields', arr);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.open_mode === 'later' && !form.open_at) {
      setError('Isi tanggal & jam war dibuka, atau pilih "Sekarang"');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    const { open_mode: _mode, ...rest } = form;
    const payload = {
      ...rest,
      open_at: form.open_mode === 'later' ? new Date(form.open_at).toISOString() : null,
      quota: form.quota === '' ? null : Number(form.quota),
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
      fields: form.fields.map((f) => ({
        id: f.id, label: f.label, type: f.type, required: f.required,
        ...(isChoice(f.type) ? { options: f.options } : {}),
      })),
    };
    try {
      if (id) await api.updateEvent(id, payload); else await api.createEvent(payload);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Link to="/admin" className="a-back">← Dashboard</Link>
      <div className="a-head">
        <div>
          <h1>{id ? 'Edit war' : 'Buat war baru'}</h1>
          <p className="a-sub">Atur info event, deskripsi, dan formulir pendaftaran.</p>
        </div>
      </div>
      {error && <p className="alert error">{error}</p>}

      <div className="a-two">
        <div className="a-col">
          <section className="a-card">
            <h2>Informasi dasar</h2>
            <div className="field">
              <label>Nama event *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Mis. Jakarta Marathon 10K" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Deskripsi event</label>
              <RichEditor value={form.description} onChange={(v) => set('description', v)} />
              <small className="a-hint">Tampil ke peserta sebagai dokumen. Gunakan Judul 1/2/3 agar otomatis jadi daftar isi.</small>
            </div>
          </section>

          <section className="a-card">
            <div className="a-card-head">
              <div>
                <h2>Isian formulir</h2>
                <p className="a-sub">Apa yang harus diisi peserta: ketik manual atau pilihan.</p>
              </div>
              <button type="button" className="a-btn sm" onClick={() => set('fields', [...form.fields, { id: newFieldId(), label: '', type: 'text', required: false, options: [] }])}>
                + Tambah isian
              </button>
            </div>
            {form.fields.length === 0 && <p className="a-sub">Belum ada isian. Peserta cukup klik daftar.</p>}
            {!form.fields.some((f) => f.type === 'email') && (
              <p className="a-warn">📧 Belum ada isian bertipe <b>Email</b> — peserta tidak akan menerima tiket QR lewat email (QR tetap tampil di layar setelah daftar).</p>
            )}
            {form.fields.map((f, i) => (
              <div className="a-field-item" key={f.id}>
                <div className="a-field-num">{i + 1}</div>
                <div className="a-field-body">
                  <div className="row">
                    <div className="field grow"><label>Label</label><input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Mis. Nama lengkap" /></div>
                    <div className="field grow"><label>Tipe</label>
                      <select value={f.type} onChange={(e) => setField(i, { type: e.target.value })}>
                        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {isChoice(f.type) && (
                    <div className="field">
                      <label>Pilihan (satu per baris)</label>
                      <textarea rows={3} value={f.options.join('\n')} onChange={(e) => setField(i, { options: e.target.value.split('\n') })} />
                    </div>
                  )}
                  <div className="row between">
                    <label className="a-check"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Wajib diisi</label>
                    <div className="actions">
                      <button type="button" className="a-btn xs" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                      <button type="button" className="a-btn xs" onClick={() => move(i, 1)} disabled={i === form.fields.length - 1}>↓</button>
                      <button type="button" className="a-btn xs danger" onClick={() => set('fields', form.fields.filter((_, j) => j !== i))}>Hapus</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="a-card">
            <div className="a-card-head">
              <div>
                <h2>😵 Pesan saat slot penuh</h2>
                <p className="a-sub">
                  Begitu kuota habis, formulir otomatis hilang dan peserta melihat pesan ini.
                  Kosongkan untuk memakai pesan standar.
                </p>
              </div>
              {form.quota === '' && <span className="a-pill closed">Tanpa limit — pesan ini tidak akan tampil</span>}
            </div>
            <RichEditor
              compact
              value={form.full_message}
              onChange={(v) => set('full_message', v)}
              placeholder="Mis. Terima kasih! Slot war sudah habis. Gabung grup WA untuk info slot tambahan / waiting list…"
            />
          </section>
        </div>

        <aside className="a-col">
          <div className="a-card a-sticky">
            <h2>Pengaturan</h2>
            <div className="field"><label>Tanggal & jam</label><input type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} /></div>
            <div className="field"><label>Lokasi</label><input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Mis. GBK, Jakarta" /></div>
            <div className="field">
              <label>Limit peserta war</label>
              <input type="number" min="1" value={form.quota} onChange={(e) => set('quota', e.target.value)} placeholder="Kosong = tanpa batas" />
            </div>
            <div className="field">
              <label>War dibuka</label>
              <div className="a-seg two">
                <button type="button" className={form.open_mode === 'now' ? 'on' : ''} onClick={() => set('open_mode', 'now')}>⚡ Sekarang</button>
                <button type="button" className={form.open_mode === 'later' ? 'on' : ''} onClick={() => set('open_mode', 'later')}>⏰ Jadwalkan</button>
              </div>
              {form.open_mode === 'later' && (
                <>
                  <input type="datetime-local" style={{ marginTop: '.5rem' }} value={form.open_at} onChange={(e) => set('open_at', e.target.value)} />
                  <small className="a-hint">
                    {form.open_at
                      ? `Formulir otomatis terbuka ${fmtOpenAt(new Date(form.open_at).toISOString())} WIB. Sebelumnya peserta melihat hitung mundur.`
                      : 'Pilih tanggal & jam war mulai.'}
                  </small>
                </>
              )}
            </div>
            <label className="a-switch">
              <input type="checkbox" checked={form.is_open} onChange={(e) => set('is_open', e.target.checked)} />
              <span className="knob" />
              <div><b>Pendaftaran dibuka</b><small>{form.is_open ? 'Peserta bisa mendaftar' : 'Ditutup sementara'}</small></div>
            </label>
            <div className="a-actions">
              <button className="a-btn primary full" disabled={busy}>{busy ? 'Menyimpan…' : id ? 'Simpan perubahan' : 'Terbitkan war'}</button>
              <button type="button" className="a-btn full" onClick={() => navigate('/admin')}>Batal</button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
