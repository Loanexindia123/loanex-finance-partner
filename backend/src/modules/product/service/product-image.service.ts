import { Readable } from 'stream';
import { Response } from 'express';
import { GridFSBucket, ObjectId } from 'mongodb';
import { getMongoDb } from '../../../config/mongo';
import { jsonDb } from '../../../config/json-db';
import { BadRequestError, NotFoundError } from '../../../common/errors/app-error';

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_PATH = '/api/v1/products/images';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const GRIDFS_BUCKET = 'fs';
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const IMAGE_REF_RE = /\/api\/v1\/products\/images\/([a-f0-9]{24})/i;

export type UploadedProductImage = {
  id: string;
  url: string;
  fileName: string;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'image.jpg';
}

function extensionOk(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

function productImageUrl(id: string): string {
  return `${PRODUCT_IMAGE_PATH}/${id}`;
}

async function getBucket(): Promise<GridFSBucket> {
  const db = await getMongoDb();
  return new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
}

function parseObjectId(raw: string): ObjectId {
  if (!OBJECT_ID_RE.test(raw)) {
    throw new NotFoundError('Product image not found.');
  }
  return new ObjectId(raw);
}

export function extractGridFsImageId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const fromPath = trimmed.match(IMAGE_REF_RE);
  if (fromPath) return fromPath[1].toLowerCase();
  if (OBJECT_ID_RE.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function addImageRef(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    const id = extractGridFsImageId(value);
    if (id) out.add(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => addImageRef(item, out));
  }
}

export function collectProductImageIds(product: unknown): Set<string> {
  const ids = new Set<string>();
  if (!product || typeof product !== 'object') return ids;
  const row = product as Record<string, unknown>;
  const wizard =
    row['wizardData'] && typeof row['wizardData'] === 'object'
      ? (row['wizardData'] as Record<string, unknown>)
      : {};

  addImageRef(row['image'], ids);
  addImageRef(row['imageUrl'], ids);
  addImageRef(row['thumbnail'], ids);
  addImageRef(row['images'], ids);
  addImageRef(row['galleryImages'], ids);
  addImageRef(wizard['primaryImage'], ids);
  addImageRef(wizard['galleryImages'], ids);
  addImageRef(wizard['variantImages'], ids);

  const variantLists = [row['variants'], wizard['variants']];
  for (const list of variantLists) {
    if (!Array.isArray(list)) continue;
    for (const variant of list) {
      if (!variant || typeof variant !== 'object') continue;
      const item = variant as Record<string, unknown>;
      addImageRef(item['variantImage'], ids);
      addImageRef(item['galleryImages'], ids);
      addImageRef(item['images'], ids);
    }
  }
  return ids;
}

function isReferencedByOtherProduct(imageId: string, exceptProductId?: string): boolean {
  const products = jsonDb.getCollection('products') as Array<Record<string, unknown>>;
  return products.some((product) => {
    const id = String(product['id'] ?? '');
    if (exceptProductId && id === exceptProductId) return false;
    return collectProductImageIds(product).has(imageId);
  });
}

export async function deleteGridFsImage(imageId: string): Promise<void> {
  const sourceId = OBJECT_ID_RE.test(imageId) ? imageId.toLowerCase() : imageId;
  try {
    const bucket = await getBucket();
    await bucket.delete(parseObjectId(imageId));
  } catch (err) {
    if (err instanceof NotFoundError) {
      // still try derived cleanup below
    } else {
      console.warn(`[Products] GridFS delete failed for ${imageId}:`, err);
    }
  }
  await deleteDerivedVariants(sourceId);
}

export async function deleteOrphanedProductImages(
  previous: unknown,
  next: unknown,
  productId?: string,
): Promise<void> {
  const before = collectProductImageIds(previous);
  const after = collectProductImageIds(next);
  const exceptId =
    productId ||
    (next && typeof next === 'object' ? String((next as Record<string, unknown>)['id'] ?? '') : '') ||
    (previous && typeof previous === 'object'
      ? String((previous as Record<string, unknown>)['id'] ?? '')
      : '');

  for (const imageId of before) {
    if (after.has(imageId)) continue;
    if (isReferencedByOtherProduct(imageId, exceptId || undefined)) continue;
    await deleteGridFsImage(imageId);
  }
}

function parseImageDataUrl(value: string): { mime: string; buffer: Buffer; fileName: string } | null {
  const match = value.trim().match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[3].replace(/\s/g, ''), 'base64');
  if (!buffer.length) return null;
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.replace('image/', '');
  return { mime, buffer, fileName: `image.${ext}` };
}

async function persistOneImage(value: unknown): Promise<unknown> {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return value;
  const parsed = parseImageDataUrl(value);
  if (!parsed) {
    throw new BadRequestError('Invalid inline product image.');
  }
  const stored = await storeProductImage({
    buffer: parsed.buffer,
    size: parsed.buffer.length,
    mimetype: parsed.mime,
    originalname: parsed.fileName,
  } as Express.Multer.File);
  return stored.url;
}

