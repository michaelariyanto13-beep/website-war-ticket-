import { useEffect, useRef } from 'react';

/**
 * Jalankan fn sekarang lalu tiap `ms`. Berhenti saat tab tidak terlihat
 * (hemat server saat war) dan langsung refresh ketika tab aktif lagi.
 */
export function usePolling(fn, ms, deps = [], enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => { if (!document.hidden) ref.current(); };
    ref.current();
    const t = setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, enabled, ...deps]);
}
