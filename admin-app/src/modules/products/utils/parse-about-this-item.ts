const HEADINGS = new Set([
  'about this item',
  'about the item',
  'about this product',
]);

const BULLET_PREFIX = /^(?:[-•*·–—▪▸►]|\u2022|\u2023|\u25E6)\s+/;
const NUMBERED_PREFIX = /^\d+[.)]\s+/;

export function parseAboutThisItemText(text: string): string[] {
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
    const item = normalizeAboutItem(chunk);
    if (!item) continue;
    const token = item.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    items.push(item);
  }

  return items;
}

function normalizeAboutItem(chunk: string): string {
  let value = chunk.replace(/\u00a0/g, ' ').trim();
  value = value.replace(/^#{1,6}\s*/, '');
  value = value.replace(BULLET_PREFIX, '').replace(NUMBERED_PREFIX, '').trim();
  value = value.replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (isAboutHeading(value)) return '';
  return value;
}

function isAboutHeading(value: string): boolean {
  const normalized = value
    .replace(/[:.\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return HEADINGS.has(normalized);
}
