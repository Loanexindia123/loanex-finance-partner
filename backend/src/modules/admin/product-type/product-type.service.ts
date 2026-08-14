import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../common/errors/app-error';
import type {
  CreateProductTypeBody,
  UpdateProductTypeBody,
} from './product-type.validator';

const COLLECTION = 'product_types';

/** Seeded defaults — must match the historical Admin Web PRODUCT_TYPES list. */
export const DEFAULT_PRODUCT_TYPES = [
  'Smartphone',
  'Tablet',
  'Laptop',
  'Accessories',
  'Smartwatch',
  'Audio',
] as const;

export interface ProductTypeRecord {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function toPublic(row: any): ProductTypeRecord {
  const status = row?.status === 'inactive' ? 'inactive' : 'active';
  return {
    id: String(row.id),
    name: String(row.name ?? '').trim(),
    status,
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

async function ensureReady(): Promise<void> {
  await jsonDb.ensureCollection(COLLECTION);
}

function findByName(name: string, excludeId?: string): any | null {
  const key = normalizeKey(name);
  const items = jsonDb.findMany(COLLECTION, {}) as any[];
  return (
    items.find((item) => {
      if (excludeId && String(item.id) === excludeId) return false;
      return normalizeKey(String(item.name ?? '')) === key;
    }) ?? null
  );
}

function assertUniqueName(name: string, excludeId?: string): void {
  if (findByName(name, excludeId)) {
    throw new ConflictError('Product Type name already exists');
  }
}

/**
 * Insert any missing default Product Types without duplicating existing names
 * (case-insensitive). Safe to call on every list.
 */
export async function ensureDefaultProductTypes(): Promise<void> {
  await ensureReady();
  const existing = jsonDb.findMany(COLLECTION, {}) as any[];
  const existingKeys = new Set(
    existing.map((row) => normalizeKey(String(row.name ?? ''))).filter(Boolean),
  );

  for (const name of DEFAULT_PRODUCT_TYPES) {
    const key = normalizeKey(name);
    if (existingKeys.has(key)) continue;
    jsonDb.insert(COLLECTION, {
      id: randomUUID(),
      name,
      status: 'active',
    });
    existingKeys.add(key);
  }
}

export class ProductTypeService {
  list = async (): Promise<ProductTypeRecord[]> => {
    await ensureDefaultProductTypes();
    return (jsonDb.findMany(COLLECTION, {}) as any[])
      .map(toPublic)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  listActive = async (): Promise<ProductTypeRecord[]> => {
    const all = await this.list();
    return all.filter((item) => item.status === 'active');
  };

  getById = async (id: string): Promise<ProductTypeRecord> => {
    await ensureReady();
    const row = jsonDb.findOne(COLLECTION, { id });
    if (!row) throw new NotFoundError('Product Type not found');
    return toPublic(row);
  };

  create = async (body: CreateProductTypeBody): Promise<ProductTypeRecord> => {
    await ensureReady();
    const name = body.name.trim();
    if (!name) throw new BadRequestError('Product Type name is required');
    assertUniqueName(name);

    const status = body.status === 'inactive' ? 'inactive' : 'active';
    const created = jsonDb.insert(COLLECTION, {
      id: body.id?.trim() || randomUUID(),
      name,
      status,
    });
    return toPublic(created);
  };

  update = async (
    id: string,
    body: UpdateProductTypeBody,
  ): Promise<ProductTypeRecord> => {
    await ensureReady();
    const existing = jsonDb.findOne(COLLECTION, { id });
    if (!existing) throw new NotFoundError('Product Type not found');

    const nextName =
      body.name !== undefined ? String(body.name).trim() : String(existing.name ?? '').trim();
    if (!nextName) throw new BadRequestError('Product Type name is required');
    assertUniqueName(nextName, id);

    const nextStatus =
      body.status !== undefined
        ? body.status === 'inactive'
          ? 'inactive'
          : 'active'
        : existing.status === 'inactive'
          ? 'inactive'
          : 'active';

    const updated = jsonDb.update(
      COLLECTION,
      { id },
      {
        name: nextName,
        status: nextStatus,
      },
    );
    return toPublic(updated);
  };

  delete = async (id: string): Promise<{ deleted: boolean }> => {
    await ensureReady();
    const existing = jsonDb.findOne(COLLECTION, { id });
    if (!existing) throw new NotFoundError('Product Type not found');
    jsonDb.delete(COLLECTION, { id });
    return { deleted: true };
  };
}

export const productTypeService = new ProductTypeService();
