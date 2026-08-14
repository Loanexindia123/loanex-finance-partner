import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
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
import { DealerService } from '../../services/dealer.service';
import { Dealer, FORM_STATUS_OPTIONS } from '../../models/dealer.models';

const AVATAR_TONES = [
  { bg: '#eef2ff', color: '#4338ca' },
  { bg: '#ecfdf5', color: '#047857' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#fdf2f8', color: '#be185d' },
  { bg: '#ecfeff', color: '#0e7490' },
  { bg: '#fef3c7', color: '#b45309' },
] as const;

@Component({
  selector: 'app-dealer-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
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
  templateUrl: './dealer-list.html',
  styleUrl: './dealer-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealerList {
  private readonly dealers = inject(DealerService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Dealer[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string>('all');
  readonly formStatusFilter = signal<string>('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 },
  ];

  readonly deleteTarget = signal<Dealer | null>(null);
  readonly deleting = signal(false);

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  readonly formStatusOptions = [
    { label: 'All form statuses', value: 'all' },
    ...FORM_STATUS_OPTIONS,
  ];

  readonly stats = computed(() => {
    const items = this.items();
    return {
      total: items.length,
      active: items.filter((d) => d.status === 'active').length,
      approved: items.filter((d) => d.verificationStatus === 'approved').length,
      pending: items.filter(
        (d) => d.formStatus === 'pending' || d.verificationStatus === 'pending',
      ).length,
    };
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      this.statusFilter() !== 'all' ||
      this.formStatusFilter() !== 'all',
  );

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const formStatus = this.formStatusFilter();
    return this.items().filter((d) => {
      const haystack = [
        d.dealerName,
        d.dealerCode,
        d.ownerName,
        d.mobile,
        d.email,
        d.whatsapp,
        d.branch,
        d.dealerBranch,
        d.gstNumber,
        d.paymentCycle,
        d.paymentSettlementTerms,
      ]
        .join(' ')
        .toLowerCase();
      const matchesTerm = !term || haystack.includes(term);
      const matchesStatus = status === 'all' || d.status === status;
      const matchesForm = formStatus === 'all' || d.formStatus === formStatus;
      return matchesTerm && matchesStatus && matchesForm;
    });
  });

  readonly paged = computed(() => {
    const start = this.pageFirst();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly pageFrom = computed(() =>
    this.filtered().length === 0 ? 0 : this.pageFirst() + 1,
  );

  readonly pageTo = computed(() =>
    Math.min(this.pageFirst() + this.pageSize(), this.filtered().length),
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );

  readonly currentPage = computed(() =>
    Math.floor(this.pageFirst() / this.pageSize()) + 1,
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const end = Math.min(total, Math.max(1, current - 2) + 4);
    const from = Math.max(1, end - 4);
    return Array.from({ length: end - from + 1 }, (_, i) => from + i);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dealers.list().subscribe({
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

  avatarInitials(dealer: Dealer): string {
    const words = dealer.dealerName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
    }
    const fallback = dealer.dealerName || dealer.dealerCode || 'DL';
    return fallback.slice(0, 2).toUpperCase();
  }

  avatarTone(dealer: Dealer): { bg: string; color: string } {
    const key = dealer.dealerName || dealer.dealerCode || dealer.id;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
    }
    return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
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
    this.statusFilter.set('all');
    this.formStatusFilter.set('all');
    this.resetPage();
  }

  add(): void {
    this.router.navigate(['/masters/dealers/new']);
  }

  view(dealer: Dealer): void {
    this.router.navigate(['/masters/dealers', dealer.id]);
  }

  edit(dealer: Dealer): void {
    this.router.navigate(['/masters/dealers', dealer.id, 'edit']);
  }

  confirmDelete(dealer: Dealer): void {
    this.deleteTarget.set(dealer);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  deleteConfirmed(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.dealers.delete(target.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((d) => d.id !== target.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
        this.messages.add({ severity: 'success', summary: 'Dealer deleted' });
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
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
