import sanitizeHtml from 'sanitize-html';

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i, /^inherit$/i];

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code',
    'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'img', 'span', 'mark', 'pre',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    span: ['style'],
    mark: ['style', 'data-color'],
    p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
  },
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

/** Bersihkan HTML dari editor. Return '' bila kosong. */
export function sanitizeRich(html) {
  const clean = sanitizeHtml(String(html ?? ''), OPTIONS).trim();
  const hasText = clean.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
  const hasMedia = /<(img|hr)\b/.test(clean);
  return hasText || hasMedia ? clean : '';
}
