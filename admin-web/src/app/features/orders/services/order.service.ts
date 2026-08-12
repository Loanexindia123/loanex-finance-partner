import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import {
  EmiPaymentEntry,
  EmiScheduleEntry,
  Order,
  OrderItem,
  UpdateOrderStatusPayload,
} from '../models/order.models';

/**
 * Raw backend order shape has several historical field-name variants —
 * normalize them the same way admin-app/src/services/orderService.ts does.
 */
interface RawOrder {
  id: string;
  orderNumber?: string;
  userId?: string;
  customerId?: string;
  addressId?: string;
  productId?: string;
  productName?: string;
  productImageUrl?: string;
  productImage?: string;
  quantity?: number;
  sellingPrice?: number;
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
  transactionDate?: string;
  customerName?: string;
  customerMobile?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  emiPlan?: string;
  emiAmount?: number | null;
  emiDuration?: string;
  downPayment?: number | null;
  loanAmount?: number | null;
  interestRate?: number | null;
  processingFee?: number | null;
  loanStatus?: string | null;
  loanAccountNumber?: string | null;
  outstandingAmount?: number | null;
  paidEmiCount?: number | null;
  totalEmiCount?: number | null;
  downPaymentCollected?: number | null;
  amountPaid?: number | null;
  paidAtDelivery?: number | null;
  nextEmiDueDate?: string | null;
  emiPayments?: unknown[];
  emiSchedule?: unknown[];
  application?: {
    productName?: string;
    productImage?: string;
    sellingPrice?: number;
  };
  product?: {
    id?: string;
    name?: string;
    brand?: string;
    imageUrl?: string;
  };
  user?: {
    fullName?: string;
    email?: string;
    mobile?: string;
  };
  [key: string]: unknown;
}

interface RawOrderList {
  items?: RawOrder[];
  totalItems?: number;
  total?: number;
}

interface RawOrderItem {
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  productName?: string;
  productImageUrl?: string;
  productBrand?: string;
  product?: {
    id?: string;
    name?: string;
    brand?: string;
    imageUrl?: string;
  };
}

interface RawEmiRow {
  emiNumber?: number;
  dueDate?: string | null;
  paidAt?: string | null;
  principalAmount?: number;
  interestAmount?: number;
  amount?: number;
  paymentStatus?: string;
  status?: string;
}

