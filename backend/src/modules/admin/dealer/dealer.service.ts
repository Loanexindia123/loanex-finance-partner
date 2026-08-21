import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import { hasOrgWideEmployeeAccess } from '../employee/employee-hierarchy';
import type { CreateDealerBody, UpdateDealerBody } from './dealer.validator';
import { isDealerApproved, isDealerAuthUser, provisionDealerAccount } from './dealer-account';
import { isEmployeeRoleUser } from '../employee/employee-account';
import { isRestrictedCatalogUser } from '../../product/utils/product-emi';
import {
  isAgentAuthUser,
  resolveIsAgentUserId,
} from '../freelancer-agent/agent-account';
import {
  collectDealerAgentUserIds,
  resolveFieldActor,
} from '../hierarchy/field-actor';

const COLLECTION = 'dealers';

/** Full dealer record — schemaless Mongo document aligned with onboarding form + Prisma aliases. */
export interface DealerRecord {
  id: string;
  name: string;
  dealerCode: string;
  dealerName: string;
  ownerName: string;
  businessType: string;
  mobile: string;
  whatsapp: string;
  email: string;
  dealerType: string;
  categoryDepartment: string;
  establishedYear: string;
  shopAddress: string;
  pincode: string;
  googleLocation: string;
  deliveryArea: string;
  deliveryTime: string;
  warehouseAddress: string;
  panCard: string;
  gstCertificate: string;
  ownerAadhaar: string;
  shopAddressProof: string;
  cancelledCheque: string;
  shopPhotos: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  paymentCycle: string;
  holdPercentage: string;
  productDeliveryBy: string;
  assignedB2BManager: string;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'hold';
  dealerAgreement: string;
  creatorType: string;
  creatorId: string;
  creatorName: string;
  /**
   * Parent dealer profile id when an Agent creates this dealer.
   * Empty for staff-created root dealers. Never a nested dealer tree —
   * always the creating agent's parent dealer.
   */
  dealerId: string;
  status: 'active' | 'inactive';
  formStatus: 'draft' | 'pending' | 'approved' | 'rejected' | 'hold';
  dealer_address: string;
  dealerMobile: string;
  gstNumber: string;
  branch: string;
  paymentSchedule: string;
  holdDays: number;
  commission: number;
  dealerBranch: string;
  paymentSettlementTerms: string;
  /** Linked dealer login user id. Distinct from creatorId (staff owner). */
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DealerActor {
  userId: string;
  displayName: string;
  orgWide: boolean;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function buildRecord(row: any): DealerRecord {
  const dealerName = String(row.dealerName ?? row.name ?? '').trim();
  const shopAddress = String(row.shopAddress ?? row.dealer_address ?? '').trim();
  const mobile = String(row.mobile ?? row.dealerMobile ?? '').trim();
  const branch = String(row.branch ?? row.dealerBranch ?? '').trim();
  const paymentCycle = String(row.paymentCycle ?? row.paymentSchedule ?? '').trim();
  const paymentSchedule = String(row.paymentSchedule ?? row.paymentCycle ?? '').trim();
  const paymentSettlementTerms = String(row.paymentSettlementTerms ?? '').trim();
  const holdPercentage = String(row.holdPercentage ?? '').trim();
  const holdDays = toNumber(row.holdDays, holdPercentage ? toNumber(holdPercentage) : 0);
  const commission = toNumber(row.commission, 0);
  const gstNumber = String(row.gstNumber ?? row.gst_number ?? '').trim().toUpperCase();
  const formStatus = row.formStatus ?? row.form_status;
  const verificationStatus = row.verificationStatus ?? row.verification_status ?? 'pending';

  return {
    id: String(row.id),
    name: dealerName || String(row.name ?? ''),
    dealerCode: String(row.dealerCode ?? row.code ?? '').trim(),
    dealerName,
    ownerName: String(row.ownerName ?? '').trim(),
    businessType: String(row.businessType ?? '').trim(),
    mobile,
    whatsapp: String(row.whatsapp ?? '').trim(),
    email: String(row.email ?? '').trim(),
    dealerType: String(row.dealerType ?? '').trim(),
    categoryDepartment: String(row.categoryDepartment ?? '').trim(),
    establishedYear: String(row.establishedYear ?? '').trim(),
    shopAddress,
    pincode: String(row.pincode ?? '').trim(),
    googleLocation: String(row.googleLocation ?? '').trim(),
    deliveryArea: String(row.deliveryArea ?? '').trim(),
    deliveryTime: String(row.deliveryTime ?? '').trim(),
    warehouseAddress: String(row.warehouseAddress ?? '').trim(),
    panCard: String(row.panCard ?? '').trim(),
    gstCertificate: String(row.gstCertificate ?? '').trim(),
    ownerAadhaar: String(row.ownerAadhaar ?? '').trim(),
    shopAddressProof: String(row.shopAddressProof ?? '').trim(),
    cancelledCheque: String(row.cancelledCheque ?? '').trim(),
    shopPhotos: String(row.shopPhotos ?? '').trim(),
    accountHolderName: String(row.accountHolderName ?? '').trim(),
    accountNumber: String(row.accountNumber ?? '').trim(),
    ifscCode: String(row.ifscCode ?? '').trim(),
    paymentCycle,
    holdPercentage,
    productDeliveryBy: String(row.productDeliveryBy ?? '').trim(),
    assignedB2BManager: String(row.assignedB2BManager ?? '').trim(),
    verificationStatus:
      verificationStatus === 'approved' ||
      verificationStatus === 'rejected' ||
      verificationStatus === 'hold'
        ? verificationStatus
        : 'pending',
    dealerAgreement: String(row.dealerAgreement ?? '').trim(),
    creatorType: String(row.creatorType ?? '').trim(),
    creatorId: String(row.creatorId ?? '').trim(),
    creatorName: String(row.creatorName ?? '').trim(),
    dealerId: String(row.dealerId ?? '').trim(),
    status: row.status === 'inactive' ? 'inactive' : 'active',
    formStatus:
      formStatus === 'pending' ||
      formStatus === 'approved' ||
      formStatus === 'rejected' ||
      formStatus === 'hold'
        ? formStatus
        : 'draft',
    dealer_address: shopAddress,
    dealerMobile: mobile,
    gstNumber,
    branch,
    paymentSchedule,
    holdDays,
    commission,
    dealerBranch: branch,
    paymentSettlementTerms,
    userId: String(row.userId ?? row.user_id ?? '').trim(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function bodyToPayload(body: CreateDealerBody | UpdateDealerBody): Omit<DealerRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const dealerName = body.dealerName.trim();
  const shopAddress = body.shopAddress?.trim() || body.dealer_address?.trim() || '';
  const mobile = body.mobile?.trim() || body.dealerMobile?.trim() || '';
  const branch = body.branch?.trim() || body.dealerBranch?.trim() || '';
  const paymentCycle = body.paymentCycle?.trim() || '';
  const paymentSettlementTerms = body.paymentSettlementTerms?.trim() || '';
  const paymentSchedule = body.paymentSchedule?.trim() || paymentCycle;
  const holdPercentage = body.holdPercentage?.trim() || '';
  const holdDays =
    body.holdDays != null && body.holdDays > 0
      ? body.holdDays
      : holdPercentage
        ? toNumber(holdPercentage)
        : 0;

  return {
    name: body.name?.trim() || dealerName,
    dealerCode: body.dealerCode.trim(),
    dealerName,
    ownerName: body.ownerName?.trim() || '',
    businessType: body.businessType?.trim() || '',
    mobile,
    whatsapp: body.whatsapp?.trim() || '',
    email: body.email?.trim() || '',
    dealerType: body.dealerType?.trim() || '',
    categoryDepartment: body.categoryDepartment?.trim() || '',
    establishedYear: body.establishedYear?.trim() || '',
    shopAddress,
    pincode: body.pincode?.trim() || '',
    googleLocation: body.googleLocation?.trim() || '',
    deliveryArea: body.deliveryArea?.trim() || '',
    deliveryTime: body.deliveryTime?.trim() || '',
    warehouseAddress: body.warehouseAddress?.trim() || '',
    panCard: body.panCard?.trim() || '',
    gstCertificate: body.gstCertificate?.trim() || '',
    ownerAadhaar: body.ownerAadhaar?.trim() || '',
    shopAddressProof: body.shopAddressProof?.trim() || '',
    cancelledCheque: body.cancelledCheque?.trim() || '',
    shopPhotos: body.shopPhotos?.trim() || '',
    accountHolderName: body.accountHolderName?.trim() || '',
    accountNumber: body.accountNumber?.trim() || '',
    ifscCode: body.ifscCode?.trim() || '',
    paymentCycle,
    holdPercentage,
    productDeliveryBy: body.productDeliveryBy?.trim() || '',
    assignedB2BManager: body.assignedB2BManager?.trim() || '',
    verificationStatus: body.verificationStatus ?? 'pending',
    dealerAgreement: body.dealerAgreement?.trim() || '',
    creatorType: body.creatorType?.trim() || '',
    creatorId: body.creatorId?.trim() || '',
    creatorName: body.creatorName?.trim() || '',
    // Never trust client dealerId — service sets parent ownership for agent-created dealers.
    dealerId: '',
    status: body.status ?? 'active',
    formStatus: body.formStatus ?? 'draft',
    dealer_address: shopAddress,
    dealerMobile: mobile,
    gstNumber: body.gstNumber?.trim().toUpperCase() || '',
    branch,
    paymentSchedule,
    holdDays,
    commission: body.commission ?? 0,
    dealerBranch: branch,
    paymentSettlementTerms,
    userId: '',
  };
}

async function ensureReady(): Promise<void> {
  await jsonDb.ensureCollection(COLLECTION);
}

function findDuplicateCode(dealerCode: string, excludeId?: string): boolean {
  const codeKey = normalizeKey(dealerCode);
  const items = jsonDb.findMany(COLLECTION, {}) as any[];
  return items.some((item) => {
    if (excludeId && String(item.id) === excludeId) return false;
    const code = normalizeKey(String(item.dealerCode ?? item.code ?? ''));
    return code && code === codeKey;
  });
}

function collectDeleteBlockers(dealer: DealerRecord): string[] {
  const blockers: string[] = [];
  const products = jsonDb.findMany('products', {}) as any[];
  let productRefs = 0;
  for (const product of products) {
    const wizard = product.wizardData;
    const suppliers = Array.isArray(wizard?.suppliers) ? wizard.suppliers : [];
    for (const entry of suppliers) {
      const dealerName = String(entry.dealer ?? '').trim();
      const dealerId = String(entry.dealerId ?? '').trim();
      if (dealerId === dealer.id || dealerName === dealer.dealerName || dealerName === dealer.name) {
        productRefs += 1;
        break;
      }
    }
  }
  if (productRefs > 0) {
    blockers.push(`${productRefs} product(s)`);
  }
  return blockers;
}

function resolveActor(actorUserId: string): DealerActor {
  const userId = str(actorUserId);
  const profile = jsonDb.findOne('profiles', { id: userId }) as any;
  const user = jsonDb.findOne('users', { id: userId }) as any;
  const displayName =
    str(profile?.fullName) ||
    str(profile?.name) ||
    str(user?.email) ||
    str(user?.phone) ||
    userId;
  return {
    userId,
    displayName,
    orgWide: hasOrgWideEmployeeAccess(userId),
  };
}

function canAccessDealer(dealer: DealerRecord, actor: DealerActor): boolean {
  if (actor.orgWide) return true;
  const owner = str(dealer.creatorId);
  // Legacy dealers with no creator: Super Admin only (orgWide).
  if (!owner) return false;
  return owner === actor.userId;
}

/**
 * Field-actor visibility:
 * - Dealer: own profile + dealers created by self/own agents (parent dealerId match)
 * - Agent: only dealers they created
 */
async function canAccessDealerForActor(
  dealer: DealerRecord,
  actorUserId: string,
): Promise<boolean> {
  const actor = resolveActor(actorUserId);
  if (canAccessDealer(dealer, actor)) return true;

  const field = await resolveFieldActor(actorUserId);
  if (!field) return false;

  if (field.kind === 'dealer') {
    // Child dealers created under this dealer (by agents) — not the dealer's own profile.
    if (field.dealerId && str(dealer.dealerId) === field.dealerId) return true;
    const agentUserIds = collectDealerAgentUserIds(field.dealerId);
    if (agentUserIds.has(str(dealer.creatorId))) return true;
    return false;
  }

  if (field.kind === 'agent') {
    return str(dealer.creatorId) === field.userId;
  }

  return false;
}

async function assertCanAccessForActor(dealer: DealerRecord, actorUserId: string): Promise<void> {
  if (!(await canAccessDealerForActor(dealer, actorUserId))) {
    throw new ForbiddenError('You do not have access to this dealer');
  }
}

function assertCanAccess(dealer: DealerRecord, actor: DealerActor): void {
  if (!canAccessDealer(dealer, actor)) {
    throw new ForbiddenError('You do not have access to this dealer');
  }
}

export class DealerService {
  async list(
    actorUserId: string,
    options?: { approvedOnly?: boolean },
  ): Promise<DealerRecord[]> {
    await ensureReady();
    const all = (jsonDb.findMany(COLLECTION, {}) as any[]).map(buildRecord);
    const scoped: DealerRecord[] = [];
    for (const d of all) {
      if (await canAccessDealerForActor(d, actorUserId)) scoped.push(d);
    }
    // Product catalog / pickers: only dealers that passed approval (formStatus or
    // verificationStatus). Masters list omits this flag so pending stays visible.
    if (options?.approvedOnly) {
      return scoped.filter(isDealerApproved);
    }
    return scoped;
  }

  async getById(id: string, actorUserId: string): Promise<DealerRecord> {
    await ensureReady();
    const trimmed = String(id ?? '').trim();
    if (!trimmed) {
      throw new BadRequestError('Dealer id is required');
    }
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Dealer not found');
    }
    const record = buildRecord(existing);
    await assertCanAccessForActor(record, actorUserId);
    return record;
  }

  async create(body: CreateDealerBody, actorUserId: string): Promise<DealerRecord> {
    await ensureReady();
    const actorUser = jsonDb.findOne('users', { id: actorUserId }) as any;
    if (isDealerAuthUser(actorUser)) {
      throw new ForbiddenError('Dealers cannot create dealer accounts');
    }
    if (findDuplicateCode(body.dealerCode)) {
      throw new ConflictError('Dealer Code already exists');
    }

    const actor = resolveActor(actorUserId);
    const field = await resolveFieldActor(actorUserId);
    const isAgent = Boolean(field?.kind === 'agent') || isAgentAuthUser(actorUser);

    // Agents and Employees may create dealers but cannot approve — force pending/draft.
    let formStatus = body.formStatus ?? 'draft';
    let verificationStatus = body.verificationStatus ?? 'pending';
    const cannotApprove = isAgent || isEmployeeRoleUser(actorUserId);
    if (cannotApprove) {
      if (formStatus === 'approved') formStatus = 'pending';
      if (verificationStatus === 'approved') verificationStatus = 'pending';
    }

    const payload = {
      id: body.id?.trim() || randomUUID(),
      ...bodyToPayload({ ...body, formStatus, verificationStatus }),
      // Creator always from authenticated session — never trust client owner fields.
      creatorId: actor.userId,
      creatorName: actor.displayName,
      creatorType: isAgent ? 'Agent' : str(body.creatorType) || 'Employee',
      // Parent dealer for agent-created dealers (ownership tree).
      dealerId: isAgent ? str(field?.dealerId) : '',
    };

    if (jsonDb.findOne(COLLECTION, { id: payload.id })) {
      throw new ConflictError('Dealer id already exists');
    }

    const created = jsonDb.insert(COLLECTION, payload);
    return this.afterPersist(buildRecord(created));
  }

  async update(id: string, body: UpdateDealerBody, actorUserId: string): Promise<DealerRecord> {
    await ensureReady();
    const trimmed = String(id ?? '').trim();
    if (!trimmed) {
      throw new BadRequestError('Dealer id is required');
    }

    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Dealer not found');
    }

    const existingRecord = buildRecord(existing);
    await assertCanAccessForActor(existingRecord, actorUserId);

    const field = await resolveFieldActor(actorUserId);
    const isAgent = field?.kind === 'agent' || (await resolveIsAgentUserId(actorUserId));

    // Approved dealers are read-only for Employee / Dealer / Agent.
    if (
      isRestrictedCatalogUser(actorUserId) &&
      String(existingRecord.formStatus ?? '')
        .trim()
        .toLowerCase() === 'approved'
    ) {
      throw new ForbiddenError('Approved dealers cannot be edited.');
    }

    if (findDuplicateCode(body.dealerCode, trimmed)) {
      throw new ConflictError('Dealer Code already exists');
    }

    // Agents and Employees cannot approve dealers.
    let formStatus = body.formStatus ?? existingRecord.formStatus;
    let verificationStatus = body.verificationStatus ?? existingRecord.verificationStatus;
    const cannotApprove = isAgent || isEmployeeRoleUser(actorUserId);
    if (cannotApprove) {
      if (formStatus === 'approved') formStatus = existingRecord.formStatus === 'approved' ? 'approved' : 'pending';
      if (verificationStatus === 'approved') {
        verificationStatus =
          existingRecord.verificationStatus === 'approved' ? 'approved' : 'pending';
      }
      if (existingRecord.formStatus !== 'approved' && body.formStatus === 'approved') {
        throw new ForbiddenError('Only Admin can approve dealers');
      }
      if (
        existingRecord.verificationStatus !== 'approved' &&
        body.verificationStatus === 'approved'
      ) {
        throw new ForbiddenError('Only Admin can approve dealers');
      }
    }

    const updates = bodyToPayload({ ...body, formStatus, verificationStatus });
    // Ownership is immutable after create.
    updates.creatorId = existingRecord.creatorId;
    updates.creatorName = existingRecord.creatorName;
    updates.creatorType = existingRecord.creatorType || updates.creatorType;
    updates.dealerId = existingRecord.dealerId;
    // Never trust client userId — only provisioner may set it.
    updates.userId = existingRecord.userId;

    const updated = jsonDb.update(COLLECTION, { id: trimmed }, updates);
    if (!updated) {
      throw new NotFoundError('Dealer not found');
    }
    return this.afterPersist(buildRecord(updated));
  }

  /** After save: when approved, create/link dealer login and persist userId. */
  private async afterPersist(record: DealerRecord): Promise<DealerRecord> {
    if (!isDealerApproved(record)) {
      return record;
    }
    const result = await provisionDealerAccount(record);
    if (!result?.userId) {
      throw new BadRequestError('Dealer login account could not be created');
    }
    if (record.userId === result.userId) {
      return record;
    }
    // Await Mongo mirror so dealers.userId survives process restart / other instances.
    const linked = await jsonDb.updateAwaited(COLLECTION, { id: record.id }, {
      userId: result.userId,
    });
    return linked ? buildRecord(linked) : { ...record, userId: result.userId };
  }

  async delete(id: string, actorUserId: string): Promise<{ deleted: true; id: string }> {
    await ensureReady();
    const trimmed = String(id ?? '').trim();
    if (!trimmed) {
      throw new BadRequestError('Dealer id is required');
    }

    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Dealer not found');
    }

    const dealer = buildRecord(existing);
    await assertCanAccessForActor(dealer, actorUserId);

    // Agents cannot delete protected (approved) dealers.
    const field = await resolveFieldActor(actorUserId);
    if (field?.kind === 'agent' && isDealerApproved(dealer)) {
      throw new ForbiddenError('Approved dealers cannot be deleted');
    }

    const blockers = collectDeleteBlockers(dealer);
    if (blockers.length > 0) {
      throw new ConflictError(
        `Cannot delete dealer: still referenced by ${blockers.join(' and ')}`,
      );
    }

    jsonDb.delete(COLLECTION, { id: trimmed });
    return { deleted: true, id: trimmed };
  }
}

export const dealerService = new DealerService();
