export type StaffRole =
  | 'Sales Executive'
  | 'Branch Manager'
  | 'Credit Officer'
  | 'FI Executive'
  | 'HR Executive';

export const STAFF_ROLE_OPTIONS: { label: string; value: StaffRole }[] = [
  { label: 'Sales Executive', value: 'Sales Executive' },
  { label: 'Branch Manager', value: 'Branch Manager' },
  { label: 'Credit Officer', value: 'Credit Officer' },
  { label: 'FI Executive', value: 'FI Executive' },
  { label: 'HR / HR Executive', value: 'HR Executive' },
];

/** Matches admin.controller.ts createUser() body exactly — confirmed against backend source. */
export interface CreateUserPayload {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: StaffRole;
}

export interface StaffUser {
  id: string;
  phone: string;
  email: string;
  role: string;
  roleId: string | null;
  roleName: string | null;
  status: string;   // ← this one is authoritative — reflects 'BLOCKED'/'ACTIVE' accurately
  blocked: boolean;
  created_at: string;
  profile: { fullName: string } | null;
}