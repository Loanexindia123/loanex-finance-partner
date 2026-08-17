/**
 * Mirrors backend/src/modules/rbac/permissions.ts (modules x view/create/edit/delete,
 * plus freelancer extra actions: approve, reject, payout).
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
  'freelancers',
] as const;

export const ACTION_KEYS = ['view', 'create', 'edit', 'delete'] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type ActionKey = (typeof ACTION_KEYS)[number];
export type ExtraPermission = 'freelancers.approve' | 'freelancers.reject' | 'freelancers.payout';
export type Permission = `${ModuleKey}.${ActionKey}` | ExtraPermission;

export function permission(module: ModuleKey, action: ActionKey): Permission {
  return `${module}.${action}`;
}
