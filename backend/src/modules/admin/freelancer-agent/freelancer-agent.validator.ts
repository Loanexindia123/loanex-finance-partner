import { z } from 'zod';
import {
  ACCOUNT_NUMBER_PATTERN,
  AADHAAR_PATTERN,
  AGENT_TYPES,
  CREATOR_TYPES,
  FORM_STATUSES,
  IFSC_PATTERN,
  MOBILE_PATTERN,
  PAN_PATTERN,
  PINCODE_PATTERN,
  TRAINING_STATUSES,
  WORK_MODES,
  normalizeAadhaar,
  normalizeAccount,
  normalizeIfscCode,
  normalizeMobile,
  normalizePan,
  normalizePincode,
  str,
  stringList,
} from './freelancer-agent.util';

const optionalString = z.preprocess(
  (value) => (value == null ? '' : value),
  z.string().trim().optional().default(''),
);
const optionalBool = z.preprocess(
  (value) => (value == null ? false : value),
  z.coerce.boolean().optional().default(false),
);
const stringArray = z.preprocess((value) => stringList(value), z.array(z.string()));

const formStatusSchema = z.enum(FORM_STATUSES);
const catalogStatusSchema = z.enum(['active', 'inactive']);

const freelancerCoreSchema = z.object({
  id: z.string().trim().min(1).optional(),
  agentId: optionalString,
  creatorType: optionalString,
  creatorId: optionalString,
  creatorName: optionalString,

  fullName: optionalString,
  fatherHusbandName: optionalString,
  dateOfBirth: optionalString,
  mobile: optionalString,
  whatsapp: optionalString,
  email: optionalString,
  gender: optionalString,
  education: optionalString,
  occupation: optionalString,

  currentAddress: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: optionalString,
  googleLocation: optionalString,
  preferredWorkArea: optionalString,
  workMode: optionalString,
  emergencyContactName: optionalString,
  emergencyContactMobile: optionalString,

  /** Server sets this for dealer-created agents; client value is ignored. */
  dealerId: optionalString,

  profilePhoto: optionalString,
  aadhaarFront: optionalString,
  aadhaarBack: optionalString,
  aadhaarCard: optionalString,
  aadhaarNumber: optionalString,
  panCard: optionalString,
  panNumber: optionalString,
  addressProof: optionalString,
  cancelledCheque: optionalString,
  signature: optionalString,

  agentType: optionalString,
  preferredDepartments: stringArray.optional().default([]),
  allowedWork: stringArray.optional().default([]),
  assignedManager: optionalString,
  assignedManagerId: optionalString,
  branch: optionalString,
  branchId: optionalString,
  trainingStatus: optionalString,

  accountNumber: optionalString,
  confirmAccountNumber: optionalString,
  ifscCode: optionalString,
  payoutBasis: optionalString,
  payoutConfig: z
    .object({
      policyVersion: optionalString,
      notes: optionalString,
    })
    .optional(),

  policyAccepted: optionalBool,
  policyAcceptedAt: optionalString,
  policyVersion: optionalString,

  status: catalogStatusSchema.optional(),
  formStatus: formStatusSchema.optional(),
});

const requiredWhenSubmitting = [
  ['fullName', 'Full Name'],
  ['dateOfBirth', 'Date of Birth'],
  ['mobile', 'Mobile Number'],
  ['currentAddress', 'Current Address'],
  ['pincode', 'Pincode'],
  ['preferredWorkArea', 'Preferred Work Area'],
  ['workMode', 'Work Mode'],
  ['profilePhoto', 'Profile Photo'],
  ['panCard', 'PAN Card'],
  ['cancelledCheque', 'Cancelled Cheque'],
  ['signature', 'Signature'],
  ['agentType', 'Agent Type'],
  ['assignedManagerId', 'Assigned Manager'],
  ['accountNumber', 'Account Number'],
  ['ifscCode', 'IFSC Code'],
] as const;

function hasAadhaarDocument(data: {
  aadhaarFront?: string;
  aadhaarBack?: string;
  aadhaarCard?: string;
}): boolean {
  const front = str(data.aadhaarFront);
  const back = str(data.aadhaarBack);
  const combined = str(data.aadhaarCard);
  return Boolean((front && back) || combined);
}

