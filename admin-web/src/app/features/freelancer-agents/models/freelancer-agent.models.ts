export type FreelancerFormStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';
export type FreelancerCatalogStatus = 'active' | 'inactive';
export type FreelancerCreatorType = 'Employee' | 'Existing Agent' | 'Direct';

export interface FreelancerApprovalHistoryEntry {
  action: 'created' | 'draft_saved' | 'submitted' | 'approved' | 'rejected' | 'updated';
  byId: string;
  byName: string;
  at: string;
  note?: string;
}

export interface FreelancerPayoutConfig {
  policyVersion: string;
  notes: string;
}

export interface FreelancerAgent {
  id: string;
  agentId: string;
  agentIdIssued: boolean;
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
  pincode: string;
  googleLocation: string;
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
  confirmAccountNumber: string;
  ifscCode: string;
  payoutBasis: string;
  payoutConfig: FreelancerPayoutConfig;
  policyAccepted: boolean;
  policyAcceptedAt: string;
  policyVersion: string;
  status: FreelancerCatalogStatus;
  formStatus: FreelancerFormStatus;
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
  approvalHistory: FreelancerApprovalHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export type FreelancerAgentPayload = Omit<FreelancerAgent, 'id' | 'createdAt' | 'updatedAt' | 'agentIdIssued'> & {
  id?: string;
};

export const AGENT_ID_PLACEHOLDER = 'AUTO-GENERATED AFTER APPROVAL';
export const POLICY_VERSION = 'gp-payout-v1';
export const PAYOUT_BASIS = 'incentive_commission';

export const ONBOARDING_STEPS = [
  { key: 'referredBy', title: 'Referred By', description: 'Who created or referred this profile', icon: 'pi-user-plus' },
  { key: 'personal', title: 'Personal Details', description: 'Identity and contact information', icon: 'pi-id-card' },
  { key: 'address', title: 'Address', description: 'Current address and work area', icon: 'pi-map-marker' },
  { key: 'kyc', title: 'KYC Documents', description: 'Photo, ID and signature files', icon: 'pi-file' },
  { key: 'work', title: 'Work Preferences', description: 'Type, department and manager', icon: 'pi-briefcase' },
  { key: 'bank', title: 'Bank & Payout', description: 'Incentive payout account', icon: 'pi-building' },
  { key: 'consent', title: 'Consent & Submit', description: 'Review, accept policy and submit', icon: 'pi-check-circle' },
] as const;

export const CREATOR_TYPE_OPTIONS = ['Employee', 'Existing Agent', 'Direct'] as const;
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export const EDUCATION_OPTIONS = ['Below 10th', '10th', '12th', 'Diploma', 'Graduate', 'Post Graduate', 'Other'] as const;
export const OCCUPATION_OPTIONS = ['Self Employed', 'Business', 'Salaried', 'Student', 'Homemaker', 'Other'] as const;
export const WORK_MODE_OPTIONS = ['Field', 'Online', 'Both'] as const;
export const AGENT_TYPE_OPTIONS = ['Individual', 'Business Associate'] as const;
export const TRAINING_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'] as const;
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

export const FORM_STATUS_OPTIONS: { label: string; value: FreelancerFormStatus }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export const DOCUMENT_FIELDS = [
  { key: 'profilePhoto', label: 'Profile Photo', required: true, hint: 'JPG / PNG' },
  { key: 'aadhaarFront', label: 'Aadhaar Front', required: true, hint: 'JPG / PNG / PDF' },
  { key: 'aadhaarBack', label: 'Aadhaar Back', required: true, hint: 'JPG / PNG / PDF' },
  { key: 'panCard', label: 'PAN Card', required: true, hint: 'PDF / JPG / PNG' },
  { key: 'addressProof', label: 'Address Proof', required: false, hint: 'Optional' },
  { key: 'cancelledCheque', label: 'Cancelled Cheque', required: true, hint: 'Image / PDF' },
  { key: 'signature', label: 'Signature', required: true, hint: 'JPG / PNG' },
] as const;

export const STEP_REQUIRED_FIELDS: ReadonlyArray<readonly string[]> = [
  ['creatorType'],
  ['fullName', 'dateOfBirth', 'mobile'],
  ['currentAddress', 'pincode', 'preferredWorkArea', 'workMode'],
  ['profilePhoto', 'aadhaarFront', 'aadhaarBack', 'panCard', 'cancelledCheque', 'signature'],
  ['agentType', 'preferredDepartments', 'allowedWork', 'assignedManagerId'],
  ['accountNumber', 'confirmAccountNumber', 'ifscCode', 'policyAccepted'],
  [],
];

export const SUBMIT_REQUIRED_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'creatorType', label: 'Creator Type' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'mobile', label: 'Mobile Number' },
  { key: 'currentAddress', label: 'Current Address' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'preferredWorkArea', label: 'Preferred Work Area' },
  { key: 'workMode', label: 'Work Mode' },
  { key: 'profilePhoto', label: 'Profile Photo' },
  { key: 'aadhaarFront', label: 'Aadhaar Front' },
  { key: 'aadhaarBack', label: 'Aadhaar Back' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'cancelledCheque', label: 'Cancelled Cheque' },
  { key: 'signature', label: 'Signature' },
  { key: 'agentType', label: 'Agent Type' },
  { key: 'preferredDepartments', label: 'Preferred Department' },
  { key: 'allowedWork', label: 'Allowed Work' },
  { key: 'assignedManagerId', label: 'Assigned Manager' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'confirmAccountNumber', label: 'Confirm Account Number' },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'policyAccepted', label: 'Policy Acceptance' },
];

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_PATTERN = /^\d{8,18}$/;
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_PATTERN = /^[2-9]\d{11}$/;

