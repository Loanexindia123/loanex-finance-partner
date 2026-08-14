import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { resolveMediaUrl } from '../../../shared/utils/media-url';

export type PurchaseType = 'EMI' | 'DIRECT' | 'COD';

export interface CheckoutSummary {
  product: {
    id: string;
    name: string;
    brand: string;
    variant: string | null;
    variantId?: string | null;
    sku?: string;
    imageUrl: string;
    inStock: boolean;
    stockQuantity: number;
  };
  quantity: number;
  items?: Array<{
    product: {
      id: string;
      name: string;
      brand: string;
      variant: string | null;
      sku?: string;
      imageUrl: string;
      inStock: boolean;
      stockQuantity: number;
    };
    quantity: number;
    pricing: {
      unitPrice: number;
      mrp: number;
      productPrice: number;
      discount: number;
      deliveryCharges: number;
      totalAmount: number;
    };
    variantId?: string;
  }>;
  pricing: {
    unitPrice: number;
    mrp: number;
    productPrice: number;
    discount: number;
    deliveryCharges: number;
    totalAmount: number;
  };
  prerequisites: {
    profileCompleted: boolean;
    addressCompleted: boolean;
    readyForCheckout: boolean;
  };
  address: {
    id: string;
    addressLine1: string;
    addressLine2: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault?: boolean;
  } | null;
  addresses?: Array<{
    id: string;
    addressLine1: string;
    addressLine2: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault: boolean;
  }>;
  purchaseOptions: Array<{ code: PurchaseType; label: string; description: string }>;
  /** Cash-on-delivery rules — COD is blocked above the max amount. */
  codRules?: {
    maxAmount: number;
    codAllowed: boolean;
    totalAmount: number;
  };
}

export interface CheckoutSession {
  id: string;
  userId: string;
  productId: string;
  items?: Array<{ productId: string; quantity: number }>;
  variantId?: string | null;
  quantity: number;
  purchaseType: PurchaseType;
  addressId: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCheckoutResponse {
  session: CheckoutSession;
  summary: Pick<CheckoutSummary, 'product' | 'quantity' | 'pricing' | 'items'>;
  redirectPath: string;
  nextStep: 'EMI_VERIFICATION' | 'DIRECT_PAYMENT';
}

export interface CheckoutSessionResponse {
  session: CheckoutSession;
  summary: Pick<CheckoutSummary, 'product' | 'quantity' | 'pricing' | 'items'>;
}

export interface CreateDirectPaymentOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  paymentDevBypass: boolean;
}

export interface VerifyDirectPaymentResponse {
  paymentStatus: string;
  alreadyProcessed?: boolean;
  transactionId?: string;
  orderId: string;
  orderNumber: string | null;
  nextStep: string;
}

