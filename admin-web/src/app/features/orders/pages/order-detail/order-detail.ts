import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { OrderService } from '../../services/order.service';
import {
  ORDER_STATUSES,
  Order,
  OrderItem,
  isEmiOrder,
  orderDisplayId,
  paymentMethodLabel,
} from '../../models/order.models';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetail {
  private readonly orders = inject(OrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly orderId = this.route.snapshot.paramMap.get('id')!;
  readonly statusOptions = ORDER_STATUSES.map((s) => ({
    label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: s,
  }));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<Order | null>(null);
  readonly updating = signal(false);

  readonly nextStatus = signal<string | null>(null);
  readonly remarks = signal('');
  readonly trackingNumber = signal('');
  readonly courierPartner = signal('');

  readonly title = computed(() => {
    const order = this.order();
    if (!order) return `Order ${this.orderId}`;
    return `Order ${orderDisplayId(order)}`;
  });

  readonly methodLabel = computed(() => paymentMethodLabel(this.order()?.paymentMethod));

  readonly isEmi = computed(() => {
    const order = this.order();
    return order ? isEmiOrder(order) : false;
  });

  readonly itemsTotal = computed(() =>
    (this.order()?.items ?? []).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );

  readonly emiProgress = computed(() => {
    const order = this.order();
    const paid = order?.paidEmiCount ?? 0;
    const total = order?.totalEmiCount ?? order?.emiSchedule?.length ?? 0;
    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    return { paid, total, pct };
  });

  readonly copyTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 150,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.orders.getById(this.orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.nextStatus.set(order.status);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  back(): void {
    this.router.navigate(['/orders']);
  }

  lineTotal(item: OrderItem): number {
    return item.unitPrice * item.quantity;
  }

  async copyId(): Promise<void> {
    const id = this.order()?.id ?? this.orderId;
    try {
      await navigator.clipboard.writeText(id);
      this.messages.add({ severity: 'success', summary: 'Order ID copied' });
    } catch {
      this.messages.add({ severity: 'warn', summary: 'Could not copy order ID' });
    }
  }

  updateStatus(): void {
    const status = this.nextStatus();
    if (!status) return;
    this.updating.set(true);
    this.orders
      .updateStatus(this.orderId, {
        status,
        remarks: this.remarks() || undefined,
        trackingNumber: this.trackingNumber() || undefined,
        courierPartner: this.courierPartner() || undefined,
      })
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.updating.set(false);
          this.messages.add({ severity: 'success', summary: 'Order status updated' });
        },
        error: (err: unknown) => {
          this.updating.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Update failed',
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
