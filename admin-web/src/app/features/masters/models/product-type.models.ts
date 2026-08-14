export type ProductTypeStatus = 'active' | 'inactive';

export interface ProductType {
  id: string;
  name: string;
  status: ProductTypeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeProductType(raw: unknown): ProductType {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status =
    String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    status,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}

export function productTypePayload(input: {
  name: string;
  active: boolean;
}): Record<string, unknown> {
  return {
    name: input.name.trim(),
    status: input.active ? 'active' : 'inactive',
  };
}
