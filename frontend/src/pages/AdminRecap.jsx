import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { answerText, dateParts, fmtDateTime, statusOf } from '../util.js';
import SlotBar from '../components/SlotBar.jsx';

// Cegah CSV/formula injection: isian peserta seperti "=HYPERLINK(...)" tidak dieksekusi Excel
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const no = (r) => `#${String(r.ticket_no ?? '').padStart(3, '0')}`;
const timeOnly = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'in', label: 'Hadir' },
  { key: 'out', label: 'Belum hadir' },
];

export default function AdminRecap() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState({}); // id baris yang sedang diproses
  const [bulk, setBulk] = useState(false);

  const load = () => api.recap(id).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh: peserta yang di-scan (di HP/tab lain) langsung tercentang hadir
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') api.recap(id).then(setData).catch(() => {}); };
    const t = setInterval(tick, 5000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [id]);

  const rows = data?.registrations ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'in' && !r.checked_in_at) return false;
      if (filter === 'out' && r.checked_in_at) return false;
      if (!s) return true;
      return no(r).includes(s) || Object.values(r.answers).some((v) => String(answerText(v)).toLowerCase().includes(s));
    });
  }, [rows, q, filter]);

  if (!data) return <p className="a-sub">{error || 'Memuat…'}</p>;
  const { event } = data;
  const dp = dateParts(event.event_date);
  const s = statusOf({ ...event, is_full: event.quota !== null && rows.length >= event.quota });
  const left = event.quota === null ? '∞' : Math.max(0, event.quota - rows.length);
  const present = rows.filter((r) => r.checked_in_at).length;
  const emailField = event.fields.find((f) => f.type === 'email');
  const unsent = emailField ? rows.filter((r) => !r.email_sent_at && r.answers?.[emailField.id]).length : 0;

  const patchRow = (row) => setData((d) => ({ ...d, registrations: d.registrations.map((r) => (r.id === row.id ? row : r)) }));
  const withPending = async (rid, fn) => {
    setPending((p) => ({ ...p, [rid]: true }));
    setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setPending((p) => ({ ...p, [rid]: false })); }
  };

  const toggleCheckin = (r) => withPending(r.id, async () => patchRow(await api.setCheckin(r.id, !r.checked_in_at)));
  const resend = (r) => withPending(r.id, async () => {
    const res = await api.resendEmail(r.id);
    patchRow(res.registration);
    setNotice(`Tiket ${no(r)} terkirim ke ${res.to}`);
  });
  const remove = (r) => {
    if (!confirm(`Hapus pendaftar ${no(r)}? Slot akan kembali tersedia.`)) return;
    withPending(r.id, async () => { await api.deleteRegistration(r.id); await load(); });
  };

  const sendPending = async () => {
    setBulk(true); setError(''); setNotice('');
    let sent = 0, failed = 0;
    try {
      // Diproses per batch kecil sampai antrean habis
      for (let i = 0; i < 50; i++) {
        const r = await api.emailPending(event.id);
        sent += r.sent; failed += r.failed;
        setNotice(`Mengirim… ${sent} terkirim${failed ? `, ${failed} gagal` : ''}, sisa ${r.remaining}`);
        if (r.remaining === 0 || r.sent === 0) break;
      }
      setNotice(`Selesai: ${sent} email terkirim${failed ? `, ${failed} gagal (cek pengaturan SMTP)` : ''}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBulk(false);
      load();
    }
  };

  const exportCsv = () => {
    const head = ['No. tiket', 'Waktu daftar', ...event.fields.map((f) => f.label), 'Kehadiran', 'Waktu check-in', 'Email terkirim'];
    const lines = [head, ...rows.map((r) => [
      no(r), fmtDateTime(r.created_at),
      ...event.fields.map((f) => answerText(r.answers[f.id])),
      r.checked_in_at ? 'Hadir' : 'Belum hadir',
      r.checked_in_at ? fmtDateTime(r.checked_in_at) : '',
      r.email_sent_at ? fmtDateTime(r.email_sent_at) : '',
    ])];
    const csv = '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rekap-${event.title.replace(/[^\w-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const summaries = event.fields.filter((f) => f.options).map((f) => {
    const counts = Object.fromEntries(f.options.map((o) => [o, 0]));
    for (const r of rows) {
      const v = r.answers[f.id];
      (Array.isArray(v) ? v : [v]).forEach((x) => { if (x in counts) counts[x]++; });
    }
    return { field: f, counts };
  });

  return (
    <>
      <Link to="/admin" className="a-back">← Dashboard</Link>
      <div className="a-head">
        <div>
          <h1>{event.title}</h1>
          <p className="a-sub">
            <span className={`a-pill ${s.cls}`}>{s.label}</span>{' '}
            {dp ? `${dp.day} ${dp.mon} ${dp.year}, ${dp.time} WIB` : 'Jadwal belum ditentukan'}{event.location && ` · ${event.location}`}
          </p>
        </div>
        <div className="actions">
          <button className="a-btn" onClick={load}>↻ Refresh</button>
          <Link className="a-btn" to={`/admin/events/${event.id}/edit`}>Edit</Link>
          <Link className="a-btn" to={`/admin/scan?event=${event.id}`}>📷 Scan kehadiran</Link>
          <button className="a-btn primary" onClick={exportCsv} disabled={!rows.length}>⬇ Export CSV</button>
        </div>
      </div>
      {error && <p className="alert error">{error}</p>}
      {notice && <p className="a-notice">{notice}</p>}

      <div className="a-kpis four">
        <div className="a-kpi"><span className="ic b">👟</span><div><b>{rows.length}</b><small>Terdaftar</small></div></div>
        <div className="a-kpi"><span className="ic g">✅</span><div><b>{present}</b><small>Hadir{rows.length ? ` (${Math.round((present / rows.length) * 100)}%)` : ''}</small></div></div>
        <div className="a-kpi"><span className="ic">⏳</span><div><b>{rows.length - present}</b><small>Belum hadir</small></div></div>
        <div className="a-kpi"><span className="ic">🎟</span><div><b>{left}</b><small>Slot tersisa</small></div></div>
      </div>
      <div className="a-card"><SlotBar registered={rows.length} quota={event.quota} big /></div>

      {emailField && unsent > 0 && (
        <div className="a-card a-mailbar">
          <div>
            <b>📧 {unsent} peserta belum menerima email tiket</b>
            <small>{data.mail_enabled ? 'Misal tab ditutup sebelum email terkirim, atau SMTP sempat gagal.' : 'SMTP belum dikonfigurasi — isi SMTP_* di Environment Variables.'}</small>
          </div>
          <button className="a-btn primary" onClick={sendPending} disabled={bulk || !data.mail_enabled}>
            {bulk ? 'Mengirim…' : 'Kirim semua'}
          </button>
        </div>
      )}

      {summaries.length > 0 && (
        <>
          <h2 className="a-h2">Ringkasan pilihan</h2>
          <div className="a-sumgrid">
            {summaries.map(({ field, counts }) => (
              <div className="a-card" key={field.id}>
                <h3>{field.label}</h3>
                {Object.entries(counts).map(([opt, n]) => (
                  <div className="a-sumrow" key={opt}>
                    <span>{opt}</span>
                    <div className="w-track"><div className="w-fill" style={{ width: rows.length ? `${(n / rows.length) * 100}%` : 0 }} /></div>
                    <b>{n}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="a-card">
        <div className="a-card-head">
          <h2>Daftar peserta <span className="a-count">{filtered.length}</span></h2>
          <div className="actions">
            <div className="a-seg">
              {FILTERS.map((f) => (
                <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            <input className="a-search" placeholder="🔍 Cari nama / no. tiket…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Kehadiran</th>
                {event.fields.map((f) => <th key={f.id}>{f.label}</th>)}
                <th>Daftar</th>
                {emailField && <th>Email tiket</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={r.checked_in_at ? 'is-in' : ''}>
                  <td className="num">{no(r)}</td>
                  <td>
                    <button className={`a-att ${r.checked_in_at ? 'in' : ''}`} disabled={pending[r.id]} onClick={() => toggleCheckin(r)}
                      title={r.checked_in_at ? 'Klik untuk batalkan check-in' : 'Klik untuk tandai hadir manual'}>
                      {r.checked_in_at ? `✅ Hadir ${timeOnly(r.checked_in_at)}` : '○ Belum'}
                    </button>
                  </td>
                  {event.fields.map((f) => <td key={f.id}>{answerText(r.answers[f.id])}</td>)}
                  <td className="muted">{fmtDateTime(r.created_at)}</td>
                  {emailField && (
                    <td>
                      {r.email_sent_at
                        ? <span className="a-mail ok" title={fmtDateTime(r.email_sent_at)}>✓ Terkirim</span>
                        : r.answers?.[emailField.id] ? <span className="a-mail no">Belum</span> : <span className="muted">—</span>}
                    </td>
                  )}
                  <td>
                    <div className="actions nowrap">
                      {emailField && r.answers?.[emailField.id] && (
                        <button className="a-btn xs" disabled={pending[r.id] || !data.mail_enabled} onClick={() => resend(r)} title="Kirim ulang email tiket">📧</button>
                      )}
                      <button className="a-btn xs danger" disabled={pending[r.id]} onClick={() => remove(r)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={event.fields.length + 5} className="empty">Tidak ada data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