export function emptyFreelancerAgent(): FreelancerAgentPayload {
  return {
    agentId: '',
    creatorType: '',
    creatorId: '',
    creatorName: '',
    fullName: '',
    fatherHusbandName: '',
    dateOfBirth: '',
    mobile: '',
    whatsapp: '',
    email: '',
    gender: '',
    education: '',
    occupation: '',
    currentAddress: '',
    pincode: '',
    googleLocation: '',
    preferredWorkArea: '',
    workMode: '',
    emergencyContactName: '',
    emergencyContactMobile: '',
    profilePhoto: '',
    aadhaarFront: '',
    aadhaarBack: '',
    aadhaarCard: '',
    aadhaarNumber: '',
    panCard: '',
    panNumber: '',
    addressProof: '',
    cancelledCheque: '',
    signature: '',
    agentType: '',
    preferredDepartments: [],
    allowedWork: [],
    assignedManager: '',
    assignedManagerId: '',
    branch: '',
    branchId: '',
    trainingStatus: 'Pending',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    payoutBasis: PAYOUT_BASIS,
    payoutConfig: {
      policyVersion: POLICY_VERSION,
      notes: 'Incentive / Commission as per approved company policy',
    },
    policyAccepted: false,
    policyAcceptedAt: '',
    policyVersion: POLICY_VERSION,
    status: 'inactive',
    formStatus: 'draft',
    createdBy: '',
    createdById: '',
    updatedBy: '',
    updatedById: '',
    approvedBy: '',
    approvedById: '',
    approvedAt: '',
    rejectedBy: '',
    rejectedById: '',
    rejectedAt: '',
    rejectionReason: '',
    approvalHistory: [],
  };
}

function pick(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function pickList(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function pickHistory(raw: unknown): FreelancerApprovalHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const rec = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const action = pick(rec, 'action') as FreelancerApprovalHistoryEntry['action'];
      return {
        action,
        byId: pick(rec, 'byId'),
        byName: pick(rec, 'byName'),
        at: pick(rec, 'at'),
        note: pick(rec, 'note') || undefined,
      };
    })
    .filter((entry) => entry.action && entry.at);
}

