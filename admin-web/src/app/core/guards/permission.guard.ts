import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RbacService } from '../services/rbac.service';
import { Permission } from '../models/permission.models';

/**
 * Route-level RBAC gate. Usage in routes:
 *   { path: 'roles', canActivate: [permissionGuard('roles.view')], ... }
 * This is a UI convenience only — the backend's requirePermission
 * middleware is the real authority and still 403s unauthorized calls.
 */
export function permissionGuard(...required: (Permission | string)[]): CanActivateFn {
  return () => {
    const rbac = inject(RbacService);
    const router = inject(Router);
    if (rbac.canAny(...required)) {
      return true;
    }
    return router.createUrlTree(['/forbidden']);
  };
}