async function persistImageList(value: unknown): Promise<unknown> {
  if (!Array.isArray(value)) return value;
  const next: unknown[] = [];
  for (const item of value) {
    next.push(await persistOneImage(item));
  }
  return next;
}

async function persistVariantImages(value: unknown): Promise<unknown> {
  if (!Array.isArray(value)) return value;
  const next = [];
  for (const variant of value) {
    if (!variant || typeof variant !== 'object') {
      next.push(variant);
      continue;
    }
    const row = { ...(variant as Record<string, unknown>) };
    row['variantImage'] = await persistOneImage(row['variantImage']);
    row['galleryImages'] = await persistImageList(row['galleryImages']);
    next.push(row);
  }
  return next;
}

/** Convert wizard data-URL images to GridFS refs during product create/update only. */
export async function persistInlineProductImages<T>(data: T): Promise<T> {
  if (!data || typeof data !== 'object') return data;
  const next = { ...(data as Record<string, unknown>) };
  next['image'] = await persistOneImage(next['image']);
  next['galleryImages'] = await persistImageList(next['galleryImages']);
  next['variants'] = await persistVariantImages(next['variants']);

  if (next['wizardData'] && typeof next['wizardData'] === 'object') {
    const wizard = { ...(next['wizardData'] as Record<string, unknown>) };
    wizard['primaryImage'] = await persistOneImage(wizard['primaryImage']);
    wizard['galleryImages'] = await persistImageList(wizard['galleryImages']);
    wizard['variantImages'] = await persistImageList(wizard['variantImages']);
    wizard['variants'] = await persistVariantImages(wizard['variants']);
    next['wizardData'] = wizard;
  }

  return next as T;
}

export async function storeProductImage(
  file: Express.Multer.File | undefined,
): Promise<UploadedProductImage> {
  if (!file?.buffer?.length) {
    throw new BadRequestError('Image file is required.');
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new BadRequestError('Image must be 5MB or smaller.');
  }

  const mime = String(file.mimetype || '');
  const original = sanitizeFileName(file.originalname || 'image.jpg');
  if (!ALLOWED_MIME.has(mime) && !extensionOk(original)) {
    throw new BadRequestError('Image must be JPG, PNG, WEBP, or GIF.');
  }

  const bucket = await getBucket();
  const id = new ObjectId();
  const upload = bucket.openUploadStreamWithId(id, original, {
    metadata: {
      contentType: mime || 'image/jpeg',
      originalName: original,
      kind: 'product-image',
      uploadedAt: new Date().toISOString(),
    },
  });

  await new Promise<void>((resolve, reject) => {
    upload.once('finish', () => resolve());
    upload.once('error', reject);
    Readable.from(file.buffer).pipe(upload);
  });

  const imageId = id.toHexString();
  return {
    id: imageId,
    url: productImageUrl(imageId),
    fileName: original,
  };
}

/** Supported resize widths for list/banner/thumb (uploaded originals stay untouched). */
const RESIZE_WIDTHS = new Set([200, 400, 800]);
const DERIVED_BUCKET = 'product_image_derived';
const MEMORY_CACHE_MAX = 64;

type CachedWebp = { buffer: Buffer; contentType: string };
const memoryWebpCache = new Map<string, CachedWebp>();

function memoryCacheKey(imageId: string, width: number): string {
  return `${imageId}:w${width}`;
}

function memoryCacheGet(imageId: string, width: number): CachedWebp | null {
  const key = memoryCacheKey(imageId, width);
  const hit = memoryWebpCache.get(key);
  if (!hit) return null;
  // Refresh LRU order
  memoryWebpCache.delete(key);
  memoryWebpCache.set(key, hit);
  return hit;
}

function memoryCacheSet(imageId: string, width: number, value: CachedWebp): void {
  const key = memoryCacheKey(imageId, width);
  if (memoryWebpCache.has(key)) memoryWebpCache.delete(key);
  memoryWebpCache.set(key, value);
  while (memoryWebpCache.size > MEMORY_CACHE_MAX) {
    const oldest = memoryWebpCache.keys().next().value;
    if (oldest == null) break;
    memoryWebpCache.delete(oldest);
  }
}

function normalizeResizeWidth(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const width = Math.round(n);
  return RESIZE_WIDTHS.has(width) ? width : null;
}

async function getDerivedBucket(): Promise<GridFSBucket> {
  const db = await getMongoDb();
  return new GridFSBucket(db, { bucketName: DERIVED_BUCKET });
}

async function readBucketBuffer(bucket: GridFSBucket, id: ObjectId): Promise<Buffer> {
  const download = bucket.openDownloadStream(id);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    download.on('data', (chunk: Buffer) => chunks.push(chunk));
    download.once('error', reject);
    download.once('end', () => resolve());
  });
  return Buffer.concat(chunks);
}

