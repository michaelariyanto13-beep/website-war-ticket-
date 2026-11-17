import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../usePolling.js';
import { statusOf } from '../util.js';
import EventCard from '../components/EventCard.jsx';

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'open', label: 'Sedang dibuka' },
  { key: 'soon', label: 'Segera dibuka' },
  { key: 'done', label: 'Penuh / Ditutup' },
];

export default function Home() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  usePolling(() => api.listEvents().then((d) => { setEvents(d); setError(''); }).catch((e) => setError(e.message)), 10000);

  const shown = useMemo(() => {
    if (!events) return [];
    if (tab === 'all') return events;
    return events.filter((e) => {
      const c = statusOf(e).cls;
      return tab === 'done' ? c === 'full' || c === 'closed' : c === tab;
    });
  }, [events, tab]);

  const openCount = events?.filter((e) => statusOf(e).cls === 'open').length ?? 0;
  const totalReg = events?.reduce((n, e) => n + e.registered, 0) ?? 0;

  return (
    <>
      <section className="w-hero">
        <div className="w-blob b1" /><div className="w-blob b2" />
        <div className="w-hero-inner">
          {openCount > 0 && (
            <span className="w-live"><i className="w-dot" /> {openCount} war sedang dibuka</span>
          )}
          <h1>Rebut slotmu.<br /><em>Lari lebih jauh.</em></h1>
          <p>Daftar war ticket lari favoritmu dalam hitungan detik. Pilih event, isi data, dan amankan slot sebelum kehabisan.</p>
          <div className="w-hero-stats">
            <div><b>{events ? events.length : '–'}</b><span>Event</span></div>
            <div><b>{events ? openCount : '–'}</b><span>Dibuka</span></div>
            <div><b>{events ? totalReg : '–'}</b><span>Pelari terdaftar</span></div>
          </div>
        </div>
      </section>

      <section className="w-section" id="events">
        <div className="w-section-head">
          <h2>Event war</h2>
          <div className="w-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
        </div>

        {error && !events && <p className="alert error">{error}</p>}

        {!events && !error && (
          <div className="w-grid">
            {[0, 1, 2].map((i) => <div key={i} className="w-skel" />)}
          </div>
        )}

        {events && shown.length === 0 && (
          <div className="w-empty">
            <div>🏁</div>
            <p>{events.length === 0 ? 'Belum ada event war. Pantau terus ya!' : 'Tidak ada event di kategori ini.'}</p>
          </div>
        )}

        <div className="w-grid">
          {shown.map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      </section>
    </>
  );
}
