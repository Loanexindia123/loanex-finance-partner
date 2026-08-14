import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (value == null ? '' : value),
  z.string().trim().optional().default(''),
);
const optionalBool = z.preprocess(
  (value) => (value == null ? false : value),
  z.coerce.boolean().optional().default(false),
);

const formStatusSchema = z.enum(['draft', 'pending', 'approved']);
const catalogStatusSchema = z.enum(['active', 'inactive']);
const verificationStatusSchema = z.enum(['pending', 'verified', 'rejected']);

const employeeCoreSchema = z.object({
  id: z.string().trim().min(1).optional(),
  onboardedBy: optionalString,
  onboardedById: optionalString,
  employeeId: optionalString,
  onboardingDate: optionalString,

  fullName: optionalString,
  fatherHusbandName: optionalString,
  dateOfBirth: optionalString,
  mobile: optionalString,
  whatsapp: optionalString,
  email: optionalString,
  gender: optionalString,
  maritalStatus: optionalString,
  emergencyContact: optionalString,

  department: optionalString,
  designation: optionalString,
  employmentType: optionalString,
  dateOfJoining: optionalString,
  branch: optionalString,
  branchId: optionalString,
  workMode: optionalString,
  reportingPerson: optionalString,
  reportingPersonId: optionalString,
  reportingPersonPost: optionalString,
  shift: optionalString,
  probationPeriod: optionalString,
  noticePeriod: optionalString,

  monthlyCtc: optionalString,
  basicSalary: optionalString,
  hra: optionalString,
  conveyanceAllowance: optionalString,
  specialAllowance: optionalString,
  otherAllowance: optionalString,
  fixedGrossSalary: optionalString,
  variableIncentive: optionalString,
  totalMonthlyCtc: optionalString,
  pfApplicable: optionalBool,
  esiApplicable: optionalBool,
  otherDeduction: optionalString,
  netTakeHome: optionalString,
  salaryEffectiveFrom: optionalString,
  paymentMode: optionalString,

  profilePhoto: optionalString,
  aadhaarCard: optionalString,
  panCard: optionalString,
  addressProof: optionalString,
  educationDocuments: optionalString,
  experienceLetter: optionalString,
  cancelledCheque: optionalString,
  signature: optionalString,
  appointmentLetter: optionalString,

  accountHolderName: optionalString,
  accountNumber: optionalString,
  ifscCode: optionalString,
  uanNumber: optionalString,
  esicNumber: optionalString,
  verificationStatus: verificationStatusSchema.optional().default('pending'),

  status: catalogStatusSchema.optional(),
  formStatus: formStatusSchema.optional(),
});

const requiredWhenNotDraft = [
  ['fullName', 'Full Name'],
  ['dateOfBirth', 'Date of Birth'],
  ['mobile', 'Mobile Number'],
  ['department', 'Department'],
  ['designation', 'Designation / Post'],
  ['employmentType', 'Employment Type'],
  ['dateOfJoining', 'Date of Joining'],
  ['branch', 'Branch / Work Location'],
  ['workMode', 'Work Mode'],
  ['reportingPerson', 'Reporting Person'],
  ['shift', 'Shift / Duty Timing'],
  ['monthlyCtc', 'Monthly CTC'],
  ['basicSalary', 'Basic Salary'],
  ['salaryEffectiveFrom', 'Salary Effective From'],
  ['profilePhoto', 'Profile Photo'],
  ['aadhaarCard', 'Aadhaar Card'],
  ['panCard', 'PAN Card'],
  ['addressProof', 'Address Proof'],
  ['cancelledCheque', 'Cancelled Cheque'],
  ['signature', 'Signature'],
  ['accountHolderName', 'Account Holder Name'],
  ['accountNumber', 'Account Number'],
  ['ifscCode', 'IFSC Code'],
] as const;

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{8,18}$/;

const employeeBodySchema = employeeCoreSchema.superRefine((data, ctx) => {
  const status = data.formStatus ?? 'draft';
  if (status === 'draft') return;

  for (const [key, label] of requiredWhenNotDraft) {
    const value = data[key as keyof typeof data];
    if (typeof value !== 'string' || !value.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} is required`,
        path: [key],
      });
    }
  }

  const ifsc = String(data.ifscCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (ifsc && !IFSC_PATTERN.test(ifsc)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid IFSC code (e.g. SBIN0001234)',
      path: ['ifscCode'],
    });
  }

  const accountNumber = String(data.accountNumber ?? '').trim();
  if (accountNumber && !ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Account number must be 8–18 digits',
      path: ['accountNumber'],
    });
  }
});

/** POST /admin/employees */
export const createEmployeeBodySchema = employeeBodySchema;

/** PUT /admin/employees/:id */
export const updateEmployeeBodySchema = employeeBodySchema;

export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBodySchema>;
