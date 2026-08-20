export interface ParsedAmazonSpecification {
  key: string;
  value: string;
}

export interface ParsedAmazonProduct {
  specifications: ParsedAmazonSpecification[];
  features: string[];
  boxContents: string[];
  warranty: string;
  description: string;
  shortDescription: string;
  brand: string;
  manufacturer: string;
  modelNumber: string;
  colourSizeVariant: string;
}

export interface AmazonFillTarget {
  brand: string;
  manufacturer: string;
  modelNumber: string;
  warranty: string;
  colourSizeVariant: string;
  shortDescription: string;
  description: string;
  specifications: Array<{ id: string; key: string; value: string }>;
  features: string[];
  boxContents: string[];
}

/** Subset of Amazon parse results applied to a Product Variant form. */
export interface VariantAmazonFillTarget {
  description: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  specifications: Array<{ id: string; key: string; value: string }>;
  features: string[];
  boxContents: string[];
}

export interface ParsedAmazonDimensions {
  weight: string;
  length: string;
  width: string;
  height: string;
}

type ContentSection = 'specs' | 'features' | 'box' | 'description';

const FEATURE_HEADERS = [
  'about this item',
  'about the item',
  'about this product',
  'product highlights',
  'key features',
  'key feature',
  'features',
  'highlights',
  'from the brand',
];

const BOX_HEADERS = [
  'in the box',
  "what's in the box",
  'whats in the box',
  'what is in the box',
  'what’s in the box',
  'box contents',
  'package includes',
  'package contents',
  'in the package',
  'contents of the box',
];

const DESCRIPTION_HEADERS = [
  'product description',
  'description',
  'from the manufacturer',
  'about the product',
];

const WARRANTY_KEYS = new Set([
  'warranty',
  'warranty description',
  'warranty type',
  'manufacturer warranty',
  'brand warranty',
  'warranty information',
]);

const BOX_KEYS = new Set([
  'included components',
  'in the box',
  "what's in the box",
  'whats in the box',
  'what is in the box',
  'box contents',
  'package contents',
  'package includes',
  'contents',
]);

const BRAND_KEYS = new Set(['brand', 'brand name']);
const MANUFACTURER_KEYS = new Set(['manufacturer']);
const MODEL_NUMBER_KEYS = new Set(['model number', 'item model number', 'model']);
const MODEL_NAME_KEYS = new Set(['model name']);
const COLOUR_KEYS = new Set(['colour', 'color']);
const SIZE_KEYS = new Set(['size', 'item size']);

const SPEC_KEY_ALIASES: Record<string, string> = {
  color: 'colour',
  'product dimensions': 'dimensions',
  dimensions: 'dimensions',
  'item weight': 'weight',
  weight: 'weight',
  'product care instructions': 'care instructions',
  'care instructions': 'care instructions',
  'model name': 'model name',
  model: 'model',
  'model number': 'model number',
  'item model number': 'model number',
};

const SKIP_LINES = [
  /^see (more|all|less|buying options)\b/i,
  /^visit the\b/i,
  /^\d+(\.\d+)?\s+out of\s+5\b/i,
  /^(₹|\$|rs\.?)\s*\d/i,
  /^best sellers rank\b/i,
  /^customer reviews?\b/i,
  /^new\s*\(/i,
];

const KNOWN_SPEC_KEYS = [
  'product care instructions',
  'care instructions',
  'included components',
  'country of origin',
  'product dimensions',
  'item model number',
  'connectivity technology',
  'noise control',
  'ear placement',
  'form factor',
  'special features',
  'special feature',
  'frame material',
  'back style',
  'item weight',
  'model name',
  'model number',
  'manufacturer',
  'dimensions',
  'connector type',
  'compatible devices',
  'battery life',
  'charging time',
  'water resistance level',
  'control type',
  'power source',
  'operating system',
  'wireless communication technologies',
  'material',
  'capacity',
  'warranty',
  'colour',
  'color',
  'brand',
  'size',
  'weight',
  'model',
];

const BULLET_RE = /^(?:[-•*·–—▪▸►]|[\u2022\u2023\u25E6])\s+/;
const NUMBERED_RE = /^\d+[.)]\s+/;

