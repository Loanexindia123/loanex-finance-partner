import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { AdminUserRecord } from '../../customers/models/customer.models';
import { Order } from '../../orders/models/order.models';
import { Product } from '../../products/models/product.models';
import { OrderService } from '../../orders/services/order.service';
import { ProductService } from '../../products/services/product.service';

export interface WidgetState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

export function idleWidget<T>(): WidgetState<T> {
  return { loading: true, error: null, data: null };
}

export interface StatusBucket {
  key: string;
  label: string;
  count: number;
}

export interface ProductOverview {
  total: number;
  active: number | null;
  outOfStock: number | null;
  lowStock: number | null;
  lowStockProducts: Product[];
}

export interface OrderOverview {
  total: number;
  recent: Order[];
  statuses: StatusBucket[];
  payments: StatusBucket[];
}

export interface CustomerOverview {
  total: number;
}

export interface EmiOverview {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  other: number;
}

export interface LoanOverview {
  total: number;
  active: number;
  completed: number;
  pending: number;
  other: number;
}

export interface FiOverview {
  total: number;
  pending: number;
  completed: number;
  other: number;
}

interface ListedPayload<T> {
  items?: T[];
  total?: number;
}

interface RawEmiApplication {
  status?: string;
}

interface RawLoan {
  loanStatus?: string;
  status?: string;
}

interface RawFiCase {
  status?: string;
}

const LOW_STOCK_THRESHOLD = 5;

function asList<T>(payload: T[] | ListedPayload<T> | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload?.items ?? [];
}

