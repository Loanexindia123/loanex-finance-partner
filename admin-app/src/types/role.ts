/**
 * RBAC types for the LoanEx admin portal.
 * Permission keys mirror backend/src/modules/rbac/permissions.ts.
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
  'freelancers',
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
  {
    key: 'freelancers',
    label: 'Freelancer / Growing Partner',
    description: 'Freelancer agent onboarding, approval and payout view',
  },
];

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

export const ALL_PERMISSIONS: string[] = MODULE_KEYS.flatMap((module) =>
  ACTION_KEYS.map((action) => `${module}.${action}`),
);

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function permissionKey(module: ModuleKey, action: ActionKey): string {
  return `${module}.${action}`;
}

export function parsePermission(permission: string): { module: ModuleKey; action: ActionKey } | null {
  const [module, action] = permission.split('.');
  if (!module || !action) return null;
  return {
    module: module as ModuleKey,
    action: action as ActionKey,
  };
}