export function parseAmazonProductText(text: string): ParsedAmazonProduct {
  const empty: ParsedAmazonProduct = {
    specifications: [],
    features: [],
    boxContents: [],
    warranty: '',
    description: '',
    shortDescription: '',
    brand: '',
    manufacturer: '',
    modelNumber: '',
    colourSizeVariant: '',
  };

  const raw = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!raw.trim()) return empty;

  const lines = raw.split('\n').map((line) => line.replace(/\u00a0/g, ' ').trimEnd());
  const specifications: ParsedAmazonSpecification[] = [];
  const features: string[] = [];
  const boxContents: string[] = [];
  const descriptionParts: string[] = [];
  const leftoverParts: string[] = [];
  let warranty = '';
  let section: ContentSection = 'specs';

  const pushSpec = (key: string, value: string) => {
    const cleanKey = tidyLabel(key);
    const cleanValue = collapseDuplicatedText(tidyValue(value));
    if (!cleanKey || !cleanValue) return;
    if (isDuplicateSpec(specifications, cleanKey, cleanValue)) return;
    specifications.push({ key: cleanKey, value: cleanValue });

    const canonical = canonicalSpecKey(cleanKey);
    if (WARRANTY_KEYS.has(canonical) && !warranty) {
      warranty = mapWarranty(cleanValue);
    }
    if (BOX_KEYS.has(canonical)) {
      splitListItems(cleanValue).forEach((item) => pushUnique(boxContents, item));
    }
  };

  const pushFeature = (value: string) => {
    const cleaned = tidyValue(stripBullet(value));
    if (!cleaned) return;
    const maybePair = splitKeyValue(cleaned);
    if (maybePair && WARRANTY_KEYS.has(canonicalSpecKey(maybePair.key))) {
      if (!warranty) warranty = mapWarranty(maybePair.value);
      return;
    }
    if (maybePair && BOX_KEYS.has(canonicalSpecKey(maybePair.key))) {
      splitListItems(maybePair.value).forEach((item) => pushUnique(boxContents, item));
      return;
    }
    pushUnique(features, cleaned);
  };

  const pushBox = (value: string) => {
    const cleaned = tidyValue(stripBullet(value));
    if (!cleaned) return;
    const maybePair = splitKeyValue(cleaned);
    if (maybePair && BOX_KEYS.has(canonicalSpecKey(maybePair.key))) {
      splitListItems(maybePair.value).forEach((item) => pushUnique(boxContents, item));
      return;
    }
    splitListItems(cleaned).forEach((item) => pushUnique(boxContents, item));
  };

  for (let i = 0; i < lines.length; i += 1) {
    const original = lines[i] ?? '';
    const line = original.replace(/\u00a0/g, ' ').trim();
    if (!line) continue;
    if (isMarkdownSeparatorRow(line)) continue;
    if (SKIP_LINES.some((re) => re.test(stripMarkupKeepWhitespace(line).trim()))) continue;

    const spec = parseInlineSpec(line);
    if (spec && section === 'specs') {
      pushSpec(spec.key, spec.value);
      continue;
    }

    const header = detectSectionHeader(line);
    if (header) {
      section = header;
      continue;
    }

    if (section === 'features') {
      if (isBullet(line) || looksLikeFeatureLine(line)) {
        pushFeature(line);
        continue;
      }
      const pair = splitKeyValue(line);
      if (pair && looksLikeSpecKey(pair.key)) {
        pushFeature(`${tidyLabel(pair.key)}: ${tidyValue(pair.value)}`);
        continue;
      }
      if (line.length > 20) leftoverParts.push(line);
      continue;
    }

    if (section === 'box') {
      if (isBullet(line) || splitKeyValue(line) || line.length <= 80) {
        pushBox(line);
        continue;
      }
      leftoverParts.push(line);
      continue;
    }

    if (section === 'description') {
      if (!isBullet(line)) {
        descriptionParts.push(line);
        continue;
      }
      pushFeature(line);
      continue;
    }

    const next = peekNextContent(lines, i);
    if (looksLikeSpecKey(line) && next && /^:\s*\S/.test(next.line.trim())) {
      pushSpec(line, stripLeadingColon(next.line));
      i = next.index;
      continue;
    }

    if (isBullet(line)) {
      const bulletPair = splitKeyValue(stripBullet(line));
      if (bulletPair && looksLikeSpecKey(bulletPair.key)) {
        pushSpec(bulletPair.key, bulletPair.value);
      } else {
        pushFeature(line);
      }
      continue;
    }

    leftoverParts.push(line);
  }

  if (!features.length) {
    const special = specifications.find((item) =>
      ['special feature', 'special features'].includes(canonicalSpecKey(item.key)),
    );
    if (special) {
      splitListItems(special.value).forEach((item) => pushUnique(features, item));
    }
  }

  const brand = specValue(specifications, BRAND_KEYS);
  const manufacturer = specValue(specifications, MANUFACTURER_KEYS);
  const modelNumber =
    specValue(specifications, MODEL_NUMBER_KEYS) || specValue(specifications, MODEL_NAME_KEYS);
  const colour = specValue(specifications, COLOUR_KEYS);
  const size = specValue(specifications, SIZE_KEYS);
  const colourSizeVariant = [colour, size].filter(Boolean).join(' / ');

  const description = buildDescription(descriptionParts.join('\n'), leftoverParts.join('\n'), features);
  const shortDescription = toShortDescription(description);

  return {
    specifications,
    features,
    boxContents,
    warranty,
    description,
    shortDescription,
    brand,
    manufacturer,
    modelNumber,
    colourSizeVariant,
  };
}

