/**
 * Add User operational-role restrictions.
 * Run: npx tsx src/modules/admin/operational-staff-role.selftest.ts
 */
import { jsonDb } from '../../config/json-db';
import { ForbiddenError } from '../../common/errors/app-error';
import { resolveRoleAssignment } from './admin.controller';
import {
  assertAssignableOperationalRole,
  ensureOperationalStaffRoles,
} from '../rbac/operational-staff-roles';
import { OPERATIONAL_STAFF_ROLE_IDS, OPERATIONAL_STAFF_ROLE_NAMES } from '../rbac/permissions';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function expectForbidden(fn: () => void, label: string): void {
  try {
    fn();
    throw new Error(`ASSERTION FAILED: ${label} did not throw`);
  } catch (err) {
    assert(err instanceof ForbiddenError, `${label} threw ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  await jsonDb.ensureCollection('roles');
  await ensureOperationalStaffRoles();

  for (const name of OPERATIONAL_STAFF_ROLE_NAMES) {
    const role = jsonDb.findOne('roles', { name });
    assert(!!role, `operational role missing: ${name}`);
    const assignment = resolveRoleAssignment({ role: name });
    assertAssignableOperationalRole(assignment);
    assert(assignment.roleId === role.id, `${name} roleId mismatch`);
  }

  expectForbidden(
    () => assertAssignableOperationalRole(resolveRoleAssignment({ role: 'admin' })),
    'legacy admin string',
  );
  expectForbidden(
    () => assertAssignableOperationalRole(resolveRoleAssignment({ role: 'Super Admin' })),
    'Super Admin name',
  );
  expectForbidden(
    () =>
      assertAssignableOperationalRole(
        resolveRoleAssignment({ roleId: '00000000-0000-4000-8000-000000000001' }),
      ),
    'Super Admin roleId',
  );
  expectForbidden(
    () => assertAssignableOperationalRole(resolveRoleAssignment({ role: 'Employee' })),
    'Employee role',
  );
  expectForbidden(
    () => assertAssignableOperationalRole(resolveRoleAssignment({ role: 'customer' })),
    'customer role',
  );

  const sales = jsonDb.findOne('roles', { name: 'Sales Executive' });
  assert(sales, 'Sales Executive missing');
  assert(
    Array.isArray(sales.permissions) &&
      sales.permissions.includes('products.create') &&
      !sales.permissions.includes('products.delete') &&
      !String(sales.permissions).includes('approve'),
    'Sales Executive must not have product approval/admin permissions',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        operationalRoles: OPERATIONAL_STAFF_ROLE_NAMES.map((name) => ({
          name,
          id: jsonDb.findOne('roles', { name })?.id ?? OPERATIONAL_STAFF_ROLE_IDS[name],
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
