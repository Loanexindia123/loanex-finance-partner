export interface Brand {
  id: string;
  name: string;
  logo: string;
  description: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeBrand(raw: unknown): Brand {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status = String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    logo: String(row['logo'] ?? row['image'] ?? row['imageUrl'] ?? '').trim(),
    description: String(row['description'] ?? '').trim(),
    status,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
  };
}

export function brandPayload(input: {
  name: string;
  logo: string;
  description: string;
  active: boolean;
}): Record<string, unknown> {
  return {
    name: input.name.trim(),
    logo: input.logo.trim(),
    description: input.description.trim(),
    status: input.active ? 'active' : 'inactive',
  };
}
