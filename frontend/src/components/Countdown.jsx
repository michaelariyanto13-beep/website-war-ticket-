import { useEffect, useState } from 'react';

export default function Countdown({ to, offset = 0, doneText = '🏁 Event sudah dimulai' }) {
  const [now, setNow] = useState(Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  if (!to) return null;
  let diff = new Date(to).getTime() - now;
  if (diff <= 0) return <div className="w-count done">{doneText}</div>;
  const d = Math.floor(diff / 86400000); diff %= 86400000;
  const h = Math.floor(diff / 3600000); diff %= 3600000;
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const box = (n, l) => (
    <div className="w-count-box"><b>{String(n).padStart(2, '0')}</b><span>{l}</span></div>
  );
  return (
    <div className="w-count">
      {box(d, 'Hari')}{box(h, 'Jam')}{box(m, 'Menit')}{box(s, 'Detik')}
    </div>
  );
}
