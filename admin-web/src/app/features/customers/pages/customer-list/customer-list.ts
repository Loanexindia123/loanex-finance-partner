import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { CustomerService } from '../../services/customer.service';
import {
  Customer,
  KYC_STATUSES,
  customerCity,
  customerDisplayName,
  customerEmail,
  customerKycStatus,
  customerPhone,
  initialsFromName,
} from '../../models/customer.models';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    TableModule,
    SelectModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
    StatCard,
  ],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerList {
  private readonly customers = inject(CustomerService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Customer[]>([]);
  readonly searchTerm = signal('');
  readonly kycFilter = signal<string>('all');
  readonly statusFilter = signal<string>('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 },
  ];

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly kycOptions = [
    { label: 'All KYC', value: 'all' },
    ...KYC_STATUSES.map((s) => ({ label: s, value: s })),
    { label: 'Not Available', value: 'Not Available' },
  ];

  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Blocked', value: 'blocked' },
    { label: 'Inactive', value: 'inactive' },
  ];

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      this.kycFilter() !== 'all' ||
      this.statusFilter() !== 'all',
  );

  readonly stats = computed(() => {
    const items = this.items();
    const kycOf = (c: Customer) => customerKycStatus(c).toLowerCase();
    return {
      total: items.length,
      approved: items.filter((c) => kycOf(c) === 'approved').length,
      pending: items.filter((c) => {
        const s = kycOf(c);
        return s === 'pending' || s === 'not available';
      }).length,
      blocked: items.filter((c) => c.blocked || String(c.status).toLowerCase() === 'blocked').length,
    };
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const kyc = this.kycFilter();
    const status = this.statusFilter();
    return this.items().filter((c) => {
      const name = customerDisplayName(c).toLowerCase();
      const phone = customerPhone(c).toLowerCase();
      const email = customerEmail(c).toLowerCase();
      const matchesTerm =
        !term ||
        name.includes(term) ||
        phone.includes(term) ||
        email.includes(term) ||
        c.id.toLowerCase().includes(term);
      const matchesKyc = kyc === 'all' || customerKycStatus(c) === kyc;
      const accountStatus = String(c.status ?? (c.blocked ? 'blocked' : 'active')).toLowerCase();
      const matchesStatus = status === 'all' || accountStatus === status;
      return matchesTerm && matchesKyc && matchesStatus;
    });
  });

  readonly paged = computed(() => {
    const start = this.pageFirst();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly pageFrom = computed(() => (this.filtered().length === 0 ? 0 : this.pageFirst() + 1));
  readonly pageTo = computed(() =>
    Math.min(this.pageFirst() + this.pageSize(), this.filtered().length),
  );
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );
  readonly currentPage = computed(() => Math.floor(this.pageFirst() / this.pageSize()) + 1);
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const from = Math.max(1, end - 4);
    return Array.from({ length: end - from + 1 }, (_, i) => from + i);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.customers.list().subscribe({
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

  name(customer: Customer): string {
    return customerDisplayName(customer);
  }

  phone(customer: Customer): string {
    return customerPhone(customer);
  }

  email(customer: Customer): string {
    return customerEmail(customer);
  }

  city(customer: Customer): string {
    return customerCity(customer);
  }

  kycStatus(customer: Customer): string {
    return customerKycStatus(customer);
  }

  initials(customer: Customer): string {
    return initialsFromName(customerDisplayName(customer));
  }

  accountStatus(customer: Customer): string {
    return customer.blocked ? 'blocked' : customer.status || 'active';
  }

  resetPage(): void {
    this.pageFirst.set(0);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    this.pageFirst.set((next - 1) * this.pageSize());
  }

  changePageSize(rows: number): void {
    this.pageSize.set(rows || 10);
    this.resetPage();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.kycFilter.set('all');
    this.statusFilter.set('all');
    this.resetPage();
  }

  view(customer: Customer): void {
    this.router.navigate(['/customers', customer.id]);
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Unable to load customers.';
    }
    return 'Unable to load customers.';
  }
}