function extractOrders(data: RawOrder[] | RawOrderList | null | undefined): RawOrder[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data?.items ?? [];
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeItems(raw: RawOrder): OrderItem[] {
  const list = Array.isArray(raw.items) ? (raw.items as RawOrderItem[]) : [];
  const mapped = list
    .map((item): OrderItem | null => {
      const productId = item.productId ?? item.product?.id ?? '';
      if (!productId && !item.productName && !item.product?.name) return null;
      return {
        productId: productId || 'unknown',
        quantity: Math.max(1, toNumber(item.quantity, 1)),
        unitPrice: toNumber(item.unitPrice ?? item.price, 0),
        productName: item.productName ?? item.product?.name,
        productImageUrl: item.productImageUrl ?? item.product?.imageUrl,
        productBrand: item.productBrand ?? item.product?.brand,
      };
    })
    .filter((item): item is OrderItem => item !== null);

  if (mapped.length > 0) return mapped;

  const productId = raw.productId ?? raw.product?.id;
  const productName =
    raw.product?.name ?? raw.productName ?? raw.application?.productName;
  if (!productId && !productName) return [];

  const quantity = Math.max(1, toNumber(raw.quantity, 1));
  const total = toNumber(raw.totalAmount ?? raw.total ?? raw.orderAmount, 0);
  const unitPrice =
    toNumber(raw.sellingPrice, 0) ||
    toNumber(raw.application?.sellingPrice, 0) ||
    (quantity > 0 ? Math.round(total / quantity) : total);

  return [
    {
      productId: productId || 'unknown',
      quantity,
      unitPrice,
      productName: productName || 'Product',
      productImageUrl:
        raw.product?.imageUrl ??
        raw.productImageUrl ??
        raw.productImage ??
        raw.application?.productImage,
      productBrand: raw.product?.brand,
    },
  ];
}

function normalizeSchedule(raw: unknown[]): EmiScheduleEntry[] {
  return raw
    .map((row): EmiScheduleEntry | null => {
      const item = row as RawEmiRow;
      const emiNumber = toNumber(item.emiNumber, 0);
      if (!emiNumber) return null;
      return {
        emiNumber,
        dueDate: item.dueDate ?? null,
        paidAt: item.paidAt ?? null,
        principalAmount: toNumber(item.principalAmount, 0),
        interestAmount: toNumber(item.interestAmount, 0),
        amount: toNumber(item.amount, 0),
        paymentStatus: String(item.paymentStatus ?? item.status ?? 'PENDING').toUpperCase(),
      };
    })
    .filter((row): row is EmiScheduleEntry => row !== null)
    .sort((a, b) => a.emiNumber - b.emiNumber);
}

function normalizePayments(raw: unknown[]): EmiPaymentEntry[] {
  return raw
    .map((row): EmiPaymentEntry | null => {
      const item = row as RawEmiRow;
      const emiNumber = toNumber(item.emiNumber, 0);
      if (!emiNumber) return null;
      return {
        emiNumber,
        dueDate: item.dueDate ?? null,
        paidAt: item.paidAt ?? null,
        principalAmount: toNumber(item.principalAmount, 0),
        interestAmount: toNumber(item.interestAmount, 0),
        amount: toNumber(item.amount, 0),
      };
    })
    .filter((row): row is EmiPaymentEntry => row !== null)
    .sort((a, b) => a.emiNumber - b.emiNumber);
}

function normalizeOrder(raw: RawOrder): Order {
  const items = normalizeItems(raw);
  const nestedProduct = raw.product as
    | { id?: string; name?: string; imageUrl?: string; brand?: string }
    | undefined;
  const emiSchedule = Array.isArray(raw.emiSchedule) ? normalizeSchedule(raw.emiSchedule) : [];
  const emiPayments = Array.isArray(raw.emiPayments) ? normalizePayments(raw.emiPayments) : [];

  return {
    id: raw.id,
    orderNumber: raw.orderNumber,
    userId: raw.userId ?? raw.customerId,
    customerId: raw.customerId ?? raw.userId,
    addressId: raw.addressId,
    totalAmount: toNumber(raw.totalAmount ?? raw.total ?? raw.orderAmount, 0),
    sellingPrice: toNullableNumber(raw.sellingPrice) ?? undefined,
    quantity: toNullableNumber(raw.quantity) ?? undefined,
    paymentMethod: raw.paymentMethod ?? raw.paymentType,
    paymentStatus: raw.paymentStatus ?? raw.payment_status ?? 'PENDING',
    status: raw.status ?? raw.orderStatus ?? 'PENDING',
    items,
    createdAt: raw.createdAt ?? raw.orderDate,
    updatedAt: raw.updatedAt,
    transactionDate: raw.transactionDate,
    customerName: raw.customerName ?? raw.user?.fullName,
    customerPhone: raw.customerPhone ?? raw.customerMobile ?? raw.user?.mobile,
    customerEmail: raw.user?.email,
    deliveryAddress: raw.deliveryAddress,
    productId: raw.productId ?? nestedProduct?.id ?? raw.product?.id ?? items[0]?.productId,
    productName:
      raw.productName ??
      nestedProduct?.name ??
      raw.product?.name ??
      raw.application?.productName ??
      items[0]?.productName,
    productImageUrl:
      raw.productImageUrl ??
      raw.productImage ??
      nestedProduct?.imageUrl ??
      raw.product?.imageUrl ??
      raw.application?.productImage ??
      items[0]?.productImageUrl,
    emiPlan: raw.emiPlan,
    emiAmount: toNullableNumber(raw.emiAmount),
    emiDuration: raw.emiDuration,
    downPayment: toNullableNumber(raw.downPayment),
    loanAmount: toNullableNumber(raw.loanAmount),
    interestRate: toNullableNumber(raw.interestRate),
    processingFee: toNullableNumber(raw.processingFee),
    loanStatus: raw.loanStatus ?? null,
    loanAccountNumber: raw.loanAccountNumber ?? null,
    outstandingAmount: toNullableNumber(raw.outstandingAmount),
    paidEmiCount: toNullableNumber(raw.paidEmiCount),
    totalEmiCount: toNullableNumber(raw.totalEmiCount),
    downPaymentCollected: toNullableNumber(raw.downPaymentCollected),
    amountPaid: toNullableNumber(raw.amountPaid),
    paidAtDelivery: toNullableNumber(raw.paidAtDelivery),
    nextEmiDueDate: raw.nextEmiDueDate ?? null,
    emiPayments,
    emiSchedule,
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
