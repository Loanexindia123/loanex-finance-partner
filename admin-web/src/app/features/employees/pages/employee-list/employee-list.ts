import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
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
import { EmployeeService } from '../../services/employee.service';
import { Employee, FORM_STATUS_OPTIONS } from '../../models/employee.models';

const AVATAR_TONES = [
  { bg: '#eef2ff', color: '#4338ca' },
  { bg: '#ecfdf5', color: '#047857' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#fdf2f8', color: '#be185d' },
] as const;

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
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
  templateUrl: './employee-list.html',
  styleUrl: './employee-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeList {
  private readonly employees = inject(EmployeeService);
  private readonly rbac = inject(RbacService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Employee[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly deleteTarget = signal<Employee | null>(null);
  readonly deleting = signal(false);

  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    ...FORM_STATUS_OPTIONS,
  ];

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly stats = computed(() => {
    const items = this.items();
    return {
      total: items.length,
      draft: items.filter((e) => e.formStatus === 'draft').length,
      approved: items.filter((e) => e.formStatus === 'approved').length,
      pending: items.filter((e) => e.formStatus === 'pending').length,
    };
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter((e) => {
      if (status !== 'all' && e.formStatus !== status) return false;
      if (!term) return true;
      const haystack = [
        e.fullName,
        e.employeeId,
        e.department,
        e.designation,
        e.mobile,
        e.branch,
        e.email,
      ]
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
    this.employees.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractMessage(err));
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

  add(): void {
    this.router.navigate(['/employees/onboard']);
  }

  view(employee: Employee): void {
    this.router.navigate(['/employees', employee.id]);
  }

  edit(employee: Employee): void {
    this.router.navigate(['/employees', employee.id, 'edit']);
  }

  /** Hide Edit for Employee/Dealer/Agent when the record is approved. */
  canEditEmployee(employee: Employee): boolean {
    return this.rbac.can('users.edit') && !this.rbac.isApprovedFormLocked(employee.formStatus);
  }

  confirmDelete(employee: Employee): void {
    this.deleteTarget.set(employee);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  deleteConfirmed(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.employees.delete(target.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((e) => e.id !== target.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
        this.messages.add({ severity: 'success', summary: 'Onboarding record deleted' });
      },
      error: (err) => {
        this.deleting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  avatarInitials(employee: Employee): string {
    const source = employee.fullName || employee.employeeId || 'EM';
    const parts = source.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'EM';
  }

  avatarTone(employee: Employee) {
    const key = employee.fullName || employee.employeeId || employee.id;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
    return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
