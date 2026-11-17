import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { dateParts, fmtOpenAt, gradientFor, statusOf } from '../util.js';
import SlotBar from '../components/SlotBar.jsx';

export default function AdminDashboard() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.adminEvents().then(setEvents).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggle = async (e) => {
    try { await api.setOpen(e.id, !e.is_open); load(); } catch (err) { setError(err.message); }
  };
  const remove = async (e) => {
    if (!confirm(`Hapus event "${e.title}" beserta SEMUA pendaftarnya?`)) return;
    try { await api.deleteEvent(e.id); load(); } catch (err) { setError(err.message); }
  };

  if (!events) return <p className="a-sub">{error || 'Memuat…'}</p>;

  const totalReg = events.reduce((n, e) => n + e.registered, 0);
  const active = events.filter((e) => statusOf(e).cls === 'open').length;

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Dashboard</h1>
          <p className="a-sub">Ringkasan semua event war kamu.</p>
        </div>
        <Link to="/admin/events/new" className="a-btn primary">+ Buat war baru</Link>
      </div>

      {error && <p className="alert error">{error}</p>}

      <div className="a-kpis">
        <div className="a-kpi"><span className="ic">🏁</span><div><b>{events.length}</b><small>Total event</small></div></div>
        <div className="a-kpi"><span className="ic g">🟢</span><div><b>{active}</b><small>Sedang dibuka</small></div></div>
        <div className="a-kpi"><span className="ic b">👟</span><div><b>{totalReg}</b><small>Total pendaftar</small></div></div>
      </div>

      {events.length === 0 && (
        <div className="a-empty">
          <div>🏃</div>
          <p>Belum ada event. Buat war pertamamu!</p>
          <Link to="/admin/events/new" className="a-btn primary">+ Buat war baru</Link>
        </div>
      )}

      <div className="a-list">
        {events.map((e) => {
          const s = statusOf(e);
          const dp = dateParts(e.event_date);
          return (
            <div key={e.id} className="a-row">
              <div className="a-row-date" style={{ background: gradientFor(e.id) }}>
                {dp ? <><b>{dp.day}</b><span>{dp.mon}</span></> : <b>?</b>}
              </div>
              <div className="a-row-main">
                <div className="a-row-title">
                  <h3>{e.title}</h3>
                  <span className={`a-pill ${s.cls}`}>{s.label}</span>
                </div>
                <p className="a-sub">{dp ? `${dp.time} WIB` : 'Jadwal belum ditentukan'}{e.location && ` · ${e.location}`}
                  {s.cls === 'soon' && <> · ⏰ War dibuka {fmtOpenAt(e.open_at)} WIB</>}</p>
                <SlotBar registered={e.registered} quota={e.quota} />
              </div>
              <div className="a-row-actions">
                <Link className="a-btn primary sm" to={`/admin/events/${e.id}/recap`}>Rekap</Link>
                <Link className="a-btn sm" to={`/admin/events/${e.id}/edit`}>Edit</Link>
                <button className="a-btn sm" onClick={() => toggle(e)}>{e.is_open ? 'Tutup' : 'Buka'}</button>
                <button className="a-btn sm danger" onClick={() => remove(e)}>Hapus</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
