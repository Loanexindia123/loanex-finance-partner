import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LoanService } from '../../services/loan.service';
import { LOAN_STATUS_FILTERS, LoanListItem, LoanStatusFilter } from '../../models/loan.models';

@Component({
  selector: 'app-loan-list',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    TableModule,
    SelectModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
  ],
  templateUrl: './loan-list.html',
  styleUrl: './loan-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanList {
  private readonly loans = inject(LoanService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<LoanListItem[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<LoanStatusFilter>('all');

  readonly statusOptions = LOAN_STATUS_FILTERS;

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly subtitle = computed(() => `${this.items().length.toLocaleString('en-IN')} Loans`);

  readonly hasActiveFilters = computed(() => this.statusFilter() !== 'all');

  readonly statusChipLabel = computed(() => {
    const status = this.statusFilter();
    if (status === 'all') return '';
    const option = LOAN_STATUS_FILTERS.find((item) => item.value === status);
    return option ? `Status: ${option.label}` : '';
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    return this.items()
      .filter((loan) => {
        const matchesTerm =
          !term ||
          loan.loanAccountNumber.toLowerCase().includes(term) ||
          (loan.customer?.fullName ?? '').toLowerCase().includes(term) ||
          (loan.customer?.mobile ?? '').toLowerCase().includes(term) ||
          (loan.applicationNumber ?? '').toLowerCase().includes(term);
        const matchesStatus = status === 'all' || loan.loanStatus === status;
        return matchesTerm && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? b.loanStartDate ?? 0).getTime() -
          new Date(a.createdAt ?? a.loanStartDate ?? 0).getTime(),
      );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.loans.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load loans. Please try again.');
        this.loading.set(false);
      },
    });
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  clearStatusFilter(): void {
    this.statusFilter.set('all');
  }

  clearFilters(): void {
    this.statusFilter.set('all');
  }

  view(loan: LoanListItem): void {
    this.router.navigate(['/loans', loan.id]);
  }
}
