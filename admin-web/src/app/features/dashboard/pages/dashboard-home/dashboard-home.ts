import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { RbacService } from '../../../../core/services/rbac.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import {
  DonutSlice,
  StatusDonut,
} from '../../components/status-donut/status-donut';
import {
  CustomerOverview,
  DashboardService,
  EmiOverview,
  FiOverview,
  LoanOverview,
  OrderOverview,
  ProductOverview,
  StatusBucket,
  WidgetState,
  idleWidget,
} from '../../services/dashboard.service';

const COLORS = {
  navy: '#0b1b33',
  blue: '#2a6aa8',
  gold: '#c9a227',
  slate: '#94a3b8',
  wine: '#8d4b4b',
} as const;

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ButtonModule, SkeletonModule, StatusBadge, StatusDonut, BrandedLoader],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHome {
  private readonly dashboard = inject(DashboardService);
  private readonly rbac = inject(RbacService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly canViewProducts = computed(() => this.rbac.can('products.view'));
  readonly canViewOrders = computed(() => this.rbac.can('orders.view'));
  readonly canViewCustomers = computed(() => this.rbac.canAny('users.view', 'customers.view'));
  readonly canViewEmi = computed(() => this.rbac.can('emi.view'));
  readonly canViewFi = computed(() => this.rbac.can('fi.view'));

  readonly today = new Date();
  readonly refreshing = signal(false);
  private requestId = 0;
  private pending = 0;

  readonly products = signal<WidgetState<ProductOverview>>(idleWidget());
  readonly orders = signal<WidgetState<OrderOverview>>(idleWidget());
  readonly customers = signal<WidgetState<CustomerOverview>>(idleWidget());
  readonly emi = signal<WidgetState<EmiOverview>>(idleWidget());
  readonly loans = signal<WidgetState<LoanOverview>>(idleWidget());
  readonly fi = signal<WidgetState<FiOverview>>(idleWidget());

  readonly initialLoading = computed(() =>
    [this.products(), this.orders(), this.customers(), this.emi(), this.loans(), this.fi()].some(
      (widget) => widget.loading && !widget.data,
    ),
  );

  constructor() {
    this.load();
  }

  load(): void {
    const requestId = ++this.requestId;
    this.pending = 0;
    this.refreshing.set(true);

    this.loadWidget(requestId, this.canViewProducts(), this.dashboard.loadProducts(), this.products);
    this.loadWidget(requestId, this.canViewOrders(), this.dashboard.loadOrders(), this.orders);
    this.loadWidget(requestId, this.canViewCustomers(), this.dashboard.loadCustomers(), this.customers);
    this.loadWidget(requestId, this.canViewEmi(), this.dashboard.loadEmi(), this.emi);
    this.loadWidget(requestId, this.canViewEmi(), this.dashboard.loadLoans(), this.loans);
    this.loadWidget(requestId, this.canViewFi(), this.dashboard.loadFi(), this.fi);

    if (this.pending === 0) {
      this.refreshing.set(false);
    }
  }

  goTo(path: string): void {
    this.router.navigate([path]);
  }

  orderLabel(order: { id: string; orderNumber?: string }): string {
    return order.orderNumber || order.id;
  }

  orderSlices(data: OrderOverview): DonutSlice[] {
    return this.colorize(data.statuses, {
      pending: COLORS.gold,
      processing: COLORS.blue,
      completed: COLORS.navy,
      cancelled: COLORS.slate,
    });
  }

  paymentSlices(data: OrderOverview): DonutSlice[] {
    return this.colorize(data.payments, {
      paid: COLORS.navy,
      pending: COLORS.gold,
      failed: COLORS.wine,
      other: COLORS.slate,
    });
  }

  emiSlices(data: EmiOverview): DonutSlice[] {
    return this.optionalSlices([
      { key: 'approved', label: 'Approved', count: data.approved, color: COLORS.navy },
      { key: 'pending', label: 'Pending', count: data.pending, color: COLORS.gold },
      { key: 'rejected', label: 'Rejected', count: data.rejected, color: COLORS.wine },
      { key: 'other', label: 'Other', count: data.other, color: COLORS.slate },
    ]);
  }

  loanSlices(data: LoanOverview): DonutSlice[] {
    return this.optionalSlices([
      { key: 'active', label: 'Active', count: data.active, color: COLORS.blue },
      { key: 'completed', label: 'Completed', count: data.completed, color: COLORS.navy },
      { key: 'pending', label: 'Pending', count: data.pending, color: COLORS.gold },
      { key: 'other', label: 'Other', count: data.other, color: COLORS.slate },
    ]);
  }

  fiSlices(data: FiOverview): DonutSlice[] {
    return this.optionalSlices([
      { key: 'pending', label: 'Pending', count: data.pending, color: COLORS.gold },
      { key: 'completed', label: 'Completed', count: data.completed, color: COLORS.navy },
      { key: 'other', label: 'Other', count: data.other, color: COLORS.slate },
    ]);
  }

  private colorize(buckets: StatusBucket[], colors: Record<string, string>): DonutSlice[] {
    return buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: bucket.count,
      color: colors[bucket.key] ?? COLORS.slate,
    }));
  }

  private optionalSlices(slices: DonutSlice[]): DonutSlice[] {
    return slices.filter((slice) => slice.key !== 'other' || slice.count > 0);
  }

  private loadWidget<T>(
    requestId: number,
    allowed: boolean,
    source: Observable<T>,
    target: WritableSignal<WidgetState<T>>,
  ): void {
    if (!allowed) {
      target.set({ loading: false, error: null, data: null });
      return;
    }
    this.pending += 1;
    this.bind(requestId, source, target);
  }

  private bind<T>(
    requestId: number,
    source: Observable<T>,
    target: WritableSignal<WidgetState<T>>,
  ): void {
    target.set({ loading: true, error: null, data: target().data });
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        if (requestId !== this.requestId) {
          return;
        }
        target.set({ loading: false, error: null, data });
        this.completeRequest(requestId);
      },
      error: (err: unknown) => {
        if (requestId !== this.requestId) {
          return;
        }
        target.set({ loading: false, error: this.extractMessage(err), data: null });
        this.completeRequest(requestId);
      },
    });
  }

  private completeRequest(requestId: number): void {
    if (requestId !== this.requestId) {
      return;
    }
    this.pending -= 1;
    if (this.pending <= 0) {
      this.refreshing.set(false);
    }
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 403) {
        return 'You do not have permission to view this data.';
      }
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Unable to load';
    }
    return 'Unable to load';
  }
}
