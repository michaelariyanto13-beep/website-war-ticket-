import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { usePolling } from '../usePolling.js';
import { dateParts, fmtDate, gradientFor, statusOf, toHtml } from '../util.js';
import SlotBar from '../components/SlotBar.jsx';
import Countdown from '../components/Countdown.jsx';
import RichContent from '../components/RichContent.jsx';

function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.8 + Math.random() * 1.6,
      hue: [18, 45, 150, 200, 330][i % 5],
      rot: Math.random() * 360,
    })), []);
  return (
    <div className="w-confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: `hsl(${b.hue} 95% 60%)`, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}

export default function EventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [loadError, setLoadError] = useState('');

  const load = () => api.getEvent(id).then((d) => { setEvent(d); setLoadError(''); }).catch((e) => setLoadError(e.message));
  usePolling(load, 7000, [id], !done); // kuota live, berhenti setelah berhasil daftar

  if (loadError && !event) return <div className="w-wrap"><p className="alert error">{loadError}</p></div>;
  if (!event) return <div className="w-wrap"><div className="w-skel tall" /></div>;

  const s = statusOf(event);
  const dp = dateParts(event.event_date);
  const canRegister = event.is_open && !event.is_full;

  const set = (fid, v) => setAnswers((a) => ({ ...a, [fid]: v }));
  const toggle = (fid, opt) => {
    const cur = answers[fid] || [];
    set(fid, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setDone(await api.register(id, answers));
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="w-wrap w-success">
        <Confetti />
        <div className="w-check">✓</div>
        <h1>Slot berhasil diamankan!</h1>
        <p className="w-sub">Kamu resmi terdaftar. Sampai jumpa di garis start 🏃</p>
        <div className="w-ticket">
          <div className="w-ticket-top" style={{ background: gradientFor(event.id) }}>
            <span>TIKET PESERTA</span>
            <h3>{event.title}</h3>
          </div>
          <div className="w-ticket-body">
            <div><label>No. peserta</label><b>#{String(done.position).padStart(3, '0')}</b></div>
            <div><label>Tanggal</label><b>{dp ? `${dp.day} ${dp.mon} ${dp.year}` : '—'}</b></div>
            <div><label>Jam</label><b>{dp ? `${dp.time} WIB` : '—'}</b></div>
            <div><label>Lokasi</label><b>{event.location || '—'}</b></div>
          </div>
        </div>
        <p className="w-sub small">Screenshot tiket ini sebagai bukti pendaftaran.</p>
        <Link to="/" className="w-btn">Lihat event lain</Link>
      </div>
    );
  }

  return (
    <div className="w-wrap">
      <Link to="/" className="w-back">← Semua event</Link>

      <div className="w-event">
        <div className="w-event-main">
          <div className="w-banner" style={{ background: gradientFor(event.id) }}>
            <span className={`w-pill ${s.cls}`}>{s.cls === 'open' && <i className="w-dot" />}{s.label}</span>
            <span className="w-banner-icon">🏃‍♂️</span>
            <h1>{event.title}</h1>
          </div>

          <div className="w-info">
            <div className="w-info-item"><span>📅</span><div><label>Tanggal</label><b>{dp ? `${dp.day} ${dp.mon} ${dp.year}` : 'Menyusul'}</b></div></div>
            <div className="w-info-item"><span>🕒</span><div><label>Jam</label><b>{dp ? `${dp.time} WIB` : '—'}</b></div></div>
            <div className="w-info-item"><span>📍</span><div><label>Lokasi</label><b>{event.location || '—'}</b></div></div>
          </div>

          {event.event_date && (
            <div className="w-panel">
              <label className="w-label">Event dimulai dalam</label>
              <Countdown to={event.event_date} />
            </div>
          )}

          {event.description && <RichContent html={event.description} title={event.title} />}
        </div>

        <aside className="w-event-side">
          <div className="w-panel sticky">
            <SlotBar registered={event.registered} quota={event.quota} big />

            {canRegister ? (
              <form onSubmit={submit} className="w-form">
                <h2>Formulir pendaftaran</h2>
                {event.fields.length === 0 && <p className="w-sub small">Tidak ada isian, langsung klik daftar.</p>}
                {event.fields.map((f) => (
                  <div className="field" key={f.id}>
                    <label>{f.label}{f.required && <span className="req"> *</span>}</label>
                    {f.type === 'text' && <input value={answers[f.id] || ''} onChange={(e) => set(f.id, e.target.value)} />}
                    {f.type === 'textarea' && <textarea rows={3} value={answers[f.id] || ''} onChange={(e) => set(f.id, e.target.value)} />}
                    {f.type === 'number' && <input type="number" inputMode="numeric" value={answers[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />}
                    {f.type === 'select' && (
                      <select value={answers[f.id] || ''} onChange={(e) => set(f.id, e.target.value)}>
                        <option value="">Pilih…</option>
                        {f.options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {(f.type === 'radio' || f.type === 'checkbox') && (
                      <div className="w-chips">
                        {f.options.map((o) => {
                          const on = f.type === 'radio' ? answers[f.id] === o : (answers[f.id] || []).includes(o);
                          return (
                            <label key={o} className={`w-chip ${on ? 'on' : ''}`}>
                              <input
                                type={f.type}
                                name={f.id}
                                checked={on}
                                onChange={() => (f.type === 'radio' ? set(f.id, o) : toggle(f.id, o))}
                              />
                              {o}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {error && <p className="alert error">{error}</p>}
                <button className="w-btn big" disabled={busy}>{busy ? 'Memproses…' : '⚡ Daftar sekarang'}</button>
              </form>
            ) : (
              <div className="w-closed">
                <div>{event.is_full ? '😵' : '🔒'}</div>
                <b>{event.is_full ? 'Kuota war sudah penuh' : 'Pendaftaran ditutup'}</b>
                {event.is_full && event.full_message ? (
                  <div className="w-full-msg doc-content" dangerouslySetInnerHTML={{ __html: toHtml(event.full_message) }} />
                ) : (
                  <p className="w-sub small">Pantau event lainnya agar tidak ketinggalan.</p>
                )}
                <Link to="/" className="w-btn ghost">Lihat event lain</Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
