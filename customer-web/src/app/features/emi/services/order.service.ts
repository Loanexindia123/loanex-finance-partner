import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { resolveMediaUrl } from '../../../shared/utils/media-url';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  orderDate: string;
  orderAmount: number;
  paymentType: string;
  orderStatus: string;
  product: {
    id: string;
    name: string;
    brand: string;
    imageUrl: string;
  };
  items?: {
    product: {
      id: string;
      name: string;
      brand: string;
      imageUrl: string;
    };
    quantity: number;
    unitPrice: number;
  }[];
}

export interface OrderListResponse {
  items: OrderListItem[];
  totalItems: number;
}

export interface OrderConfirmationDetails {
  id: string;
  orderNumber: string;
  orderStatus: string;
  applicationId: string;
  applicationNumber: string;
  paymentId: string | null;
  paymentTransactionId: string | null;
  transactionDate: string;
  paymentType?: string;
  paymentMethod?: string;
  paymentStatus?: string | null;
  paidAtDelivery?: string | null;
  productId?: string;
  productName?: string | null;
  productBrand?: string;
  productImage?: string;
  quantity?: number;
  productPrice?: number;
  items?: {
    productId: string;
    productName: string;
    productBrand: string;
    productImage: string;
    quantity: number;
    unitPrice: number;
  }[];
  amountPaid: number;
  remainingLoanAmount: number;
  approvedLoanAmount: number;
  approvedDownPayment: number;
  canPayDownPayment?: boolean;
  downPaymentPaid?: boolean;
  downPaymentCollected?: number;
  emiPayments?: {
    emiNumber: number;
    dueDate: string | null;
    paidAt: string | null;
    principalAmount: number;
    interestAmount: number;
    amount: number;
  }[];
  /**
   * Full loan schedule — paid rows carry PAID + paidAt, upcoming rows stay
   * PENDING/OVERDUE with their due dates and amounts.
   */
  emiSchedule?: {
    emiNumber: number;
    dueDate: string | null;
    paidAt: string | null;
    principalAmount: number;
    interestAmount: number;
    amount: number;
    paymentStatus: string;
  }[];
  shippingAddress?: string | null;
  billingAddress?: string | null;
  customer?: {
    fullName: string;
    email: string;
    mobile: string;
  };
  emi?: {
    loanAmount: number;
    downPayment: number;
    tenure: number | null;
    monthlyEmi?: number;
    interestRate?: number;
    processingFee?: number;
    loanStatus?: string | null;
    loanAccountNumber?: string | null;
    paidEmiCount?: number;
    totalEmiCount?: number;
    nextEmiDueDate?: string | null;
    remainingLoanAmount?: number;
    downPaymentCollected?: number;
  };
  estimatedDeliveryDate: string | null;
  createdAt: string;
  courierPartner?: string | null;
  trackingNumber?: string | null;
  warehouse?: string | null;
  deliveryAddress?: string | null;
  canOpenEmiDashboard?: boolean;
  loanStatus?: string;
  timeline: {
    applicationApproved: boolean;
    offerAccepted: boolean;
    downPaymentCompleted: boolean;
    orderConfirmed: boolean;
    processing?: boolean;
    packed?: boolean;
    shipped: boolean;
    outForDelivery?: boolean;
    delivered: boolean;
  };
  receiptAvailable: boolean;
  invoiceAvailable?: boolean;
}

export interface OrderTrackingStep {
  status: string;
  label: string;
  completed: boolean;
  active: boolean;
  timestamp: string | null;
  remarks: string | null;
  location: string | null;
  updatedBy: string | null;
}

