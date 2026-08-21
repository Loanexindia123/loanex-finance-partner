import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { employeeService } from '../employee/employee.service';
import type {
  CreateFreelancerAgentBody,
  RejectFreelancerAgentBody,
  UpdateFreelancerAgentBody,
} from './freelancer-agent.validator';
import {
  AGENT_ID_PLACEHOLDER,
  AADHAAR_PATTERN,
  ACCOUNT_NUMBER_PATTERN,
  AGENT_TYPES,
  ApprovalHistoryEntry,
  IFSC_PATTERN,
  MOBILE_PATTERN,
  PAN_PATTERN,
  PAYOUT_BASIS,
  PINCODE_PATTERN,
  POLICY_VERSION,
  WORK_MODES,
  bool,
  canEditFormStatus,
  canSubmitFormStatus,
  displayAgentId,
  duplicateConflictMessage,
  generateAgentId,
  maskAadhaar,
  maskBankAccount,
  maskPan,
  normalizeAadhaar,
  normalizeAccount,
  normalizeIfscCode,
  normalizeMobile,
  normalizePan,
  normalizePincode,
  str,
  stringList,
} from './freelancer-agent.util';
import { isDealerUserId, resolveIsDealerUserId } from '../dealer/dealer-account';
import {
  findLinkedAgentByUserId,
  isAgentApproved,
  isAgentUserId,
  provisionAgentAccount,
  resolveIsAgentUserId,
} from './agent-account';
import {
  canViewAgent,
  filterAgentCreatedAgents,
  filterDealerAgents,
  filterVisibleAgents,
  isAgentOwnedAgent,
  isDealerOwnedAgent,
  resolveDealerIdForActor,
  resolveFreelancerViewer,
  resolveParentDealerIdForAgent,
} from './freelancer-agent-visibility';

const COLLECTION = 'freelancer_agents';

export interface FreelancerPayoutConfig {
  policyVersion: string;
  notes: string;
}

