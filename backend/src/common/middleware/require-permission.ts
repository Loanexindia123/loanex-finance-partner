import { NextFunction, Response } from 'express';
import { ForbiddenError } from '../errors/app-error';
import { rolesService } from '../../modules/rbac/roles.service';
import { resolveIsDealerUserId } from '../../modules/admin/dealer/dealer-account';
import { resolveIsAgentUserId } from '../../modules/admin/freelancer-agent/agent-account';
import { isEmployeeRoleUser } from '../../modules/admin/employee/employee-account';
import type { AuthenticatedRequest } from './authenticate';

/**
 * Route guard — rejects the request unless the authenticated user's role
 * grants `permission`. Must run after `authenticate`.
 */
export function requirePermission(permission: string) {
  return requireAnyPermission(permission);
}

/** Route guard — user must have at least one of the listed permissions. */
export function requireAnyPermission(...needed: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.sub) {
        next(new ForbiddenError('Not authorized for this action'));
        return;
      }
      const permissions = await rolesService.resolveUserPermissions(req.user.sub);
      if (!needed.some((permission) => permissions.includes(permission))) {
        next(new ForbiddenError('You do not have permission to perform this action'));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Product/dealer/agent write access for Dealer/Agent APK without Admin Web permissions.
 * Field roles keep an empty permission set; this only opens create/edit/view.
 */
export function requirePermissionOrDealer(permission: string) {
  return requireAnyPermissionOrDealer(permission);
}

/**
 * Same as requireAnyPermission, but Dealers and Agents (empty role permissions)
 * are allowed through so the admin-app field APIs work.
 */
export function requireAnyPermissionOrDealer(...needed: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.sub) {
        next(new ForbiddenError('Not authorized for this action'));
        return;
      }
      if (await resolveIsDealerUserId(req.user.sub)) {
        next();
        return;
      }
      if (await resolveIsAgentUserId(req.user.sub)) {
        next();
        return;
      }
      await requireAnyPermission(...needed)(req, _res, next);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Staff Users (/admin/users) is Admin/Super Admin only.
 * Employees keep users.* for Employee Onboarding (/admin/employees), not portal user admin.
 */
export function forbidEmployeeRole() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (isEmployeeRoleUser(req.user?.sub)) {
        next(new ForbiddenError('Employees cannot manage Staff Users'));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
