/**
 * Pending local image URIs (file:// / content:// / blob:) awaiting upload on save.
 * Mirrors Admin Web product-form pendingUploads Map.
 */
export type PendingImageFile = {
  uri: string;
  name: string;
  type: string;
};

const pendingUploads = new Map<string, PendingImageFile>();

export function isLocalPendingImageUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return (
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('blob:') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library:') ||
    pendingUploads.has(uri)
  );
}

export function registerPendingImage(file: PendingImageFile): void {
  pendingUploads.set(file.uri, file);
}

export function clearPendingImage(uri: string): void {
  pendingUploads.delete(uri);
}

export function getPendingImage(uri: string): PendingImageFile | undefined {
  return pendingUploads.get(uri);
}

export function listPendingImages(): PendingImageFile[] {
  return [...pendingUploads.values()];
}

export function clearAllPendingImages(): void {
  pendingUploads.clear();
}

/** Replace local pending URIs with uploaded server URLs throughout a string tree. */
export function remapImageUris<T>(value: T, urlMap: Map<string, string>): T {
  if (typeof value === 'string') {
    return (urlMap.get(value) ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapImageUris(item, urlMap)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = remapImageUris(v, urlMap);
    }
    return out as T;
  }
  return value;
}
