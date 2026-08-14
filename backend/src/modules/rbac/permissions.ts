/**
 * RBAC permission registry — single source of truth for the admin portal.
 * Permission keys are `${module}.${action}` strings persisted on public.roles
 * (Supabase) and mirrored through the in-memory engine.
 * Keep in sync with the roles seed data (scripts/seed or migrate-mongo).
 */

export const MODULE_KEYS = [
  'products',
  'orders',
  'customers',
  'emi',
  'fi',
  'users',
  'roles',
  'reports',
  'masters',
  'settings',
  'notifications',
  'careers',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ACTION_KEYS = ['view', 'create', 'edit', 'delete'] as const;

export type ActionKey = (typeof ACTION_KEYS)[number];

export const MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: 'products', label: 'Products', description: 'Product catalog management' },
  { key: 'orders', label: 'Orders', description: 'Customer orders & fulfilment' },
  { key: 'customers', label: 'Customers', description: 'Customer profiles, KYC & verification' },
  { key: 'emi', label: 'EMI Applications', description: 'EMI approvals, terms, loans & disbursement' },
  { key: 'fi', label: 'Field Investigation', description: 'FI cases & field verification' },
  { key: 'users', label: 'Users', description: 'Admin portal staff accounts' },
  { key: 'roles', label: 'Roles & Permissions', description: 'Role definitions (super admin only)' },
  { key: 'reports', label: 'Reports', description: 'Business reports & exports' },
  { key: 'masters', label: 'Master Data', description: 'Suppliers, dealers, warehouses' },
  { key: 'settings', label: 'Settings', description: 'Portal settings' },
  { key: 'notifications', label: 'Notifications', description: 'Push & in-app notifications' },
  { key: 'careers', label: 'Careers', description: 'Job openings & hiring' },
];

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

/** Every permission string known to the system. */
export const ALL_PERMISSIONS: string[] = MODULE_KEYS.flatMap((module) =>
  ACTION_KEYS.map((action) => `${module}.${action}`),
);

/** Permissions granted to the system Super Admin role. */
export const SUPER_ADMIN_PERMISSIONS: string[] = [...ALL_PERMISSIONS];

export interface SeedRole {
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

/** Default roles seeded into Supabase (and the in-memory fallback). */
export const SEED_ROLES: SeedRole[] = [
  {
    name: 'Super Admin',
    description: 'Full access to every module in the admin portal',
    permissions: [...SUPER_ADMIN_PERMISSIONS],
    isSystem: true,
  },
  {
    name: 'Branch Manager',
    description: 'Run branch operations: orders, EMI approvals and field investigation',
    permissions: [
      'products.view',
      'orders.view',
      'orders.edit',
      'customers.view',
      'emi.view',
      'emi.edit',
      'fi.view',
      'fi.edit',
      'reports.view',
    ],
    isSystem: false,
  },
  {
    name: 'Credit Officer',
    description: 'Review and approve credit: EMI applications, loans and payment terms',
    permissions: [
      'products.view',
      'orders.view',
      'customers.view',
      'emi.view',
      'emi.edit',
      'fi.view',
      'reports.view',
    ],
    isSystem: false,
  },
  {
    name: 'FI Executive',
    description: 'Field investigation: view and update FI cases only',
    permissions: ['customers.view', 'emi.view', 'fi.view', 'fi.edit'],
    isSystem: false,
  },
  {
    name: 'Sales Executive',
    description: 'Product catalog: view, add and edit products',
    permissions: ['products.view', 'products.create', 'products.edit', 'customers.view', 'orders.view'],
    isSystem: false,
  },
  {
    name: 'Employee',
    description: 'Employee portal: products, product masters and own dealers',
    permissions: [
      'products.view',
      'products.create',
      'products.edit',
      'masters.view',
      'masters.create',
      'masters.edit',
    ],
    isSystem: false,
  },
];

/** Coerce a role's permissions field (jsonb array or JSON string) into a string[]. */
export function rolePermissions(role?: any): string[] {
  if (!role) return [];
  let list = role.permissions;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter((p): p is string => typeof p === 'string');
}

export function hasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes(permission);
}
