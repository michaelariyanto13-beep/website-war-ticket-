import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { dateParts, fmtDateTime, gradientFor } from '../util.js';
import TicketQR from '../components/TicketQR.jsx';

export default function TicketPage() {
  const { code } = useParams();
  const [t, setT] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.ticket(code).then(setT).catch((e) => setError(e.message)); }, [code]);

  if (error) {
    return (
      <div className="w-wrap w-success">
        <div className="w-check bad">!</div>
        <h1>{error}</h1>
        <p className="w-sub">Periksa kembali link tiket dari email kamu.</p>
        <Link to="/" className="w-btn">Ke beranda</Link>
      </div>
    );
  }
  if (!t) return <div className="w-wrap"><div className="w-skel tall" /></div>;

  const dp = dateParts(t.event.event_date);
  return (
    <div className="w-wrap w-success">
      <div className="w-ticket">
        <div className="w-ticket-top" style={{ background: gradientFor(t.event.id) }}>
          <span>TIKET PESERTA</span>
          <h3>{t.event.title}</h3>
        </div>
        <div className="w-ticket-qr">
          <TicketQR code={t.ticket_code} size={240} />
          <b>#{String(t.ticket_no ?? '').padStart(3, '0')}</b>
          {t.checked_in_at
            ? <span className="w-badge-in">✅ Sudah check-in · {fmtDateTime(t.checked_in_at)}</span>
            : <small>Tunjukkan QR ini ke panitia saat registrasi ulang</small>}
        </div>
        <div className="w-ticket-body">
          <div><label>Tanggal</label><b>{dp ? `${dp.day} ${dp.mon} ${dp.year}` : '—'}</b></div>
          <div><label>Jam</label><b>{dp ? `${dp.time} WIB` : '—'}</b></div>
          <div className="span2"><label>Lokasi</label><b>{t.event.location || '—'}</b></div>
        </div>
      </div>
      <p className="w-sub small">Jangan bagikan QR ini. Satu QR hanya berlaku untuk satu kali check-in.</p>
      <Link to={`/event/${t.event.id}`} className="w-btn ghost">Lihat info event</Link>
    </div>
  );
}
