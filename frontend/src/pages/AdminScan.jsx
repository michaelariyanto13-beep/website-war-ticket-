import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { api } from '../api.js';
import { answerText, fmtDateTime } from '../util.js';

const READER_ID = 'qr-reader';

// Nada pendek: berhasil = tinggi, gagal = rendah
function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.15;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + (ok ? 0.15 : 0.35));
    navigator.vibrate?.(ok ? 80 : [80, 60, 80]);
  } catch { /* abaikan */ }
}

const STATUS = {
  ok: { cls: 'ok', icon: '✅', title: 'Check-in berhasil' },
  already: { cls: 'warn', icon: '⚠️', title: 'Sudah check-in sebelumnya' },
  wrong_event: { cls: 'bad', icon: '⛔', title: 'Tiket untuk event lain' },
  invalid: { cls: 'bad', icon: '❌', title: 'Tiket tidak valid' },
  error: { cls: 'bad', icon: '❌', title: 'Gagal memeriksa tiket' },
};

export default function AdminScan() {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const eventId = params.get('event') || '';
  const [running, setRunning] = useState(false);
  const [camError, setCamError] = useState('');
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  const scanner = useRef(null);
  const lastScan = useRef({ text: '', at: 0 });
  const busyRef = useRef(false);
  const eventRef = useRef(eventId);
  eventRef.current = eventId;

  useEffect(() => { api.adminEvents().then(setEvents).catch(() => {}); }, []);

  const check = useCallback(async (text) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await api.checkin(text, eventRef.current || undefined);
      setResult(r);
      beep(r.status === 'ok');
      setLog((l) => [{ ...r, at: Date.now() }, ...l].slice(0, 15));
    } catch (e) {
      const r = { status: e.data?.status || 'error', error: e.message, ...e.data };
      setResult(r);
      beep(false);
      setLog((l) => [{ ...r, at: Date.now() }, ...l].slice(0, 15));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const onDecoded = useCallback((text) => {
    const now = Date.now();
    // Abaikan QR sama yang terbaca berulang dalam 3 detik
    if (text === lastScan.current.text && now - lastScan.current.at < 3000) return;
    lastScan.current = { text, at: now };
    check(text);
  }, [check]);

  const start = async () => {
    setCamError('');
    try {
      if (!scanner.current) {
        scanner.current = new Html5Qrcode(READER_ID, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      }
      await scanner.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        onDecoded,
        () => {}
      );
      setRunning(true);
    } catch (e) {
      setCamError(
        String(e).includes('NotAllowed') || String(e).includes('Permission')
          ? 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu coba lagi.'
          : 'Kamera tidak bisa dibuka. Pastikan membuka situs lewat HTTPS dan tidak dipakai aplikasi lain.'
      );
    }
  };

  const stop = async () => {
    try { if (scanner.current?.isScanning) await scanner.current.stop(); } catch { /* abaikan */ }
    setRunning(false);
  };

  useEffect(() => () => { stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitManual = (e) => {
    e.preventDefault();
    if (manual.trim()) { check(manual.trim()); setManual(''); }
  };

  const st = result ? STATUS[result.status] || STATUS.error : null;
  const fields = result?.event?.fields || [];
  const reg = result?.registration;

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Scan kehadiran</h1>
          <p className="a-sub">Arahkan kamera ke QR tiket peserta. Tiket otomatis ditandai hadir.</p>
        </div>
        <select className="a-scan-event" value={eventId} onChange={(e) => setParams(e.target.value ? { event: e.target.value } : {})}>
          <option value="">Semua event</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>
      </div>

      <div className="a-scan">
        <div className="a-card a-scan-cam">
          <div id={READER_ID} className={`a-reader ${running ? 'on' : ''}`} />
          {!running && (
            <div className="a-reader-idle">
              <div>📷</div>
              <p>Kamera belum aktif</p>
            </div>
          )}
          {camError && <p className="alert error">{camError}</p>}
          <div className="a-scan-ctrl">
            {running
              ? <button className="a-btn full" onClick={stop}>⏹ Matikan kamera</button>
              : <button className="a-btn primary full" onClick={start}>▶ Mulai scan</button>}
          </div>
          <form className="a-manual" onSubmit={submitManual}>
            <input placeholder="Atau ketik / tempel kode tiket" value={manual} onChange={(e) => setManual(e.target.value)} />
            <button className="a-btn" disabled={busy}>Cek</button>
          </form>
        </div>

        <div className="a-scan-side">
          <div className={`a-card a-result ${st ? st.cls : 'idle'}`}>
            {!st && <p className="a-sub">Hasil scan akan muncul di sini.</p>}
            {st && (
              <>
                <div className="a-result-head">
                  <span className="a-result-icon">{st.icon}</span>
                  <div>
                    <b>{st.title}</b>
                    {result.error && <small>{result.error}</small>}
                    {result.status === 'already' && reg?.checked_in_at && <small>Pada {fmtDateTime(reg.checked_in_at)}</small>}
                  </div>
                </div>
                {reg && (
                  <div className="a-result-body">
                    <div className="a-result-no">#{String(reg.ticket_no ?? '').padStart(3, '0')}</div>
                    <div className="a-result-event">{result.event?.title}</div>
                    <dl>
                      {fields.map((f) => (
                        <div key={f.id}><dt>{f.label}</dt><dd>{answerText(reg.answers?.[f.id]) || '—'}</dd></div>
                      ))}
                    </dl>
                  </div>
                )}
                {result.stats && (
                  <div className="a-result-stats">Hadir <b>{result.stats.checked_in}</b> / {result.stats.registered} peserta</div>
                )}
              </>
            )}
          </div>

          {log.length > 0 && (
            <div className="a-card">
              <h3>Riwayat scan</h3>
              <ul className="a-log">
                {log.map((l, i) => {
                  const s = STATUS[l.status] || STATUS.error;
                  const nameField = (l.event?.fields || []).find((f) => f.type === 'text');
                  const name = nameField ? l.registration?.answers?.[nameField.id] : '';
                  return (
                    <li key={i} className={s.cls}>
                      <span>{s.icon}</span>
                      <div>
                        <b>{l.registration ? `#${String(l.registration.ticket_no ?? '').padStart(3, '0')} ${name || ''}` : s.title}</b>
                        <small>{new Date(l.at).toLocaleTimeString('id-ID')} · {s.title}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
