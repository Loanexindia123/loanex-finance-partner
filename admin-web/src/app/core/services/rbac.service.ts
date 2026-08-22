import { Injectable, computed, inject } from '@angular/core';
import { TokenService } from './token.service';
import { Permission } from '../models/permission.models';

/**
 * Client-side permission mirror of the backend RBAC model (rbacStore.ts
 * pattern from admin-app, ported to Angular signals). UI-level only —
 * the backend's requirePermission middleware remains authoritative; every
 * check here is a convenience for hiding controls, not a security boundary.
 */
@Injectable({ providedIn: 'root' })
export class RbacService {
  private readonly tokens = inject(TokenService);

  readonly permissions = computed(() => this.tokens.user()?.permissions ?? []);
  readonly roleName = computed(() => this.tokens.user()?.roleName ?? null);

  readonly roleKey = computed(() =>
    String(this.roleName() ?? '')
      .trim()
      .toLowerCase(),
  );

  /** Employee / Dealer / Agent — catalog restrictions (no approve, no edit of approved). */
  readonly isRestrictedCatalogUser = computed(() => {
    const role = this.roleKey();
    return role === 'employee' || role === 'dealer' || role === 'agent';
  });

  readonly isEmployee = computed(() => this.roleKey() === 'employee');

  can(perm: Permission | string): boolean {
    return this.permissions().includes(perm);
  }

  canAny(...perms: (Permission | string)[]): boolean {
    const owned = this.permissions();
    return perms.some((p) => owned.includes(p));
  }

  canAll(...perms: (Permission | string)[]): boolean {
    const owned = this.permissions();
    return perms.every((p) => owned.includes(p));
  }

  /** Approved (active) products are locked for Employee / Dealer / Agent. */
  isApprovedProductLocked(status: string | undefined | null): boolean {
    return (
      this.isRestrictedCatalogUser() &&
      String(status ?? '')
        .trim()
        .toLowerCase() === 'active'
    );
  }

  /**
   * Approved onboarding records (Employee / Dealer / Agent formStatus)
   * are read-only for Employee / Dealer / Agent — same rule as products.
   */
  isApprovedFormLocked(formStatus: string | undefined | null): boolean {
    return (
      this.isRestrictedCatalogUser() &&
      String(formStatus ?? '')
        .trim()
        .toLowerCase() === 'approved'
    );
  }
}
