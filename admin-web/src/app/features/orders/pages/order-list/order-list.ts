import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { OrderService } from '../../services/order.service';
import {
  ORDER_STATUSES,
  Order,
  PAYMENT_STATUSES,
  orderDisplayId,
  paymentMethodLabel,
} from '../../models/order.models';

function humanizeStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

@Component({
  selector: 'app-order-list',
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
    StatCard,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderList {
  private readonly orders = inject(OrderService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Order[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string>('all');
  readonly paymentFilter = signal<string>('all');
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

  readonly statusOptions = [
    { label: 'All statuses', value: 'all' },
    ...ORDER_STATUSES.map((s) => ({ label: humanizeStatus(s), value: s })),
  ];

  readonly paymentOptions = [
    { label: 'All payments', value: 'all' },
    ...PAYMENT_STATUSES.map((s) => ({ label: humanizeStatus(s), value: s })),
  ];

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      this.statusFilter() !== 'all' ||
      this.paymentFilter() !== 'all',
  );

  readonly stats = computed(() => {
    const items = this.items();
    const statusOf = (o: Order) => (o.status ?? '').toUpperCase();
    const payOf = (o: Order) => (o.paymentStatus ?? '').toUpperCase();
    return {
      total: items.length,
      pendingPay: items.filter((o) => payOf(o) === 'PENDING').length,
      processing: items.filter((o) =>
        ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(statusOf(o)),
      ).length,
      cancelled: items.filter((o) => statusOf(o) === 'CANCELLED').length,
    };
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const payment = this.paymentFilter();
    return this.items().filter((o) => {
      const haystack = [
        o.id,
        o.orderNumber,
        o.customerName,
        o.customerPhone,
        o.paymentMethod,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesTerm = !term || haystack.includes(term);
      const matchesStatus = status === 'all' || (o.status ?? '').toUpperCase() === status;
      const matchesPayment =
        payment === 'all' || (o.paymentStatus ?? '').toUpperCase() === payment;
      return matchesTerm && matchesStatus && matchesPayment;
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
    this.orders.list().subscribe({
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

  displayId(order: Order): string {
    return orderDisplayId(order);
  }

  methodLabel(order: Order): string {
    return paymentMethodLabel(order.paymentMethod);
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
    this.paymentFilter.set('all');
    this.resetPage();
  }

  view(order: Order): void {
    this.router.navigate(['/orders', order.id]);
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Unable to load orders.';
    }
    return 'Unable to load orders.';
  }
}
