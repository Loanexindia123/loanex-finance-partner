/**
 * Employee Phase permission guards — run with:
 *   npx tsx src/modules/admin/employee/employee-phase.selftest.ts
 */
import { EMPLOYEE_ROLE_PERMISSIONS } from './employee-account';

function assert(cond: unknown, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
}

// Permission set must allow create/view of hierarchy resources but never approve.
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('users.create'), 'users.create');
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('users.view'), 'users.view');
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('users.edit'), 'users.edit');
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('freelancers.create'), 'freelancers.create');
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('freelancers.view'), 'freelancers.view');
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('masters.create'), 'masters.create');
assert(EMPLOYEE_ROLE_PERMISSIONS.includes('products.create'), 'products.create');
assert(!EMPLOYEE_ROLE_PERMISSIONS.includes('freelancers.approve'), 'no freelancers.approve');
assert(!EMPLOYEE_ROLE_PERMISSIONS.includes('freelancers.reject'), 'no freelancers.reject');
assert(!EMPLOYEE_ROLE_PERMISSIONS.includes('products.delete'), 'no products.delete');

console.log('employee-phase.selftest: all assertions passed');
process.exit(0);
