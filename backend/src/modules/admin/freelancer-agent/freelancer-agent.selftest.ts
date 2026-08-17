/**
 * Freelancer / Growing Partner onboarding — pure helper checks (no DB).
 * Run with: npx tsx src/modules/admin/freelancer-agent/freelancer-agent.selftest.ts
 */
import {
  AGENT_ID_PATTERN,
  AGENT_ID_PLACEHOLDER,
  IFSC_PATTERN,
  MOBILE_PATTERN,
  PAN_PATTERN,
  PINCODE_PATTERN,
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
} from './freelancer-agent.util';
import { createFreelancerAgentBodySchema } from './freelancer-agent.validator';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const idA = generateAgentId();
const idB = generateAgentId();
assert(AGENT_ID_PATTERN.test(idA), 'generated agent id must match AG-XXXXXX');
assert(idA !== idB, 'generated agent ids must be unique');
assert(!idA.startsWith('EMP-'), 'agent id must not reuse employee prefix');

assert(displayAgentId('', 'draft') === AGENT_ID_PLACEHOLDER, 'draft must hide agent id');
assert(displayAgentId('', 'pending_approval') === AGENT_ID_PLACEHOLDER, 'pending must hide agent id');
assert(displayAgentId(idA, 'approved') === idA, 'approved record shows generated id');
assert(
  displayAgentId('EMP-20260101-AB12', 'approved') === AGENT_ID_PLACEHOLDER,
  'employee-style ids must not be accepted as agent ids',
);

assert(canEditFormStatus('draft') && canEditFormStatus('rejected'), 'draft/rejected are editable');
assert(!canEditFormStatus('pending_approval') && !canEditFormStatus('approved'), 'pending/approved are locked');
assert(canSubmitFormStatus('draft') && canSubmitFormStatus('rejected'), 'draft/rejected can be submitted');

assert(MOBILE_PATTERN.test(normalizeMobile('9876543210')), 'valid mobile');
assert(!MOBILE_PATTERN.test(normalizeMobile('12345')), 'invalid mobile rejected');
assert(PINCODE_PATTERN.test(normalizePincode('560001')), 'valid pincode');
assert(!PINCODE_PATTERN.test(normalizePincode('000001')), 'pincode cannot start with 0');
assert(IFSC_PATTERN.test(normalizeIfscCode('sbin0001234')), 'ifsc normalized and valid');
assert(PAN_PATTERN.test(normalizePan('abcde1234f')), 'pan normalized');
assert(normalizeAadhaar('2345 6789 0123') === '234567890123', 'aadhaar digits only');
assert(normalizeAccount('1234 5678 9012') === '123456789012', 'account digits only');

assert(maskAadhaar('234567890123').endsWith('0123'), 'aadhaar mask keeps last 4');
assert(!maskAadhaar('234567890123').includes('23456789'), 'aadhaar mask hides prefix');
assert(maskPan('ABCDE1234F').endsWith('234F'), 'pan mask keeps last 4');
assert(maskBankAccount('123456789012').includes('9012'), 'account mask keeps last 4');

assert(
  duplicateConflictMessage('mobile').includes('mobile'),
  'duplicate message does not leak other records',
);
assert(!duplicateConflictMessage('pan').includes('ABCDE'), 'duplicate message has no PAN value');

const draft = createFreelancerAgentBodySchema.safeParse({
  formStatus: 'draft',
  fullName: '',
  mobile: '',
});
assert(draft.success, 'draft may omit required fields');

const submitMissing = createFreelancerAgentBodySchema.safeParse({
  formStatus: 'pending_approval',
  creatorType: 'Direct',
  fullName: 'Asha',
});
assert(!submitMissing.success, 'submit requires mandatory fields');

const submitValid = createFreelancerAgentBodySchema.safeParse({
  formStatus: 'pending_approval',
  creatorType: 'Direct',
  fullName: 'Asha Rao',
  dateOfBirth: '1994-02-11',
  mobile: '9876543210',
  currentAddress: '12 MG Road, Bengaluru',
  pincode: '560001',
  preferredWorkArea: 'Bengaluru',
  workMode: 'Field',
  profilePhoto: '/api/v1/products/images/aaaaaaaaaaaaaaaaaaaaaaaa',
  aadhaarFront: '/api/v1/products/images/bbbbbbbbbbbbbbbbbbbbbbbb',
  aadhaarBack: '/api/v1/products/images/cccccccccccccccccccccccc',
  panCard: '/api/v1/products/images/dddddddddddddddddddddddd',
  cancelledCheque: '/api/v1/products/images/eeeeeeeeeeeeeeeeeeeeeeee',
  signature: '/api/v1/products/images/ffffffffffffffffffffffff',
  agentType: 'Individual',
  preferredDepartments: ['Sales'],
  allowedWork: ['Leads'],
  assignedManager: 'Ravi',
  assignedManagerId: 'mgr-1',
  accountNumber: '123456789012',
  confirmAccountNumber: '123456789012',
  ifscCode: 'SBIN0001234',
  policyAccepted: true,
});
assert(submitValid.success, `valid submit must pass: ${submitValid.success ? '' : JSON.stringify(submitValid.error)}`);

const mismatch = createFreelancerAgentBodySchema.safeParse({
  ...submitValid.data,
  confirmAccountNumber: '999999999999',
});
assert(!mismatch.success, 'confirm account must match');

const salaryKeys = ['monthlyCtc', 'basicSalary', 'pfApplicable', 'esiApplicable', 'uanNumber'];
for (const key of salaryKeys) {
  assert(!(key in (submitValid.data ?? {})), `payload must not introduce ${key}`);
}

console.log('freelancer-agent.selftest: all assertions passed');