export function amazonParseHasContent(parsed: ParsedAmazonProduct): boolean {
  return Boolean(
    parsed.specifications.length ||
      parsed.features.length ||
      parsed.boxContents.length ||
      parsed.warranty.trim() ||
      parsed.description.trim() ||
      parsed.brand.trim() ||
      parsed.manufacturer.trim() ||
      parsed.modelNumber.trim(),
  );
}

export function mergeAmazonParseIntoProduct(
  existing: AmazonFillTarget,
  parsed: ParsedAmazonProduct,
): AmazonFillTarget {
  const specifications = [...existing.specifications];
  for (const spec of parsed.specifications) {
    if (isDuplicateSpec(specifications, spec.key)) continue;
    const emptyIndex = specifications.findIndex((row) => !row.key.trim() && !row.value.trim());
    const next = { id: '', key: spec.key, value: spec.value };
    if (emptyIndex >= 0) {
      specifications[emptyIndex] = {
        id: specifications[emptyIndex]!.id || nextSpecId(specifications.length),
        key: spec.key,
        value: spec.value,
      };
    } else {
      specifications.push({
        id: nextSpecId(specifications.length),
        key: spec.key,
        value: spec.value,
      });
    }
  }

  return {
    brand: fillEmpty(existing.brand, parsed.brand),
    manufacturer: fillEmpty(existing.manufacturer, parsed.manufacturer),
    modelNumber: fillEmpty(existing.modelNumber, parsed.modelNumber),
    warranty: fillEmpty(existing.warranty, parsed.warranty),
    colourSizeVariant: fillEmpty(existing.colourSizeVariant, parsed.colourSizeVariant),
    shortDescription: fillEmpty(existing.shortDescription, parsed.shortDescription),
    description: fillEmpty(existing.description, parsed.description),
    specifications,
    features: mergeStringList(existing.features, parsed.features),
    boxContents: mergeStringList(existing.boxContents, parsed.boxContents),
  };
}

