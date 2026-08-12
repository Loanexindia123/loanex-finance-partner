import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { FiCaseService } from '../../services/fi-case.service';
import {
  FI_STATUS_FILTERS,
  FI_STATUS_LABEL,
  FiCase,
  FiCaseStatus,
} from '../../../emi/models/fi-case.models';

@Component({
  selector: 'app-fi-case-list',
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
  ],
  templateUrl: './fi-case-list.html',
  styleUrl: './fi-case-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiCaseList {
  private readonly fiCases = inject(FiCaseService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<FiCase[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | FiCaseStatus>('all');

  readonly statusOptions = FI_STATUS_FILTERS;

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly subtitle = computed(() => `${this.items().length.toLocaleString('en-IN')} Cases`);

  readonly hasActiveFilters = computed(() => this.statusFilter() !== 'all');

  readonly statusChipLabel = computed(() => {
    const status = this.statusFilter();
    if (status === 'all') return '';
    return `Status: ${FI_STATUS_LABEL[status]}`;
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();

    const result = this.items().filter((fiCase) => {
      const matchesTerm =
        !term ||
        fiCase.id.toLowerCase().includes(term) ||
        fiCase.customerName.toLowerCase().includes(term) ||
        fiCase.mobile.toLowerCase().includes(term) ||
        (fiCase.applicationId ?? '').toLowerCase().includes(term) ||
        fiCase.productName.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || fiCase.status === status;
      return matchesTerm && matchesStatus;
    });

    result.sort((a, b) => b.assignedDate.localeCompare(a.assignedDate));
    return result;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fiCases.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load FI cases. Please try again.');
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

  view(fiCase: FiCase): void {
    this.router.navigate(['/fi', fiCase.id]);
  }

  statusLabel(status: FiCaseStatus): string {
    return FI_STATUS_LABEL[status];
  }
}
