/** GET /admin/users record (role: 'admin' | 'customer' | 'authenticated'). */
export interface AdminUserRecord {
  id: string;
  phone: string;
  email: string;
  role: 'admin' | 'customer' | 'authenticated' | string;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  status: string;
  blocked: boolean;
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    mobile_number: string;
    fullName: string;
    email: string;
    dob: string;
    gender: string;
    kyc_status: 'Pending' | 'Approved' | 'Rejected' | string;
    branches?: string[];
    pincodes?: string[];
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface KycAddress {
  country?: string;
  dist?: string;
  district?: string;
  state?: string;
  city?: string;
  pincode?: string;
  zip?: string;
  line1?: string;
  line2?: string;
  fullAddress?: string;
}

/** Raw /admin/kyc or /admin/users/:id/kyc row. */
export interface KycRecord {
  id: string;
  userId: string;
  aadharVerified?: boolean;
  aadhaarVerified?: boolean;
  aadhar_number?: string;
  aadhaar_number?: string;
  masked_aadhaar?: string;
  fullName?: string;
  dob?: string;
  gender?: string;
  address?: KycAddress | null;
  pan_verified?: boolean;
  panVerified?: boolean;
  panNumber?: string;
  cibil_score?: number;
  cibilScore?: number;
  face_verified?: boolean;
  faceVerified?: boolean;
  faceMatchScore?: number;
  faceLivenessScore?: number;
  panNameMatchScore?: number;
  kycCompleted?: boolean;
  kycCompletedAt?: string;
  cibil_checked?: boolean;
  credit_eligibility_status?: string;
  creditReportFetchedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer extends AdminUserRecord {
  kyc: KycRecord | null;
}

/** GET /admin/users/:id/activity */
export interface CustomerActivity {
  id: string;
  userId?: string;
  action: string;
  entityType?: string;
  entity?: string;
  entityId?: string;
  changes?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Item from GET /admin/loans filtered by customer.id */
export interface CustomerLoan {
  id: string;
  loanAccountNumber?: string;
  applicationId?: string;
  applicationNumber?: string | null;
  productId?: string;
  productName?: string;
  loanAmount: number;
  emiAmount: number;
  loanTenure?: number | null;
  interestRate?: number | null;
  outstandingAmount: number;
  paidAmount: number;
  loanStatus: string;
  nextEmiDueDate?: string | null;
  lastPaymentDate?: string | null;
  loanStartDate?: string | null;
  loanEndDate?: string | null;
  createdAt?: string | null;
  customerId?: string;
}

/** Item from GET /admin/emi-applications filtered by userId */
export interface CustomerEmiApplication {
  id: string;
  applicationNumber: string;
  userId: string;
  productName?: string;
  sellingPrice?: number;
  requestedAmount?: number;
  monthlyEmi?: number;
  estimatedMonthlyEmi?: number;
  approvedAmount?: number | null;
  approvedTenure?: number | null;
  interestRate?: number | null;
  status: string;
  submittedAt?: string | null;
  createdAt?: string | null;
}

export interface CustomerDetailBundle {
  customer: Customer;
  activity: CustomerActivity[];
  loans: CustomerLoan[];
  emiApplications: CustomerEmiApplication[];
}

export const KYC_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

export function customerDisplayName(customer: Customer): string {
  return (
    customer.profile?.fullName?.trim() ||
    customer.kyc?.fullName?.trim() ||
    (customer.email ? customer.email.split('@')[0] : '') ||
    `Customer ${customer.id.slice(0, 6)}`
  );
}

export function customerPhone(customer: Customer): string {
  return customer.profile?.mobile_number?.trim() || customer.phone?.trim() || '—';
}

export function customerEmail(customer: Customer): string {
  return customer.profile?.email?.trim() || customer.email?.trim() || '—';
}

export function customerKycStatus(customer: Customer): string {
  return customer.profile?.kyc_status?.trim() || (customer.kyc ? 'Pending' : 'Not Available');
}

export function customerCity(customer: Customer): string {
  const address = customer.kyc?.address;
  if (!address) return '—';
  return (
    address.dist?.trim() ||
    address.district?.trim() ||
    address.city?.trim() ||
    address.state?.trim() ||
    '—'
  );
}

export function kycAadhaarVerified(kyc: KycRecord | null | undefined): boolean {
  return Boolean(kyc?.aadharVerified ?? kyc?.aadhaarVerified);
}

export function kycPanVerified(kyc: KycRecord | null | undefined): boolean {
  return Boolean(kyc?.pan_verified ?? kyc?.panVerified);
}

export function kycFaceVerified(kyc: KycRecord | null | undefined): boolean {
  return Boolean(kyc?.face_verified ?? kyc?.faceVerified);
}

export function kycCibilScore(kyc: KycRecord | null | undefined): number | null {
  const score = kyc?.cibil_score ?? kyc?.cibilScore;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}

/** Prefer backend masked value; otherwise mask locally (last 4 only). */
export function displayAadhaar(kyc: KycRecord | null | undefined): string {
  if (!kyc) return '—';
  if (kyc.masked_aadhaar?.trim()) return kyc.masked_aadhaar.trim();
  const raw = (kyc.aadhar_number || kyc.aadhaar_number || '').replace(/\D/g, '');
  if (!raw) return '—';
  const last4 = raw.slice(-4).padStart(4, '0');
  return `XXXX XXXX ${last4}`;
}

/** Mask PAN as ABC******4F when full value is present. */
export function displayPan(kyc: KycRecord | null | undefined): string {
  const value = (kyc?.panNumber ?? '').trim().toUpperCase();
  if (!value) return '—';
  if (value.includes('*')) return value;
  if (value.length !== 10) return '**********';
  return `${value.slice(0, 3)}******${value.slice(8)}`;
}

export function formatKycAddress(kyc: KycRecord | null | undefined): string {
  const address = kyc?.address;
  if (!address) return '—';
  if (address.fullAddress?.trim()) return address.fullAddress.trim();
  const parts = [
    address.line1,
    address.line2,
    address.dist || address.district || address.city,
    address.state,
    address.pincode || address.zip,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function humanizeAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
