import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { ProductListResponse, ProductsApiService } from './products-api.service';

/** Soft-navigation TTL for Shop catalog — short enough for stock/price freshness. */
const SHOP_CATALOG_TTL_MS = 45_000;

/**
 * In-memory Shop/Product-Catalog list cache.
 * Keyed by the full effective query so filters/search/pagination never cross-contaminate.
 * Hard browser refresh clears it (new JS context).
 */
@Injectable({ providedIn: 'root' })
export class ShopCatalogCacheService {
  private readonly productsApi = inject(ProductsApiService);

  private readonly entries = new Map<
    string,
    { expiresAt: number; request$: Observable<ProductListResponse> }
  >();

  /**
   * Shared catalog GET for an exact query. Pass `{ force: true }` to bypass TTL
   * (explicit refresh).
   */
  list(
    params: Record<string, string | number | boolean | undefined>,
    options?: { force?: boolean },
  ): Observable<ProductListResponse> {
    const key = this.buildKey(params);
    const now = Date.now();

    if (!options?.force) {
      const hit = this.entries.get(key);
      if (hit && now < hit.expiresAt) {
        return hit.request$;
      }
    } else {
      this.entries.delete(key);
    }

    const request$ = this.productsApi.list(params).pipe(
      tap({
        error: () => {
          this.entries.delete(key);
        },
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.entries.set(key, {
      expiresAt: now + SHOP_CATALOG_TTL_MS,
      request$,
    });

    // Bound memory if many distinct filter combos are used in one session.
    if (this.entries.size > 40) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }

    return request$;
  }

  /** Drop all cached catalog queries. */
  invalidate(): void {
    this.entries.clear();
  }

  private buildKey(params: Record<string, string | number | boolean | undefined>): string {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      normalized[key] = String(value);
    }
    return Object.keys(normalized)
      .sort()
      .map((key) => `${key}=${normalized[key]}`)
      .join('&');
  }
}
