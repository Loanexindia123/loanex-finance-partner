import { randomUUID } from 'node:crypto';
import { maskAccountNumber, normalizeIfsc } from '../../../common/utils/bank';

export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_PATTERN = /^\d{8,18}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_PATTERN = /^[2-9]\d{11}$/;
export const AGENT_ID_PATTERN = /^AG-[A-Z0-9]{6}$/;

export const POLICY_VERSION = 'gp-payout-v1';
export const PAYOUT_BASIS = 'incentive_commission';
export const AGENT_ID_PLACEHOLDER = 'AUTO-GENERATED AFTER APPROVAL';

export const CREATOR_TYPES = ['Employee', 'Existing Agent', 'Direct'] as const;
export const WORK_MODES = ['Field', 'Online', 'Both'] as const;
export const AGENT_TYPES = ['Individual', 'Business Associate'] as const;
export const TRAINING_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;
export const FORM_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'] as const;
export const CATALOG_STATUSES = ['active', 'inactive'] as const;

export const FALLBACK_DEPARTMENTS = [
  'Engineering',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
  'Finance',
  'Credit',
  'FI',
  'HR',
  'Support',
  'Other',
] as const;

export const ALLOWED_WORK_OPTIONS = ['Leads', 'EMI Sale', 'KYC', 'Dealer Referral'] as const;

export type FreelancerFormStatus = (typeof FORM_STATUSES)[number];
export type FreelancerCatalogStatus = (typeof CATALOG_STATUSES)[number];
export type CreatorType = (typeof CREATOR_TYPES)[number];

export interface ApprovalHistoryEntry {
  action: 'created' | 'draft_saved' | 'submitted' | 'approved' | 'rejected' | 'updated';
  byId: string;
  byName: string;
  at: string;
  note?: string;
}

export function str(value: unknown): string {
  return String(value ?? '').trim();
}

export function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeMobile(value: unknown): string {
  const digits = str(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function normalizePan(value: unknown): string {
  return str(value).toUpperCase().replace(/\s+/g, '');
}

export function normalizeAadhaar(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

export function normalizeAccount(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

export function normalizePincode(value: unknown): string {
  return str(value).replace(/\D/g, '').slice(0, 6);
}

export function generateAgentId(): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `AG-${suffix}`;
}

export function isApprovedStatus(status: string): boolean {
  return status === 'approved';
}

export function canEditFormStatus(status: string): boolean {
  return status === 'draft' || status === 'rejected';
}

export function canSubmitFormStatus(status: string): boolean {
  return status === 'draft' || status === 'rejected' || status === '';
}

export function displayAgentId(agentId: string, formStatus: string): string {
  if (isApprovedStatus(formStatus) && AGENT_ID_PATTERN.test(str(agentId))) {
    return str(agentId);
  }
  return AGENT_ID_PLACEHOLDER;
}

export function maskAadhaar(value: unknown): string {
  const digits = normalizeAadhaar(value);
  if (digits.length < 4) return digits ? 'XXXX' : '';
  return `XXXXXXXX${digits.slice(-4)}`;
}

export function maskPan(value: unknown): string {
  const pan = normalizePan(value);
  if (pan.length < 4) return pan ? 'XXXX' : '';
  return `${'X'.repeat(Math.max(pan.length - 4, 4))}${pan.slice(-4)}`;
}

export function maskBankAccount(value: unknown): string {
  const digits = normalizeAccount(value);
  if (!digits) return '';
  return maskAccountNumber(digits);
}

export function normalizeIfscCode(value: unknown): string {
  const next = str(value);
  return next ? normalizeIfsc(next) : '';
}

export function duplicateConflictMessage(field: 'mobile' | 'pan' | 'aadhaar' | 'account'): string {
  switch (field) {
    case 'mobile':
      return 'A freelancer / growing partner with this mobile number already exists.';
    case 'pan':
      return 'A freelancer / growing partner with this PAN already exists.';
    case 'aadhaar':
      return 'A freelancer / growing partner with this Aadhaar already exists.';
    case 'account':
      return 'A freelancer / growing partner with this bank account already exists.';
    default:
      return 'A matching freelancer / growing partner record already exists.';
  }
}
