export default function SlotBar({ registered, quota, big = false }) {
  if (quota === null || quota === undefined) {
    return (
      <div className={`w-slots ${big ? 'big' : ''}`}>
        <div className="w-slots-text"><b>{registered}</b> peserta terdaftar</div>
        <div className="w-track"><div className="w-fill" style={{ width: '100%', opacity: .35 }} /></div>
        <div className="w-slots-sub">Tanpa batas slot</div>
      </div>
    );
  }
  const left = Math.max(0, quota - registered);
  const pct = Math.min(100, Math.round((registered / quota) * 100));
  const hot = left > 0 && (left <= 5 || pct >= 85);
  return (
    <div className={`w-slots ${big ? 'big' : ''} ${hot ? 'hot' : ''} ${left === 0 ? 'full' : ''}`}>
      <div className="w-slots-text">
        {left === 0 ? <b>Slot habis</b> : <><b>{left}</b> slot tersisa</>}
        <span>{registered}/{quota}</span>
      </div>
      <div className="w-track"><div className="w-fill" style={{ width: `${pct}%` }} /></div>
      {hot && <div className="w-slots-sub hotmsg">🔥 Hampir penuh — buruan war!</div>}
    </div>
  );
}
