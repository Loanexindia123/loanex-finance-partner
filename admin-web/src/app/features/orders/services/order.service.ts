import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Order, UpdateOrderStatusPayload } from '../models/order.models';

/**
 * Raw backend order shape has several historical field-name variants —
 * normalize them the same way admin-app/src/services/orderService.ts does.
 */
interface RawOrder {
  id: string;
  orderNumber?: string;
  userId?: string;
  addressId?: string;
  totalAmount?: number;
  total?: number;
  orderAmount?: number;
  paymentMethod?: string;
  paymentType?: string;
  paymentStatus?: string;
  payment_status?: string;
  status?: string;
  orderStatus?: string;
  items?: unknown[];
  createdAt?: string;
  orderDate?: string;
  updatedAt?: string;
  customerName?: string;
  customerMobile?: string;
  customerPhone?: string;
  [key: string]: unknown;
}

interface RawOrderList {
  items?: RawOrder[];
  totalItems?: number;
  total?: number;
}

function extractOrders(data: RawOrder[] | RawOrderList | null | undefined): RawOrder[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data?.items ?? [];
}

function normalizeOrder(raw: RawOrder): Order {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    userId: raw.userId,
    addressId: raw.addressId,
    totalAmount: raw.totalAmount ?? raw.total ?? raw.orderAmount ?? 0,
    paymentMethod: raw.paymentMethod ?? raw.paymentType,
    paymentStatus: raw.paymentStatus ?? raw.payment_status ?? 'PENDING',
    status: raw.status ?? raw.orderStatus ?? 'PENDING',
    items: (raw.items as Order['items']) ?? [],
    createdAt: raw.createdAt ?? raw.orderDate,
    updatedAt: raw.updatedAt,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone ?? raw.customerMobile,
  };
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  list(): Observable<Order[]> {
    return this.http
      .get<ApiEnvelope<RawOrder[] | RawOrderList>>(apiUrl('/admin/orders'))
      .pipe(
        unwrapApi(),
        map((payload) => extractOrders(payload).map(normalizeOrder)),
      );
  }

  /** No single-order endpoint exists under /admin/* — must use /orders/admin/:id. */
  getById(orderId: string): Observable<Order> {
    return this.http
      .get<ApiEnvelope<RawOrder>>(apiUrl(`/orders/admin/${orderId}`))
      .pipe(unwrapApi(), map(normalizeOrder));
  }

  updateStatus(orderId: string, payload: UpdateOrderStatusPayload): Observable<Order> {
    return this.http
      .patch<ApiEnvelope<RawOrder>>(apiUrl(`/admin/orders/${orderId}/status`), payload)
      .pipe(unwrapApi(), map(normalizeOrder));
  }

  tracking(orderId: string): Observable<unknown> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl(`/orders/${orderId}/tracking`))
      .pipe(unwrapApi());
  }
}
