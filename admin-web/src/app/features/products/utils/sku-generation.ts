/** Ported from admin-app/src/modules/products/utils/skuGeneration.ts — extended for product-field fallback. */

export function getMockExistingSkus(additionalSkus: string[] = []): string[] {
  const demo = ['TN-X1-256-001', 'TN-X1-256-002'];
  return [...new Set([...demo, ...additionalSkus.filter(Boolean)])];
}

export type ProductSkuSource = {
  modelNumber?: string | null;
  productName?: string | null;
  shortName?: string | null;
  productType?: string | null;
  brand?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Keep only A–Z, 0–9 and single hyphens — safe for typical SKU validation. */
export function sanitizeSkuBase(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Allocate `{base}-001`, `-002`, … by scanning existing SKUs for the next free 3-digit suffix.
 */
export function allocateSkuWithNumericSuffix(
  base: string,
  existingSkus: string[] = getMockExistingSkus(),
): string {
  const pattern = new RegExp(`^${escapeRegExp(base)}-(\\d{3})$`);
  let maxNum = 0;

  for (const sku of existingSkus) {
    const match = sku.trim().match(pattern);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  return `${base}-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Generate SKU from model number: `{modelNumber}-001`, `-002`, etc.
 * Uses 3-digit suffix; scans mock existing SKUs for the next available number.
 */
export function generateSkuFromModelNumber(
  modelNumber: string,
  existingSkus: string[] = getMockExistingSkus(),
): string | null {
  const base = modelNumber.trim();
  if (!base) return null;
  return allocateSkuWithNumericSuffix(base, existingSkus);
}

// NEW: cap each segment before joining, so the base stays short.
const SEGMENT_MAX_LEN = 4;

function buildFallbackSkuBase(source: ProductSkuSource): string {
  const namePart = String(source.shortName ?? '').trim() || String(source.productName ?? '').trim();
  const segments = [source.brand, source.productType, namePart, source.category, source.subCategory]
    .map((v) => sanitizeSkuBase(String(v ?? '')).slice(0, SEGMENT_MAX_LEN)) // CHANGED: added .slice(0, SEGMENT_MAX_LEN)
    .filter(Boolean);

  const deduped: string[] = [];
  for (const seg of segments) {
    if (deduped[deduped.length - 1] !== seg) deduped.push(seg);
  }

  let base = deduped.join('-');
  const MAX_BASE = 20; // CHANGED: was 48
  while (base.length > MAX_BASE && deduped.length > 1) {
    deduped.pop();
    base = deduped.join('-');
  }
  if (base.length > MAX_BASE) {
    base = base.slice(0, MAX_BASE).replace(/-+$/g, '');
  }

  return base || 'PROD';
}

/**
 * Generate a unique SKU from available product fields.
 * Prefers model number (existing behaviour). Falls back to other form fields, then `PROD`.
 */
// NEW: same cap used for the fallback base, applied to long model numbers.
const MAX_MODEL_NUMBER_LEN = 20;

export function generateProductSku(
  source: ProductSkuSource,
  existingSkus: string[] = getMockExistingSkus(),
): string {
  const modelNumber = String(source.modelNumber ?? '').trim();
  if (modelNumber) {
    const modelBase = modelNumber.slice(0, MAX_MODEL_NUMBER_LEN); // NEW line
    return allocateSkuWithNumericSuffix(modelBase, existingSkus); // CHANGED: modelNumber -> modelBase
  }

  const base = buildFallbackSkuBase(source);
  return allocateSkuWithNumericSuffix(base, existingSkus);
}
