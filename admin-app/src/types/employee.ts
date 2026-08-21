export type EmployeeFormStatus = 'draft' | 'pending' | 'approved';

export interface AppEmployee {
  id: string;
  employeeId: string;
  fullName: string;
  fatherHusbandName: string;
  dateOfBirth: string;
  mobile: string;
  whatsapp: string;
  email: string;
  gender: string;
  department: string;
  designation: string;
  employmentType: string;
  dateOfJoining: string;
  branch: string;
  workMode: string;
  reportingPerson: string;
  shift: string;
  monthlyCtc: string;
  basicSalary: string;
  salaryEffectiveFrom: string;
  profilePhoto: string;
  aadhaarCard: string;
  panCard: string;
  addressProof: string;
  cancelledCheque: string;
  signature: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  onboardedBy: string;
  onboardedById: string;
  userId: string;
  formStatus: string;
  verificationStatus: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeePayload {
  fullName?: string;
  fatherHusbandName?: string;
  dateOfBirth?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  gender?: string;
  department?: string;
  designation?: string;
  employmentType?: string;
  dateOfJoining?: string;
  branch?: string;
  workMode?: string;
  reportingPerson?: string;
  shift?: string;
  monthlyCtc?: string;
  basicSalary?: string;
  salaryEffectiveFrom?: string;
  profilePhoto?: string;
  aadhaarCard?: string;
  panCard?: string;
  addressProof?: string;
  cancelledCheque?: string;
  signature?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  formStatus?: EmployeeFormStatus;
}

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export const EMPLOYMENT_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const;
export const WORK_MODE_OPTIONS = ['Office', 'Hybrid', 'Remote', 'Field'] as const;
export const SHIFT_OPTIONS = [
  'Morning (09:00 – 18:00)',
  'Afternoon (12:00 – 21:00)',
  'Night (21:00 – 06:00)',
  'Rotational',
  'Flexible',
] as const;
