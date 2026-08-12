export type CategoryStatus = 'active' | 'inactive';

export interface CategoryRecord {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: CategoryStatus;
  parentId: string | null;
  sortOrder: number;
  createdAt?: string;
}

export interface CategoryTableRow extends CategoryRecord {
  rowType: 'category' | 'subcategory';
  parentName: string;
}

export function normalizeCategory(raw: unknown): CategoryRecord {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status =
    String(row['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const parentId = row['parentId'];
  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? '').trim(),
    description: String(row['description'] ?? '').trim(),
    icon: String(row['icon'] ?? row['image'] ?? row['imageUrl'] ?? '').trim(),
    status,
    parentId: parentId ? String(parentId) : null,
    sortOrder: Number(row['sortOrder'] ?? 0) || 0,
    createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
  };
}

export function categoryPayload(input: {
  name: string;
  icon: string;
  description: string;
  active: boolean;
  parentId?: string | null;
}): Record<string, unknown> {
  return {
    name: input.name.trim(),
    icon: input.icon.trim(),
    description: input.description.trim(),
    status: input.active ? 'active' : 'inactive',
    parentId: input.parentId ?? null,
  };
}

export function flattenCategories(items: CategoryRecord[]): CategoryTableRow[] {
  const parents = items
    .filter((item) => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const rows: CategoryTableRow[] = [];
  for (const parent of parents) {
    rows.push({
      ...parent,
      rowType: 'category',
      parentName: '—',
    });
    const subs = items
      .filter((item) => item.parentId === parent.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const sub of subs) {
      rows.push({
        ...sub,
        rowType: 'subcategory',
        parentName: parent.name,
      });
    }
  }
  return rows;
}
