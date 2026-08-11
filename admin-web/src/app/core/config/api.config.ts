import { environment } from '../../../environments/environment';

/**
 * Single centralized place that knows the backend's base URL.
 * Every service builds request paths from here — never hardcode
 * `https://loanex-api.vercel.app` (or any URL) inside a component/service.
 */
export const API_BASE_URL = `${environment.apiBaseUrl}${environment.apiPrefix}`;

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

/** Turns a stored product image ref (`/api/v1/products/images/:id`) into a browser URL. */
export function resolveMediaUrl(url: string | null | undefined): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/api/')) {
    return `${environment.apiBaseUrl}${trimmed}`;
  }
  return trimmed;
}

export function isStoredImageRef(url: string | null | undefined): boolean {
  return /\/api\/v1\/products\/images\/[a-f0-9]{24}/i.test((url ?? '').trim());
}
