import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { normalizeIfsc } from '../../../common/utils/bank';
import type { CreateEmployeeBody, UpdateEmployeeBody } from './employee.validator';
import {
  canViewEmployee,
  filterVisibleEmployees,
  listOnboarderOptions,
  resolveCreateOnboardedBy,
  resolveViewerIdentity,
  type OnboarderOption,
} from './employee-hierarchy';
import { isEmployeeRoleUser, provisionEmployeeAccount } from './employee-account';
import { isRestrictedCatalogUser } from '../../product/utils/product-emi';

const COLLECTION = 'employees';

export interface EmployeeRecord {
  id: string;
  onboardedBy: string;
  onboardedById: string;
  /** Linked portal user account id (set on approval). */
  userId: string;
  employeeId: string;
  onboardingDate: string;
  fullName: string;
  fatherHusbandName: string;
  dateOfBirth: string;
  mobile: string;
  whatsapp: string;
  email: string;
  gender: string;
  maritalStatus: string;
  emergencyContact: string;
  department: string;
  designation: string;
  employmentType: string;
  dateOfJoining: string;
  branch: string;
  branchId: string;
  workMode: string;
  reportingPerson: string;
  reportingPersonId: string;
  reportingPersonPost: string;
  shift: string;
  probationPeriod: string;
  noticePeriod: string;
  monthlyCtc: string;
  basicSalary: string;
  hra: string;
  conveyanceAllowance: string;
  specialAllowance: string;
  otherAllowance: string;
  fixedGrossSalary: string;
  variableIncentive: string;
  totalMonthlyCtc: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
  otherDeduction: string;
  netTakeHome: string;
  salaryEffectiveFrom: string;
  paymentMode: string;
  profilePhoto: string;
  aadhaarCard: string;
  panCard: string;
  addressProof: string;
  educationDocuments: string;
  experienceLetter: string;
  cancelledCheque: string;
  signature: string;
  appointmentLetter: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  uanNumber: string;
  esicNumber: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  status: 'active' | 'inactive';
  formStatus: 'draft' | 'pending' | 'approved';
  createdAt?: string;
  updatedAt?: string;
}

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function money(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateEmployeeId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `EMP-${stamp}-${suffix}`;
}

function calcSalary(row: {
  monthlyCtc: string;
  basicSalary: string;
  hra: string;
  conveyanceAllowance: string;
  specialAllowance: string;
  otherAllowance: string;
  variableIncentive: string;
  otherDeduction: string;
}): { fixedGrossSalary: string; totalMonthlyCtc: string; netTakeHome: string } {
  const basic = money(row.basicSalary);
  const hra = money(row.hra);
  const conveyance = money(row.conveyanceAllowance);
  const special = money(row.specialAllowance);
  const other = money(row.otherAllowance);
  const variable = money(row.variableIncentive);
  const deduction = money(row.otherDeduction);
  const monthlyCtc = money(row.monthlyCtc);
  const fixedGross = basic + hra + conveyance + special + other;
  const total = fixedGross + variable || monthlyCtc;
  const net = Math.max(0, total - deduction);
  return {
    fixedGrossSalary: formatMoney(fixedGross),
    totalMonthlyCtc: formatMoney(total),
    netTakeHome: formatMoney(net),
  };
}