async function findDerivedFileId(sourceId: string, width: number): Promise<ObjectId | null> {
  const db = await getMongoDb();
  const file = await db.collection(`${DERIVED_BUCKET}.files`).findOne({
    'metadata.kind': 'product-image-derived',
    'metadata.sourceId': sourceId,
    'metadata.width': width,
  });
  return file?._id instanceof ObjectId ? file._id : null;
}

async function storeDerivedWebp(
  sourceId: string,
  width: number,
  buffer: Buffer,
): Promise<ObjectId> {
  const bucket = await getDerivedBucket();
  const existing = await findDerivedFileId(sourceId, width);
  if (existing) {
    try {
      await bucket.delete(existing);
    } catch {
      // ignore stale delete races
    }
  }

  const id = new ObjectId();
  const upload = bucket.openUploadStreamWithId(id, `${sourceId}_w${width}.webp`, {
    metadata: {
      kind: 'product-image-derived',
      sourceId,
      width,
      contentType: 'image/webp',
      createdAt: new Date().toISOString(),
    },
  });

  await new Promise<void>((resolve, reject) => {
    upload.once('finish', () => resolve());
    upload.once('error', reject);
    Readable.from(buffer).pipe(upload);
  });

  return id;
}

async function deleteDerivedVariants(sourceId: string): Promise<void> {
  try {
    const db = await getMongoDb();
    const bucket = await getDerivedBucket();
    const files = await db
      .collection(`${DERIVED_BUCKET}.files`)
      .find({
        'metadata.kind': 'product-image-derived',
        'metadata.sourceId': sourceId,
      })
      .toArray();
    for (const file of files) {
      if (file._id instanceof ObjectId) {
        try {
          await bucket.delete(file._id);
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn(`[Products] Derived image cleanup failed for ${sourceId}:`, err);
  }
  for (const width of RESIZE_WIDTHS) {
    memoryWebpCache.delete(memoryCacheKey(sourceId, width));
  }
}

async function getOrCreateResizedWebp(
  sourceId: string,
  sourceObjectId: ObjectId,
  width: number,
): Promise<Buffer> {
  const mem = memoryCacheGet(sourceId, width);
  if (mem) return mem.buffer;

  const derivedId = await findDerivedFileId(sourceId, width);
  if (derivedId) {
    const bucket = await getDerivedBucket();
    const buffer = await readBucketBuffer(bucket, derivedId);
    memoryCacheSet(sourceId, width, { buffer, contentType: 'image/webp' });
    return buffer;
  }

  const sharp = (await import('sharp')).default;
  const sourceBucket = await getBucket();
  const input = await readBucketBuffer(sourceBucket, sourceObjectId);
  const output = await sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  try {
    await storeDerivedWebp(sourceId, width, output);
  } catch (err) {
    console.warn(`[Products] Failed to persist derived w=${width} for ${sourceId}:`, err);
  }

  memoryCacheSet(sourceId, width, { buffer: output, contentType: 'image/webp' });
  return output;
}

function sendWebp(res: Response, buffer: Buffer, cacheStatus: 'HIT' | 'MISS' | 'RESIZE'): void {
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('X-Image-Cache', cacheStatus);
  res.setHeader('X-Image-Variant', 'webp');
  res.end(buffer);
}

export async function streamProductImage(
  imageId: string,
  res: Response,
  widthQuery?: unknown,
): Promise<void> {
  const id = parseObjectId(imageId);
  const sourceId = id.toHexString();
  const db = await getMongoDb();
  const file = await db.collection(`${GRIDFS_BUCKET}.files`).findOne({ _id: id });
  if (!file) {
    throw new NotFoundError('Product image not found.');
  }

  const meta =
    file['metadata'] && typeof file['metadata'] === 'object'
      ? (file['metadata'] as Record<string, unknown>)
      : {};
  const contentType =
    (typeof meta['contentType'] === 'string' && meta['contentType']) ||
    (typeof file['contentType'] === 'string' && file['contentType']) ||
    'application/octet-stream';

  const targetWidth = normalizeResizeWidth(widthQuery);
  const canResize =
    targetWidth != null && !String(contentType).toLowerCase().includes('gif');

  if (canResize && targetWidth != null) {
    try {
      const hadMemory = memoryCacheGet(sourceId, targetWidth) != null;
      const hadDerived = !hadMemory && (await findDerivedFileId(sourceId, targetWidth)) != null;
      const output = await getOrCreateResizedWebp(sourceId, id, targetWidth);
      sendWebp(res, output, hadMemory || hadDerived ? 'HIT' : 'RESIZE');
      return;
    } catch (err) {
      console.error(`[Products] Resize failed for ${sourceId} w=${targetWidth}:`, err);
      // Fall through to original only if resize truly fails.
    }
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Image-Variant', 'original');
  if (typeof file['length'] === 'number') {
    res.setHeader('Content-Length', String(file['length']));
  }

  const bucket = await getBucket();
  const download = bucket.openDownloadStream(id);
  await new Promise<void>((resolve, reject) => {
    download.once('error', reject);
    res.once('error', reject);
    res.once('finish', () => resolve());
    download.pipe(res);
  });
}
