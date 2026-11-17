import { Link } from 'react-router-dom';
import { dateParts, fmtOpenAt, gradientFor, statusOf } from '../util.js';
import SlotBar from './SlotBar.jsx';

export default function EventCard({ e }) {
  const s = statusOf(e);
  const dp = dateParts(e.event_date);
  const active = s.cls === 'open';
  const soon = s.cls === 'soon';
  return (
    <Link to={`/event/${e.id}`} className={`w-card ${active || soon ? '' : 'dim'}`}>
      <div className="w-card-cover" style={{ background: gradientFor(e.id) }}>
        <span className="w-run-icon">🏃</span>
        <span className={`w-pill ${s.cls}`}>{active && <i className="w-dot" />}{s.label}</span>
        {dp && (
          <div className="w-date">
            <b>{dp.day}</b><span>{dp.mon}</span>
          </div>
        )}
      </div>
      <div className="w-card-body">
        <h3>{e.title}</h3>
        <p className="w-meta">
          {dp ? `🕒 ${dp.time} WIB` : '🕒 Jadwal menyusul'}
          {e.location && <> · 📍 {e.location}</>}
        </p>
        {soon && <p className="w-soon">⏰ War dibuka {fmtOpenAt(e.open_at)} WIB</p>}
        <SlotBar registered={e.registered} quota={e.quota} />
        <span className="w-cta">{active ? 'War sekarang' : soon ? 'Lihat hitung mundur' : 'Lihat detail'} <i>→</i></span>
      </div>
    </Link>
  );
}
