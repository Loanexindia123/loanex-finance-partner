import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import { hashPassword } from '../../../common/utils/password';
import { BadRequestError, ConflictError } from '../../../common/errors/app-error';
import type { DealerRecord } from './dealer.service';

/** Initial Dealer APK password for newly created dealer accounts only. Never logged or returned. */
const DEALER_INITIAL_PASSWORD = 'welcome@123';

export const DEALER_ROLE_NAME = 'Dealer';
export const DEALER_ROLE_ID = '00000000-0000-4000-8000-000000000008';

/** Dealer APK auth does not use Admin Web permissions. Keep this set empty. */
export const DEALER_ROLE_PERMISSIONS: string[] = [];

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function normEmail(value: unknown): string {
  return str(value).toLowerCase();
}

function normMobile(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

export function isDealerApproved(
  dealer: Pick<DealerRecord, 'formStatus' | 'verificationStatus'>,
): boolean {
  return dealer.formStatus === 'approved' || dealer.verificationStatus === 'approved';
}

export function isDealerRoleName(name: unknown): boolean {
  return str(name).toLowerCase() === 'dealer';
}

export function isDealerAuthUser(user: any): boolean {
  if (!user) return false;
  if (isDealerRoleName(user.role)) return true;
  const roleId = user.role_id ?? user.roleId;
  if (!roleId) return false;
  const role = jsonDb.findOne('roles', { id: roleId }) as any;
  return isDealerRoleName(role?.name);
}

/** Resolve dealer identity from JWT sub / users.id. Never trust client dealerId. */
export function isDealerUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  const user = jsonDb.findOne('users', { id: userId }) as any;
  return isDealerAuthUser(user);
}

function isEmployeeOrAdminAccount(user: any): boolean {
  if (!user || isDealerAuthUser(user)) return false;
  return String(user.role ?? '') === 'admin' || Boolean(user.role_id ?? user.roleId);
}

export async function ensureDealerRole(): Promise<{ id: string; name: string }> {
  await jsonDb.ensureCollection('roles');
  let role = jsonDb.findOne('roles', { name: DEALER_ROLE_NAME }) as any;
  if (!role) {
    try {
      await jsonDb.refreshCollection('roles', { force: true });
    } catch {
      /* keep local */
    }
    role = jsonDb.findOne('roles', { name: DEALER_ROLE_NAME }) as any;
  }
  if (role?.id) {
    return { id: String(role.id), name: String(role.name ?? DEALER_ROLE_NAME) };
  }

  const now = new Date().toISOString();
  const created = await jsonDb.insertAwaited('roles', {
    id: DEALER_ROLE_ID,
    name: DEALER_ROLE_NAME,
    description: 'Dealer app login: no Admin Web permissions',
    permissions: [...DEALER_ROLE_PERMISSIONS],
    is_system: false,
    isSystem: false,
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(created.id), name: DEALER_ROLE_NAME };
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

function findDealerByUserId(userId: string, excludeDealerId?: string): any | null {
  const id = str(userId);
  if (!id) return null;
  const dealers = jsonDb.findMany('dealers', {}) as any[];
  return (
    dealers.find((row) => {
      if (excludeDealerId && str(row.id) === excludeDealerId) return false;
      return str(row.userId ?? row.user_id) === id;
    }) ?? null
  );
}

function displayName(dealer: DealerRecord): string {
  return (
    str(dealer.dealerName) ||
    str(dealer.ownerName) ||
    str(dealer.name) ||
    normEmail(dealer.email) ||
    normMobile(dealer.mobile) ||
    str(dealer.dealerCode) ||
    'Dealer'
  );
}

export interface DealerProvisionResult {
  userId: string;
  created: boolean;
  linked: boolean;
}

/**
 * On dealer approval: create a dedicated Dealer login user.
 * Never reuses Customer, Employee, or Admin accounts.
 * Never logs or returns the plaintext password.
 */
export async function provisionDealerAccount(
  dealer: DealerRecord,
): Promise<DealerProvisionResult> {
  const email = normEmail(dealer.email);
  const mobile = normMobile(dealer.mobile || dealer.dealerMobile);
  if (!mobile && !email) {
    throw new BadRequestError(
      'Dealer mobile number is required to create a login account',
    );
  }

  await Promise.all([
    jsonDb.ensureCollection('users'),
    jsonDb.ensureCollection('profiles'),
    jsonDb.ensureCollection('roles'),
    jsonDb.ensureCollection('dealers'),
  ]);

  const dealerRole = await ensureDealerRole();
  const existingLinked = str(dealer.userId);
  if (existingLinked && jsonDb.findOne('users', { id: existingLinked })) {
    return { userId: existingLinked, created: false, linked: true };
  }

  const existing = findUserByEmailOrMobile(email, mobile);
  if (existing?.id) {
    const existingId = String(existing.id);
    if (existingLinked && existingId === existingLinked) {
      return { userId: existingId, created: false, linked: true };
    }

    const otherDealer = findDealerByUserId(existingId, dealer.id);
    if (otherDealer) {
      throw new ConflictError(
        'This mobile/email is already linked to another dealer account',
      );
    }

    if (isEmployeeOrAdminAccount(existing)) {
      throw new ConflictError(
        'This mobile/email belongs to an employee or admin account and cannot be used for dealer login',
      );
    }

    if (isDealerAuthUser(existing) && !otherDealer) {
      return { userId: existingId, created: false, linked: true };
    }

    throw new ConflictError(
      'This mobile/email already has a user account and cannot be converted to a dealer login',
    );
  }

  const userId = randomUUID();
  const encryptedPassword = await hashPassword(DEALER_INITIAL_PASSWORD);
  const now = new Date().toISOString();

  await jsonDb.insertAwaited('users', {
    id: userId,
    phone: mobile || null,
    email: email || null,
    role: 'dealer',
    role_id: dealerRole.id,
    encryptedPassword,
    mustChangePassword: true,
    status: 'ACTIVE',
    mobileVerified: true,
    mobile_verified: true,
    dealerId: str(dealer.id) || null,
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  });

  await jsonDb.insertAwaited('profiles', {
    id: userId,
    mobile_number: mobile || '',
    fullName: displayName(dealer),
    email: email || null,
    kyc_status: 'Pending',
    branches: [],
    pincodes: [],
    createdAt: now,
    updatedAt: now,
  });

  return { userId, created: true, linked: true };
}

export function findLinkedDealerByUserId(userId: string): any | null {
  return findDealerByUserId(userId);
}