export interface FreelancerAgentRecord {
  id: string;
  agentId: string;
  creatorType: string;
  creatorId: string;
  creatorName: string;
  fullName: string;
  fatherHusbandName: string;
  dateOfBirth: string;
  mobile: string;
  whatsapp: string;
  email: string;
  gender: string;
  education: string;
  occupation: string;
  currentAddress: string;
  city: string;
  state: string;
  pincode: string;
  googleLocation: string;
  /** Set server-side when a Dealer/Agent creates the agent. Empty for staff-created agents. */
  dealerId: string;
  /** Linked agent login user id. Set only by provisioner on approval. */
  userId: string;
  preferredWorkArea: string;
  workMode: string;
  emergencyContactName: string;
  emergencyContactMobile: string;
  profilePhoto: string;
  aadhaarFront: string;
  aadhaarBack: string;
  aadhaarCard: string;
  aadhaarNumber: string;
  panCard: string;
  panNumber: string;
  addressProof: string;
  cancelledCheque: string;
  signature: string;
  agentType: string;
  preferredDepartments: string[];
  allowedWork: string[];
  assignedManager: string;
  assignedManagerId: string;
  branch: string;
  branchId: string;
  trainingStatus: string;
  accountNumber: string;
  ifscCode: string;
  payoutBasis: string;
  payoutConfig: FreelancerPayoutConfig;
  policyAccepted: boolean;
  policyAcceptedAt: string;
  policyVersion: string;
  status: 'active' | 'inactive';
  formStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  createdBy: string;
  createdById: string;
  updatedBy: string;
  updatedById: string;
  approvedBy: string;
  approvedById: string;
  approvedAt: string;
  rejectedBy: string;
  rejectedById: string;
  rejectedAt: string;
  rejectionReason: string;
  approvalHistory: ApprovalHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FreelancerCreatorOption {
  id: string;
  name: string;
  code: string;
  email: string;
  mobile: string;
  extra: string;
  isCurrentUser: boolean;
}

interface ActorContext {
  id: string;
  name: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultPayoutConfig(row?: Partial<FreelancerPayoutConfig>): FreelancerPayoutConfig {
  return {
    policyVersion: str(row?.policyVersion) || POLICY_VERSION,
    notes: str(row?.notes) || 'Incentive / Commission as per approved company policy',
  };
}

function historyList(value: unknown): ApprovalHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const rows: ApprovalHistoryEntry[] = [];
  for (const entry of value) {
    const rec = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const action = str(rec.action) as ApprovalHistoryEntry['action'];
    const allowed: ApprovalHistoryEntry['action'][] = [
      'created',
      'draft_saved',
      'submitted',
      'approved',
      'rejected',
      'updated',
    ];
    if (!allowed.includes(action)) continue;
    const note = str(rec.note);
    rows.push({
      action,
      byId: str(rec.byId),
      byName: str(rec.byName),
      at: str(rec.at) || nowIso(),
      ...(note ? { note } : {}),
    });
  }
  return rows;
}

function appendHistory(
  existing: ApprovalHistoryEntry[],
  entry: ApprovalHistoryEntry,
): ApprovalHistoryEntry[] {
  return [...existing, entry].slice(-40);
}

function buildRecord(row: any): FreelancerAgentRecord {
  const formStatus = str(row.formStatus);
  const aadhaarFront = str(row.aadhaarFront);
  const aadhaarBack = str(row.aadhaarBack);
  const aadhaarCard = str(row.aadhaarCard) || (aadhaarFront && aadhaarBack ? aadhaarFront : '');
  return {
    id: str(row.id),
    agentId: str(row.agentId),
    creatorType: str(row.creatorType),
    creatorId: str(row.creatorId),
    creatorName: str(row.creatorName),
    fullName: str(row.fullName),
    fatherHusbandName: str(row.fatherHusbandName),
    dateOfBirth: str(row.dateOfBirth),
    mobile: normalizeMobile(row.mobile),
    whatsapp: normalizeMobile(row.whatsapp),
    email: str(row.email).toLowerCase(),
    gender: str(row.gender),
    education: str(row.education),
    occupation: str(row.occupation),
    currentAddress: str(row.currentAddress),
    city: str(row.city),
    state: str(row.state),
    pincode: normalizePincode(row.pincode),
    googleLocation: str(row.googleLocation),
    dealerId: str(row.dealerId),
    userId: str(row.userId ?? row.user_id),
    preferredWorkArea: str(row.preferredWorkArea),
    workMode: str(row.workMode),
    emergencyContactName: str(row.emergencyContactName),
    emergencyContactMobile: normalizeMobile(row.emergencyContactMobile),
    profilePhoto: str(row.profilePhoto),
    aadhaarFront,
    aadhaarBack,
    aadhaarCard,
    aadhaarNumber: normalizeAadhaar(row.aadhaarNumber),
    panCard: str(row.panCard),
    panNumber: normalizePan(row.panNumber),
    addressProof: str(row.addressProof),
    cancelledCheque: str(row.cancelledCheque),
    signature: str(row.signature),
    agentType: str(row.agentType),
    preferredDepartments: stringList(row.preferredDepartments),
    allowedWork: stringList(row.allowedWork),
    assignedManager: str(row.assignedManager),
    assignedManagerId: str(row.assignedManagerId),
    branch: str(row.branch),
    branchId: str(row.branchId),
    trainingStatus: str(row.trainingStatus) || 'Pending',
    accountNumber: normalizeAccount(row.accountNumber),
    ifscCode: normalizeIfscCode(row.ifscCode),
    payoutBasis: PAYOUT_BASIS,
    payoutConfig: defaultPayoutConfig(row.payoutConfig),
    policyAccepted: bool(row.policyAccepted),
    policyAcceptedAt: str(row.policyAcceptedAt),
    policyVersion: str(row.policyVersion) || POLICY_VERSION,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    formStatus:
      formStatus === 'pending_approval' || formStatus === 'approved' || formStatus === 'rejected'
        ? formStatus
        : 'draft',
    createdBy: str(row.createdBy),
    createdById: str(row.createdById),
    updatedBy: str(row.updatedBy),
    updatedById: str(row.updatedById),
    approvedBy: str(row.approvedBy),
    approvedById: str(row.approvedById),
    approvedAt: str(row.approvedAt),
    rejectedBy: str(row.rejectedBy),
    rejectedById: str(row.rejectedById),
    rejectedAt: str(row.rejectedAt),
    rejectionReason: str(row.rejectionReason),
    approvalHistory: historyList(row.approvalHistory),
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

function bodyToPayload(
  body: CreateFreelancerAgentBody | UpdateFreelancerAgentBody,
): Omit<
  FreelancerAgentRecord,
  | 'id'
  | 'agentId'
  | 'createdBy'
  | 'createdById'
  | 'updatedBy'
  | 'updatedById'
  | 'approvedBy'
  | 'approvedById'
  | 'approvedAt'
  | 'rejectedBy'
  | 'rejectedById'
  | 'rejectedAt'
  | 'rejectionReason'
  | 'approvalHistory'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'formStatus'
  | 'userId'
> {
  const aadhaarFront = str(body.aadhaarFront);
  const aadhaarBack = str(body.aadhaarBack);
  const aadhaarCard = str(body.aadhaarCard) || aadhaarFront;
  const policyAccepted = bool(body.policyAccepted);
  return {
    creatorType: str(body.creatorType),
    creatorId: str(body.creatorId),
    creatorName: str(body.creatorName),
    fullName: str(body.fullName),
    fatherHusbandName: str(body.fatherHusbandName),
    dateOfBirth: str(body.dateOfBirth),
    mobile: normalizeMobile(body.mobile),
    whatsapp: normalizeMobile(body.whatsapp),
    email: str(body.email).toLowerCase(),
    gender: str(body.gender),
    education: str(body.education),
    occupation: str(body.occupation),
    currentAddress: str(body.currentAddress),
    city: str((body as { city?: string }).city),
    state: str((body as { state?: string }).state),
    pincode: normalizePincode(body.pincode),
    googleLocation: str(body.googleLocation),
    // Never trust client-provided dealerId; service overwrites for dealers.
    dealerId: '',
    preferredWorkArea: str(body.preferredWorkArea),
    workMode: str(body.workMode),
    emergencyContactName: str(body.emergencyContactName),
    emergencyContactMobile: normalizeMobile(body.emergencyContactMobile),
    profilePhoto: str(body.profilePhoto),
    aadhaarFront,
    aadhaarBack,
    aadhaarCard,
    aadhaarNumber: normalizeAadhaar(body.aadhaarNumber),
    panCard: str(body.panCard),
    panNumber: normalizePan(body.panNumber),
    addressProof: str(body.addressProof),
    cancelledCheque: str(body.cancelledCheque),
    signature: str(body.signature),
    agentType: str(body.agentType),
    preferredDepartments: stringList(body.preferredDepartments),
    allowedWork: stringList(body.allowedWork),
    assignedManager: str(body.assignedManager),
    assignedManagerId: str(body.assignedManagerId),
    branch: str(body.branch),
    branchId: str(body.branchId),
    trainingStatus: str(body.trainingStatus) || 'Pending',
    accountNumber: normalizeAccount(body.accountNumber),
    ifscCode: normalizeIfscCode(body.ifscCode),
    payoutBasis: PAYOUT_BASIS,
    payoutConfig: defaultPayoutConfig(body.payoutConfig),
    policyAccepted,
    policyAcceptedAt: policyAccepted ? str(body.policyAcceptedAt) || nowIso() : '',
    policyVersion: policyAccepted ? str(body.policyVersion) || POLICY_VERSION : '',
  };
}

function assertDealerAgentFields(fields: {
  fullName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  currentAddress: string;
  pincode: string;
  preferredWorkArea: string;
  workMode: string;
  emergencyContactMobile: string;
  profilePhoto: string;
  aadhaarFront: string;
  aadhaarBack: string;
  aadhaarNumber: string;
  panCard: string;
  panNumber: string;
  cancelledCheque: string;
  signature: string;
  agentType: string;
  preferredDepartments: string[];
  allowedWork: string[];
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  policyAccepted: boolean;
}): void {
  const requiredStrings: Array<[keyof typeof fields, string]> = [
    ['fullName', 'Full Name'],
    ['mobile', 'Mobile Number'],
    ['dateOfBirth', 'Date of Birth'],
    ['currentAddress', 'Current Address'],
    ['pincode', 'Pincode'],
    ['preferredWorkArea', 'Preferred Work Area'],
    ['workMode', 'Work Mode'],
    ['profilePhoto', 'Profile Photo'],
    ['aadhaarFront', 'Aadhaar Front'],
    ['aadhaarBack', 'Aadhaar Back'],
    ['panCard', 'PAN Card'],
    ['cancelledCheque', 'Cancelled Cheque'],
    ['signature', 'Signature'],
    ['agentType', 'Agent Type'],
    ['accountNumber', 'Account Number'],
    ['ifscCode', 'IFSC Code'],
  ];
  for (const [key, label] of requiredStrings) {
    const value = fields[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestError(`${label} is required`);
    }
  }
  if (!fields.preferredDepartments.length) {
    throw new BadRequestError('Preferred Department is required');
  }
  if (!fields.allowedWork.length) {
    throw new BadRequestError('Allowed Work is required');
  }
  if (!fields.policyAccepted) {
    throw new BadRequestError('Policy acceptance is required');
  }
  if (!MOBILE_PATTERN.test(fields.mobile)) {
    throw new BadRequestError('Enter a valid 10-digit mobile number');
  }
  if (fields.whatsapp && !MOBILE_PATTERN.test(fields.whatsapp)) {
    throw new BadRequestError('Enter a valid 10-digit WhatsApp number');
  }
  if (fields.emergencyContactMobile && !MOBILE_PATTERN.test(fields.emergencyContactMobile)) {
    throw new BadRequestError('Enter a valid 10-digit emergency mobile number');
  }
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw new BadRequestError('Enter a valid email address');
  }
  if (!PINCODE_PATTERN.test(fields.pincode)) {
    throw new BadRequestError('Enter a valid 6-digit Indian pincode');
  }
  if (!(WORK_MODES as readonly string[]).includes(fields.workMode)) {
    throw new BadRequestError('Select a valid work mode');
  }
  if (!(AGENT_TYPES as readonly string[]).includes(fields.agentType)) {
    throw new BadRequestError('Select a valid agent type');
  }
  if (fields.panNumber && !PAN_PATTERN.test(fields.panNumber)) {
    throw new BadRequestError('Enter a valid PAN (e.g. ABCDE1234F)');
  }
  if (fields.aadhaarNumber && !AADHAAR_PATTERN.test(fields.aadhaarNumber)) {
    throw new BadRequestError('Enter a valid 12-digit Aadhaar number');
  }
  if (!ACCOUNT_NUMBER_PATTERN.test(fields.accountNumber)) {
    throw new BadRequestError('Account number must be 8–18 digits');
  }
  if (fields.confirmAccountNumber !== fields.accountNumber) {
    throw new BadRequestError('Account number and confirmation must match');
  }
  if (!IFSC_PATTERN.test(fields.ifscCode)) {
    throw new BadRequestError('Enter a valid IFSC code (e.g. SBIN0001234)');
  }
}

type FieldAgentActorContext =
  | { kind: 'dealer'; dealerId: string; agentId: string }
  | { kind: 'agent'; dealerId: string; agentId: string };

async function resolveFieldAgentActorContext(
  actorUserId: string,
): Promise<FieldAgentActorContext | null> {
  if (await resolveIsAgentUserId(actorUserId)) {
    const dealerId = await resolveParentDealerIdForAgent(actorUserId);
    const linked = findLinkedAgentByUserId(actorUserId);
    return { kind: 'agent', dealerId, agentId: str(linked?.id) };
  }
  if (await resolveIsDealerUserId(actorUserId)) {
    const dealerId = await resolveDealerIdForActor(actorUserId);
    // Allow dealer actor even if dealer profile link is temporarily missing —
    // ownership still scopes by creatorId / createdById === actor.
    return { kind: 'dealer', dealerId, agentId: '' };
  }
  return null;
}

async function assertCanAccessAgent(
  all: FreelancerAgentRecord[],
  record: FreelancerAgentRecord,
  actorUserId: string,
): Promise<void> {
  const fieldCtx = await resolveFieldAgentActorContext(actorUserId);
  if (fieldCtx?.kind === 'dealer') {
    const owned = filterDealerAgents(all, fieldCtx.dealerId, actorUserId).some(
      (row) => row.id === record.id,
    );
    if (!owned) {
      throw new ForbiddenError('You do not have access to this agent');
    }
    return;
  }
  if (fieldCtx?.kind === 'agent') {
    const owned = isAgentOwnedAgent(record, actorUserId, fieldCtx.agentId);
    if (!owned) {
      throw new ForbiddenError('You do not have access to this agent');
    }
    return;
  }
  const viewer = await resolveFreelancerViewer(actorUserId);
  if (!canViewAgent(all, viewer, record.id)) {
    throw new ForbiddenError('You do not have access to this freelancer record');
  }
}

async function ensureReady(): Promise<void> {
  await jsonDb.ensureCollection(COLLECTION);
}

function loadAllRecords(): FreelancerAgentRecord[] {
  return (jsonDb.findMany(COLLECTION, {}) as any[]).map(buildRecord);
}

function sortByUpdated(records: FreelancerAgentRecord[]): FreelancerAgentRecord[] {
  return [...records].sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')),
  );
}

function findDuplicate(
  field: 'mobile' | 'pan' | 'aadhaar' | 'account',
  value: string,
  excludeId?: string,
): boolean {
  const needle = str(value);
  if (!needle) return false;
  const items = jsonDb.findMany(COLLECTION, {}) as any[];
  return items.some((item) => {
    if (excludeId && String(item.id) === excludeId) return false;
    if (field === 'mobile') return normalizeMobile(item.mobile) === needle;
    if (field === 'pan') return normalizePan(item.panNumber) === needle;
    if (field === 'aadhaar') return normalizeAadhaar(item.aadhaarNumber) === needle;
    return normalizeAccount(item.accountNumber) === needle;
  });
}

function assertNoDuplicates(record: {
  mobile: string;
  panNumber: string;
  aadhaarNumber: string;
  accountNumber: string;
}, excludeId?: string): void {
  if (record.mobile && findDuplicate('mobile', record.mobile, excludeId)) {
    throw new ConflictError(duplicateConflictMessage('mobile'));
  }
  if (record.panNumber && findDuplicate('pan', record.panNumber, excludeId)) {
    throw new ConflictError(duplicateConflictMessage('pan'));
  }
  if (record.aadhaarNumber && findDuplicate('aadhaar', record.aadhaarNumber, excludeId)) {
    throw new ConflictError(duplicateConflictMessage('aadhaar'));
  }
  if (record.accountNumber && findDuplicate('account', record.accountNumber, excludeId)) {
    throw new ConflictError(duplicateConflictMessage('account'));
  }
}

function uniqueAgentId(excludeId?: string): string {
  for (let i = 0; i < 12; i += 1) {
    const generated = generateAgentId();
    const clash = (jsonDb.findMany(COLLECTION, {}) as any[]).some((item) => {
      if (excludeId && String(item.id) === excludeId) return false;
      return str(item.agentId).toUpperCase() === generated;
    });
    if (!clash) return generated;
  }
  return `AG-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function resolveCreator(
  body: CreateFreelancerAgentBody | UpdateFreelancerAgentBody,
  actor: ActorContext,
  existing?: FreelancerAgentRecord,
): { creatorType: string; creatorId: string; creatorName: string } {
  const creatorType = str(body.creatorType) || existing?.creatorType || 'Direct';
  if (creatorType === 'Direct') {
    return {
      creatorType: 'Direct',
      creatorId: '',
      creatorName: '',
    };
  }
  return {
    creatorType,
    creatorId: str(body.creatorId) || existing?.creatorId || '',
    creatorName: str(body.creatorName) || existing?.creatorName || '',
  };
}

function toPublicList(record: FreelancerAgentRecord) {
  return {
    id: record.id,
    agentId: displayAgentId(record.agentId, record.formStatus),
    agentIdIssued: Boolean(record.agentId && record.formStatus === 'approved'),
    fullName: record.fullName,
    mobile: record.mobile,
    email: record.email,
    gender: record.gender,
    dateOfBirth: record.dateOfBirth,
    city: record.city,
    state: record.state,
    pincode: record.pincode,
    creatorType: record.creatorType,
    creatorId: record.creatorId,
    creatorName: record.creatorName,
    dealerId: record.dealerId,
    userId: record.userId,
    agentType: record.agentType,
    assignedManager: record.assignedManager,
    assignedManagerId: record.assignedManagerId,
    branch: record.branch,
    branchId: record.branchId,
    formStatus: record.formStatus,
    status: record.status,
    payoutBasis: record.payoutBasis,
    profilePhoto: record.profilePhoto,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPublicDetail(record: FreelancerAgentRecord, canSeePayout: boolean) {
  return {
    ...record,
    agentId: displayAgentId(record.agentId, record.formStatus),
    agentIdIssued: Boolean(record.agentId && record.formStatus === 'approved'),
    confirmAccountNumber: '',
    aadhaarNumber: canSeePayout ? record.aadhaarNumber : maskAadhaar(record.aadhaarNumber),
    panNumber: canSeePayout ? record.panNumber : maskPan(record.panNumber),
    accountNumber: canSeePayout ? record.accountNumber : maskBankAccount(record.accountNumber),
  };
}

export class FreelancerAgentService {
  async list(actorUserId: string) {
    await ensureReady();
    const all = loadAllRecords();
    const fieldCtx = await resolveFieldAgentActorContext(actorUserId);
    if (fieldCtx?.kind === 'dealer') {
      return sortByUpdated(filterDealerAgents(all, fieldCtx.dealerId, actorUserId)).map(
        toPublicList,
      );
    }
    if (fieldCtx?.kind === 'agent') {
      return sortByUpdated(
        filterAgentCreatedAgents(all, actorUserId, fieldCtx.agentId),
      ).map(toPublicList);
    }
    const viewer = await resolveFreelancerViewer(actorUserId);
    return sortByUpdated(filterVisibleAgents(all, viewer)).map(toPublicList);
  }

  async listCreators(actorUserId: string, type?: string): Promise<FreelancerCreatorOption[]> {
    if (await resolveIsDealerUserId(actorUserId) || await resolveIsAgentUserId(actorUserId)) {
      throw new ForbiddenError('Dealers cannot list agent creators');
    }
    const creatorType = str(type) || 'Employee';
    if (creatorType === 'Direct') return [];

    const viewer = await resolveFreelancerViewer(actorUserId);

    if (creatorType === 'Existing Agent') {
      await ensureReady();
      const all = loadAllRecords();
      const visible = filterVisibleAgents(all, viewer).filter(
        (row) => row.formStatus === 'approved' && row.agentId,
      );
      return visible.map((row) => ({
        id: row.id,
        name: row.fullName || row.agentId,
        code: row.agentId,
        email: row.email,
        mobile: row.mobile,
        extra: [row.agentType, row.branch].filter(Boolean).join(' · '),
        isCurrentUser: false,
      }));
    }

    const onboarders = await employeeService.listOnboarders(actorUserId);
    return onboarders.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.employeeId,
      email: row.email,
      mobile: row.mobile,
      extra: [row.designation, row.department].filter(Boolean).join(' · '),
      isCurrentUser: row.isCurrentUser,
    }));
  }

  async getById(id: string, actorUserId: string, canSeePayout: boolean) {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) throw new BadRequestError('Freelancer agent id is required');
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) throw new NotFoundError('Freelancer / growing partner record not found');
    const record = buildRecord(existing);
    const all = loadAllRecords();
    await assertCanAccessAgent(all, record, actorUserId);
    const dealerViewing = Boolean(await resolveFieldAgentActorContext(actorUserId));
    return toPublicDetail(record, canSeePayout || dealerViewing);
  }

  async create(body: CreateFreelancerAgentBody, actor: ActorContext) {
    await ensureReady();
    const fieldCtx = await resolveFieldAgentActorContext(actor.id);

    if (fieldCtx) {
      const payloadFields = bodyToPayload(body);
      const confirmAccountNumber = normalizeAccount(
        (body as { confirmAccountNumber?: string }).confirmAccountNumber ?? body.accountNumber,
      );
      // Same approval workflow as Admin Web — dealer/agent submits; admin approves / issues Agent ID.
      const formStatus = str(body.formStatus) === 'pending_approval' ? 'pending_approval' : 'draft';
      if (formStatus === 'pending_approval') {
        assertDealerAgentFields({
          fullName: payloadFields.fullName,
          mobile: payloadFields.mobile,
          whatsapp: payloadFields.whatsapp,
          email: payloadFields.email,
          gender: payloadFields.gender,
          dateOfBirth: payloadFields.dateOfBirth,
          currentAddress: payloadFields.currentAddress,
          pincode: payloadFields.pincode,
          preferredWorkArea: payloadFields.preferredWorkArea,
          workMode: payloadFields.workMode,
          emergencyContactMobile: payloadFields.emergencyContactMobile,
          profilePhoto: payloadFields.profilePhoto,
          aadhaarFront: payloadFields.aadhaarFront,
          aadhaarBack: payloadFields.aadhaarBack,
          aadhaarNumber: payloadFields.aadhaarNumber,
          panCard: payloadFields.panCard,
          panNumber: payloadFields.panNumber,
          cancelledCheque: payloadFields.cancelledCheque,
          signature: payloadFields.signature,
          agentType: payloadFields.agentType,
          preferredDepartments: payloadFields.preferredDepartments,
          allowedWork: payloadFields.allowedWork,
          accountNumber: payloadFields.accountNumber,
          confirmAccountNumber,
          ifscCode: payloadFields.ifscCode,
          policyAccepted: payloadFields.policyAccepted,
        });
      }

      const parentDealerId = fieldCtx.dealerId || '';
      const record: FreelancerAgentRecord = {
        id: str(body.id) || randomUUID(),
        agentId: '',
        ...payloadFields,
        creatorType: 'Direct',
        creatorId: actor.id,
        creatorName: actor.name,
        assignedManagerId: payloadFields.assignedManagerId || actor.id,
        assignedManager: payloadFields.assignedManager || actor.name,
        dealerId: parentDealerId,
        userId: '',
        status: 'inactive',
        formStatus,
        createdBy: actor.name,
        createdById: actor.id,
        updatedBy: actor.name,
        updatedById: actor.id,
        approvedBy: '',
        approvedById: '',
        approvedAt: '',
        rejectedBy: '',
        rejectedById: '',
        rejectedAt: '',
        rejectionReason: '',
        approvalHistory: [
          {
            action: formStatus === 'pending_approval' ? 'submitted' : 'created',
            byId: actor.id,
            byName: actor.name,
            at: nowIso(),
            note: fieldCtx.kind === 'agent' ? 'Agent-created agent' : 'Dealer-created agent',
          },
        ],
      };

      if (jsonDb.findOne(COLLECTION, { id: record.id })) {
        throw new ConflictError('Freelancer record id already exists');
      }
      assertNoDuplicates(record);
      const created = jsonDb.insert(COLLECTION, record);
      return toPublicDetail(buildRecord(created), true);
    }

    const formStatus = str(body.formStatus) === 'pending_approval' ? 'pending_approval' : 'draft';
    if (formStatus === 'pending_approval' && !canSubmitFormStatus('draft')) {
      throw new BadRequestError('This record cannot be submitted for approval');
    }

    const payloadFields = bodyToPayload(body);
    const creator = resolveCreator(body, actor);
    // Ownership always from session when client did not pick a referrer (Direct).
    // Employee/Dealer Phase: creatorId = logged-in actor for visibility + dashboard.
    const ownership =
      creator.creatorType === 'Direct' || !creator.creatorId
        ? {
            creatorType: creator.creatorType === 'Direct' ? 'Employee' : creator.creatorType,
            creatorId: actor.id,
            creatorName: actor.name,
          }
        : creator;
    const record: FreelancerAgentRecord = {
      id: str(body.id) || randomUUID(),
      agentId: '',
      ...payloadFields,
      ...ownership,
      dealerId: '',
      userId: '',
      status: 'inactive',
      formStatus,
      createdBy: actor.name,
      createdById: actor.id,
      updatedBy: actor.name,
      updatedById: actor.id,
      approvedBy: '',
      approvedById: '',
      approvedAt: '',
      rejectedBy: '',
      rejectedById: '',
      rejectedAt: '',
      rejectionReason: '',
      approvalHistory: [
        {
          action: formStatus === 'pending_approval' ? 'submitted' : 'created',
          byId: actor.id,
          byName: actor.name,
          at: nowIso(),
        },
      ],
    };

    if (jsonDb.findOne(COLLECTION, { id: record.id })) {
      throw new ConflictError('Freelancer record id already exists');
    }

    if (formStatus === 'pending_approval') {
      assertNoDuplicates(record);
    }

    const created = jsonDb.insert(COLLECTION, record);
    return toPublicDetail(buildRecord(created), true);
  }

  async update(id: string, body: UpdateFreelancerAgentBody, actor: ActorContext) {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) throw new BadRequestError('Freelancer agent id is required');
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) throw new NotFoundError('Freelancer / growing partner record not found');

    const current = buildRecord(existing);
    const all = loadAllRecords();
    await assertCanAccessAgent(all, current, actor.id);

    const fieldCtx = await resolveFieldAgentActorContext(actor.id);
    if (fieldCtx) {
      if (!canEditFormStatus(current.formStatus)) {
        throw new BadRequestError('Only draft or rejected records can be edited');
      }

      const payloadFields = bodyToPayload(body);
      const confirmAccountNumber = normalizeAccount(
        (body as { confirmAccountNumber?: string }).confirmAccountNumber ?? body.accountNumber,
      );
      const nextStatus = str(body.formStatus) === 'pending_approval' ? 'pending_approval' : 'draft';
      if (nextStatus === 'pending_approval') {
        assertDealerAgentFields({
          fullName: payloadFields.fullName,
          mobile: payloadFields.mobile,
          whatsapp: payloadFields.whatsapp,
          email: payloadFields.email,
          gender: payloadFields.gender,
          dateOfBirth: payloadFields.dateOfBirth,
          currentAddress: payloadFields.currentAddress,
          pincode: payloadFields.pincode,
          preferredWorkArea: payloadFields.preferredWorkArea,
          workMode: payloadFields.workMode,
          emergencyContactMobile: payloadFields.emergencyContactMobile,
          profilePhoto: payloadFields.profilePhoto,
          aadhaarFront: payloadFields.aadhaarFront,
          aadhaarBack: payloadFields.aadhaarBack,
          aadhaarNumber: payloadFields.aadhaarNumber,
          panCard: payloadFields.panCard,
          panNumber: payloadFields.panNumber,
          cancelledCheque: payloadFields.cancelledCheque,
          signature: payloadFields.signature,
          agentType: payloadFields.agentType,
          preferredDepartments: payloadFields.preferredDepartments,
          allowedWork: payloadFields.allowedWork,
          accountNumber: payloadFields.accountNumber,
          confirmAccountNumber,
          ifscCode: payloadFields.ifscCode,
          policyAccepted: payloadFields.policyAccepted,
        });
      }

      const next: FreelancerAgentRecord = {
        ...current,
        ...payloadFields,
        id: current.id,
        agentId: '',
        userId: current.userId,
        creatorType: 'Direct',
        creatorId: current.creatorId || actor.id,
        creatorName: current.creatorName || actor.name,
        assignedManagerId: payloadFields.assignedManagerId || current.assignedManagerId || actor.id,
        assignedManager: payloadFields.assignedManager || current.assignedManager || actor.name,
        dealerId: current.dealerId || fieldCtx.dealerId,
        formStatus: nextStatus,
        status: 'inactive',
        createdBy: current.createdBy,
        createdById: current.createdById,
        updatedBy: actor.name,
        updatedById: actor.id,
        approvedBy: '',
        approvedById: '',
        approvedAt: '',
        rejectedBy: nextStatus === 'draft' ? current.rejectedBy : '',
        rejectedById: nextStatus === 'draft' ? current.rejectedById : '',
        rejectedAt: nextStatus === 'draft' ? current.rejectedAt : '',
        rejectionReason: nextStatus === 'draft' ? current.rejectionReason : '',
        approvalHistory: appendHistory(current.approvalHistory, {
          action: nextStatus === 'pending_approval' ? 'submitted' : 'draft_saved',
          byId: actor.id,
          byName: actor.name,
          at: nowIso(),
          note: fieldCtx.kind === 'agent' ? 'Agent update' : 'Dealer update',
        }),
      };

      assertNoDuplicates(next, current.id);
      const updated = jsonDb.update(COLLECTION, { id: trimmed }, next);
      if (!updated) throw new NotFoundError('Freelancer / growing partner record not found');
      return toPublicDetail(buildRecord(updated), true);
    }

    if (!canEditFormStatus(current.formStatus)) {
      throw new BadRequestError('Only draft or rejected records can be edited');
    }

    const nextStatus = str(body.formStatus) === 'pending_approval' ? 'pending_approval' : 'draft';
    const payloadFields = bodyToPayload(body);
    const creator = resolveCreator(body, actor, current);

    const next: FreelancerAgentRecord = {
      ...current,
      ...payloadFields,
      ...creator,
      id: current.id,
      agentId: '',
      dealerId: current.dealerId,
      formStatus: nextStatus,
      status: 'inactive',
      createdBy: current.createdBy,
      createdById: current.createdById,
      updatedBy: actor.name,
      updatedById: actor.id,
      approvedBy: '',
      approvedById: '',
      approvedAt: '',
      rejectedBy: nextStatus === 'draft' ? current.rejectedBy : '',
      rejectedById: nextStatus === 'draft' ? current.rejectedById : '',
      rejectedAt: nextStatus === 'draft' ? current.rejectedAt : '',
      rejectionReason: nextStatus === 'draft' ? current.rejectionReason : '',
      approvalHistory: appendHistory(current.approvalHistory, {
        action: nextStatus === 'pending_approval' ? 'submitted' : 'draft_saved',
        byId: actor.id,
        byName: actor.name,
        at: nowIso(),
      }),
    };

    if (nextStatus === 'pending_approval') {
      assertNoDuplicates(next, current.id);
    }

    const updated = jsonDb.update(COLLECTION, { id: trimmed }, next);
    if (!updated) throw new NotFoundError('Freelancer / growing partner record not found');
    return toPublicDetail(buildRecord(updated), true);
  }

  async approve(id: string, actor: ActorContext) {
    await ensureReady();
    if (isDealerUserId(actor.id) || isAgentUserId(actor.id)) {
      throw new ForbiddenError('Dealers and Agents cannot approve agents');
    }
    const { isEmployeeRoleUser } = await import('../employee/employee-account');
    if (isEmployeeRoleUser(actor.id)) {
      throw new ForbiddenError('Only Admin can approve agents');
    }
    const trimmed = str(id);
    if (!trimmed) throw new BadRequestError('Freelancer agent id is required');
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) throw new NotFoundError('Freelancer / growing partner record not found');

    const current = buildRecord(existing);
    const all = loadAllRecords();
    await assertCanAccessAgent(all, current, actor.id);
    if (current.formStatus !== 'pending_approval') {
      throw new BadRequestError('Only records pending approval can be approved');
    }

    assertNoDuplicates(current, current.id);

    const agentId = uniqueAgentId(current.id);
    const updated = await jsonDb.updateAwaited(COLLECTION, { id: trimmed }, {
      agentId,
      formStatus: 'approved',
      status: 'active',
      approvedBy: actor.name,
      approvedById: actor.id,
      approvedAt: nowIso(),
      rejectedBy: '',
      rejectedById: '',
      rejectedAt: '',
      rejectionReason: '',
      updatedBy: actor.name,
      updatedById: actor.id,
      approvalHistory: appendHistory(current.approvalHistory, {
        action: 'approved',
        byId: actor.id,
        byName: actor.name,
        at: nowIso(),
        note: agentId,
      }),
    });
    if (!updated) throw new NotFoundError('Freelancer / growing partner record not found');

    // Provision Agent login (mirrors Dealer afterPersist).
    let record = buildRecord(updated);
    if (isAgentApproved(record)) {
      const result = await provisionAgentAccount(record);
      if (result?.userId && record.userId !== result.userId) {
        const linked = await jsonDb.updateAwaited(COLLECTION, { id: record.id }, {
          userId: result.userId,
        });
        record = linked ? buildRecord(linked) : { ...record, userId: result.userId };
      }
    }
    return toPublicDetail(record, true);
  }

  async reject(id: string, body: RejectFreelancerAgentBody, actor: ActorContext) {
    await ensureReady();
    if (isDealerUserId(actor.id) || isAgentUserId(actor.id)) {
      throw new ForbiddenError('Dealers and Agents cannot reject agents');
    }
    const trimmed = str(id);
    if (!trimmed) throw new BadRequestError('Freelancer agent id is required');
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) throw new NotFoundError('Freelancer / growing partner record not found');

    const current = buildRecord(existing);
    const all = loadAllRecords();
    await assertCanAccessAgent(all, current, actor.id);
    if (current.formStatus !== 'pending_approval') {
      throw new BadRequestError('Only records pending approval can be rejected');
    }

    const reason = str(body.reason);
    const updated = jsonDb.update(COLLECTION, { id: trimmed }, {
      agentId: '',
      formStatus: 'rejected',
      status: 'inactive',
      rejectedBy: actor.name,
      rejectedById: actor.id,
      rejectedAt: nowIso(),
      rejectionReason: reason,
      updatedBy: actor.name,
      updatedById: actor.id,
      approvalHistory: appendHistory(current.approvalHistory, {
        action: 'rejected',
        byId: actor.id,
        byName: actor.name,
        at: nowIso(),
        note: reason || undefined,
      }),
    });
    if (!updated) throw new NotFoundError('Freelancer / growing partner record not found');
    return toPublicDetail(buildRecord(updated), true);
  }

  async delete(id: string, actorUserId: string) {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) throw new BadRequestError('Freelancer agent id is required');
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) throw new NotFoundError('Freelancer / growing partner record not found');

    const current = buildRecord(existing);
    const all = loadAllRecords();
    await assertCanAccessAgent(all, current, actorUserId);

    const fieldCtx = await resolveFieldAgentActorContext(actorUserId);
    if (fieldCtx?.kind === 'dealer') {
      // Dealers may delete any agent they own (draft / pending / approved).
      if (!isDealerOwnedAgent(current, fieldCtx.dealerId, actorUserId)) {
        throw new ForbiddenError('Dealers can only delete their own agents');
      }
    } else if (fieldCtx?.kind === 'agent') {
      // Agents may delete only self-created draft/pending — not approved/protected.
      if (!isAgentOwnedAgent(current, actorUserId, fieldCtx.agentId)) {
        throw new ForbiddenError('Agents can only delete their own agents');
      }
      if (current.formStatus === 'approved') {
        throw new ForbiddenError('Approved agents cannot be deleted');
      }
    } else if (current.formStatus === 'approved') {
      throw new BadRequestError('Approved freelancer / growing partner records cannot be deleted');
    }

    jsonDb.delete(COLLECTION, { id: trimmed });
    return { deleted: true, id: trimmed };
  }
}

export const freelancerAgentService = new FreelancerAgentService();

export const FREELANCER_AGENT_ID_PLACEHOLDER = AGENT_ID_PLACEHOLDER;
