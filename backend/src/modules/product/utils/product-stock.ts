export type StockParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'missing' | 'invalid' };

/** Strict non-negative integer. Empty is missing; decimals/negatives are invalid. */
export function parseNonNegativeInt(value: unknown): StockParseResult {
  if (value === undefined || value === null || value === '') {
    return { ok: false, reason: 'missing' };
  }
  if (typeof value === 'boolean' || (typeof value === 'object' && value !== null)) {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) return { ok: false, reason: 'invalid' };
    return { ok: true, value };
  }
  const s = String(value).trim();
  if (s === '') return { ok: false, reason: 'missing' };
  if (!/^\d+$/.test(s)) return { ok: false, reason: 'invalid' };
  return { ok: true, value: Number(s) };
}

export function collectPayloadVariants(data: any): any[] {
  const payload = data?.wizardData || data || {};
  const variants = payload.variants ?? data?.variants;
  if (!Array.isArray(variants)) return [];
  return variants.filter(
    (row) => row && (String(row.name ?? '').trim() || String(row.sku ?? '').trim()),
  );
}

export type StockResolveResult =
  | { ok: true; applied: true; stock: number }
  | { ok: true; applied: false }
  | { ok: false; message: string };

/**
 * Create requires stock. Update applies stock only when the payload includes
 * variants or an explicit stock/availableStock value.
 */
export function resolveProductStockForWrite(
  data: any,
  mode: 'create' | 'update',
): StockResolveResult {
  const payload = data?.wizardData || data || {};
  const variants = collectPayloadVariants(data);

  if (variants.length > 0) {
    let sum = 0;
    for (const variant of variants) {
      const parsed = parseNonNegativeInt(variant.stock ?? variant.availableStock);
      if (parsed.ok === false && parsed.reason === 'missing') {
        return {
          ok: false,
          message: 'Each variant must have a stock quantity (integer 0 or more).',
        };
      }
      if (parsed.ok === false) {
        return { ok: false, message: 'Variant stock must be an integer of 0 or more.' };
      }
      sum += parsed.value;
    }
    return { ok: true, applied: true, stock: sum };
  }

  const parsed = parseNonNegativeInt(
    payload.availableStock ?? data?.availableStock ?? data?.stock,
  );
  if (parsed.ok === true) return { ok: true, applied: true, stock: parsed.value };
  if (parsed.reason === 'invalid') {
    return { ok: false, message: 'Stock quantity must be an integer of 0 or more.' };
  }
  if (mode === 'create') {
    return { ok: false, message: 'Stock quantity is required.' };
  }
  return { ok: true, applied: false };
}