function norm(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function stockOf(product: Product): number {
  return Number(product.availableStock ?? product.stock ?? 0);
}

function bucketize(values: string[], groups: { key: string; label: string; match: string[] }[]): StatusBucket[] {
  return groups.map((group) => ({
    key: group.key,
    label: group.label,
    count: values.filter((value) => group.match.includes(value)).length,
  }));
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly http = inject(HttpClient);

  loadProducts(): Observable<ProductOverview> {
    return this.productService.listWithMeta({ status: 'all', limit: 500 }).pipe(
      switchMap((page) => {
        const items = page.items;
        const total = page.total;
        const complete = items.length >= total;
        const lowStockProducts = items
          .filter((product) => stockOf(product) <= LOW_STOCK_THRESHOLD)
          .slice(0, 8);

        if (complete) {
          return of({
            total,
            active: items.filter((product) => norm(product.status) === 'ACTIVE').length,
            outOfStock: items.filter((product) => stockOf(product) <= 0).length,
            lowStock: items.filter((product) => stockOf(product) <= LOW_STOCK_THRESHOLD).length,
            lowStockProducts,
          });
        }

        return forkJoin({
          active: this.productService.listWithMeta({ status: 'active', limit: 1 }),
          outOfStock: this.productService.listWithMeta({
            status: 'all',
            limit: 1,
            availability: 'OUT_OF_STOCK',
          }),
        }).pipe(
          map(({ active, outOfStock }) => ({
            total,
            active: active.total,
            outOfStock: outOfStock.total,
            lowStock: null,
            lowStockProducts,
          })),
        );
      }),
    );
  }

  loadOrders(): Observable<OrderOverview> {
    return this.orderService.list().pipe(
      map((orders) => {
        const recent = [...orders]
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .slice(0, 8);
        const statuses = bucketize(
          orders.map((order) => norm(order.status)),
          [
            { key: 'pending', label: 'Pending', match: ['PENDING'] },
            {
              key: 'processing',
              label: 'Processing',
              match: ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'],
            },
            { key: 'completed', label: 'Completed', match: ['DELIVERED', 'COMPLETED'] },
            { key: 'cancelled', label: 'Cancelled', match: ['CANCELLED'] },
          ],
        );
        const payments = bucketize(
          orders.map((order) => norm(order.paymentStatus)),
          [
            { key: 'paid', label: 'Paid', match: ['SUCCESS', 'PAID', 'COMPLETED'] },
            { key: 'pending', label: 'Pending', match: ['PENDING', 'CREATED', 'AUTHORIZED'] },
            { key: 'failed', label: 'Failed', match: ['FAILED', 'CANCELLED', 'REFUNDED'] },
          ],
        );
        const paymentKnown = payments.reduce((sum, bucket) => sum + bucket.count, 0);
        const paymentOther = Math.max(0, orders.length - paymentKnown);
        if (paymentOther > 0) {
          payments.push({ key: 'other', label: 'Other', count: paymentOther });
        }
        return { total: orders.length, recent, statuses, payments };
      }),
    );
  }

  loadCustomers(): Observable<CustomerOverview> {
    return this.http
      .get<ApiEnvelope<AdminUserRecord[] | ListedPayload<AdminUserRecord>>>(apiUrl('/admin/users'))
      .pipe(
        unwrapApi(),
        map((payload) => ({
          total: asList(payload).filter((user) => String(user.role).toLowerCase() === 'customer')
            .length,
        })),
      );
  }

  loadEmi(): Observable<EmiOverview> {
    return this.http
      .get<ApiEnvelope<RawEmiApplication[] | ListedPayload<RawEmiApplication>>>(
        apiUrl('/admin/emi-applications'),
      )
      .pipe(
        unwrapApi(),
        map((payload) => {
          const items = asList(payload);
          const statuses = items.map((item) => norm(item.status));
          const pending = statuses.filter((status) =>
            ['PENDING', 'UNDER_REVIEW', 'HOLD', 'ON_HOLD', 'REVIEW'].includes(status),
          ).length;
          const approved = statuses.filter((status) =>
            [
              'APPROVED',
              'ACTIVE',
              'ACTIVE_EMI',
              'OFFER_ACCEPTED',
              'DOWN_PAYMENT_PENDING',
              'DOWN_PAYMENT_COMPLETED',
              'ORDER_CONFIRMED',
            ].includes(status),
          ).length;
          const rejected = statuses.filter((status) =>
            ['REJECTED', 'DECLINED_BY_CUSTOMER'].includes(status),
          ).length;
          return {
            total: items.length,
            pending,
            approved,
            rejected,
            other: Math.max(0, items.length - pending - approved - rejected),
          };
        }),
      );
  }

  loadLoans(): Observable<LoanOverview> {
    return this.http
      .get<ApiEnvelope<RawLoan[] | ListedPayload<RawLoan>>>(apiUrl('/admin/loans'))
      .pipe(
        unwrapApi(),
        map((payload) => {
          const items = asList(payload);
          const statuses = items.map((item) => norm(item.loanStatus ?? item.status));
          const active = statuses.filter((status) => status === 'ACTIVE').length;
          const completed = statuses.filter((status) => status === 'CLOSED').length;
          const pending = statuses.filter((status) => ['PAUSED', 'PENDING'].includes(status)).length;
          return {
            total: items.length,
            active,
            completed,
            pending,
            other: Math.max(0, items.length - active - completed - pending),
          };
        }),
      );
  }

  loadFi(): Observable<FiOverview> {
    return this.http
      .get<ApiEnvelope<RawFiCase[] | ListedPayload<RawFiCase>>>(apiUrl('/admin/fi-cases'))
      .pipe(
        unwrapApi(),
        map((payload) => {
          const items = asList(payload);
          const statuses = items.map((item) => norm(item.status));
          const pending = statuses.filter((status) =>
            ['PENDING', 'IN_PROGRESS', 'HOLD', 'ON_HOLD'].includes(status),
          ).length;
          const completed = statuses.filter((status) =>
            ['COMPLETED', 'CLOSED'].includes(status),
          ).length;
          return {
            total: items.length,
            pending,
            completed,
            other: Math.max(0, items.length - pending - completed),
          };
        }),
      );
  }
}
