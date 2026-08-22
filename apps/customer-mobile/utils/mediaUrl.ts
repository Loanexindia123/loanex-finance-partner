import { SERVER_URL } from '../constants/config';
import { Image } from 'expo-image';

/**
 * Resolve backend media refs for React Native Image URIs.
 * Absolute http(s)/data URLs are unchanged.
 * `/api/...` paths become `${SERVER_URL}/api/...`.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (path.startsWith('/api/')) {
    return `${SERVER_URL}${path}`;
  }
  // Relative non-api paths (rare) — still absolute against API host for RN.
  if (path.startsWith('/')) {
    return `${SERVER_URL}${path}`;
  }
  return trimmed;
}

export function resolveMediaUrlList(
  urls: Array<string | null | undefined> | null | undefined,
): string[] {
  return (urls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean);
}

/** Display sizes mapped to backend resize widths (`?w=`). */
export type MediaDisplaySize = 'thumb' | 'card' | 'banner' | 'full';

const DISPLAY_WIDTH: Record<MediaDisplaySize, number | null> = {
  thumb: 200,
  card: 400,
  banner: 800,
  full: null,
};

/** Matches LoanEx GridFS product/banner image URLs (any host). */
const PRODUCT_IMAGE_RE = /\/api\/v1\/products\/images\/[a-f0-9]{24}/i;

function isLoanexProductImageUrl(url: string): boolean {
  return PRODUCT_IMAGE_RE.test(url);
}

/**
 * Append a resize width for LoanEx GridFS images only.
 * - Product cards → ?w=400
 * - Thumbnails → ?w=200
 * - Home banners → ?w=800
 * - Product detail hero → full (no ?w)
 * External URLs (Unsplash, etc.) are returned unchanged.
 */
export function withMediaSize(
  url: string | null | undefined,
  size: MediaDisplaySize = 'full',
): string {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return '';
  const width = DISPLAY_WIDTH[size];
  if (width == null || !isLoanexProductImageUrl(resolved)) return resolved;

  try {
    const parsed = new URL(resolved);
    // Strip any prior size so cards/banners always hit the resize endpoint cleanly.
    parsed.searchParams.delete('w');
    parsed.searchParams.set('w', String(width));
    return parsed.toString();
  } catch {
    const cleaned = resolved.replace(/([?&])w=\d+/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
    const join = cleaned.includes('?') ? '&' : '?';
    return `${cleaned}${join}w=${width}`;
  }
}

/** Prefetch unique URIs into expo-image memory+disk cache. */
export function prefetchMediaUrls(urls: Array<string | null | undefined>): void {
  const unique = [...new Set(urls.map((u) => (u ?? '').trim()).filter(Boolean))];
  if (!unique.length) return;
  void Image.prefetch(unique, { cachePolicy: 'memory-disk' });
}

/** Map common product image fields from a backend product payload. */
export function withResolvedProductImages<T extends Record<string, unknown>>(product: T): T {
  const next = { ...product } as T & {
    image?: string;
    imageUrl?: string;
    thumbnail?: string;
    images?: string[];
    galleryImages?: string[];
    photos?: Array<{ url?: string; [key: string]: unknown }>;
  };

  const primary = resolveMediaUrl(
    (next.image as string) ||
      (next.imageUrl as string) ||
      (next.thumbnail as string) ||
      (Array.isArray(next.images) ? next.images[0] : '') ||
      '',
  );

  if ('image' in next || primary) next.image = primary;
  if ('imageUrl' in next) next.imageUrl = resolveMediaUrl(next.imageUrl as string | undefined) || primary;
  if ('thumbnail' in next) next.thumbnail = resolveMediaUrl(next.thumbnail as string | undefined) || primary;
  if (Array.isArray(next.images)) {
    next.images = resolveMediaUrlList(next.images);
    if (!next.images.length && primary) next.images = [primary];
  } else if (primary) {
    (next as { images?: string[] }).images = [primary];
  }
  if (Array.isArray(next.galleryImages)) {
    next.galleryImages = resolveMediaUrlList(next.galleryImages);
  }
  if (Array.isArray(next.photos)) {
    next.photos = next.photos.map((photo) => ({
      ...photo,
      url: resolveMediaUrl(photo?.url),
    }));
  }

  const variants = (next as {
    productVariants?: Array<Record<string, unknown>>;
    variants?: Array<Record<string, unknown>>;
  });
  if (Array.isArray(variants.productVariants)) {
    variants.productVariants = variants.productVariants.map((v) => withResolvedProductImages(v));
  }
  if (Array.isArray(variants.variants)) {
    variants.variants = variants.variants.map((v) =>
      'images' in v || 'image' in v || 'imageUrl' in v ? withResolvedProductImages(v) : v,
    );
  }

  return next as T;
}
