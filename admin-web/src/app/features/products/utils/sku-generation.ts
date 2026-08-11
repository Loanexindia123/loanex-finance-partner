/** Ported 1:1 from admin-app/src/modules/products/utils/skuGeneration.ts */

export function getMockExistingSkus(additionalSkus: string[] = []): string[] {
  const demo = ['TN-X1-256-001', 'TN-X1-256-002'];
  return [...new Set([...demo, ...additionalSkus.filter(Boolean)])];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const pattern = new RegExp(`^${escapeRegExp(base)}-(\\d{3})$`);
  let maxNum = 0;

  for (const sku of existingSkus) {
    const match = sku.trim().match(pattern);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  const next = maxNum + 1;
  return `${base}-${String(next).padStart(3, '0')}`;
}