function buildRecord(row: any): EmployeeRecord {
  const monthlyCtc = str(row.monthlyCtc);
  const basicSalary = str(row.basicSalary);
  const hra = str(row.hra);
  const conveyanceAllowance = str(row.conveyanceAllowance);
  const specialAllowance = str(row.specialAllowance);
  const otherAllowance = str(row.otherAllowance);
  const variableIncentive = str(row.variableIncentive);
  const otherDeduction = str(row.otherDeduction);
  const calculated = calcSalary({
    monthlyCtc,
    basicSalary,
    hra,
    conveyanceAllowance,
    specialAllowance,
    otherAllowance,
    variableIncentive,
    otherDeduction,
  });
  const verificationStatus = str(row.verificationStatus);
  const formStatus = str(row.formStatus);

  return {
    id: str(row.id),
    onboardedBy: str(row.onboardedBy),
    onboardedById: str(row.onboardedById),
    userId: str(row.userId),
    employeeId: str(row.employeeId),
    onboardingDate: str(row.onboardingDate) || todayIsoDate(),
    fullName: str(row.fullName),
    fatherHusbandName: str(row.fatherHusbandName),
    dateOfBirth: str(row.dateOfBirth),
    mobile: str(row.mobile),
    whatsapp: str(row.whatsapp),
    email: str(row.email),
    gender: str(row.gender),
    maritalStatus: str(row.maritalStatus),
    emergencyContact: str(row.emergencyContact),
    department: str(row.department),
    designation: str(row.designation),
    employmentType: str(row.employmentType),
    dateOfJoining: str(row.dateOfJoining),
    branch: str(row.branch),
    branchId: str(row.branchId),
    workMode: str(row.workMode),
    reportingPerson: str(row.reportingPerson),
    reportingPersonId: str(row.reportingPersonId),
    reportingPersonPost: str(row.reportingPersonPost),
    shift: str(row.shift),
    probationPeriod: str(row.probationPeriod),
    noticePeriod: str(row.noticePeriod),
    monthlyCtc,
    basicSalary,
    hra,
    conveyanceAllowance,
    specialAllowance,
    otherAllowance,
    fixedGrossSalary: calculated.fixedGrossSalary,
    variableIncentive,
    totalMonthlyCtc: calculated.totalMonthlyCtc,
    pfApplicable: bool(row.pfApplicable),
    esiApplicable: bool(row.esiApplicable),
    otherDeduction,
    netTakeHome: calculated.netTakeHome,
    salaryEffectiveFrom: str(row.salaryEffectiveFrom),
    paymentMode: str(row.paymentMode),
    profilePhoto: str(row.profilePhoto),
    aadhaarCard: str(row.aadhaarCard),
    panCard: str(row.panCard),
    addressProof: str(row.addressProof),
    educationDocuments: str(row.educationDocuments),
    experienceLetter: str(row.experienceLetter),
    cancelledCheque: str(row.cancelledCheque),
    signature: str(row.signature),
    appointmentLetter: str(row.appointmentLetter),
    accountHolderName: str(row.accountHolderName),
    accountNumber: str(row.accountNumber),
    ifscCode: row.ifscCode ? normalizeIfsc(str(row.ifscCode)) : '',
    uanNumber: str(row.uanNumber),
    esicNumber: str(row.esicNumber),
    verificationStatus:
      verificationStatus === 'verified' || verificationStatus === 'rejected'
        ? verificationStatus
        : 'pending',
    status: row.status === 'inactive' ? 'inactive' : 'active',
    formStatus:
      formStatus === 'pending' || formStatus === 'approved' ? formStatus : 'draft',
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
  };
}

function bodyToPayload(
  body: CreateEmployeeBody | UpdateEmployeeBody,
): Omit<EmployeeRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  const monthlyCtc = str(body.monthlyCtc);
  const basicSalary = str(body.basicSalary);
  const hra = str(body.hra);
  const conveyanceAllowance = str(body.conveyanceAllowance);
  const specialAllowance = str(body.specialAllowance);
  const otherAllowance = str(body.otherAllowance);
  const variableIncentive = str(body.variableIncentive);
  const otherDeduction = str(body.otherDeduction);
  const calculated = calcSalary({
    monthlyCtc,
    basicSalary,
    hra,
    conveyanceAllowance,
    specialAllowance,
    otherAllowance,
    variableIncentive,
    otherDeduction,
  });

  return {
    onboardedBy: str(body.onboardedBy),
    onboardedById: str(body.onboardedById),
    employeeId: str(body.employeeId),
    onboardingDate: str(body.onboardingDate) || todayIsoDate(),
    fullName: str(body.fullName),
    fatherHusbandName: str(body.fatherHusbandName),
    dateOfBirth: str(body.dateOfBirth),
    mobile: str(body.mobile),
    whatsapp: str(body.whatsapp),
    email: str(body.email),
    gender: str(body.gender),
    maritalStatus: str(body.maritalStatus),
    emergencyContact: str(body.emergencyContact),
    department: str(body.department),
    designation: str(body.designation),
    employmentType: str(body.employmentType),
    dateOfJoining: str(body.dateOfJoining),
    branch: str(body.branch),
    branchId: str(body.branchId),
    workMode: str(body.workMode),
    reportingPerson: str(body.reportingPerson),
    reportingPersonId: str(body.reportingPersonId),
    reportingPersonPost: str(body.reportingPersonPost),
    shift: str(body.shift),
    probationPeriod: str(body.probationPeriod),
    noticePeriod: str(body.noticePeriod),
    monthlyCtc,
    basicSalary,
    hra,
    conveyanceAllowance,
    specialAllowance,
    otherAllowance,
    fixedGrossSalary: calculated.fixedGrossSalary,
    variableIncentive,
    totalMonthlyCtc: calculated.totalMonthlyCtc,
    pfApplicable: bool(body.pfApplicable),
    esiApplicable: bool(body.esiApplicable),
    otherDeduction,
    netTakeHome: calculated.netTakeHome,
    salaryEffectiveFrom: str(body.salaryEffectiveFrom),
    paymentMode: str(body.paymentMode),
    profilePhoto: str(body.profilePhoto),
    aadhaarCard: str(body.aadhaarCard),
    panCard: str(body.panCard),
    addressProof: str(body.addressProof),
    educationDocuments: str(body.educationDocuments),
    experienceLetter: str(body.experienceLetter),
    cancelledCheque: str(body.cancelledCheque),
    signature: str(body.signature),
    appointmentLetter: str(body.appointmentLetter),
    accountHolderName: str(body.accountHolderName),
    accountNumber: str(body.accountNumber),
    ifscCode: body.ifscCode ? normalizeIfsc(str(body.ifscCode)) : '',
    uanNumber: str(body.uanNumber),
    esicNumber: str(body.esicNumber),
    verificationStatus: body.verificationStatus ?? 'pending',
    status: body.status ?? 'active',
    formStatus: body.formStatus ?? 'draft',
  };
}

