import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import { hashPassword } from '../../../common/utils/password';
import type { EmployeeRecord } from './employee.service';

/** Initial portal password for newly created employee accounts only. Never logged or returned. */
const EMPLOYEE_INITIAL_PASSWORD = 'welcome@123';

const EMPLOYEE_ROLE_NAME = 'Employee';
const EMPLOYEE_ROLE_ID = '00000000-0000-4000-8000-000000000006';

export const EMPLOYEE_ROLE_PERMISSIONS: string[] = [
  'products.view',
  'products.create',
  'products.edit',
  'masters.view',
  'masters.create',
  'masters.edit',
];

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function normEmail(value: unknown): string {
  return str(value).toLowerCase();
}

function normMobile(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

/** Ensure the Employee RBAC role exists (seeded or created once). */
export async function ensureEmployeeRole(): Promise<{ id: string; name: string }> {
  await jsonDb.ensureCollection('roles');
  let role = jsonDb.findOne('roles', { name: EMPLOYEE_ROLE_NAME }) as any;
  if (!role) {
    try {
      await jsonDb.refreshCollection('roles', { force: true });
    } catch {
      /* keep local */
    }
    role = jsonDb.findOne('roles', { name: EMPLOYEE_ROLE_NAME }) as any;
  }
  if (role?.id) {
    return { id: String(role.id), name: String(role.name ?? EMPLOYEE_ROLE_NAME) };
  }

  const now = new Date().toISOString();
  const created = await jsonDb.insertAwaited('roles', {
    id: EMPLOYEE_ROLE_ID,
    name: EMPLOYEE_ROLE_NAME,
    description: 'Employee portal: products, product masters and own dealers',
    permissions: [...EMPLOYEE_ROLE_PERMISSIONS],
    is_system: false,
    isSystem: false,
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(created.id), name: EMPLOYEE_ROLE_NAME };
}

function findUserByEmailOrMobile(email: string, mobile: string): any | null {
  const users = jsonDb.findMany('users', {}) as any[];
  for (const user of users) {
    const userEmail = normEmail(user.email);
    const userMobile = normMobile(user.phone ?? user.mobile);
    if (email && userEmail && userEmail === email) return user;
    if (mobile && userMobile && userMobile === mobile) return user;
  }
  return null;
}

function displayName(employee: EmployeeRecord): string {
  return (
    str(employee.fullName) ||
    normEmail(employee.email) ||
    normMobile(employee.mobile) ||
    str(employee.employeeId) ||
    'Employee'
  );
}

export interface ProvisionResult {
  userId: string;
  created: boolean;
  linked: boolean;
}

/**
 * On employee approval: create or link the portal login account.
 * - New accounts get a hashed initial password and mustChangePassword=true.
 * - Existing accounts are reused; passwords and roles are not reset/overwritten
 *   when the user is already staff. Customers matched by email/mobile are
 *   upgraded to the Employee role so they can use the admin portal.
 * Never returns or logs the plaintext password.
 */
export async function provisionEmployeeAccount(
  employee: EmployeeRecord,
): Promise<ProvisionResult | null> {
  const email = normEmail(employee.email);
  const mobile = normMobile(employee.mobile);
  if (!email && !mobile) {
    return null;
  }

  await Promise.all([
    jsonDb.ensureCollection('users'),
    jsonDb.ensureCollection('profiles'),
    jsonDb.ensureCollection('roles'),
  ]);

  const employeeRole = await ensureEmployeeRole();
  const existingLinked = str(employee.userId);
  if (existingLinked && jsonDb.findOne('users', { id: existingLinked })) {
    return { userId: existingLinked, created: false, linked: true };
  }

  const existing = findUserByEmailOrMobile(email, mobile);
  const now = new Date().toISOString();

  if (existing?.id) {
    const userId = String(existing.id);
    const hasStaffRole =
      String(existing.role ?? '') === 'admin' || Boolean(existing.role_id ?? existing.roleId);
    const updates: Record<string, unknown> = {
      employeeId: str(employee.employeeId) || undefined,
      updated_at: now,
      updatedAt: now,
    };

    if (!hasStaffRole) {
      // Onboarded employee matched a non-staff account — grant Employee portal access.
      updates.role = 'admin';
      updates.role_id = employeeRole.id;
      const hasPassword = Boolean(str(existing.encryptedPassword || existing.password));
      if (!hasPassword) {
        updates.encryptedPassword = await hashPassword(EMPLOYEE_INITIAL_PASSWORD);
        updates.mustChangePassword = true;
      } else if (existing.mustChangePassword == null) {
        // Keep existing password; do not force reset for reused accounts with a password.
        updates.mustChangePassword = false;
      }
      if (!existing.status || String(existing.status).toUpperCase() === 'PENDING') {
        updates.status = 'ACTIVE';
        updates.mobileVerified = true;
        updates.mobile_verified = true;
      }
    }

    await jsonDb.updateAwaited('users', { id: userId }, updates);

    const profile = jsonDb.findOne('profiles', { id: userId });
    if (!profile) {
      await jsonDb.insertAwaited('profiles', {
        id: userId,
        mobile_number: mobile || '',
        fullName: displayName(employee),
        email: email || null,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const profileUpdates: Record<string, unknown> = { updatedAt: now };
      if (!str((profile as any).fullName) && employee.fullName) {
        profileUpdates.fullName = displayName(employee);
      }
      if (email && !str((profile as any).email)) profileUpdates.email = email;
      if (mobile && !str((profile as any).mobile_number)) {
        profileUpdates.mobile_number = mobile;
      }
      await jsonDb.updateAwaited('profiles', { id: userId }, profileUpdates);
    }

    return { userId, created: false, linked: true };
  }

  const userId = randomUUID();
  const encryptedPassword = await hashPassword(EMPLOYEE_INITIAL_PASSWORD);

  await jsonDb.insertAwaited('users', {
    id: userId,
    phone: mobile || null,
    email: email || null,
    role: 'admin',
    role_id: employeeRole.id,
    encryptedPassword,
    mustChangePassword: true,
    status: 'ACTIVE',
    mobileVerified: true,
    mobile_verified: true,
    employeeId: str(employee.employeeId) || null,
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  });

  await jsonDb.insertAwaited('profiles', {
    id: userId,
    mobile_number: mobile || '',
    fullName: displayName(employee),
    email: email || null,
    kyc_status: 'Pending',
    branches: [],
    pincodes: [],
    createdAt: now,
    updatedAt: now,
  });

  return { userId, created: true, linked: true };
}
