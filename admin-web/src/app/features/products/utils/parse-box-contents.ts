const HEADINGS = new Set([
  "what's in the box",
  'whats in the box',
  'what is in the box',
  'what’s in the box',
  'box contents',
  'box content',
  'package includes',
  'package contents',
  'in the box',
  'in the package',
  'contents of the box',
]);

const BULLET_PREFIX = /^(?:[-•*·–—▪▸►]|\u2022|\u2023|\u25E6)\s+/;
/** Numbered list markers only (1. / 1)) — does not strip quantity prefixes like "1 x". */
const NUMBERED_LIST_PREFIX = /^\d+[.)]\s+/;

/**
 * Parse Amazon-style "What's in the box" / Box Contents paste into editable list items.
 * Each source line becomes one item. Quantities are preserved. Headings are ignored.
 */
export function parseBoxContentsText(text: string): string[] {
  const raw = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<\/?(?:div|ul|ol|span)[^>]*>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');

  const items: string[] = [];
  const seen = new Set<string>();

  for (const chunk of raw.split(/\n|(?=[\u2022\u2023\u25E6•·▪▸►])/)) {
    const item = normalizeBoxContentItem(chunk);
    if (!item) continue;
    const token = item.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    items.push(item);
  }

  return items;
}

function normalizeBoxContentItem(chunk: string): string {
  let value = chunk.replace(/\u00a0/g, ' ').trim();
  value = value.replace(/^#{1,6}\s*/, '');
  value = value.replace(BULLET_PREFIX, '').replace(NUMBERED_LIST_PREFIX, '').trim();
  value = value.replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (isBoxContentsHeading(value)) return '';
  return value;
}

function isBoxContentsHeading(value: string): boolean {
  const normalized = value
    .replace(/[:.\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return HEADINGS.has(normalized);
}
