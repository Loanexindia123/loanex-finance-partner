export type WarehouseStatus = 'active' | 'inactive';

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  status: WarehouseStatus;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeWarehouse(raw: unknown): Warehouse {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status =
    String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    location: String(row['location'] ?? row['address'] ?? '').trim(),
    status,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}

export function warehousePayload(input: {
  name: string;
  location: string;
  active: boolean;
}): Record<string, unknown> {
  return {
    name: input.name.trim(),
    location: input.location.trim(),
    status: input.active ? 'active' : 'inactive',
  };
}
