import { environment } from '../../../environments/environment';

/**
 * Resolve backend media refs for browser/app display.
 *
 * - Absolute http(s) / data: / blob: → unchanged
 * - `/api/...` + production `apiBaseUrl` → absolute API host URL
 * - `/api/...` + empty `apiBaseUrl` (local) → relative path (Angular proxy)
 * - empty / null → ''
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/api/')) {
    return `${environment.apiBaseUrl}${trimmed}`;
  }
  return trimmed;
}

export function resolveMediaUrlList(
  urls: Array<string | null | undefined> | null | undefined,
): string[] {
  return (urls ?? []).map((u) => resolveMediaUrl(u)).filter((u) => Boolean(u));
}

type GalleryImage = { id?: string; src: string; alt?: string; [key: string]: unknown };

/** Resolve common product image fields on a catalog/detail product payload. */
export function withResolvedProductImages<T extends Record<string, unknown>>(product: T): T {
  const next = { ...product } as T & {
    image?: string;
    imageUrl?: string;
    thumbnail?: string | null;
    images?: string[];
    galleryImages?: string[];
    imagesGallery?: GalleryImage[];
    productVariants?: Array<Record<string, unknown>>;
    selectedVariant?: Record<string, unknown> | null;
  };

  if ('image' in next) next.image = resolveMediaUrl(next.image as string | undefined);
  if ('imageUrl' in next) next.imageUrl = resolveMediaUrl(next.imageUrl as string | undefined);
  if ('thumbnail' in next) {
    next.thumbnail = next.thumbnail == null ? next.thumbnail : resolveMediaUrl(String(next.thumbnail));
  }
  if (Array.isArray(next.images)) next.images = resolveMediaUrlList(next.images);
  if (Array.isArray(next.galleryImages)) {
    next.galleryImages = resolveMediaUrlList(next.galleryImages);
  }
  if (Array.isArray(next.imagesGallery)) {
    next.imagesGallery = next.imagesGallery.map((img) => ({
      ...img,
      src: resolveMediaUrl(img?.src),
    }));
  }
  if (Array.isArray(next.productVariants)) {
    next.productVariants = next.productVariants.map((variant) =>
      withResolvedProductImages(variant),
    );
  }
  if (next.selectedVariant && typeof next.selectedVariant === 'object') {
    next.selectedVariant = withResolvedProductImages(next.selectedVariant);
  }

  return next as T;
}