export function normalizeFreelancerAgent(raw: unknown): FreelancerAgent {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const formStatus = pick(row, 'formStatus');
  const payout =
    row['payoutConfig'] && typeof row['payoutConfig'] === 'object'
      ? (row['payoutConfig'] as Record<string, unknown>)
      : {};
  const issued = row['agentIdIssued'] === true || (formStatus === 'approved' && !!pick(row, 'agentId'));
  return {
    id: pick(row, 'id'),
    agentId: pick(row, 'agentId'),
    agentIdIssued: issued,
    creatorType: pick(row, 'creatorType'),
    creatorId: pick(row, 'creatorId'),
    creatorName: pick(row, 'creatorName'),
    fullName: pick(row, 'fullName'),
    fatherHusbandName: pick(row, 'fatherHusbandName'),
    dateOfBirth: pick(row, 'dateOfBirth'),
    mobile: pick(row, 'mobile'),
    whatsapp: pick(row, 'whatsapp'),
    email: pick(row, 'email'),
    gender: pick(row, 'gender'),
    education: pick(row, 'education'),
    occupation: pick(row, 'occupation'),
    currentAddress: pick(row, 'currentAddress'),
    pincode: pick(row, 'pincode'),
    googleLocation: pick(row, 'googleLocation'),
    preferredWorkArea: pick(row, 'preferredWorkArea'),
    workMode: pick(row, 'workMode'),
    emergencyContactName: pick(row, 'emergencyContactName'),
    emergencyContactMobile: pick(row, 'emergencyContactMobile'),
    profilePhoto: pick(row, 'profilePhoto'),
    aadhaarFront: pick(row, 'aadhaarFront'),
    aadhaarBack: pick(row, 'aadhaarBack'),
    aadhaarCard: pick(row, 'aadhaarCard'),
    aadhaarNumber: pick(row, 'aadhaarNumber'),
    panCard: pick(row, 'panCard'),
    panNumber: pick(row, 'panNumber'),
    addressProof: pick(row, 'addressProof'),
    cancelledCheque: pick(row, 'cancelledCheque'),
    signature: pick(row, 'signature'),
    agentType: pick(row, 'agentType'),
    preferredDepartments: pickList(row, 'preferredDepartments'),
    allowedWork: pickList(row, 'allowedWork'),
    assignedManager: pick(row, 'assignedManager'),
    assignedManagerId: pick(row, 'assignedManagerId'),
    branch: pick(row, 'branch'),
    branchId: pick(row, 'branchId'),
    trainingStatus: pick(row, 'trainingStatus') || 'Pending',
    accountNumber: pick(row, 'accountNumber'),
    confirmAccountNumber: pick(row, 'accountNumber'),
    ifscCode: pick(row, 'ifscCode'),
    payoutBasis: pick(row, 'payoutBasis') || PAYOUT_BASIS,
    payoutConfig: {
      policyVersion: String(payout['policyVersion'] ?? POLICY_VERSION).trim(),
      notes: String(payout['notes'] ?? 'Incentive / Commission as per approved company policy').trim(),
    },
    policyAccepted: row['policyAccepted'] === true || row['policyAccepted'] === 'true',
    policyAcceptedAt: pick(row, 'policyAcceptedAt'),
    policyVersion: pick(row, 'policyVersion') || POLICY_VERSION,
    status: pick(row, 'status') === 'active' ? 'active' : 'inactive',
    formStatus:
      formStatus === 'pending_approval' || formStatus === 'approved' || formStatus === 'rejected'
        ? formStatus
        : 'draft',
    createdBy: pick(row, 'createdBy'),
    createdById: pick(row, 'createdById'),
    updatedBy: pick(row, 'updatedBy'),
    updatedById: pick(row, 'updatedById'),
    approvedBy: pick(row, 'approvedBy'),
    approvedById: pick(row, 'approvedById'),
    approvedAt: pick(row, 'approvedAt'),
    rejectedBy: pick(row, 'rejectedBy'),
    rejectedById: pick(row, 'rejectedById'),
    rejectedAt: pick(row, 'rejectedAt'),
    rejectionReason: pick(row, 'rejectionReason'),
    approvalHistory: pickHistory(row['approvalHistory']),
    createdAt: pick(row, 'createdAt') || undefined,
    updatedAt: pick(row, 'updatedAt') || undefined,
  };
}

export function displayAgentId(agent: Pick<FreelancerAgent, 'agentId' | 'agentIdIssued' | 'formStatus'>): string {
  if (agent.agentIdIssued && agent.agentId && agent.agentId !== AGENT_ID_PLACEHOLDER) {
    return agent.agentId;
  }
  return AGENT_ID_PLACEHOLDER;
}