const freelancerBodySchema = freelancerCoreSchema.superRefine((data, ctx) => {
  const status = data.formStatus ?? 'draft';
  if (status === 'draft') return;

  if (status !== 'pending_approval') {
    ctx.addIssue({
      code: 'custom',
      message: 'Use draft or submit for approval. Agent ID is generated only after approval.',
      path: ['formStatus'],
    });
    return;
  }

  for (const [key, label] of requiredWhenSubmitting) {
    const value = data[key as keyof typeof data];
    if (typeof value !== 'string' || !value.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} is required`,
        path: [key],
      });
    }
  }

  const creatorType = str(data.creatorType);
  if (!creatorType) {
    ctx.addIssue({ code: 'custom', message: 'Creator Type is required', path: ['creatorType'] });
  } else if (!(CREATOR_TYPES as readonly string[]).includes(creatorType)) {
    ctx.addIssue({ code: 'custom', message: 'Select a valid creator type', path: ['creatorType'] });
  } else if (creatorType !== 'Direct' && !str(data.creatorId)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Search and select a creator',
      path: ['creatorId'],
    });
  }

  const mobile = normalizeMobile(data.mobile);
  if (mobile && !MOBILE_PATTERN.test(mobile)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid 10-digit mobile number',
      path: ['mobile'],
    });
  }

  const whatsapp = normalizeMobile(data.whatsapp);
  if (whatsapp && !MOBILE_PATTERN.test(whatsapp)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid 10-digit WhatsApp number',
      path: ['whatsapp'],
    });
  }

  const email = str(data.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email address', path: ['email'] });
  }

  const pincode = normalizePincode(data.pincode);
  if (pincode && !PINCODE_PATTERN.test(pincode)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid 6-digit Indian pincode',
      path: ['pincode'],
    });
  }

  const emergencyMobile = normalizeMobile(data.emergencyContactMobile);
  if (emergencyMobile && !MOBILE_PATTERN.test(emergencyMobile)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid 10-digit emergency mobile number',
      path: ['emergencyContactMobile'],
    });
  }

  if (!hasAadhaarDocument(data)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Aadhaar Card is required',
      path: ['aadhaarFront'],
    });
  }

  const aadhaarNumber = normalizeAadhaar(data.aadhaarNumber);
  if (aadhaarNumber && !AADHAAR_PATTERN.test(aadhaarNumber)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid 12-digit Aadhaar number',
      path: ['aadhaarNumber'],
    });
  }

  const panNumber = normalizePan(data.panNumber);
  if (panNumber && !PAN_PATTERN.test(panNumber)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid PAN (e.g. ABCDE1234F)',
      path: ['panNumber'],
    });
  }

  if (!(WORK_MODES as readonly string[]).includes(str(data.workMode))) {
    ctx.addIssue({ code: 'custom', message: 'Select a valid work mode', path: ['workMode'] });
  }

  if (!(AGENT_TYPES as readonly string[]).includes(str(data.agentType))) {
    ctx.addIssue({ code: 'custom', message: 'Select a valid agent type', path: ['agentType'] });
  }

  if (!(data.preferredDepartments ?? []).length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Preferred Department is required',
      path: ['preferredDepartments'],
    });
  }

  if (!(data.allowedWork ?? []).length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Allowed Work is required',
      path: ['allowedWork'],
    });
  }

  const training = str(data.trainingStatus);
  if (training && !(TRAINING_STATUSES as readonly string[]).includes(training)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Select a valid training status',
      path: ['trainingStatus'],
    });
  }

  const accountNumber = normalizeAccount(data.accountNumber);
  if (accountNumber && !ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Account number must be 8–18 digits',
      path: ['accountNumber'],
    });
  }

  const confirmAccount = normalizeAccount(data.confirmAccountNumber);
  if (accountNumber && confirmAccount !== accountNumber) {
    ctx.addIssue({
      code: 'custom',
      message: 'Account number and confirmation must match',
      path: ['confirmAccountNumber'],
    });
  }

  const ifsc = normalizeIfscCode(data.ifscCode);
  if (ifsc && !IFSC_PATTERN.test(ifsc)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a valid IFSC code (e.g. SBIN0001234)',
      path: ['ifscCode'],
    });
  }

  if (!data.policyAccepted) {
    ctx.addIssue({
      code: 'custom',
      message: 'Policy acceptance is required',
      path: ['policyAccepted'],
    });
  }
});

/** POST /admin/freelancer-agents */
export const createFreelancerAgentBodySchema = freelancerBodySchema;

/** PUT /admin/freelancer-agents/:id */
export const updateFreelancerAgentBodySchema = freelancerBodySchema;

export const rejectFreelancerAgentBodySchema = z.object({
  reason: optionalString,
});

export const listCreatorsQuerySchema = z.object({
  type: z.enum(['Employee', 'Existing Agent', 'Direct']).optional(),
});

export type CreateFreelancerAgentBody = z.infer<typeof createFreelancerAgentBodySchema>;
export type UpdateFreelancerAgentBody = z.infer<typeof updateFreelancerAgentBodySchema>;
export type RejectFreelancerAgentBody = z.infer<typeof rejectFreelancerAgentBodySchema>;
