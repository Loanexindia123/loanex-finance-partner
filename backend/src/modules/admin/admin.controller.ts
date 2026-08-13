import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { EmiApplicationStatus } from '@prisma/client';
import { jsonDb } from '../../config/json-db';
import { sendSuccess } from '../../common/utils/api-response';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors/app-error';
import { hashPassword } from '../../common/utils/password';
import { rolePermissions, SUPER_ADMIN_PERMISSIONS } from '../rbac/permissions';

/** EMI statuses that FI Accept/Reject may still move (pre-final-approval). */
const FI_MUTABLE_EMI_STATUSES = new Set<string>([
  EmiApplicationStatus.PENDING,
  EmiApplicationStatus.UNDER_REVIEW,
  EmiApplicationStatus.APPROVED,
]);

/** Open EMI statuses compatible with an in-progress FI case. */
const FI_OPEN_EMI_STATUSES = new Set<string>([
  EmiApplicationStatus.PENDING,
  EmiApplicationStatus.UNDER_REVIEW,
]);

/** Loan/EMI stages that must never coexist with pending/in-progress/rejected FI. */
const FI_INCOMPATIBLE_EMI_STATUSES = new Set<string>([
  EmiApplicationStatus.ACTIVE_EMI,
  EmiApplicationStatus.ORDER_CONFIRMED,
  EmiApplicationStatus.DOWN_PAYMENT_COMPLETED,
  EmiApplicationStatus.DOWN_PAYMENT_PENDING,
  EmiApplicationStatus.OFFER_ACCEPTED,
]);

function isOpenFiCaseStatus(status: unknown): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'pending' || s === 'in_progress' || s === 'hold';
}

function pickFiCompatibleApplication(candidates: any[], productName: string): any | undefined {
  const open = candidates.filter((a) => FI_OPEN_EMI_STATUSES.has(String(a.status)));
  const pool = open.length > 0 ? open : [];
  if (pool.length === 0) return undefined;
  if (productName) {
    const byProduct = pool.find((a) => String(a.productName || '') === productName);
    if (byProduct) return byProduct;
  }
  return pool[0];
}

/**
 * Keep fi_cases.applicationId pointing at a live, FI-compatible EMI application.
 * Never heal a pending/in-progress/rejected FI case onto ACTIVE_EMI (or later) apps.
 */
