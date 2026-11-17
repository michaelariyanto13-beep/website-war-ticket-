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

export default function AdminRecap() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = () => api.recap(id).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const rows = data?.registrations ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => Object.values(r.answers).some((v) => String(answerText(v)).toLowerCase().includes(s)));
  }, [rows, q]);

  if (!data) return <p className="a-sub">{error || 'Memuat…'}</p>;
  const { event } = data;
  const dp = dateParts(event.event_date);
  const s = statusOf({ ...event, is_full: event.quota !== null && rows.length >= event.quota });
  const left = event.quota === null ? '∞' : Math.max(0, event.quota - rows.length);
  const pct = event.quota ? Math.min(100, Math.round((rows.length / event.quota) * 100)) : null;

  const summaries = event.fields.filter((f) => f.options).map((f) => {
    const counts = Object.fromEntries(f.options.map((o) => [o, 0]));
    for (const r of rows) {
      const v = r.answers[f.id];
      (Array.isArray(v) ? v : [v]).forEach((x) => { if (x in counts) counts[x]++; });
    }
    return { field: f, counts };
  });

  const exportCsv = () => {
    const head = ['No', 'Waktu daftar', ...event.fields.map((f) => f.label)];
    const lines = [head, ...rows.map((r, i) => [i + 1, fmtDateTime(r.created_at), ...event.fields.map((f) => answerText(r.answers[f.id]))])];
    const csv = '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `rekap-${event.title.replace(/[^\w-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const remove = async (r) => {
    if (!confirm('Hapus pendaftar ini? Slot akan kembali tersedia.')) return;
    try { await api.deleteRegistration(r.id); load(); } catch (e) { setError(e.message); }
  };

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
          <button className="a-btn primary" onClick={exportCsv} disabled={!rows.length}>⬇ Export CSV</button>
        </div>
      </div>
      {error && <p className="alert error">{error}</p>}

      <div className="a-kpis four">
        <div className="a-kpi"><span className="ic b">👟</span><div><b>{rows.length}</b><small>Terdaftar</small></div></div>
        <div className="a-kpi"><span className="ic g">🎟</span><div><b>{left}</b><small>Slot tersisa</small></div></div>
        <div className="a-kpi"><span className="ic">📈</span><div><b>{pct === null ? '—' : `${pct}%`}</b><small>Terisi</small></div></div>
        <div className="a-kpi"><span className="ic">🎯</span><div><b>{event.quota ?? '∞'}</b><small>Limit war</small></div></div>
      </div>
      <div className="a-card"><SlotBar registered={rows.length} quota={event.quota} big /></div>

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
          <input className="a-search" placeholder="🔍 Cari peserta…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>#</th><th>Waktu daftar</th>
                {event.fields.map((f) => <th key={f.id}>{f.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="num">{rows.indexOf(r) + 1}</td>
                  <td>{fmtDateTime(r.created_at)}</td>
                  {event.fields.map((f) => <td key={f.id}>{answerText(r.answers[f.id])}</td>)}
                  <td><button className="a-btn xs danger" onClick={() => remove(r)}>Hapus</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={event.fields.length + 3} className="empty">Belum ada pendaftar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
