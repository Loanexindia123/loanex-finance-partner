import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { jsonDb } from '../../config/json-db';
import { sendSuccess } from '../../common/utils/api-response';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors/app-error';
import { hashPassword } from '../../common/utils/password';
import { rolePermissions, SUPER_ADMIN_PERMISSIONS } from '../rbac/permissions';

/** Resolve role + effective permissions for a user row (sync, in-memory). */
export function resolveRbacForUser(user: any) {
  const roleId = user?.role_id ?? user?.roleId ?? null;
  const role = roleId ? jsonDb.findOne('roles', { id: roleId }) : null;
  let permissions: string[] = [];
  if (role) {
    permissions = rolePermissions(role);
  } else if (!roleId && String(user?.role ?? '') === 'admin') {
    // Legacy admins WITHOUT a role_id keep full access. If role_id IS set but
    // the role cannot be found (deleted / not yet synced), deny — matching
    // rolesService.resolveUserPermissions. Never escalate to Super Admin.
    permissions = [...SUPER_ADMIN_PERMISSIONS];
  }
  return {
    roleId: roleId ?? null,
    roleName: role?.name ?? (permissions.length > 0 ? 'Super Admin' : null),
    permissions,
  };
}

/**
 * Normalize the role assignment from an admin-app payload:
 *  - roleId → that role (must exist)
 *  - role = 'customer' (case-insensitive) → customer (no role)
 *  - role = any other string → match a role by name (seeded or custom)
 *  - role = 'admin' with no roleId → Super Admin (legacy behaviour)
 *  - unknown role string → BadRequestError (fail closed, never escalate)
 */
export function resolveRoleAssignment(body: any): { role: string; roleId: string | null } {
  if (body.roleId) {
    const role = jsonDb.findOne('roles', { id: String(body.roleId) });
    if (!role) {
      throw new BadRequestError('The selected role does not exist');
    }
    return { role: 'admin', roleId: role.id };
  }

  if (
    body.role === undefined ||
    body.role === null ||
    String(body.role).trim().toLowerCase() === 'customer'
  ) {
    return { role: 'customer', roleId: null };
  }

  if (body.role === 'admin') {
    return { role: 'admin', roleId: null }; // legacy → Super Admin via fallback
  }

  // Display-name roles (e.g. "Sales Executive"): match against the roles
  // collection by name — covers the seeded roles AND custom roles created via
  // the Roles UI.
  const roleByName = jsonDb.findOne('roles', { name: body.role });
  if (roleByName) {
    return { role: 'admin', roleId: roleByName.id };
  }

  // Unknown role string — never silently escalate to Super Admin (the legacy
  // fallback would grant full permissions). Fail closed instead.
  throw new BadRequestError(`Unknown role: ${String(body.role)}`);
}

const MASTER_COLLECTIONS = [
  'suppliers',
  'dealers',
  'warehouses',
  'brands',
  'branches',
  'pincodes',
  'wholesalers',
  'delivery_partners',
  'delivery_zones',
  'manufacturers',
  'sub_categories',
  'product_attributes',
  'product_attribute_values',
  'product_variants',
  'product_variant_attributes',
] as const;

