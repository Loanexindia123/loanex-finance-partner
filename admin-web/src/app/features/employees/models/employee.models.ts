export type EmployeeFormStatus = 'draft' | 'pending' | 'approved';
export type EmployeeVerificationStatus = 'pending' | 'verified' | 'rejected';
export type EmployeeCatalogStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  onboardedBy: string;
  onboardedById: string;
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
  verificationStatus: EmployeeVerificationStatus;
  status: EmployeeCatalogStatus;
  formStatus: EmployeeFormStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type EmployeePayload = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export const ONBOARDING_STEPS = [
  { key: 'createdBy', title: 'Created By', description: 'Who initiated this onboarding', icon: 'pi-user-plus' },
  { key: 'personal', title: 'Personal Details', description: 'Identity and contact information', icon: 'pi-id-card' },
  { key: 'job', title: 'Job & Reporting', description: 'Role, branch and reporting line', icon: 'pi-briefcase' },
  { key: 'salary', title: 'Salary Structure', description: 'CTC breakup and take-home', icon: 'pi-wallet' },
  { key: 'documents', title: 'Documents & Verification', description: 'KYC and appointment files', icon: 'pi-file' },
  { key: 'bank', title: 'Bank & Statutory', description: 'Bank account, UAN and ESIC', icon: 'pi-building' },
  { key: 'review', title: 'Review & Join', description: 'Confirm and complete onboarding', icon: 'pi-check-circle' },
] as const;

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Divorced'] as const;

export const EMPLOYMENT_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const;

export const WORK_MODE_OPTIONS = ['Office', 'Hybrid', 'Remote', 'Field'] as const;

export const SHIFT_OPTIONS = [
  'Morning (09:00 – 18:00)',
  'Afternoon (12:00 – 21:00)',
  'Night (21:00 – 06:00)',
  'Rotational',
  'Flexible',
] as const;

export const PROBATION_OPTIONS = ['None', '3 months', '6 months', '12 months'] as const;

export const NOTICE_PERIOD_OPTIONS = ['15 days', '30 days', '60 days', '90 days'] as const;

export const PAYMENT_MODE_OPTIONS = ['Bank Transfer', 'Cheque', 'Cash'] as const;

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

export const FALLBACK_DESIGNATIONS = [
  'Branch Manager',
  'Credit Officer',
  'FI Executive',
  'Sales Executive',
  'HR Executive',
  'Accountant',
  'Support Executive',
  'Operations Executive',
  'Team Lead',
  'Other',
] as const;

export const VERIFICATION_STATUS_OPTIONS: { label: string; value: EmployeeVerificationStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Verified', value: 'verified' },
  { label: 'Rejected', value: 'rejected' },
];

export const FORM_STATUS_OPTIONS: { label: string; value: EmployeeFormStatus }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
];

export const DOCUMENT_FIELDS = [
  { key: 'profilePhoto', label: 'Profile Photo', required: true, hint: 'JPG / PNG' },
  { key: 'aadhaarCard', label: 'Aadhaar Card', required: true, hint: 'Front + Back' },
  { key: 'panCard', label: 'PAN Card', required: true, hint: 'PDF / JPG' },
  { key: 'addressProof', label: 'Address Proof', required: true, hint: 'Bill / Aadhaar' },
  { key: 'educationDocuments', label: 'Education Documents', required: false, hint: 'Certificates' },
  { key: 'experienceLetter', label: 'Experience Letter', required: false, hint: 'Optional' },
  { key: 'cancelledCheque', label: 'Cancelled Cheque', required: true, hint: 'Cheque image' },
  { key: 'signature', label: 'Signature', required: true, hint: 'JPG / PNG' },
  { key: 'appointmentLetter', label: 'Appointment Letter', required: false, hint: 'Signed copy' },
] as const;

export const STEP_REQUIRED_FIELDS: ReadonlyArray<readonly string[]> = [
  ['onboardedBy', 'employeeId', 'onboardingDate'],
  ['fullName', 'dateOfBirth', 'mobile'],
  [
    'department',
    'designation',
    'employmentType',
    'dateOfJoining',
    'branch',
    'workMode',
    'reportingPerson',
    'shift',
  ],
  ['monthlyCtc', 'basicSalary', 'salaryEffectiveFrom'],
  ['profilePhoto', 'aadhaarCard', 'panCard', 'addressProof', 'cancelledCheque', 'signature'],
  ['accountHolderName', 'accountNumber', 'ifscCode', 'verificationStatus'],
  [],
];

export const APPROVE_REQUIRED_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'mobile', label: 'Mobile Number' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation / Post' },
  { key: 'employmentType', label: 'Employment Type' },
  { key: 'dateOfJoining', label: 'Date of Joining' },
  { key: 'branch', label: 'Branch / Work Location' },
  { key: 'workMode', label: 'Work Mode' },
  { key: 'reportingPerson', label: 'Reporting Person' },
  { key: 'shift', label: 'Shift / Duty Timing' },
  { key: 'monthlyCtc', label: 'Monthly CTC' },
  { key: 'basicSalary', label: 'Basic Salary' },
  { key: 'salaryEffectiveFrom', label: 'Salary Effective From' },
  { key: 'profilePhoto', label: 'Profile Photo' },
  { key: 'aadhaarCard', label: 'Aadhaar Card' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'addressProof', label: 'Address Proof' },
  { key: 'cancelledCheque', label: 'Cancelled Cheque' },
  { key: 'signature', label: 'Signature' },
  { key: 'accountHolderName', label: 'Account Holder Name' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'verificationStatus', label: 'Verification Status' },
];