async function ensureReady(): Promise<void> {
  await jsonDb.ensureCollection(COLLECTION);
}

function findDuplicateEmployeeId(employeeId: string, excludeId?: string): boolean {
  const codeKey = employeeId.trim().toLowerCase();
  if (!codeKey) return false;
  const items = jsonDb.findMany(COLLECTION, {}) as any[];
  return items.some((item) => {
    if (excludeId && String(item.id) === excludeId) return false;
    return String(item.employeeId ?? '').trim().toLowerCase() === codeKey;
  });
}

function uniqueEmployeeId(preferred?: string, excludeId?: string): string {
  const requested = str(preferred);
  if (requested && !findDuplicateEmployeeId(requested, excludeId)) {
    return requested;
  }
  for (let i = 0; i < 8; i += 1) {
    const generated = generateEmployeeId();
    if (!findDuplicateEmployeeId(generated, excludeId)) return generated;
  }
  return `EMP-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function loadAllRecords(): EmployeeRecord[] {
  return (jsonDb.findMany(COLLECTION, {}) as any[]).map(buildRecord);
}

/** Shared loader for hierarchy-scoped modules (products, etc.). */
export async function loadEmployeeRecordsForHierarchy(): Promise<EmployeeRecord[]> {
  await ensureReady();
  return loadAllRecords();
}

function sortByUpdated(records: EmployeeRecord[]): EmployeeRecord[] {
  return [...records].sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')),
  );
}

export class EmployeeService {
  async list(actorUserId: string): Promise<EmployeeRecord[]> {
    await ensureReady();
    const all = loadAllRecords();
    const viewer = resolveViewerIdentity(str(actorUserId), all);
    return sortByUpdated(filterVisibleEmployees(all, viewer));
  }

  async listOnboarders(actorUserId: string): Promise<OnboarderOption[]> {
    await ensureReady();
    const all = loadAllRecords();
    const viewer = resolveViewerIdentity(str(actorUserId), all);
    return listOnboarderOptions(all, viewer);
  }

  async getById(id: string, actorUserId: string): Promise<EmployeeRecord> {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) {
      throw new BadRequestError('Employee id is required');
    }
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Employee onboarding record not found');
    }
    const record = buildRecord(existing);
    const all = loadAllRecords();
    const viewer = resolveViewerIdentity(str(actorUserId), all);
    if (!canViewEmployee(all, viewer, record.id)) {
      throw new ForbiddenError('You do not have access to this employee onboarding record');
    }
    return record;
  }

  async create(body: CreateEmployeeBody, actorUserId: string): Promise<EmployeeRecord> {
    await ensureReady();
    const all = loadAllRecords();
    const viewer = resolveViewerIdentity(str(actorUserId), all);
    const onboarded = resolveCreateOnboardedBy(
      viewer,
      all,
      str(body.onboardedById),
      str(body.onboardedBy),
    );

    // Employees cannot approve — Admin/Super Admin only provisions login.
    let formStatus = body.formStatus ?? 'draft';
    if (isEmployeeRoleUser(actorUserId) && formStatus === 'approved') {
      formStatus = 'pending';
    }

    const payload = {
      id: str(body.id) || randomUUID(),
      ...bodyToPayload({ ...body, formStatus }),
      onboardedById: onboarded.onboardedById,
      onboardedBy: onboarded.onboardedBy,
      userId: '',
    };
    payload.employeeId = uniqueEmployeeId(payload.employeeId);

    if (jsonDb.findOne(COLLECTION, { id: payload.id })) {
      throw new ConflictError('Employee record id already exists');
    }

    const created = jsonDb.insert(COLLECTION, payload);
    return this.afterPersist(buildRecord(created));
  }

  async update(
    id: string,
    body: UpdateEmployeeBody,
    actorUserId: string,
  ): Promise<EmployeeRecord> {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) {
      throw new BadRequestError('Employee id is required');
    }

    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Employee onboarding record not found');
    }

    const existingRecord = buildRecord(existing);
    const all = loadAllRecords();
    const viewer = resolveViewerIdentity(str(actorUserId), all);
    if (!canViewEmployee(all, viewer, existingRecord.id)) {
      throw new ForbiddenError('You do not have access to this employee onboarding record');
    }

    // Approved records are read-only for Employee / Dealer / Agent (product-style lock).
    if (
      isRestrictedCatalogUser(actorUserId) &&
      String(existingRecord.formStatus ?? '')
        .trim()
        .toLowerCase() === 'approved'
    ) {
      throw new ForbiddenError('Approved employees cannot be edited.');
    }

    // Employees cannot approve peer employees — only Admin/Super Admin.
    if (
      isEmployeeRoleUser(actorUserId) &&
      body.formStatus === 'approved' &&
      existingRecord.formStatus !== 'approved'
    ) {
      throw new ForbiddenError('Only Admin can approve employees');
    }

    let formStatus = body.formStatus ?? existingRecord.formStatus;
    if (isEmployeeRoleUser(actorUserId) && formStatus === 'approved' && existingRecord.formStatus !== 'approved') {
      formStatus = 'pending';
    }

    const updates = bodyToPayload({ ...body, formStatus });
    // Edit / approval must never silently re-parent the onboarding chain.
    updates.onboardedById = existingRecord.onboardedById;
    updates.onboardedBy = existingRecord.onboardedBy;
    updates.employeeId = uniqueEmployeeId(updates.employeeId || existing.employeeId, trimmed);

    const updated = jsonDb.update(COLLECTION, { id: trimmed }, {
      ...updates,
      // Never trust client userId — only provisioner may set it.
      userId: existingRecord.userId,
    });
    if (!updated) {
      throw new NotFoundError('Employee onboarding record not found');
    }
    return this.afterPersist(buildRecord(updated));
  }

  /** After save: when approved, create/link portal login and persist userId. */
  private async afterPersist(record: EmployeeRecord): Promise<EmployeeRecord> {
    if (record.formStatus !== 'approved') {
      return record;
    }
    const result = await provisionEmployeeAccount(record);
    if (!result?.userId) {
      throw new BadRequestError(
        'Employee portal account could not be created. Add a mobile or email and try again.',
      );
    }
    if (record.userId === result.userId) return record;
    const linked = await jsonDb.updateAwaited(COLLECTION, { id: record.id }, {
      userId: result.userId,
    });
    return linked ? buildRecord(linked) : { ...record, userId: result.userId };
  }

  async delete(id: string, actorUserId: string): Promise<{ deleted: true; id: string }> {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) {
      throw new BadRequestError('Employee id is required');
    }

    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Employee onboarding record not found');
    }

    const record = buildRecord(existing);
    const all = loadAllRecords();
    const viewer = resolveViewerIdentity(str(actorUserId), all);
    if (!canViewEmployee(all, viewer, record.id)) {
      throw new ForbiddenError('You do not have access to this employee onboarding record');
    }

    jsonDb.delete(COLLECTION, { id: trimmed });
    return { deleted: true, id: trimmed };
  }
}

export const employeeService = new EmployeeService();
