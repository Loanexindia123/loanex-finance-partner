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
}