/**
 * Apply Amazon parse results to a variant form target.
 * Does not touch name / SKU / pricing / stock / barcode / status / EMI.
 */
export function mergeAmazonParseIntoVariant(
  existing: VariantAmazonFillTarget,
  parsed: ParsedAmazonProduct,
): VariantAmazonFillTarget {
  const productLike = mergeAmazonParseIntoProduct(
    {
      brand: '',
      manufacturer: '',
      modelNumber: '',
      warranty: '',
      colourSizeVariant: '',
      shortDescription: '',
      description: existing.description,
      specifications: existing.specifications,
      features: existing.features,
      boxContents: existing.boxContents,
    },
    parsed,
  );
  const dims = extractAmazonDimensions(parsed);
  return {
    description: productLike.description,
    weight: fillEmpty(existing.weight, dims.weight),
    length: fillEmpty(existing.length, dims.length),
    width: fillEmpty(existing.width, dims.width),
    height: fillEmpty(existing.height, dims.height),
    specifications: productLike.specifications,
    features: productLike.features,
    boxContents: productLike.boxContents,
  };
}

/** Pull weight / L / W / H from parsed Amazon specs when format is reliable. */
export function extractAmazonDimensions(parsed: ParsedAmazonProduct): ParsedAmazonDimensions {
  const empty: ParsedAmazonDimensions = { weight: '', length: '', width: '', height: '' };
  if (!parsed?.specifications?.length) return empty;

  const weightRaw =
    specValue(parsed.specifications, new Set(['weight', 'item weight'])) ||
    specValueByIncludes(parsed.specifications, ['weight']);
  const dimsRaw =
    specValue(parsed.specifications, new Set(['dimensions', 'product dimensions'])) ||
    specValueByIncludes(parsed.specifications, ['dimension']);

  const weight = parseWeightValue(weightRaw);
  const fromDims = parseDimensionTriplet(dimsRaw);
  const length = fromDims.length || parseSingleMeasure(
    specValue(parsed.specifications, new Set(['length', 'item length', 'depth'])),
  );
  const width = fromDims.width || parseSingleMeasure(
    specValue(parsed.specifications, new Set(['width', 'item width'])),
  );
  const height = fromDims.height || parseSingleMeasure(
    specValue(parsed.specifications, new Set(['height', 'item height'])),
  );

  return { weight, length, width, height };
}

export function mapWarranty(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (/\bno\s+warranty\b|\bnot\s+applicable\b|\bnone\b/.test(lower) && !/\d/.test(lower)) {
    return 'None';
  }
  if (/\b36\s*months?\b|\b3\s*years?\b/.test(lower)) return '3 Years';
  if (/\b24\s*months?\b|\b2\s*years?\b/.test(lower)) return '2 Years';
  if (/\b18\s*months?\b/.test(lower)) return text;
  if (/\b12\s*months?\b|\b1\s*year\b/.test(lower)) return '1 Year';
  if (/\b6\s*months?\b/.test(lower)) return '6 Months';
  return text;
}

export function canonicalSpecKey(key: string): string {
  const normalized = key
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ');
  return SPEC_KEY_ALIASES[normalized] ?? normalized;
}

function mergeStringList(existing: string[], incoming: string[]): string[] {
  const result = [...existing];
  const seen = new Set(result.map((item) => item.trim().toLowerCase()).filter(Boolean));
  for (const item of incoming) {
    const value = item.trim();
    if (!value) continue;
    const token = value.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    const emptyIndex = result.findIndex((row) => !String(row ?? '').trim());
    if (emptyIndex >= 0) {
      result[emptyIndex] = value;
    } else {
      result.push(value);
    }
  }
  return result;
}

