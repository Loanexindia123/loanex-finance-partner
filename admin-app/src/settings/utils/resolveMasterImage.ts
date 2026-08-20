import { uploadProductImage } from '../../services/productService';
import {
  clearPendingImage,
  getPendingImage,
} from '../../modules/products/utils/pendingImages';

/**
 * If `uri` is a deferred local pick, upload it (same endpoint as product / admin-web
 * brand & category images) and return the server URL. Otherwise return as-is.
 */
export async function resolveMasterImageUri(uri?: string | null): Promise<string> {
  const value = String(uri ?? '').trim();
  if (!value) return '';

  const pending = getPendingImage(value);
  if (!pending) return value;

  const uploaded = await uploadProductImage(pending);
  const serverUrl = String(uploaded?.url ?? '').trim();
  if (!serverUrl) {
    throw new Error('Image upload did not return a URL');
  }
  clearPendingImage(value);
  return serverUrl;
}
