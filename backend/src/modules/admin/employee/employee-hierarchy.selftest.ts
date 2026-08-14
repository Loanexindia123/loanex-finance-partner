/**
 * Lightweight hierarchy visibility checks (no DB) — run with:
 *   npx tsx src/modules/admin/employee/employee-hierarchy.selftest.ts
 */
import type { EmployeeRecord } from './employee.service';
import {
  collectDescendantEmployees,
  filterVisibleEmployees,
  type ViewerIdentity,
} from './employee-hierarchy';

function emp(
  partial: Pick<EmployeeRecord, 'id' | 'fullName' | 'onboardedById'> &
    Partial<EmployeeRecord>,
): EmployeeRecord {
  return {
    onboardedBy: '',
    userId: '',
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

function names(rows: EmployeeRecord[]): string[] {
  return rows.map((r) => r.fullName).sort();
}

function assertEqual(actual: string[], expected: string[], label: string): void {
  const a = [...actual].sort().join(',');
  const e = [...expected].sort().join(',');
  if (a !== e) {
    throw new Error(`${label}: expected [${e}] got [${a}]`);
  }
}

const rahul = emp({ id: 'e-rahul', fullName: 'Rahul', onboardedById: '' });
const amit = emp({ id: 'e-amit', fullName: 'Amit', onboardedById: 'e-rahul' });
const priya = emp({ id: 'e-priya', fullName: 'Priya', onboardedById: 'e-amit' });
const neha = emp({ id: 'e-neha', fullName: 'Neha', onboardedById: 'e-priya' });
const rohan = emp({ id: 'e-rohan', fullName: 'Rohan', onboardedById: 'e-rahul' });
const sameer = emp({ id: 'e-sameer', fullName: 'Sameer', onboardedById: 'e-rohan' });
const all = [rahul, amit, priya, neha, rohan, sameer];

assertEqual(
  names(collectDescendantEmployees(all, ['e-rahul'])),
  ['Amit', 'Priya', 'Neha', 'Rohan', 'Sameer'],
  'TEST 3/4 Rahul descendants',
);

assertEqual(
  names(
    filterVisibleEmployees(
      all,
      viewer({
        userId: 'u-amit',
        ownEmployeeIds: ['e-amit'],
        parentKeys: ['u-amit', 'e-amit'],
      }),
    ),
  ),
  ['Amit', 'Priya', 'Neha'],
  'TEST 4 Amit visibility',
);

assertEqual(
  names(
    filterVisibleEmployees(
      all,
      viewer({
        userId: 'u-priya',
        ownEmployeeIds: ['e-priya'],
        parentKeys: ['u-priya', 'e-priya'],
      }),
    ),
  ),
  ['Priya', 'Neha'],
  'TEST 3 Priya visibility',
);

assertEqual(
  names(
    filterVisibleEmployees(
      all,
      viewer({
        userId: 'u-rohan',
        ownEmployeeIds: ['e-rohan'],
        parentKeys: ['u-rohan', 'e-rohan'],
      }),
    ),
  ),
  ['Rohan', 'Sameer'],
  'TEST 4 Rohan branch isolation',
);

assertEqual(
  names(
    filterVisibleEmployees(
      all,
      viewer({
        userId: 'u-sameer',
        ownEmployeeIds: ['e-sameer'],
        parentKeys: ['u-sameer', 'e-sameer'],
      }),
    ),
  ),
  ['Sameer'],
  'TEST 4 Sameer self only',
);

assertEqual(
  names(
    filterVisibleEmployees(
      all,
      viewer({
        userId: 'u-rahul',
        ownEmployeeIds: ['e-rahul'],
        parentKeys: ['u-rahul', 'e-rahul'],
        orgWide: false,
      }),
    ),
  ),
  ['Rahul', 'Amit', 'Priya', 'Neha', 'Rohan', 'Sameer'],
  'TEST 4 Rahul full tree',
);

// Legacy: child onboardedById stored as parent user id
const legacyAmit = emp({ id: 'e-amit2', fullName: 'Amit2', onboardedById: 'u-rahul2' });
const legacyPriya = emp({ id: 'e-priya2', fullName: 'Priya2', onboardedById: 'e-amit2' });
assertEqual(
  names(collectDescendantEmployees([legacyAmit, legacyPriya], ['u-rahul2'])),
  ['Amit2', 'Priya2'],
  'Legacy user-id parent pointer',
);

console.log('employee-hierarchy.selftest: all assertions passed');
