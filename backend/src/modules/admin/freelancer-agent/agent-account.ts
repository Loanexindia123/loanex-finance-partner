import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import { hashPassword } from '../../../common/utils/password';
import { BadRequestError, ConflictError } from '../../../common/errors/app-error';
import { isDealerAuthUser } from '../dealer/dealer-account';
import type { FreelancerAgentRecord } from './freelancer-agent.service';

/** Initial Agent APK password for newly created agent accounts only. Never logged or returned. */
const AGENT_INITIAL_PASSWORD = 'welcome@123';

export const AGENT_ROLE_NAME = 'Agent';
export const AGENT_ROLE_ID = '00000000-0000-4000-8000-000000000009';

/** Agent APK auth does not use Admin Web permissions. Keep this set empty. */
export const AGENT_ROLE_PERMISSIONS: string[] = [];

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function normEmail(value: unknown): string {
  return str(value).toLowerCase();
}

function normMobile(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

export function isAgentApproved(
  agent: Pick<FreelancerAgentRecord, 'formStatus'>,
): boolean {
  return str(agent.formStatus).toLowerCase() === 'approved';
}

export function isAgentRoleName(name: unknown): boolean {
  return str(name).toLowerCase() === 'agent';
}

export function isAgentAuthUser(user: any): boolean {
  if (!user) return false;
  if (isAgentRoleName(user.role)) return true;
  const roleId = user.role_id ?? user.roleId;
  if (!roleId) return false;
  const role = jsonDb.findOne('roles', { id: roleId }) as any;
  return isAgentRoleName(role?.name);
}

/** Resolve agent identity from JWT sub / users.id. Never trust client agentId. */
export function isAgentUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  const user = jsonDb.findOne('users', { id: userId }) as any;
  return isAgentAuthUser(user);
}

/**
 * Same as isAgentUserId, but loads the user from Mongo when the local
 * jsonDb cache is cold (common right after API restart).
 */
export async function resolveIsAgentUserId(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  if (isAgentUserId(userId)) return true;
  try {
    const { authRepository } = await import('../../auth/auth.repository');
    const fromMongo = await authRepository.findById(userId);
    if (!fromMongo || !isAgentAuthUser(fromMongo)) return false;
    const collection = jsonDb.getCollection('users');
    if (!collection.some((u: any) => u.id === fromMongo.id)) {
      const { profiles: _profiles, ...row } = fromMongo as any;
      collection.push(row);
    }
    return true;
  } catch {
    return false;
  }
}

function isEmployeeOrAdminAccount(user: any): boolean {
  if (!user || isAgentAuthUser(user) || isDealerAuthUser(user)) return false;
  return String(user.role ?? '') === 'admin' || Boolean(user.role_id ?? user.roleId);
}

