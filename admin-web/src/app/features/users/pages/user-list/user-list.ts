import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { RbacService } from '../../../../core/services/rbac.service';
import { TokenService } from '../../../../core/services/token.service';
import { UserService } from '../../services/user.service';
import { CreateUserPayload, STAFF_ROLE_OPTIONS, StaffRole, StaffUser } from '../../models/user.models';

const AVATAR_TONES = [
  { bg: '#eef2ff', color: '#4338ca' },
  { bg: '#ecfdf5', color: '#047857' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#fdf2f8', color: '#be185d' },
] as const;

function passwordsMatch(group: FormGroup): ValidationErrors | null {
  const p = group.get('password')?.value;
  const c = group.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    DialogModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatCard,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserList {
  private readonly users = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly rbac = inject(RbacService);
  private readonly tokens = inject(TokenService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<StaffUser[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly statusTarget = signal<StaffUser | null>(null);
  readonly statusUpdating = signal(false);
  readonly deleteTarget = signal<StaffUser | null>(null);
  readonly deleting = signal(false);

  readonly roleOptions = STAFF_ROLE_OPTIONS;
  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Blocked', value: 'BLOCKED' },
  ];

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly form: FormGroup = this.fb.group(
    {
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      role: ['Sales Executive' as StaffRole, Validators.required],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly stats = computed(() => {
    const items = this.items();
    return {
      total: items.length,
      active: items.filter((u) => !this.isBlocked(u)).length,
      blocked: items.filter((u) => this.isBlocked(u)).length,
    };
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter((user) => {
      if (status === 'BLOCKED' && !this.isBlocked(user)) return false;
      if (status === 'ACTIVE' && this.isBlocked(user)) return false;
      if (!term) return true;
      const haystack = [this.displayName(user), user.email, user.phone, user.roleName, user.role]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  readonly paged = computed(() => {
    const start = this.pageFirst();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize()) || 1));
  readonly currentPage = computed(() => Math.floor(this.pageFirst() / this.pageSize()) + 1);
  readonly pageFrom = computed(() => (this.filtered().length ? this.pageFirst() + 1 : 0));
  readonly pageTo = computed(() => Math.min(this.pageFirst() + this.pageSize(), this.filtered().length));
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.users.listStaff().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  resetPage(): void {
    this.pageFirst.set(0);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    this.pageFirst.set((next - 1) * this.pageSize());
  }

  isBlocked(user: StaffUser): boolean {
    return String(user.status ?? '').toUpperCase() === 'BLOCKED' || user.blocked === true;
  }

  displayName(user: StaffUser): string {
    const name = user.profile?.fullName?.trim();
    if (name) return name;
    const fromEmail = user.email?.split('@')[0]?.trim();
    return fromEmail || 'Unnamed user';
  }

  displayMobile(user: StaffUser): string {
    const phone = String(user.phone ?? '').trim();
    return /^\+?\d[\d\s-]{5,}$/.test(phone) ? phone : '—';
  }

  statusLabel(user: StaffUser): string {
    return this.isBlocked(user) ? 'blocked' : 'active';
  }

  canToggleStatus(): boolean {
    return this.rbac.can('users.edit');
  }

  canDelete(user: StaffUser): boolean {
    if (!this.rbac.can('users.delete')) return false;
    if (this.isProtectedUser(user)) return false;
    if (user.id === this.tokens.user()?.id) return false;
    return true;
  }

  isProtectedUser(user: StaffUser): boolean {
    const name = String(user.roleName ?? '').trim().toLowerCase();
    return name === 'super admin' || name === 'admin';
  }

  avatarInitials(user: StaffUser): string {
    const source = this.displayName(user);
    const parts = source.trim().split(/[\s._-]+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
  }

  avatarTone(user: StaffUser) {
    const key = this.displayName(user) || user.id;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
    return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
  }

  openAdd(): void {
    this.form.reset({
      name: '',
      email: '',
      mobile: '',
      role: 'Sales Executive',
      password: '',
      confirmPassword: '',
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateUserPayload = {
      name: raw.name,
      email: raw.email,
      mobile: raw.mobile,
      role: raw.role,
      password: raw.password,
    };

    this.saving.set(true);
    this.users.createUser(payload).subscribe({
      next: (created) => {
        this.items.update((list) => [created, ...list]);
        this.saving.set(false);
        this.formOpen.set(false);
        this.messages.add({ severity: 'success', summary: 'User created', detail: raw.name });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not create user',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  confirmToggle(user: StaffUser): void {
    if (!this.canToggleStatus()) return;
    this.statusTarget.set(user);
  }

  cancelToggle(): void {
    if (this.statusUpdating()) return;
    this.statusTarget.set(null);
  }

  toggleConfirmed(): void {
    const user = this.statusTarget();
    if (!user || this.statusUpdating()) return;
    const nextBlocked = !this.isBlocked(user);
    this.statusUpdating.set(true);
    this.users.setBlocked(user.id, nextBlocked).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((u) => (u.id === user.id ? updated : u)));
        this.statusTarget.set(null);
        this.statusUpdating.set(false);
        this.messages.add({
          severity: 'success',
          summary: nextBlocked ? 'User blocked' : 'User unblocked',
          detail: this.displayName(user),
        });
      },
      error: (err: unknown) => {
        this.statusUpdating.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Status update failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  confirmDelete(user: StaffUser): void {
    if (!this.canDelete(user)) return;
    this.deleteTarget.set(user);
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  deleteConfirmed(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.users.deleteUser(target.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((u) => u.id !== target.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'User deleted',
          detail: this.displayName(target),
        });
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string };
      return body?.message || err.message || 'Something went wrong.';
    }
    return 'Something went wrong.';
  }
}
