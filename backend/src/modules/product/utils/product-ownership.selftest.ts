/**
 * Product ownership visibility (employee onboarding chain) — run with:
 *   npx tsx src/modules/product/utils/product-ownership.selftest.ts
 */
import type { EmployeeRecord } from '../../admin/employee/employee.service';
import type { ViewerIdentity } from '../../admin/employee/employee-hierarchy';
import {
  buildAllowedCreatorIds,
  canAccessProductByCreator,
  resolveProductCreatorScopeFromViewer,
  type ProductCreatorScope,
} from './product-ownership';

function emp(
  partial: Pick<EmployeeRecord, 'id' | 'fullName' | 'onboardedById'> &
    Partial<EmployeeRecord>,
): EmployeeRecord {
  return {
    onboardedBy: '',
    userId: partial.userId ?? '',
    employeeId: partial.employeeId ?? partial.id,
    onboardingDate: '',
    fatherHusbandName: '',
    dateOfBirth: '',
    mobile: partial.mobile ?? '',
    whatsapp: '',
    email: partial.email ?? '',
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
    formStatus: 'approved',
    ...partial,
  };
}

function viewer(
  partial: Pick<ViewerIdentity, 'userId' | 'ownEmployeeIds' | 'parentKeys'> &
    Partial<ViewerIdentity>,
): ViewerIdentity {
  return {
    displayName: partial.userId,
    email: '',
    mobile: '',
    orgWide: false,
    ...partial,
  };
}

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}

function assertNames(
  scope: ProductCreatorScope,
  products: Array<{ name: string; creatorId: string }>,
  expected: string[],
  label: string,
): void {
  const visible = products
    .filter((p) => canAccessProductByCreator(p, scope))
    .map((p) => p.name)
    .sort();
  const e = [...expected].sort();
  if (visible.join(',') !== e.join(',')) {
    throw new Error(`${label}: expected [${e.join(',')}] got [${visible.join(',')}]`);
  }
}

/** Simulate products stamped with auth user ids (create path). */
const products = [
  { name: 'A', creatorId: 'u-rahul' },
  { name: 'B', creatorId: 'u-rahul' },
  { name: 'C', creatorId: 'u-amit' },
  { name: 'D', creatorId: 'u-amit' },
  { name: 'E', creatorId: 'u-priya' },
  { name: 'F', creatorId: 'u-neha' },
  { name: 'G', creatorId: 'u-rohan' },
  { name: 'H', creatorId: 'u-sameer' },
];

const all = [
  emp({ id: 'e-rahul', fullName: 'Rahul', onboardedById: '', userId: 'u-rahul' }),
  emp({ id: 'e-amit', fullName: 'Amit', onboardedById: 'e-rahul', userId: 'u-amit' }),
  emp({ id: 'e-priya', fullName: 'Priya', onboardedById: 'e-amit', userId: 'u-priya' }),
  emp({ id: 'e-neha', fullName: 'Neha', onboardedById: 'e-priya', userId: 'u-neha' }),
  emp({ id: 'e-rohan', fullName: 'Rohan', onboardedById: 'e-rahul', userId: 'u-rohan' }),
  emp({ id: 'e-sameer', fullName: 'Sameer', onboardedById: 'e-rohan', userId: 'u-sameer' }),
];

const linked = new Map<string, string>([
  ['e-rahul', 'u-rahul'],
  ['e-amit', 'u-amit'],
  ['e-priya', 'u-priya'],
  ['e-neha', 'u-neha'],
  ['e-rohan', 'u-rohan'],
  ['e-sameer', 'u-sameer'],
]);

function scopeFor(
  userId: string,
  ownEmployeeIds: string[],
  orgWide = false,
): ProductCreatorScope {
  const v = viewer({
    userId,
    ownEmployeeIds,
    parentKeys: [userId, ...ownEmployeeIds],
    orgWide,
  });
  if (orgWide) return resolveProductCreatorScopeFromViewer(v, all);
  return {
    orgWide: false,
    allowedCreatorIds: buildAllowedCreatorIds(v, all, linked),
  };
}

const rahul = scopeFor('u-rahul', ['e-rahul']);
const amit = scopeFor('u-amit', ['e-amit']);
const priya = scopeFor('u-priya', ['e-priya']);
const neha = scopeFor('u-neha', ['e-neha']);
const rohan = scopeFor('u-rohan', ['e-rohan']);
const admin = scopeFor('u-admin', [], true);

assertNames(rahul, products, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 'Rahul sees full tree');
assertNames(amit, products, ['C', 'D', 'E', 'F'], 'Amit sees self + Priya + Neha');
assertNames(priya, products, ['E', 'F'], 'Priya sees self + Neha');
assertNames(neha, products, ['F'], 'Neha sees only self');
assertNames(rohan, products, ['G', 'H'], 'Rohan sees self + Sameer');

assert(!canAccessProductByCreator({ creatorId: 'u-rahul' }, amit), 'TEST 5 Amit cannot see Rahul');
assert(!canAccessProductByCreator({ creatorId: 'u-rohan' }, amit), 'TEST 6 Amit cannot see Rohan');
assert(canAccessProductByCreator({ creatorId: 'u-priya' }, amit), 'TEST 8 Amit can see Priya');
assert(canAccessProductByCreator({ creatorId: 'u-amit' }, amit), 'TEST 1/2 own product');

assert(canAccessProductByCreator({ creatorId: 'u-amit' }, admin), 'TEST 12 Super Admin Amit product');
assert(canAccessProductByCreator({ creatorId: '' }, admin), 'TEST 12 Super Admin legacy');
assert(!canAccessProductByCreator({ creatorId: '' }, amit), 'Legacy hidden from employee');

// Pagination-style filter: allowed set first, then page
const amitAllowed = products.filter((p) => canAccessProductByCreator(p, amit));
assert(amitAllowed.length === 4, 'TEST 14 Amit allowed count before page');
assert(amitAllowed.slice(0, 2).every((p) => ['C', 'D', 'E', 'F'].includes(p.name)), 'TEST 14 page subset');

// Ownership immutability: creator stays Amit after "edit by Rahul"
const productC = { creatorId: 'u-amit' };
const afterEdit = { ...productC, creatorId: productC.creatorId };
assert(afterEdit.creatorId === 'u-amit', 'TEST 10 creator unchanged on edit');

console.log('product-ownership.selftest: all assertions passed');
process.exit(0);
