import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RbacService } from '../services/rbac.service';

/**
 * Blocks listed roles from a route (case-insensitive roleName match).
 * Employees keep users.* for Employee Onboarding but must not open Staff Users.
 */
export function denyRolesGuard(
  roles: string | readonly string[],
  redirectTo = '/dashboard',
): CanActivateFn {
  const denied = new Set(
    (Array.isArray(roles) ? roles : [roles]).map((r) => r.trim().toLowerCase()).filter(Boolean),
  );
  return () => {
    const rbac = inject(RbacService);
    const router = inject(Router);
    if (denied.has(rbac.roleKey())) {
      return router.createUrlTree([redirectTo]);
    }
    return true;
  };
}
