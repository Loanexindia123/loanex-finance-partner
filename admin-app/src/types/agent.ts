/** Agent / Freelancer — aligned with Admin Web freelancer-agent models. */

export type AgentCatalogStatus = 'active' | 'inactive';

export interface Agent {
  id: string;
  agentId: string;
  agentIdIssued?: boolean;
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
  preferredWorkArea: string;
  workMode: string;
  emergencyContactName: string;
  emergencyContactMobile: string;
  profilePhoto: string;
  aadhaarFront: string;
  aadhaarBack: string;
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
  policyAccepted: boolean;
  status: AgentCatalogStatus;
  formStatus?: string;
  dealerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload mirrors Admin Web create/update body (dealer submits pending_approval). */
export type AgentPayload = {
  creatorType: 'Direct';
  creatorId?: string;
  creatorName?: string;
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
  preferredWorkArea: string;
  workMode: string;
  emergencyContactName: string;
  emergencyContactMobile: string;
  profilePhoto: string;
  aadhaarFront: string;
  aadhaarBack: string;
  aadhaarCard?: string;
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
  policyAccepted: boolean;
  status: AgentCatalogStatus;
  formStatus: 'draft' | 'pending_approval';
};

export const ONBOARDING_STEPS = [
  { key: 'referredBy', title: 'Referred By', description: 'Who created or referred this profile' },
  { key: 'personal', title: 'Personal Details', description: 'Identity and contact information' },
  { key: 'address', title: 'Address', description: 'Current address and work area' },
  { key: 'kyc', title: 'KYC', description: 'Photo, ID and signature files' },
  { key: 'work', title: 'Work Preferences', description: 'Type, department and training' },
  { key: 'bank', title: 'Bank & Payout', description: 'Incentive payout account' },
  { key: 'consent', title: 'Consent & Submit', description: 'Policy, status and save' },
] as const;

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export const EDUCATION_OPTIONS = [
  'Below 10th',
  '10th',
  '12th',
  'Diploma',
  'Graduate',
  'Post Graduate',
  'Other',
] as const;
export const OCCUPATION_OPTIONS = [
  'Self Employed',
  'Business',
  'Salaried',
  'Student',
  'Homemaker',
  'Other',
] as const;
export const WORK_MODE_OPTIONS = ['Field', 'Online', 'Both'] as const;
export const AGENT_TYPE_OPTIONS = ['Individual', 'Business Associate'] as const;
export const TRAINING_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'] as const;
export const DEPARTMENT_OPTIONS = [
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

export const AGENT_STATUS_OPTIONS: Array<{ value: AgentCatalogStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const DOCUMENT_FIELDS = [
  { key: 'profilePhoto', label: 'Profile Photo', required: true },
  { key: 'aadhaarFront', label: 'Aadhaar Front', required: true },
  { key: 'aadhaarBack', label: 'Aadhaar Back', required: true },
  { key: 'panCard', label: 'PAN Card', required: true },
  { key: 'addressProof', label: 'Address Proof', required: false },
  { key: 'cancelledCheque', label: 'Cancelled Cheque', required: true },
  { key: 'signature', label: 'Signature', required: true },
] as const;

export type DocumentFieldKey = (typeof DOCUMENT_FIELDS)[number]['key'];

export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_PATTERN = /^[2-9]\d{11}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_PATTERN = /^\d{8,18}$/;

export function emptyAgentForm() {
  return {
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
    city: '',
    state: '',
    pincode: '',
    googleLocation: '',
    preferredWorkArea: '',
    workMode: '',
    emergencyContactName: '',
    emergencyContactMobile: '',
    profilePhoto: '',
    aadhaarFront: '',
    aadhaarBack: '',
    aadhaarNumber: '',
    panCard: '',
    panNumber: '',
    addressProof: '',
    cancelledCheque: '',
    signature: '',
    agentType: '',
    preferredDepartments: [] as string[],
    allowedWork: [] as string[],
    assignedManager: '',
    assignedManagerId: '',
    branch: '',
    branchId: '',
    trainingStatus: 'Pending',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    policyAccepted: false,
    status: 'active' as AgentCatalogStatus,
  };
}
