import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import {
  ProductListResponse,
  ProductsApiService,
} from '../../products/services/products-api.service';

/** Soft-navigation TTL for Home catalog — short enough to stay fresh, long enough to skip refetches. */
const HOME_CATALOG_TTL_MS = 45_000;

/**
 * In-memory Home catalog cache shared by Categories + Popular / New Arrivals.
 * Browser refresh clears it (new JS context). Does not touch checkout/KYC/orders.
 */
@Injectable({ providedIn: 'root' })
export class HomeDataCacheService {
  private readonly productsApi = inject(ProductsApiService);

  private catalog$: Observable<ProductListResponse> | null = null;
  private catalogExpiresAt = 0;
  private catalogLimit = 0;

  /**
   * Shared Home product list (`limit` matches the former Categories request).
   * Popular on EMI / New Arrivals derive featured rows client-side from this
   * same payload so Home does not fire a second `/products` call.
   */
  getCatalog(limit = 50): Observable<ProductListResponse> {
    const now = Date.now();
    if (this.catalog$ && this.catalogLimit === limit && now < this.catalogExpiresAt) {
      return this.catalog$;
    }

    this.catalogLimit = limit;
    this.catalogExpiresAt = now + HOME_CATALOG_TTL_MS;
    this.catalog$ = this.productsApi.list({ limit }).pipe(
      tap({
        error: () => {
          this.catalog$ = null;
          this.catalogExpiresAt = 0;
          this.catalogLimit = 0;
        },
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.catalog$;
  }

  /** Drop cached catalog (e.g. after a rare Home-relevant mutation). */
  invalidateCatalog(): void {
    this.catalog$ = null;
    this.catalogExpiresAt = 0;
    this.catalogLimit = 0;
  }
}
