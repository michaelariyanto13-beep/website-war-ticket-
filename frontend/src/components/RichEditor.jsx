import { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit'; // v3: sudah termasuk Underline, Link, UndoRedo
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';
import { toHtml } from '../util.js';

const TEXT_COLORS = ['#1f2430', '#6b7280', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
const MARKS = ['#fef08a', '#fed7aa', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff'];

function Btn({ active, disabled, title, onClick, children, wide }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`re-btn ${active ? 'on' : ''} ${wide ? 'wide' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ColorMenu({ label, title, colors, onPick, onReset }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="re-menu">
      <Btn title={title} onClick={() => setOpen((o) => !o)} wide>{label}</Btn>
      {open && (
        <>
          <div className="re-backdrop" onClick={() => setOpen(false)} />
          <div className="re-pop">
            <div className="re-swatches">
              {colors.map((c) => (
                <button type="button" key={c} className="re-swatch" style={{ background: c }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onPick(c); setOpen(false); }} />
              ))}
            </div>
            <label className="re-custom">
              Warna lain
              <input type="color" onChange={(e) => onPick(e.target.value)} />
            </label>
            <button type="button" className="re-reset" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onReset(); setOpen(false); }}>Hapus warna</button>
          </div>
        </>
      )}
    </div>
  );
}

function Toolbar({ editor }) {
  if (!editor) return null;
  const c = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes('link').href || 'https://';
    const url = window.prompt('Alamat link (kosongkan untuk menghapus):', prev);
    if (url === null) return;
    if (url.trim() === '') return c().extendMarkRange('link').unsetLink().run();
    c().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };
  const addImage = () => {
    const url = window.prompt('URL gambar (https://…):');
    if (url && /^https?:\/\//i.test(url.trim())) c().setImage({ src: url.trim() }).run();
  };

  const heading = editor.isActive('heading', { level: 1 }) ? '1'
    : editor.isActive('heading', { level: 2 }) ? '2'
    : editor.isActive('heading', { level: 3 }) ? '3' : '0';
  const setHeading = (v) => (v === '0' ? c().setParagraph().run() : c().toggleHeading({ level: Number(v) }).run());

  return (
    <div className="re-toolbar">
      <Btn title="Urungkan" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>↶</Btn>
      <Btn title="Ulangi" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>↷</Btn>
      <span className="re-sep" />
      <select className="re-select" value={heading} onChange={(e) => setHeading(e.target.value)} title="Gaya teks">
        <option value="0">Teks biasa</option>
        <option value="1">Judul 1</option>
        <option value="2">Judul 2</option>
        <option value="3">Judul 3</option>
      </select>
      <span className="re-sep" />
      <Btn title="Tebal" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Miring" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Garis bawah" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Coret" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <ColorMenu label={<span className="re-a">A<i /></span>} title="Warna teks" colors={TEXT_COLORS}
        onPick={(col) => c().setColor(col).run()} onReset={() => c().unsetColor().run()} />
      <ColorMenu label="🖍" title="Stabilo" colors={MARKS}
        onPick={(col) => c().setHighlight({ color: col }).run()} onReset={() => c().unsetHighlight().run()} />
      <span className="re-sep" />
      <Btn title="Rata kiri" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}>⇤</Btn>
      <Btn title="Tengah" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}>≡</Btn>
      <Btn title="Rata kanan" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}>⇥</Btn>
      <Btn title="Rata kiri-kanan" active={editor.isActive({ textAlign: 'justify' })} onClick={() => c().setTextAlign('justify').run()}>☰</Btn>
      <span className="re-sep" />
      <Btn title="Daftar poin" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>• ≡</Btn>
      <Btn title="Daftar angka" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1.</Btn>
      <Btn title="Kutipan" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
      <span className="re-sep" />
      <Btn title="Link" active={editor.isActive('link')} onClick={setLink}>🔗</Btn>
      <Btn title="Gambar (URL)" onClick={addImage}>🖼</Btn>
      <Btn title="Garis pemisah" onClick={() => c().setHorizontalRule().run()}>—</Btn>
      <Btn title="Hapus format" onClick={() => c().unsetAllMarks().clearNodes().run()}>✕</Btn>
    </div>
  );
}

export default function RichEditor({
  value,
  onChange,
  compact = false,
  placeholder = 'Tulis informasi event di sini — syarat, rute, jadwal, racepack, dll…',
}) {
  const editor = useEditor({
    shouldRerenderOnTransaction: true, // v3 default false → toolbar perlu tahu status aktif
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: toHtml(value),
    editorProps: { attributes: { class: 'doc-content' } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });

  return (
    <div className={`re ${compact ? 'compact' : ''}`}>
      <Toolbar editor={editor} />
      <div className="re-paper-wrap">
        <div className="re-paper"><EditorContent editor={editor} /></div>
      </div>
    </div>
  );
}
