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
import { EmiApplicationService } from '../../services/emi-application.service';
import {
  EMI_SORT_OPTIONS,
  EMI_STATUS_FILTERS,
  EMI_STATUS_LABEL,
  EmiApplication,
  EmiApplicationSort,
  EmiApplicationStatus,
} from '../../models/emi-application.models';

@Component({
  selector: 'app-emi-application-list',
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
  templateUrl: './emi-application-list.html',
  styleUrl: './emi-application-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmiApplicationList {
  private readonly emiApplications = inject(EmiApplicationService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<EmiApplication[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | EmiApplicationStatus>('all');
  readonly sortBy = signal<EmiApplicationSort>('date');

  readonly statusOptions = EMI_STATUS_FILTERS;
  readonly sortOptions = EMI_SORT_OPTIONS;

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly subtitle = computed(
    () => `${this.items().length.toLocaleString('en-IN')} Applications`,
  );

  readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || this.sortBy() !== 'date',
  );

  readonly statusChipLabel = computed(() => {
    const status = this.statusFilter();
    if (status === 'all') return '';
    return `Status: ${EMI_STATUS_LABEL[status]}`;
  });

  readonly sortChipLabel = computed(() => {
    const sort = this.sortBy();
    if (sort === 'date') return '';
    const option = EMI_SORT_OPTIONS.find((item) => item.value === sort);
    return option ? `Sort: ${option.label}` : '';
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const sortBy = this.sortBy();

    const result = this.items().filter((application) => {
      const matchesTerm =
        !term ||
        application.id.toLowerCase().includes(term) ||
        application.customerName.toLowerCase().includes(term) ||
        application.mobile.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || application.status === status;
      return matchesTerm && matchesStatus;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.requestedLoanAmount - a.requestedLoanAmount;
        case 'customer':
          return a.customerName.localeCompare(b.customerName);
        default:
          return b.applicationDate.localeCompare(a.applicationDate);
      }
    });

    return result;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.emiApplications.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load EMI applications. Please try again.');
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

  clearSort(): void {
    this.sortBy.set('date');
  }

  clearFilters(): void {
    this.statusFilter.set('all');
    this.sortBy.set('date');
  }

  view(application: EmiApplication): void {
    this.router.navigate(['/emi', application.id]);
  }
}