export interface OrderTrackingDetails extends OrderConfirmationDetails {
  steps: OrderTrackingStep[];
  trackingEvents: Array<{
    id: string;
    status: string;
    remarks: string | null;
    updatedBy: string | null;
    location: string | null;
    createdAt: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/orders`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  list(): Observable<OrderListResponse> {
    return this.wrap(this.http.get<ApiSuccess<OrderListResponse>>(this.baseUrl)).pipe(
      map((data) => this.withResolvedOrderListImages(data)),
    );
  }

  getCurrent(): Observable<OrderConfirmationDetails> {
    return this.wrap(
      this.http.get<ApiSuccess<OrderConfirmationDetails>>(`${this.baseUrl}/current`),
    ).pipe(map((data) => this.withResolvedOrderDetailImages(data)));
  }

  getById(orderId: string): Observable<OrderConfirmationDetails> {
    if (!orderId?.trim()) {
      this.errorSignal.set('Invalid order ID.');
      return throwError(() => new Error('Invalid order ID'));
    }

    return this.wrap(
      this.http.get<ApiSuccess<OrderConfirmationDetails>>(`${this.baseUrl}/${orderId}`),
    ).pipe(map((data) => this.withResolvedOrderDetailImages(data)));
  }

  getTracking(orderId: string): Observable<OrderTrackingDetails> {
    if (!orderId?.trim()) {
      this.errorSignal.set('Invalid order ID.');
      return throwError(() => new Error('Invalid order ID'));
    }

    return this.wrap(
      this.http.get<ApiSuccess<OrderTrackingDetails>>(`${this.baseUrl}/${orderId}/tracking`),
    ).pipe(map((data) => this.withResolvedOrderDetailImages(data) as OrderTrackingDetails));
  }

  downloadReceipt(orderId: string): Observable<Blob> {
    return this.downloadPdf(orderId, 'receipt');
  }

  downloadInvoice(orderId: string): Observable<Blob> {
    return this.downloadPdf(orderId, 'invoice');
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private withResolvedOrderListImages(data: OrderListResponse): OrderListResponse {
    return {
      ...data,
      items: (data.items ?? []).map((order) => ({
        ...order,
        product: order.product
          ? { ...order.product, imageUrl: resolveMediaUrl(order.product.imageUrl) }
          : order.product,
        items: order.items?.map((row) => ({
          ...row,
          product: {
            ...row.product,
            imageUrl: resolveMediaUrl(row.product?.imageUrl),
          },
        })),
      })),
    };
  }

  private withResolvedOrderDetailImages<T extends OrderConfirmationDetails>(data: T): T {
    return {
      ...data,
      productImage: resolveMediaUrl(data.productImage),
      items: data.items?.map((row) => ({
        ...row,
        productImage: resolveMediaUrl(row.productImage),
      })),
    };
  }

  private downloadPdf(orderId: string, type: 'receipt' | 'invoice'): Observable<Blob> {
    if (!orderId?.trim()) {
      this.errorSignal.set('Invalid order ID.');
      return throwError(() => new Error('Invalid order ID'));
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get(`${this.baseUrl}/${orderId}/${type}`, { responseType: 'blob' }).pipe(
      tap(() => this.loadingSignal.set(false)),
      catchError((err: unknown) => {
        this.loadingSignal.set(false);
        this.errorSignal.set(this.extractBlobError(err));
        return throwError(() => err);
      }),
    );
  }

  private wrap<T>(source: Observable<ApiSuccess<T>>): Observable<T> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return source.pipe(
      map((res) => res.data),
      tap(() => this.loadingSignal.set(false)),
      catchError((err: unknown) => {
        this.loadingSignal.set(false);
        this.errorSignal.set(this.extractError(err));
        return throwError(() => err);
      }),
    );
  }

  private extractError(err: unknown): string {
    const httpErr = err as { error?: { message?: string }; message?: string; status?: number };
    if (httpErr?.status === 404) {
      return httpErr?.error?.message || 'Order not found.';
    }
    return httpErr?.error?.message || httpErr?.message || 'Something went wrong. Please try again.';
  }

  private extractBlobError(err: unknown): string {
    const httpErr = err as { error?: Blob | { message?: string }; message?: string; status?: number };
    if (httpErr?.status === 401) return 'Please sign in again to download the file.';
    if (httpErr?.status === 404) return 'Document not found for this order.';
    if (httpErr?.error && typeof httpErr.error === 'object' && 'message' in httpErr.error) {
      return (httpErr.error as { message?: string }).message || 'Unable to download file.';
    }
    return httpErr?.message || 'Unable to download file.';
  }
}
