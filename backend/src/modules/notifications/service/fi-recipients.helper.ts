import { jsonDb } from '../../../config/json-db';
import { rolePermissions, rolesRepository, SUPER_ADMIN_PERMISSIONS } from '../../rbac';

const FI_PERMISSIONS = ['fi.view', 'fi.edit'] as const;

/**
 * Resolves which admin userIds should receive FI/EMI-related notifications
 * (new application submitted, approved, rejected).
 *
 * The current data model has no per-case FI-employee assignment — fi_cases.assignedExecutive
 * is a free-text string, not a reference to a user — so for this phase every admin holding
 * fi.view or fi.edit is treated as "the relevant FI employee" and all of them are notified.
 * Once real per-case assignment exists, only this function needs to change; every call site
 * in emi-application.service.ts stays the same.
 */
export function findFiAdminRecipients(): string[] {
  const roles = rolesRepository.list();
  const eligibleRoleIds = new Set<string>(
    roles
      .filter((role: any) => {
        const permissions = rolePermissions(role);
        return FI_PERMISSIONS.some((permission) => permissions.includes(permission));
      })
      .map((role: any) => role.id),
  );

  const adminUsers = jsonDb.findMany('users', { role: 'admin' }) as any[];

  return adminUsers
    .filter((user) => {
      const roleId = user.role_id ?? user.roleId ?? null;
      if (roleId) {
        return eligibleRoleIds.has(roleId);
      }
      // Legacy admins with no role_id are Super Admins with full access — same
      // convention as resolveRbacForUser() in admin/admin.controller.ts.
      return (SUPER_ADMIN_PERMISSIONS as string[]).some((permission) =>
        (FI_PERMISSIONS as readonly string[]).includes(permission),
      );
    })
    .map((user) => user.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}