/**
 * Staff picker eligibility — run with:
 *   npx tsx src/modules/admin/staff-picker.selftest.ts
 */
import { isStaffPickerUser } from './staff-picker';

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}

assert(isStaffPickerUser({ role: 'admin', id: '1' }), 'legacy admin is staff');
assert(
  isStaffPickerUser({ role: 'admin', role_id: 'role-employee', id: '2' }),
  'employee portal account is staff',
);
assert(!isStaffPickerUser({ role: 'customer', id: '3' }), 'customer is not staff');
assert(!isStaffPickerUser({ role: 'authenticated', id: '4' }), 'app user is not staff');
assert(!isStaffPickerUser({ role: 'dealer', id: '5' }), 'dealer app account is not staff');
assert(!isStaffPickerUser({ role: 'admin', blocked: true, id: '6' }), 'blocked admin is excluded');
assert(
  !isStaffPickerUser({ role: 'admin', status: 'blocked', id: '7' }),
  'status=blocked is excluded',
);
assert(
  !isStaffPickerUser({ role: 'admin', status: 'inactive', id: '8' }),
  'inactive staff is excluded',
);
assert(!isStaffPickerUser(null), 'null is not staff');

console.log('staff-picker.selftest: ok');
