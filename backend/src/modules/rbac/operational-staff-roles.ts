import { jsonDb } from '../../config/json-db';
import { ForbiddenError } from '../../common/errors/app-error';
import {
  OPERATIONAL_STAFF_ROLE_IDS,
  OPERATIONAL_STAFF_ROLE_NAMES,
  SEED_ROLES,
  isOperationalStaffRoleName,
  isSuperAdminRole,
  type OperationalStaffRoleName,
} from './permissions';

function normalizeName(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isProtectedRoleName(name: unknown): boolean {
  const normalized = normalizeName(name);
  return normalized === 'super admin' || normalized === 'admin';
}

export function isProtectedStaffUser(user: any): boolean {
  if (!user) return false;
  if (normalizeName(user.role) === 'admin' && !(user.role_id ?? user.roleId)) return true;
  const roleId = user.role_id ?? user.roleId ?? null;
  const role = roleId ? jsonDb.findOne('roles', { id: roleId }) : null;
  return isSuperAdminRole(role) || isProtectedRoleName(role?.name);
}

/**
 * Insert missing operational seed roles (currently HR Executive) without
 * touching Super Admin / existing role documents or their permissions.
 */
export async function ensureOperationalStaffRoles(): Promise<void> {
  await jsonDb.ensureCollection('roles');
  const now = new Date().toISOString();

  for (const name of OPERATIONAL_STAFF_ROLE_NAMES) {
    const byName = jsonDb.findOne('roles', { name });
    if (byName) continue;
    const id = OPERATIONAL_STAFF_ROLE_IDS[name];
    const byId = jsonDb.findOne('roles', { id });
    if (byId) continue;
    const seed = SEED_ROLES.find((role) => role.name === name);
    if (!seed) continue;
    await jsonDb.insertAwaited('roles', {
      id,
      name: seed.name,
      description: seed.description,
      permissions: [...seed.permissions],
      is_system: false,
      isSystem: false,
      created_at: now,
      updated_at: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Add User / role-change requests may only assign the operational staff roles.
 * Super Admin, Admin, Employee, Customer and crafted role IDs are rejected.
 */
export function assertAssignableOperationalRole(assignment: {
  role: string;
  roleId: string | null;
}): void {
  if (!assignment.roleId) {
    throw new ForbiddenError('Only operational staff roles can be assigned through Add User');
  }

  const role = jsonDb.findOne('roles', { id: assignment.roleId });
  if (!role) {
    throw new ForbiddenError('Only operational staff roles can be assigned through Add User');
  }

  if (Boolean(role.is_system ?? role.isSystem) || isSuperAdminRole(role) || isProtectedRoleName(role.name)) {
    throw new ForbiddenError('Super Admin and Admin cannot be assigned through Add User');
  }

  if (!isOperationalStaffRoleName(role.name)) {
    throw new ForbiddenError('Only operational staff roles can be assigned through Add User');
  }
}

export function operationalRoleLabel(name: OperationalStaffRoleName): string {
  return name === 'HR Executive' ? 'HR / HR Executive' : name;
}