export interface DevBypassSignatureResponse {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PlaceCodOrderResponse {
  kind: string;
  order: {
    id: string;
    orderNumber: string;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    totalAmount: number;
    estimatedDeliveryDate?: string;
  };
  items: unknown[];
}

export interface RazorpayVerifyPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

const SESSION_KEY = 'loanex.checkoutSessionId';

/** Short TTL for advisory PDP COD checks — keyed by amount only. */
const COD_RULES_TTL_MS = 45_000;

type CodRules = { maxAmount: number; codAllowed: boolean; totalAmount: number };

@Injectable({ providedIn: 'root' })
export class CheckoutApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/checkout`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly errorCodeSignal = signal<string | null>(null);

  private readonly codRulesCache = new Map<
    number,
    { expiresAt: number; request$: Observable<CodRules> }
  >();

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly errorCode = this.errorCodeSignal.asReadonly();

  /**
   * COD availability for a given cart total — same codRules the checkout
   * summary derives from (backend COD_MAX_AMOUNT). Lightweight call that does
   * not touch the shared loading/error signals.
   *
   * Short in-memory reuse for identical amounts (PDP advisory toast). Checkout
   * summary still loads its own `codRules` via getSummary — unchanged.
   */
  getCodRules(amount: number): Observable<CodRules> {
    const key = Math.round(amount);
    const now = Date.now();
    const hit = this.codRulesCache.get(key);
    if (hit && now < hit.expiresAt) {
      return hit.request$;
    }

    const params = new HttpParams().set('amount', String(key));
    const request$ = this.http
      .get<ApiSuccess<CodRules>>(`${this.baseUrl}/cod-rules`, { params })
      .pipe(
        map((res) => res.data),
        tap({
          error: () => {
            this.codRulesCache.delete(key);
          },
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.codRulesCache.set(key, {
      expiresAt: now + COD_RULES_TTL_MS,
      request$,
    });

    if (this.codRulesCache.size > 20) {
      const oldest = this.codRulesCache.keys().next().value;
      if (oldest !== undefined) this.codRulesCache.delete(oldest);
    }

    return request$;
  }

  getSummary(productId: string, quantity = 1, variantId?: string, mode?: string): Observable<CheckoutSummary> {
    let params = new HttpParams().set('quantity', String(quantity));
    if (variantId) {
      params = params.set('variantId', variantId);
    }
    if (mode) {
      params = params.set('mode', mode);
    }
    return this.wrap(
      this.http.get<ApiSuccess<CheckoutSummary>>(`${this.baseUrl}/${productId || 'none'}`, { params }),
    ).pipe(map((summary) => this.withResolvedCheckoutImages(summary)));
  }

  create(payload: {
    productId?: string;
    mode?: string;
    variantId?: string;
    quantity: number;
    purchaseType: PurchaseType;
    addressId?: string;
  }): Observable<CreateCheckoutResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<CreateCheckoutResponse>>(this.baseUrl, payload),
    ).pipe(
      tap((data) => this.saveSessionId(data.session.id)),
    );
  }

  getSession(sessionId: string): Observable<CheckoutSessionResponse> {
    return this.wrap(
      this.http.get<ApiSuccess<CheckoutSessionResponse>>(
        `${this.baseUrl}/session/${sessionId}`,
      ),
    );
  }

  /** Create the Razorpay order for a DIRECT (full-payment) session. */
  createPaymentOrder(
    sessionId: string,
  ): Observable<CreateDirectPaymentOrderResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<CreateDirectPaymentOrderResponse>>(
        `${this.baseUrl}/${sessionId}/payment/order`,
        {},
      ),
    );
  }

  /** Verify a Razorpay payment and complete the DIRECT order. */
  verifyPayment(
    sessionId: string,
    payload: RazorpayVerifyPayload,
  ): Observable<VerifyDirectPaymentResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<VerifyDirectPaymentResponse>>(
        `${this.baseUrl}/${sessionId}/payment/verify`,
        payload,
      ),
    );
  }

  /** One-shot COD order placement (no payment step — pay on delivery). */
  placeCodOrder(payload: {
    items: Array<{ productId: string; quantity: number; variantId?: string | null }>;
    addressId?: string;
    notes?: string;
  }): Observable<PlaceCodOrderResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<PlaceCodOrderResponse>>(`${this.baseUrl}/place-order`, {
        items: payload.items,
        addressId: payload.addressId,
        notes: payload.notes ?? null,
        paymentMethod: 'COD',
      }),
    );
  }

  /** Dev-only: fabricate a signature to complete payment without Razorpay. */
  createDevBypassSignature(sessionId: string): Observable<DevBypassSignatureResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<DevBypassSignatureResponse>>(
        `${this.baseUrl}/${sessionId}/payment/dev-bypass-signature`,
        {},
      ),
    );
  }

  saveSessionId(id: string): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, id);
    }
  }

  getSavedSessionId(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(SESSION_KEY);
  }

  clearError(): void {
    this.errorSignal.set(null);
    this.errorCodeSignal.set(null);
  }

  private withResolvedCheckoutImages(summary: CheckoutSummary): CheckoutSummary {
    return {
      ...summary,
      product: {
        ...summary.product,
        imageUrl: resolveMediaUrl(summary.product?.imageUrl),
      },
      items: summary.items?.map((row) => ({
        ...row,
        product: {
          ...row.product,
          imageUrl: resolveMediaUrl(row.product?.imageUrl),
        },
      })),
    };
  }

  private wrap<T>(source: Observable<ApiSuccess<T>>): Observable<T> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.errorCodeSignal.set(null);

    return source.pipe(
      map((res) => res.data),
      tap(() => this.loadingSignal.set(false)),
      catchError((err: unknown) => {
        this.loadingSignal.set(false);
        const body = this.extractErrorBody(err);
        this.errorSignal.set(body?.message ?? 'Unable to complete checkout request.');
        this.errorCodeSignal.set(body?.code ?? null);
        return throwError(() => err);
      }),
    );
  }

  private extractErrorBody(err: unknown): { message?: string; code?: string } | null {
    if (err && typeof err === 'object' && 'error' in err) {
      return (err as { error?: { message?: string; code?: string } }).error ?? null;
    }
    return null;
  }
}
