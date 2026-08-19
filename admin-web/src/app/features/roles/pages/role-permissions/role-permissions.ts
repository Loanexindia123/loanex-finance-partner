import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { RoleService } from '../../services/role.service';
import { MODULE_ACCESS_ITEMS, Role } from '../../models/role.models';
import { Permission } from '../../../../core/models/permission.models';

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [FormsModule, SelectModule, ButtonModule, PageHeader, BrandedLoader, ErrorState],
  templateUrl: './role-permissions.html',
  styleUrl: './role-permissions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissions {
  private readonly roles = inject(RoleService);
  private readonly messages = inject(MessageService);

  readonly items = MODULE_ACCESS_ITEMS;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly allRoles = signal<Role[]>([]);
  readonly selectedRoleId = signal<string | null>(null);
  readonly checked = signal<Set<Permission>>(new Set());
  readonly saving = signal(false);
  readonly dirty = signal(false);

    readonly roleOptions = computed(() =>
    this.allRoles().map((r) => ({
      label: r.name,
      value: r.id,
      userCount: r.userCount,
      isSystem: r.isSystem,
    })),
  );

  roleIcon(name: string): string {
    const key = name.toLowerCase();
    if (key.includes('super admin')) return 'pi-crown';
    if (key.includes('branch')) return 'pi-building';
    if (key.includes('credit')) return 'pi-wallet';
    if (key.includes('fi ')) return 'pi-map-marker';
    if (key.includes('sales')) return 'pi-briefcase';
    if (key.includes('hr')) return 'pi-id-card';
    if (key.includes('employee')) return 'pi-user';
    return 'pi-shield';
  }

  readonly selectedRole = computed(() =>
    this.allRoles().find((r) => r.id === this.selectedRoleId()) ?? null,
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.roles.list().subscribe({
      next: (list) => {
        this.allRoles.set(list);
        this.loading.set(false);
        if (list.length > 0) {
          this.selectRole(list[0].id);
        }
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  selectRole(roleId: string): void {
    this.selectedRoleId.set(roleId);
    const role = this.allRoles().find((r) => r.id === roleId);
    this.checked.set(new Set(role?.permissions ?? []));
    this.dirty.set(false);
  }

  isChecked(permission: Permission | null): boolean {
    if (!permission) return true; // Dashboard — always visible.
    return this.checked().has(permission);
  }

  toggle(permission: Permission | null): void {
    if (!permission) return; // Dashboard row is not toggleable.
    const next = new Set(this.checked());
    if (next.has(permission)) {
      next.delete(permission);
    } else {
      next.add(permission);
    }
    this.checked.set(next);
    this.dirty.set(true);
  }

  save(): void {
    const roleId = this.selectedRoleId();
    if (!roleId || this.saving()) return;

    this.saving.set(true);
    const permissions = Array.from(this.checked());
    this.roles.updatePermissions(roleId, { permissions }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.dirty.set(false);
        this.allRoles.update((list) => list.map((r) => (r.id === roleId ? updated : r)));
        this.messages.add({
          severity: 'success',
          summary: 'Permissions updated',
          detail: updated.name,
        });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not update permissions',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Something went wrong.';
    }
    return 'Something went wrong.';
  }
}