function toProfile(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    mobile_number: row.mobile_number ?? row.mobileNumber ?? '',
    fullName: row.fullName ?? '',
    email: row.email ?? '',
    dob: row.dob ?? '',
    gender: row.gender ?? '',
    kyc_status: row.kyc_status ?? 'Pending',
    branches: Array.isArray(row.branches) ? row.branches : [],
    pincodes: Array.isArray(row.pincodes) ? row.pincodes : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeUser(user: any) {
  const profile = toProfile(jsonDb.findOne('profiles', { id: user.id }));
  const rbac = resolveRbacForUser(user);
  return {
    id: user.id,
    phone: user.phone ?? '',
    email: user.email ?? '',
    role: user.role ?? 'customer',
    roleId: rbac.roleId,
    roleName: rbac.roleName,
    permissions: rbac.permissions,
    status: user.status ?? (user.blocked ? 'blocked' : 'active'),
    blocked: Boolean(user.blocked),
    created_at: user.created_at ?? user.createdAt,
    updated_at: user.updated_at ?? user.updatedAt,
    profile,
  };
}

export class AdminController {
  /** GET /admin/users — every user with profile (customer + staff). */
  listUsers = async (_req: Request, res: Response) => {
    // Refresh users from Mongo so dashboard-side edits surface without a restart.
    // (Catalog throttle is product/category only and must not be relied on here.)
    await jsonDb.refreshCollection('users');
    await jsonDb.ensureCollection('profiles');
    await jsonDb.ensureCollection('roles');
    const users = jsonDb
      .findMany('users', {})
      .sort((a: any, b: any) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
      )
      .map(serializeUser);
    return sendSuccess(res, users, 'Users fetched');
  };

  /** POST /admin/users — create a user (staff or customer) with profile. */
  createUser = async (req: Request, res: Response) => {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const mobile = String(body.mobile ?? '').trim();
    const { role, roleId } = resolveRoleAssignment(body);

    if (!name && !email && !mobile) {
      throw new BadRequestError('At least a name, email or mobile is required');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const existingEmail = email ? jsonDb.findOne('users', { email }) : null;
    const existingMobile = mobile ? jsonDb.findOne('users', { phone: mobile }) : null;
    if (existingEmail || existingMobile) {
      throw new BadRequestError('A user with this email or mobile already exists');
    }

    const encryptedPassword = body.password ? await hashPassword(String(body.password)) : undefined;

    // Await the Supabase mirror so the password hash and account survive cold
    // starts on other serverless instances (mirrorInsertAwaited is used by the
    // auth flow for the same reason).
    const user = await jsonDb.insertAwaited('users', {
      id,
      phone: mobile || null,
      email: email || null,
      role,
      role_id: roleId,
      encryptedPassword: encryptedPassword ?? '',
      created_at: now,
      updated_at: now,
    });

    await jsonDb.insertAwaited('profiles', {
      id,
      mobile_number: mobile,
      fullName: name || (email ? email.split('@')[0] : `User ${id.slice(0, 6)}`),
      email: email || null,
      kyc_status: body.kyc_status ?? 'Pending',
      branches: Array.isArray(body.branches) ? body.branches : [],
      pincodes: Array.isArray(body.pincodes) ? body.pincodes : [],
      createdAt: now,
      updatedAt: now,
    });

    return sendSuccess(res, serializeUser(user), 'User created', 201);
  };

  /** PATCH /admin/users/:id — update user + profile (name, email, phone, branches, pincodes, status). */
  updateUser = async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const body = req.body ?? {};
    const existing = jsonDb.findOne('users', { id });
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const updates: Record<string, any> = {};
    if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase() || null;
    if (body.mobile !== undefined) updates.phone = String(body.mobile).trim() || null;
    if (body.role !== undefined || body.roleId !== undefined) {
      const assignment = resolveRoleAssignment(body);
      updates.role = assignment.role;
      updates.role_id = assignment.roleId;
      // Prevent an admin from demoting their own account (avoids lockout).
      if (
        id === (req as any).user?.sub &&
        assignment.role === 'customer'
      ) {
        throw new ForbiddenError('You cannot change your own account role');
      }
    }
    if (body.password) {
      updates.encryptedPassword = await hashPassword(String(body.password));
    }
    if (body.blocked === true) {
      updates.status = 'BLOCKED';
    } else if (body.blocked === false && String(existing.status ?? '').toUpperCase() === 'BLOCKED') {
      updates.status = 'ACTIVE';
    }

    // Await the Supabase mirror for users (role, password hash, blocked status)
    // and profiles — like createUser/insertAwaited, so these writes survive
    // serverless cold starts on other instances.
    const updatedUser =
      Object.keys(updates).length > 0
        ? (await jsonDb.updateAwaited('users', { id }, updates)) ?? existing
        : existing;

    const profile = jsonDb.findOne('profiles', { id });
    const profileUpdates: Record<string, any> = {};
    if (body.name !== undefined) profileUpdates.fullName = String(body.name).trim();
    if (body.mobile !== undefined) profileUpdates.mobile_number = String(body.mobile).trim();
    if (body.email !== undefined) profileUpdates.email = String(body.email).trim() || null;
    if (body.kyc_status !== undefined) profileUpdates.kyc_status = String(body.kyc_status);
    if (Array.isArray(body.branches)) profileUpdates.branches = body.branches;
    if (Array.isArray(body.pincodes)) profileUpdates.pincodes = body.pincodes;

    if (Object.keys(profileUpdates).length > 0) {
      if (profile) {
        await jsonDb.updateAwaited('profiles', { id }, profileUpdates);
      } else {
        await jsonDb.insertAwaited('profiles', {
          id,
          // Fall back to the user row's phone rather than an empty string so a
          // profile-only write never produces a mobile_number:'' row.
          mobile_number:
            profileUpdates.mobile_number ?? updates.phone ?? existing.phone ?? '',
          fullName: profileUpdates.fullName ?? '',
          email: profileUpdates.email ?? null,
          kyc_status: profileUpdates.kyc_status ?? 'Pending',
          branches: profileUpdates.branches ?? [],
          pincodes: profileUpdates.pincodes ?? [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return sendSuccess(res, serializeUser(updatedUser), 'User updated');
  };

  /** GET /admin/kyc — all customer KYC records. */
  listKyc = async (_req: Request, res: Response) => {
    const records = jsonDb
      .findMany('customer_kyc', {})
      .sort((a: any, b: any) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );
    return sendSuccess(res, records, 'KYC records fetched');
  };

  /** GET /admin/fi-cases — all FI (field investigation) cases. */
  listFiCases = async (_req: Request, res: Response) => {
    const cases = jsonDb
      .findMany('fi_cases', {})
      .sort((a: any, b: any) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );
    return sendSuccess(res, cases, 'FI cases fetched');
  };

  /** GET /admin/fi-cases/:fiCaseId */
  getFiCase = async (req: Request, res: Response) => {
    const id = String(req.params.fiCaseId ?? '');
    const item = jsonDb.findOne('fi_cases', { id });
    if (!item) {
      throw new NotFoundError('FI case not found');
    }
    return sendSuccess(res, item, 'FI case fetched');
  };

  /** PATCH /admin/fi-cases/:fiCaseId */
  updateFiCase = async (req: Request, res: Response) => {
    const id = String(req.params.fiCaseId ?? '');
    const existing = jsonDb.findOne('fi_cases', { id });
    if (!existing) {
      throw new NotFoundError('FI case not found');
    }
    const updated = jsonDb.update('fi_cases', { id }, req.body ?? {});
    return sendSuccess(res, updated, 'FI case updated');
  };

  /** GET /admin/suppliers|dealers|warehouses */
  listMaster = async (req: Request, res: Response) => {
    const collection = this.resolveMasterCollection(req.path);
    await jsonDb.ensureCollection(collection);
    const items = jsonDb.findMany(collection, {});
    return sendSuccess(res, items, 'Master data fetched');
  };

  /** POST /admin/suppliers|dealers|warehouses */
  createMaster = async (req: Request, res: Response) => {
    const collection = this.resolveMasterCollection(req.path);
    await jsonDb.ensureCollection(collection);
    const created = jsonDb.insert(collection, req.body ?? {});
    return sendSuccess(res, created, 'Master record created', 201);
  };

  /** PUT /admin/suppliers|dealers|warehouses/:id */
  updateMaster = async (req: Request, res: Response) => {
    const collection = this.resolveMasterCollection(req.path);
    await jsonDb.ensureCollection(collection);
    const id = String(req.params.id ?? '');
    const existing = jsonDb.findOne(collection, { id });
    if (!existing) {
      throw new NotFoundError('Master record not found');
    }
    const updated = jsonDb.update(collection, { id }, req.body ?? {});
    return sendSuccess(res, updated, 'Master record updated');
  };

  /** DELETE /admin/suppliers|dealers|warehouses/:id */
  deleteMaster = async (req: Request, res: Response) => {
    const collection = this.resolveMasterCollection(req.path);
    await jsonDb.ensureCollection(collection);
    const id = String(req.params.id ?? '');
    const existing = jsonDb.findOne(collection, { id });
    if (!existing) {
      throw new NotFoundError('Master record not found');
    }
    jsonDb.delete(collection, { id });
    return sendSuccess(res, { deleted: true }, 'Master record deleted');
  };

  /** GET /admin/users/:id/activity — audit log entries for a user. */
  listUserActivity = async (req: Request, res: Response) => {
    const userId = String(req.params.id ?? '');
    const existing = jsonDb.findOne('users', { id: userId });
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const entries = jsonDb
      .findMany('audit_log', { userId })
      .sort((a: any, b: any) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );

    return sendSuccess(res, entries, 'User activity fetched');
  };

  /** GET /admin/users/:id/kyc — KYC records for a specific user. */
  listUserKyc = async (req: Request, res: Response) => {
    const userId = String(req.params.id ?? '');
    const records = jsonDb
      .findMany('customer_kyc', { userId })
      .sort((a: any, b: any) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
      );
    return sendSuccess(res, records, 'User KYC fetched');
  };

  /**
   * POST /admin/dev/clear-orders-emi
   * Wipes orders + EMI applications (+ related loans) from memory and Supabase.
   */
  clearOrdersAndEmi = async (_req: Request, res: Response) => {
    const tables = [
      'orders',
      'emi_applications',
      'emiApplication',
      'loan_accounts',
      'loanAccount',
      'emi_schedules',
      'orderTracking',
      'paymentTransaction',
    ] as const;

    const deleted: Record<string, number> = {};
    for (const table of tables) {
      deleted[table] = await jsonDb.clearCollectionAwaited(table);
    }

    return sendSuccess(res, { deleted }, 'Orders and EMI application data cleared');
  };

  private resolveMasterCollection(path: string): string {
    const match = MASTER_COLLECTIONS.find((c) => path.startsWith(`/${c}`));
    if (!match) {
      throw new BadRequestError('Unknown master collection');
    }
    return match;
  }
}

export const adminController = new AdminController();