function healFiCaseApplicationLink(fiCase: any): any {
  if (!fiCase) return fiCase;
  const applicationId = String(fiCase.applicationId ?? '');
  const linked = applicationId
    ? jsonDb.findOne('emi_applications', { id: applicationId })
    : null;

  if (linked) {
    // Existing link is fine when EMI is still pre-approval, or FI already accepted.
    if (
      !isOpenFiCaseStatus(fiCase.status) ||
      !FI_INCOMPATIBLE_EMI_STATUSES.has(String(linked.status))
    ) {
      return fiCase;
    }
    // Fall through and try to re-point to an open application for the same user.
  }

  const userId = String(fiCase.userId ?? '');
  if (!userId) return fiCase;

  const candidates = jsonDb
    .findMany('emi_applications', { userId })
    .sort(
      (a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  const match = pickFiCompatibleApplication(candidates, String(fiCase.productName || ''));
  if (!match || match.id === applicationId) return fiCase;

  return jsonDb.update('fi_cases', { id: fiCase.id }, { applicationId: match.id }) ?? {
    ...fiCase,
    applicationId: match.id,
  };
}

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

/**
 * Credit review fields — mirrors admin-app's src/types/creditReview.ts and
 * admin-web's credit-review.models.ts exactly. Do not add fields here that
 * aren't already part of that shared shape.
 */
const CREDIT_REVIEW_FIELDS = [
  'creditStatus',
  'reviewer',
  'reviewDate',
  'remarks',
  'decision',
  'kycStatus',
  'aadhaarStatus',
  'panStatus',
  'bankingDetails',
  'fiReport',
  'emiEligibility',
  'repaymentCapacity',
  'selectedProduct',
  'productMargin',
  'downPayment',
  'riskCategory',
  'recommendedProduct',
] as const;

const CREDIT_REVIEW_DEFAULTS: Record<(typeof CREDIT_REVIEW_FIELDS)[number], string> = {
  creditStatus: 'Waiting',
  reviewer: '—',
  reviewDate: '—',
  remarks: '',
  decision: 'Pending',
  kycStatus: 'Pending',
  aadhaarStatus: 'Pending',
  panStatus: 'Pending',
  bankingDetails: '—',
  fiReport: '—',
  emiEligibility: 'Under assessment',
  repaymentCapacity: 'Under assessment',
  selectedProduct: '—',
  productMargin: '—',
  downPayment: '—',
  riskCategory: '—',
  recommendedProduct: '',
};

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
    // refreshCollection is TTL-throttled; profiles/roles load in parallel.
    await Promise.all([
      jsonDb.refreshCollection('users'),
      jsonDb.ensureCollection('profiles'),
      jsonDb.ensureCollection('roles'),
    ]);
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
      .map((item: any) => healFiCaseApplicationLink(item))
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
    return sendSuccess(res, healFiCaseApplicationLink(item), 'FI case fetched');
  };

  /**
   * PATCH /admin/fi-cases/:fiCaseId
   *
   * FI Accept  → status `completed`: EMI returns to UNDER_REVIEW for Admin Credit Review
   *              (NOT final EMI/application approval).
   * FI Reject  → status `hold`: EMI moves to REJECTED; remarks become the rejection reason.
   */
  updateFiCase = async (req: Request, res: Response) => {
    const id = String(req.params.fiCaseId ?? '');
    const existing = jsonDb.findOne('fi_cases', { id });
    if (!existing) {
      throw new NotFoundError('FI case not found');
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const nextStatus = String(
      body.status !== undefined ? body.status : existing.status ?? '',
    ).toLowerCase();
    const nextRemarks = String(
      body.remarks !== undefined ? body.remarks : existing.remarks ?? '',
    ).trim();

    if (nextStatus === 'hold' && !nextRemarks) {
      throw new BadRequestError('Remarks are required when rejecting a field investigation.');
    }

    const updated = jsonDb.update('fi_cases', { id }, body);
    const applicationId = String(updated?.applicationId ?? existing.applicationId ?? '');

    if (applicationId && (nextStatus === 'completed' || nextStatus === 'hold')) {
      const app = jsonDb.findOne('emi_applications', { id: applicationId });
      if (app && FI_INCOMPATIBLE_EMI_STATUSES.has(String(app.status))) {
        throw new BadRequestError(
          'This EMI application is already past field investigation (loan/EMI active). FI Accept/Reject cannot change it.',
          { status: app.status },
        );
      }
      if (app && FI_MUTABLE_EMI_STATUSES.has(String(app.status))) {
        if (nextStatus === 'completed') {
          // FI Accept — investigation succeeded; Admin continues Credit Review / terms.
          // Never promotes EMI to ACTIVE_EMI — that happens only after down payment / loan activation.
          jsonDb.update('emi_applications', { id: applicationId }, {
            status: EmiApplicationStatus.UNDER_REVIEW,
            rejectionReason: null,
            reviewedAt: new Date(),
            offerAcceptedAt: null,
            offerDeclinedAt: null,
          });

          // Open Credit Review for Admin (Waiting) — not final approval.
          if (!jsonDb.findOne('credit_reviews', { applicationId })) {
            jsonDb.upsert(
              'credit_reviews',
              { applicationId },
              {},
              {
                ...CREDIT_REVIEW_DEFAULTS,
                applicationId,
                creditStatus: 'Waiting',
                decision: 'Pending',
                fiReport: nextRemarks || 'FI accepted. Awaiting credit review.',
                selectedProduct: String(app.productName ?? CREDIT_REVIEW_DEFAULTS.selectedProduct),
                downPayment:
                  app.approvedDownPayment != null || app.requestedDownPayment != null
                    ? String(app.approvedDownPayment ?? app.requestedDownPayment)
                    : CREDIT_REVIEW_DEFAULTS.downPayment,
              },
            );
          }
        } else {
          // FI Reject — failed investigation. Do not open Credit Review success path.
          const reason = nextRemarks || 'Field investigation rejected.';
          jsonDb.update('emi_applications', { id: applicationId }, {
            status: EmiApplicationStatus.REJECTED,
            rejectionReason: reason,
            adminRemarks: reason,
            reviewedAt: new Date(),
            offerAcceptedAt: null,
            offerDeclinedAt: null,
          });
        }
      }
    }

    return sendSuccess(res, updated, 'FI case updated');
  };

  /** GET /admin/credit-reviews/:applicationId */
  getCreditReview = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId ?? '');
    const item = jsonDb.findOne('credit_reviews', { applicationId });
    if (!item) {
      throw new NotFoundError('Credit review not found');
    }
    return sendSuccess(res, item, 'Credit review fetched');
  };

  /** PATCH /admin/credit-reviews/:applicationId — creates the record on first save (upsert). */
  upsertCreditReview = async (req: Request, res: Response) => {
    const applicationId = String(req.params.applicationId ?? '');
    if (!applicationId) {
      throw new BadRequestError('applicationId is required');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const field of CREDIT_REVIEW_FIELDS) {
      if (body[field] !== undefined) patch[field] = body[field];
    }

    const existed = Boolean(jsonDb.findOne('credit_reviews', { applicationId }));
    const saved = jsonDb.upsert(
      'credit_reviews',
      { applicationId },
      patch,
      { ...CREDIT_REVIEW_DEFAULTS, applicationId, ...patch },
    );
    return sendSuccess(res, saved, existed ? 'Credit review updated' : 'Credit review created', existed ? 200 : 201);
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
