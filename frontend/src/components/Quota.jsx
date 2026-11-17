export default function Quota({ registered, quota }) {
  if (quota === null || quota === undefined) {
    return <div className="quota"><span>{registered} terdaftar · tanpa batas</span></div>;
  }
  const pct = Math.min(100, Math.round((registered / quota) * 100));
  return (
    <div className="quota">
      <div className="bar"><div className={pct >= 100 ? 'fill full' : 'fill'} style={{ width: `${pct}%` }} /></div>
      <span>{registered} / {quota} slot ({Math.max(0, quota - registered)} tersisa)</span>
    </div>
  );
}
