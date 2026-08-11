/**
 * Mirrors backend/src/modules/rbac/permissions.ts exactly (12 modules x 4 actions).
 * Do NOT trust admin-app's src/types/role.ts copy — it is missing "careers".
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

export const ACTION_KEYS = ['view', 'create', 'edit', 'delete'] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type ActionKey = (typeof ACTION_KEYS)[number];
export type Permission = `${ModuleKey}.${ActionKey}`;

export function permission(module: ModuleKey, action: ActionKey): Permission {
  return `${module}.${action}`;
}
