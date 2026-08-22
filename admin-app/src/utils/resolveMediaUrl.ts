import { API_CONFIG } from '../services/config';

/**
 * Turn API-relative image paths (e.g. /api/v1/products/images/:id) into absolute
 * URLs RN/web Image can load. Local picker URIs are returned unchanged.
 */
export function resolveMediaUrl(uri: string | null | undefined): string {
  const value = String(uri ?? '').trim();
  if (!value) return '';

  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith('blob:') ||
    value.startsWith('file:') ||
    value.startsWith('content:') ||
    value.startsWith('data:') ||
    value.startsWith('ph://') ||
    value.startsWith('assets-library:')
  ) {
    return value;
  }

  const apiOrigin = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/i, '');
  if (value.startsWith('/')) {
    return `${apiOrigin}${value}`;
  }
  return `${API_CONFIG.BASE_URL.replace(/\/$/, '')}/${value}`;
}

/** Pick the best product image field, then make it absolute for RN Image. */
export function resolveProductImageUrl(product: Record<string, unknown> | null | undefined): string {
  if (!product || typeof product !== 'object') return '';
  const wizard =
    product['wizardData'] && typeof product['wizardData'] === 'object'
      ? (product['wizardData'] as Record<string, unknown>)
      : {};
  const gallery = product['galleryImages'];
  const images = product['images'];
  const candidates = [
    product['image'],
    product['imageUrl'],
    product['thumbnail'],
    Array.isArray(gallery) ? gallery[0] : '',
    Array.isArray(images) ? images[0] : '',
    wizard['primaryImage'],
    Array.isArray(wizard['galleryImages']) ? wizard['galleryImages'][0] : '',
  ];
  for (const candidate of candidates) {
    const resolved = resolveMediaUrl(typeof candidate === 'string' ? candidate : '');
    if (resolved) return resolved;
  }
  return '';
}
