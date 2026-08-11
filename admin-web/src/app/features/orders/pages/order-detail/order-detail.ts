import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { OrderService } from '../../services/order.service';
import { ORDER_STATUSES, Order } from '../../models/order.models';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    PageHeader,
    LoadingSkeleton,
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
  readonly statusOptions = ORDER_STATUSES.map((s) => ({ label: s, value: s }));

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<Order | null>(null);
  readonly updating = signal(false);

  readonly nextStatus = signal<string | null>(null);
  readonly remarks = signal('');
  readonly trackingNumber = signal('');
  readonly courierPartner = signal('');

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