export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function generateEmployeeId(): string {
  const stamp = todayIsoDate().replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(-4).toUpperCase();
  return `EMP-${stamp}-${suffix}`;
}

export function emptyEmployee(defaults?: Partial<EmployeePayload>): EmployeePayload {
  return {
    onboardedBy: '',
    onboardedById: '',
    userId: '',
    employeeId: generateEmployeeId(),
    onboardingDate: todayIsoDate(),
    fullName: '',
    fatherHusbandName: '',
    dateOfBirth: '',
    mobile: '',
    whatsapp: '',
    email: '',
    gender: '',
    maritalStatus: '',
    emergencyContact: '',
    department: '',
    designation: '',
    employmentType: '',
    dateOfJoining: '',
    branch: '',
    branchId: '',
    workMode: '',
    reportingPerson: '',
    reportingPersonId: '',
    reportingPersonPost: '',
    shift: '',
    probationPeriod: '',
    noticePeriod: '',
    monthlyCtc: '',
    basicSalary: '',
    hra: '',
    conveyanceAllowance: '',
    specialAllowance: '',
    otherAllowance: '',
    fixedGrossSalary: '',
    variableIncentive: '',
    totalMonthlyCtc: '',
    pfApplicable: false,
    esiApplicable: false,
    otherDeduction: '',
    netTakeHome: '',
    salaryEffectiveFrom: '',
    paymentMode: '',
    profilePhoto: '',
    aadhaarCard: '',
    panCard: '',
    addressProof: '',
    educationDocuments: '',
    experienceLetter: '',
    cancelledCheque: '',
    signature: '',
    appointmentLetter: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    uanNumber: '',
    esicNumber: '',
    verificationStatus: 'pending',
    status: 'active',
    formStatus: 'draft',
    ...defaults,
  };
}

export function normalizeEmployee(raw: unknown): Employee {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: string): string => String(row[key] ?? '').trim();
  const verification = pick('verificationStatus');
  const formStatus = pick('formStatus');
  return {
    id: pick('id'),
    onboardedBy: pick('onboardedBy'),
    onboardedById: pick('onboardedById'),
    userId: pick('userId'),
    employeeId: pick('employeeId'),
    onboardingDate: pick('onboardingDate'),
    fullName: pick('fullName'),
    fatherHusbandName: pick('fatherHusbandName'),
    dateOfBirth: pick('dateOfBirth'),
    mobile: pick('mobile'),
    whatsapp: pick('whatsapp'),
    email: pick('email'),
    gender: pick('gender'),
    maritalStatus: pick('maritalStatus'),
    emergencyContact: pick('emergencyContact'),
    department: pick('department'),
    designation: pick('designation'),
    employmentType: pick('employmentType'),
    dateOfJoining: pick('dateOfJoining'),
    branch: pick('branch'),
    branchId: pick('branchId'),
    workMode: pick('workMode'),
    reportingPerson: pick('reportingPerson'),
    reportingPersonId: pick('reportingPersonId'),
    reportingPersonPost: pick('reportingPersonPost'),
    shift: pick('shift'),
    probationPeriod: pick('probationPeriod'),
    noticePeriod: pick('noticePeriod'),
    monthlyCtc: pick('monthlyCtc'),
    basicSalary: pick('basicSalary'),
    hra: pick('hra'),
    conveyanceAllowance: pick('conveyanceAllowance'),
    specialAllowance: pick('specialAllowance'),
    otherAllowance: pick('otherAllowance'),
    fixedGrossSalary: pick('fixedGrossSalary'),
    variableIncentive: pick('variableIncentive'),
    totalMonthlyCtc: pick('totalMonthlyCtc'),
    pfApplicable: row['pfApplicable'] === true || row['pfApplicable'] === 'true',
    esiApplicable: row['esiApplicable'] === true || row['esiApplicable'] === 'true',
    otherDeduction: pick('otherDeduction'),
    netTakeHome: pick('netTakeHome'),
    salaryEffectiveFrom: pick('salaryEffectiveFrom'),
    paymentMode: pick('paymentMode'),
    profilePhoto: pick('profilePhoto'),
    aadhaarCard: pick('aadhaarCard'),
    panCard: pick('panCard'),
    addressProof: pick('addressProof'),
    educationDocuments: pick('educationDocuments'),
    experienceLetter: pick('experienceLetter'),
    cancelledCheque: pick('cancelledCheque'),
    signature: pick('signature'),
    appointmentLetter: pick('appointmentLetter'),
    accountHolderName: pick('accountHolderName'),
    accountNumber: pick('accountNumber'),
    ifscCode: pick('ifscCode'),
    uanNumber: pick('uanNumber'),
    esicNumber: pick('esicNumber'),
    verificationStatus:
      verification === 'verified' || verification === 'rejected' ? verification : 'pending',
    status: pick('status') === 'inactive' ? 'inactive' : 'active',
    formStatus: formStatus === 'pending' || formStatus === 'approved' ? formStatus : 'draft',
    createdAt: pick('createdAt') || undefined,
    updatedAt: pick('updatedAt') || undefined,
  };
}

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_PATTERN = /^\d{8,18}$/;
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
