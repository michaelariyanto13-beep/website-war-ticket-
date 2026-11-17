import { useEffect, useMemo, useRef, useState } from 'react';
import { toHtml } from '../util.js';

/** Tampilan deskripsi gaya dokumen (paper + outline otomatis dari heading). */
export default function RichContent({ html, title }) {
  const content = useMemo(() => toHtml(html), [html]);
  const ref = useRef(null);
  const [heads, setHeads] = useState([]);

  useEffect(() => {
    const hs = [...ref.current.querySelectorAll('h1,h2,h3')];
    hs.forEach((h, i) => { h.id = `sec-${i}`; });
    setHeads(hs.map((h, i) => ({ id: `sec-${i}`, text: h.textContent, level: Number(h.tagName[1]) })));
  }, [content]);

  const words = useMemo(() => content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length, [content]);
  const minutes = Math.max(1, Math.round(words / 200));

  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <article className="w-doc">
      <header className="w-doc-bar">
        <span className="w-doc-ico">📄</span>
        <div>
          <b>{title || 'Informasi event'}</b>
          <small>Informasi lengkap · {minutes} menit baca</small>
        </div>
      </header>

      {heads.length > 1 && (
        <nav className="w-doc-outline" aria-label="Isi dokumen">
          <span>Isi:</span>
          {heads.map((h) => (
            <button key={h.id} className={`l${h.level}`} onClick={() => jump(h.id)}>{h.text}</button>
          ))}
        </nav>
      )}

      <div className="w-doc-desk">
        <div className="w-doc-page doc-content" ref={ref} dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </article>
  );
}