export async function ensureAgentRole(): Promise<{ id: string; name: string }> {
  await jsonDb.ensureCollection('roles');
  let role = jsonDb.findOne('roles', { name: AGENT_ROLE_NAME }) as any;
  if (!role) {
    try {
      await jsonDb.refreshCollection('roles', { force: true });
    } catch {
      /* keep local */
    }
    role = jsonDb.findOne('roles', { name: AGENT_ROLE_NAME }) as any;
  }
  if (role?.id) {
    return { id: String(role.id), name: String(role.name ?? AGENT_ROLE_NAME) };
  }

  const now = new Date().toISOString();
  const created = await jsonDb.insertAwaited('roles', {
    id: AGENT_ROLE_ID,
    name: AGENT_ROLE_NAME,
    description: 'Agent app login: no Admin Web permissions',
    permissions: [...AGENT_ROLE_PERMISSIONS],
    is_system: false,
    isSystem: false,
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(created.id), name: AGENT_ROLE_NAME };
}

function findUserByEmailOrMobile(email: string, mobile: string): any | null {
  const users = jsonDb.findMany('users', {}) as any[];
  for (const user of users) {
    const userEmail = normEmail(user.email);
    const userMobile = normMobile(user.phone ?? user.mobile);
    // Identifier priority: email, then mobile.
    if (email && userEmail && userEmail === email) return user;
    if (mobile && userMobile && userMobile === mobile) return user;
  }
  return null;
}

function findAgentByUserId(userId: string, excludeAgentId?: string): any | null {
  const id = str(userId);
  if (!id) return null;
  const agents = jsonDb.findMany('freelancer_agents', {}) as any[];
  return (
    agents.find((row) => {
      if (excludeAgentId && str(row.id) === excludeAgentId) return false;
      return str(row.userId ?? row.user_id) === id;
    }) ?? null
  );
}

function displayName(agent: FreelancerAgentRecord): string {
  return (
    str(agent.fullName) ||
    normEmail(agent.email) ||
    normMobile(agent.mobile) ||
    str(agent.agentId) ||
    'Agent'
  );
}

export interface AgentProvisionResult {
  userId: string;
  created: boolean;
  linked: boolean;
}

/**
 * On agent approval: create a dedicated Agent login user.
 * Mirrors Dealer provisioning — never reuses Customer, Employee, Admin, or Dealer accounts.
 * Never logs or returns the plaintext password.
 */
export async function provisionAgentAccount(
  agent: FreelancerAgentRecord,
): Promise<AgentProvisionResult> {
  const email = normEmail(agent.email);
  const mobile = normMobile(agent.mobile);
  if (!mobile && !email) {
    throw new BadRequestError(
      'Agent mobile number or email is required to create a login account',
    );
  }

  await Promise.all([
    jsonDb.ensureCollection('users'),
    jsonDb.ensureCollection('profiles'),
    jsonDb.ensureCollection('roles'),
    jsonDb.ensureCollection('freelancer_agents'),
  ]);

  const agentRole = await ensureAgentRole();
  const existingLinked = str((agent as any).userId);
  if (existingLinked && jsonDb.findOne('users', { id: existingLinked })) {
    return { userId: existingLinked, created: false, linked: true };
  }

  const existing = findUserByEmailOrMobile(email, mobile);
  if (existing?.id) {
    const existingId = String(existing.id);
    if (existingLinked && existingId === existingLinked) {
      return { userId: existingId, created: false, linked: true };
    }

    const otherAgent = findAgentByUserId(existingId, agent.id);
    if (otherAgent) {
      throw new ConflictError(
        'This mobile/email is already linked to another agent account',
      );
    }

    if (isDealerAuthUser(existing)) {
      throw new ConflictError(
        'This mobile/email belongs to a dealer account and cannot be used for agent login',
      );
    }

    if (isEmployeeOrAdminAccount(existing)) {
      throw new ConflictError(
        'This mobile/email belongs to an employee or admin account and cannot be used for agent login',
      );
    }

    if (isAgentAuthUser(existing) && !otherAgent) {
      return { userId: existingId, created: false, linked: true };
    }

    throw new ConflictError(
      'This mobile/email already has a user account and cannot be converted to an agent login',
    );
  }

  const userId = randomUUID();
  const encryptedPassword = await hashPassword(AGENT_INITIAL_PASSWORD);
  const now = new Date().toISOString();
  const parentDealerId = str(agent.dealerId) || null;

  await jsonDb.insertAwaited('users', {
    id: userId,
    phone: mobile || null,
    email: email || null,
    role: 'agent',
    role_id: agentRole.id,
    encryptedPassword,
    mustChangePassword: true,
    status: 'ACTIVE',
    mobileVerified: true,
    mobile_verified: true,
    dealerId: parentDealerId,
    agentProfileId: str(agent.id) || null,
    created_at: now,
    updated_at: now,
    createdAt: now,
    updatedAt: now,
  });

  await jsonDb.insertAwaited('profiles', {
    id: userId,
    mobile_number: mobile || '',
    fullName: displayName(agent),
    email: email || null,
    kyc_status: 'Pending',
    branches: [],
    pincodes: [],
    createdAt: now,
    updatedAt: now,
  });

  return { userId, created: true, linked: true };
}

export function findLinkedAgentByUserId(userId: string): any | null {
  return findAgentByUserId(userId);
}
