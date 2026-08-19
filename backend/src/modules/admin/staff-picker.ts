import { jsonDb } from '../../config/json-db';
import { isDealerAuthUser } from './dealer/dealer-account';

export interface StaffPickerOption {
  id: string;
  name: string;
  email: string;
  mobile: string;
  phone: string;
  role: 'admin';
  roleName: string;
  employeeCode: string;
  profile: {
    id: string;
    fullName: string;
    email: string;
    mobile_number: string;
  };
}

function str(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Portal staff eligible for assignment pickers (B2B manager, creator, reporting person).
 * Excludes customers, dealer app accounts, and blocked users.
 */
export function isStaffPickerUser(user: any): boolean {
  if (!user || isDealerAuthUser(user)) return false;
  if (user.blocked === true) return false;
  const status = str(user.status).toLowerCase();
  if (status === 'blocked' || status === 'inactive' || status === 'disabled') return false;
  return str(user.role) === 'admin' || Boolean(user.role_id ?? user.roleId);
}

function displayName(user: any, profile: any): string {
  return (
    str(profile?.fullName) ||
    str(profile?.name) ||
    str(user?.email) ||
    str(user?.phone) ||
    str(profile?.email) ||
    str(profile?.mobile_number)
  );
}

export function serializeStaffOption(user: any): StaffPickerOption {
  const profile = jsonDb.findOne('profiles', { id: user.id }) as any;
  const name = displayName(user, profile);
  const email = str(user.email) || str(profile?.email);
  const mobile = str(user.phone) || str(profile?.mobile_number);
  const role = jsonDb.findOne('roles', { id: user.role_id ?? user.roleId }) as any;
  return {
    id: String(user.id),
    name,
    email,
    mobile,
    phone: mobile,
    role: 'admin',
    roleName: str(role?.name) || 'Staff',
    employeeCode: str(user.employeeId ?? user.employee_code ?? profile?.employeeCode),
    profile: {
      id: String(user.id),
      fullName: name,
      email,
      mobile_number: mobile,
    },
  };
}

/** Slim staff directory for form dropdowns — not the full /admin/users dump. */
export async function listStaffPickerOptions(): Promise<StaffPickerOption[]> {
  await Promise.all([
    jsonDb.refreshCollection('users'),
    jsonDb.ensureCollection('profiles'),
    jsonDb.ensureCollection('roles'),
  ]);
  return jsonDb
    .findMany('users', {})
    .filter(isStaffPickerUser)
    .map(serializeStaffOption)
    .filter((row) => row.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