function isDuplicateSpec(
  items: Array<{ key: string; value?: string }>,
  key: string,
  _value?: string,
): boolean {
  const canonical = canonicalSpecKey(key);
  return items.some((item) => item.key.trim() && canonicalSpecKey(item.key) === canonical);
}

function fillEmpty(current: string, incoming: string): string {
  return String(current ?? '').trim() ? current : String(incoming ?? '').trim();
}

function nextSpecId(index: number): string {
  return `spec-${Date.now()}-${index}`;
}

function specValue(
  specs: ParsedAmazonSpecification[],
  keys: Set<string>,
): string {
  const match = specs.find((item) => keys.has(canonicalSpecKey(item.key)));
  return match?.value.trim() ?? '';
}

function detectSectionHeader(line: string): ContentSection | null {
  const normalized = normalizeHeader(line);
  if (!normalized) return null;
  if (FEATURE_HEADERS.includes(normalized)) return 'features';
  if (BOX_HEADERS.includes(normalized)) return 'box';
  if (DESCRIPTION_HEADERS.includes(normalized)) return 'description';
  return null;
}

function normalizeHeader(line: string): string {
  return stripBullet(line)
    .replace(/^#{1,6}\s*/, '')
    .replace(/[:.\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseInlineSpec(line: string): { key: string; value: string } | null {
  const prepared = stripMarkupKeepWhitespace(line).replace(/\u00a0/g, ' ').trim();
  if (!prepared || isMarkdownSeparatorRow(prepared)) return null;

  if (prepared.includes('\t')) {
    const parts = prepared.split('\t');
    const key = tidyLabel(parts[0] ?? '');
    const value = tidyValue(parts.slice(1).join('\t'));
    if (key && value && looksLikeSpecKey(key)) {
      return { key, value };
    }
  }

  const table = parseMarkdownTableRow(prepared);
  if (table) return table;

  const colon = splitKeyValue(prepared);
  if (colon && looksLikeSpecKey(colon.key) && colon.value.trim()) {
    return { key: tidyLabel(colon.key), value: tidyValue(colon.value) };
  }

  const spaced = splitSpacedKeyValue(prepared);
  if (spaced) return { key: tidyLabel(spaced.key), value: tidyValue(spaced.value) };

  const known = matchKnownKeyPrefix(prepared);
  if (known) return { key: tidyLabel(known.key), value: tidyValue(known.value) };

  return null;
}

function parseMarkdownTableRow(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  if (isMarkdownSeparatorRow(trimmed)) return null;

  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = inner
    .split('|')
    .map((cell) => tidyValue(cell))
    .filter((cell, index, all) => !(cell === '' && (index === 0 || index === all.length - 1)));

  if (cells.length < 2) return null;

  const key = tidyLabel(cells[0] ?? '');
  const value = tidyValue(cells.slice(1).join(' '));
  if (!key || !value) return null;
  if (isMarkdownTableHeader(key, value)) return null;
  if (!looksLikeSpecKey(key)) return null;
  return { key, value };
}

function isMarkdownSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') && !/^\s*[-:]{3,}\s*$/.test(trimmed)) return false;
  return /^\|?[\s\-:|]+\|?$/.test(trimmed);
}

function isMarkdownTableHeader(key: string, value: string): boolean {
  const headerKeys = new Set(['key', 'attribute', 'specification', 'spec', 'name', 'title', 'field']);
  const headerValues = new Set(['value', 'detail', 'details', 'description', 'info']);
  return headerKeys.has(key.trim().toLowerCase()) && headerValues.has(value.trim().toLowerCase());
}

function stripMarkupKeepWhitespace(text: string): string {
  return String(text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?p[^>]*>/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/<\/?[^>]+>/g, ' ');
}

function stripMarkdownFormatting(text: string): string {
  return stripMarkupKeepWhitespace(text).replace(/[^\S\t]+/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function splitKeyValue(line: string): { key: string; value: string } | null {
  const cleaned = stripBullet(line);
  const colon = cleaned.match(/^(.{2,80}?)\s*:\s*(.+)$/);
  if (colon?.[1] && colon[2]) {
    return { key: colon[1].trim(), value: colon[2].trim() };
  }
  const dash = cleaned.match(/^([A-Za-z][A-Za-z0-9 /&'()]{1,40}?)\s+[-–—]\s+(.+)$/);
  if (dash?.[1] && dash[2] && looksLikeSpecKey(dash[1])) {
    return { key: dash[1].trim(), value: dash[2].trim() };
  }
  return null;
}

function splitSpacedKeyValue(line: string): { key: string; value: string } | null {
  const match = line.match(/^([A-Za-z][A-Za-z0-9 /&'()]{1,60}?)\s{2,}(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  if (!looksLikeSpecKey(match[1])) return null;
  return { key: match[1].trim(), value: match[2].trim() };
}

function matchKnownKeyPrefix(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  let best: { key: string; value: string; length: number } | null = null;
  for (const candidate of KNOWN_SPEC_KEYS) {
    if (!lower.startsWith(candidate)) continue;
    const after = trimmed.slice(candidate.length);
    if (!/^\s+\S/.test(after)) continue;
    const value = after.trim();
    if (!value || canonicalSpecKey(value) === candidate) continue;
    if (!best || candidate.length > best.length) {
      best = {
        key: trimmed.slice(0, candidate.length).trim(),
        value,
        length: candidate.length,
      };
    }
  }
  return best ? { key: best.key, value: best.value } : null;
}

function looksLikeSpecKey(text: string): boolean {
  const value = tidyLabel(text);
  if (value.length < 2 || value.length > 60) return false;
  if (detectSectionHeader(value)) return false;
  if (/https?:/i.test(value) || /^https?$/i.test(value)) return false;
  if (/[.!?]$/.test(value)) return false;
  if (!/^[A-Za-z]/.test(value)) return false;
  if (/^[A-Z0-9]{5,}$/.test(value.replace(/\s/g, ''))) return false;
  const words = value.split(/\s+/);
  if (words.length === 0 || words.length > 8) return false;
  const compact = value.replace(/\s+/g, '');
  const letters = compact.replace(/[^A-Za-z]/g, '').length;
  return letters / compact.length >= 0.55;
}

function looksLikeFeatureLine(line: string): boolean {
  const cleaned = stripBullet(line);
  return cleaned.length > 0 && (isBullet(line) || NUMBERED_RE.test(line.trim()));
}

function isBullet(line: string): boolean {
  const trimmed = line.trim();
  return BULLET_RE.test(trimmed) || NUMBERED_RE.test(trimmed);
}

function stripBullet(line: string): string {
  return line.trim().replace(BULLET_RE, '').replace(NUMBERED_RE, '').trim();
}

function stripLeadingColon(line: string): string {
  return line.trim().replace(/^:\s*/, '');
}

function peekNextContent(
  lines: string[],
  index: number,
): { index: number; line: string } | null {
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim();
    if (!line) continue;
    return { index: i, line };
  }
  return null;
}

function tidyLabel(value: string): string {
  return stripMarkdownFormatting(value).replace(/[:]+$/g, '').trim();
}

function tidyValue(value: string): string {
  return collapseDuplicatedText(stripMarkdownFormatting(value));
}

function collapseDuplicatedText(value: string): string {
  const text = String(value ?? '').trim();
  if (text.length < 12) return text;
  if (text.length % 2 === 0) {
    const mid = text.length / 2;
    if (text.slice(0, mid) === text.slice(mid)) return text.slice(0, mid).trim();
  }
  return text;
}

function pushUnique(list: string[], value: string): void {
  const cleaned = tidyValue(value);
  if (!cleaned) return;
  if (list.some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
  list.push(cleaned);
}

function splitListItems(value: string): string[] {
  const trimmed = tidyValue(value);
  if (!trimmed) return [];
  if (/[;|\n]/.test(trimmed)) {
    return trimmed
      .split(/[;|\n]/)
      .map((item) => tidyValue(item.replace(/^[-•*·–—]\s*/, '')))
      .filter(Boolean);
  }
  if (trimmed.includes(',') && !/\d,\d/.test(trimmed)) {
    const parts = trimmed.split(',').map((item) => tidyValue(item)).filter(Boolean);
    if (parts.length > 1 && parts.every((part) => part.length <= 60 && part.split(' ').length <= 8)) {
      return parts;
    }
  }
  return [trimmed];
}

function buildDescription(explicit: string, leftover: string, features: string[]): string {
  const primary = tidyMultiline(explicit);
  if (primary) return primary;
  const extra = tidyMultiline(leftover);
  const fromFeatures = features
    .map((feature) => descriptivePart(feature))
    .filter((part) => part.length >= 24)
    .join(' ');
  if (extra && fromFeatures) {
    const looksLikeTitle = extra.length <= 120 && !/[.!?]$/.test(extra) && extra.split(/\s+/).length <= 18;
    return looksLikeTitle ? fromFeatures : `${extra} ${fromFeatures}`.trim();
  }
  return extra || fromFeatures;
}

function descriptivePart(feature: string): string {
  const colon = feature.indexOf(':');
  if (colon > 0 && colon < 48) {
    return tidyValue(feature.slice(colon + 1));
  }
  return tidyValue(feature);
}

function tidyMultiline(value: string): string {
  return value
    .split('\n')
    .map((line) => tidyValue(line))
    .filter((line) => line && !detectSectionHeader(line) && !SKIP_LINES.some((re) => re.test(line)))
    .join(' ')
    .trim();
}

function toShortDescription(description: string): string {
  const text = tidyValue(description);
  if (!text) return '';
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  if (sentence.length <= 160) return sentence;
  const cut = text.slice(0, 157);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}...`;
}

function specValueByIncludes(specs: ParsedAmazonSpecification[], needles: string[]): string {
  const match = specs.find((item) => {
    const key = canonicalSpecKey(item.key);
    return needles.some((needle) => key.includes(needle));
  });
  return match?.value.trim() ?? '';
}

function parseWeightValue(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|lb|lbs|pounds?)?/i);
  if (!match) return '';
  const amount = match[1] ?? '';
  const unit = (match[2] ?? '').toLowerCase();
  if (!amount) return '';
  if (!unit || unit.startsWith('kg') || unit.startsWith('kilogram')) return amount;
  if (unit === 'g' || unit.startsWith('gram')) {
    const grams = Number(amount);
    if (!Number.isFinite(grams)) return amount;
    return String(Math.round((grams / 1000) * 1000) / 1000);
  }
  // Keep imperial as numeric value only when clearly stated; do not invent kg conversion.
  return amount;
}

function parseSingleMeasure(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match?.[1] ?? '';
}

/**
 * Supports Amazon forms such as:
 * - 51D x 51W x 114H Centimeters
 * - 51 x 51 x 114 cm
 * - 20L x 15W x 10H
 */
function parseDimensionTriplet(raw: string): { length: string; width: string; height: string } {
  const empty = { length: '', width: '', height: '' };
  const text = String(raw ?? '').trim();
  if (!text) return empty;

  const labeled = text.match(
    /(\d+(?:\.\d+)?)\s*(?:[Dd](?:epth)?|[Ll](?:ength)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[Ww](?:idth)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*[Hh](?:eight)?/i,
  );
  if (labeled) {
    return {
      length: labeled[1] ?? '',
      width: labeled[2] ?? '',
      height: labeled[3] ?? '',
    };
  }

  const plain = text.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i,
  );
  if (plain) {
    return {
      length: plain[1] ?? '',
      width: plain[2] ?? '',
      height: plain[3] ?? '',
    };
  }

  return empty;
}
