import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { resolveMediaUrl } from '../../../shared/utils/media-url';
import { LayoutUiService } from '../../../layout/services/layout-ui.service';

export interface CartProduct {
  id: string;
  name: string;
  brand: string;
  variant: string | null;
  imageUrl: string;
  unitPrice: number;
  mrp: number;
  deliveryCharge: number;
  stockQuantity: number;
  inStock: boolean;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  product: CartProduct;
  lineSubtotal: number;
  lineDiscount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartSummary {
  totalItems: number;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  grandTotal: number;
}

export interface CartResponse {
  items: CartItem[];
  summary: CartSummary;
  item?: CartItem;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/cart`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly cartSignal = signal<CartResponse | null>(null);
  /** True after a successful GET/mutation response — enables Shell→Cart reuse. */
  private loaded = false;

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly cart = this.cartSignal.asReadonly();

  /** Whether a full cart payload is available for in-memory reuse. */
  hasLoaded(): boolean {
    return this.loaded && this.cartSignal() !== null;
  }

  /**
   * Load cart. Reuses the in-memory payload when Shell (or a prior call) already
   * loaded it. Pass `{ force: true }` for an explicit network refresh.
   */
  getCart(options?: { force?: boolean }): Observable<CartResponse> {
    if (!options?.force && this.hasLoaded()) {
      return of(this.cartSignal()!);
    }

    return this.wrap(this.http.get<ApiSuccess<CartResponse>>(this.baseUrl)).pipe(
      tap((data) => this.applyCart(data)),
    );
  }

  addItem(productId: string, quantity = 1, variantId?: string): Observable<CartResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<CartResponse>>(this.baseUrl, {
        productId,
        quantity,
        ...(variantId ? { variantId } : {}),
      }),
    ).pipe(tap((data) => this.applyCart(data)));
  }

  updateQuantity(cartItemId: string, quantity: number): Observable<CartResponse> {
    return this.wrap(
      this.http.put<ApiSuccess<CartResponse>>(`${this.baseUrl}/${cartItemId}`, { quantity }),
    ).pipe(tap((data) => this.applyCart(data)));
  }

  removeItem(cartItemId: string): Observable<CartResponse> {
    return this.wrap(
      this.http.delete<ApiSuccess<CartResponse>>(`${this.baseUrl}/${cartItemId}`),
    ).pipe(tap((data) => this.applyCart(data)));
  }

  clear(): Observable<CartResponse> {
    return this.wrap(this.http.delete<ApiSuccess<CartResponse>>(this.baseUrl)).pipe(
      tap((data) => this.applyCart(data)),
    );
  }

  moveToWishlist(cartItemId: string): Observable<CartResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<CartResponse>>(
        `${this.baseUrl}/${cartItemId}/move-to-wishlist`,
        {},
      ),
    ).pipe(
      tap((data) => {
        this.applyCart(data);
        this.layoutUi.wishlistCount.update((count) => count + 1);
      }),
    );
  }

  /** Mark in-memory cart stale so the next getCart() hits the network. */
  invalidate(): void {
    this.loaded = false;
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private applyCart(data: CartResponse): void {
    const resolved: CartResponse = {
      ...data,
      items: (data.items ?? []).map((item) => ({
        ...item,
        product: {
          ...item.product,
          imageUrl: resolveMediaUrl(item.product?.imageUrl),
        },
      })),
      item: data.item
        ? {
            ...data.item,
            product: {
              ...data.item.product,
              imageUrl: resolveMediaUrl(data.item.product?.imageUrl),
            },
          }
        : data.item,
    };
    this.cartSignal.set(resolved);
    this.loaded = true;
    this.layoutUi.cartCount.set(resolved.summary.totalItems);
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
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string } }).error;
      if (body?.message) return body.message;
    }
    return 'Unable to complete cart request.';
  }
}
