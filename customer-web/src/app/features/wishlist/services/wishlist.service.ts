import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { LayoutUiService } from '../../../layout/services/layout-ui.service';

export interface WishlistProduct {
  id: string;
  name: string;
  brand: string;
  variant: string | null;
  imageUrl: string;
  unitPrice: number;
  mrp: number;
  discount: number;
  stockQuantity: number;
  inStock: boolean;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface WishlistItem {
  id: string;
  productId: string;
  variantId?: string | null;
  createdAt: string;
  updatedAt: string;
  dateAdded: string;
  product: WishlistProduct;
}

export interface WishlistResponse {
  items: WishlistItem[];
  totalItems: number;
  item?: WishlistItem;
}

export interface WishlistStatus {
  inWishlist: boolean;
  wishlistItemId: string | null;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/wishlist`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly wishlistSignal = signal<WishlistResponse | null>(null);
  /** True after a successful GET/mutation response — enables Shell→Wishlist reuse. */
  private loaded = false;

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly wishlist = this.wishlistSignal.asReadonly();

  /** Whether a full wishlist payload is available for in-memory reuse. */
  hasLoaded(): boolean {
    return this.loaded && this.wishlistSignal() !== null;
  }

  /**
   * Load wishlist. Reuses the in-memory payload when Shell (or a prior call)
   * already loaded it. Pass `{ force: true }` for an explicit network refresh.
   */
  getWishlist(options?: { force?: boolean }): Observable<WishlistResponse> {
    if (!options?.force && this.hasLoaded()) {
      return of(this.wishlistSignal()!);
    }

    return this.wrap(this.http.get<ApiSuccess<WishlistResponse>>(this.baseUrl)).pipe(
      tap((data) => this.applyWishlist(data)),
    );
  }

  addItem(productId: string, variantId?: string): Observable<WishlistResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<WishlistResponse>>(this.baseUrl, {
        productId,
        ...(variantId ? { variantId } : {}),
      }),
    ).pipe(tap((data) => this.applyWishlist(data)));
  }

  removeItem(wishlistItemId: string): Observable<WishlistResponse> {
    return this.wrap(
      this.http.delete<ApiSuccess<WishlistResponse>>(`${this.baseUrl}/${wishlistItemId}`),
    ).pipe(tap((data) => this.applyWishlist(data)));
  }

  moveToCart(wishlistItemId: string): Observable<WishlistResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<WishlistResponse>>(
        `${this.baseUrl}/${wishlistItemId}/move-to-cart`,
        {},
      ),
    ).pipe(
      tap((data) => {
        this.applyWishlist(data);
        this.layoutUi.cartCount.update((count) => count + 1);
      }),
    );
  }

  getStatus(productId: string, variantId?: string): Observable<WishlistStatus> {
    const params = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    return this.wrap(
      this.http.get<ApiSuccess<WishlistStatus>>(`${this.baseUrl}/status/${productId}${params}`),
    );
  }

  /** Mark in-memory wishlist stale so the next getWishlist() hits the network. */
  invalidate(): void {
    this.loaded = false;
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private applyWishlist(data: WishlistResponse): void {
    this.wishlistSignal.set(data);
    this.loaded = true;
    this.layoutUi.wishlistCount.set(data.totalItems);
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
    return 'Unable to complete wishlist request.';
  }
}
