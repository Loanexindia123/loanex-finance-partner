import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { OrderService } from '../../services/order.service';
import { ORDER_STATUSES, Order } from '../../models/order.models';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    TableModule,
    InputTextModule,
    SelectModule,
    PageHeader,
    LoadingSkeleton,
    ErrorState,
    EmptyState,
    StatusBadge,
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
  readonly statusFilter = signal<string | null>(null);

  readonly statusOptions = [
    { label: 'All statuses', value: null },
    ...ORDER_STATUSES.map((s) => ({ label: s, value: s })),
  ];

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter((o) => {
      const matchesTerm = !term || o.id.toLowerCase().includes(term);
      const matchesStatus = !status || o.status === status;
      return matchesTerm && matchesStatus;
    });
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
