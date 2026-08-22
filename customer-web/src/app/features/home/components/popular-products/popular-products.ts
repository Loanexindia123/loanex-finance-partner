import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { WishlistService } from '../../../wishlist/services/wishlist.service';
import {
  CatalogProduct,
  ProductsApiService,
} from '../../../products/services/products-api.service';
import { formatInr } from '../../../../shared/utils/currency';
import { resolveMediaUrl } from '../../../../shared/utils/media-url';
import { PopularProduct } from '../../models/catalog.models';
import { HomeDataCacheService } from '../../services/home-data-cache.service';

@Component({
  selector: 'app-popular-products',
  imports: [RouterLink],
  templateUrl: './popular-products.html',
  styleUrl: './popular-products.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopularProducts {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly productsApi = inject(ProductsApiService);
  private readonly homeCache = inject(HomeDataCacheService);
  private readonly wishlistApi = inject(WishlistService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = input<string>('Popular on EMI');
  readonly category = input<string | null>(null);
  readonly limit = input<number>(6);
  /**
   * When true (New Arrivals), reuse the shared Home catalog and show the
   * newest rows (no featured filter — avoids a second HTTP call).
   */
  readonly reuseFeaturedCache = input(false);

  /** Always navigates to /products; optional category becomes a shareable query param. */
  readonly viewAllQueryParams = () => {
    const category = this.category()?.trim();
    return category ? { category } : {};
  };

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly products = signal<PopularProduct[]>([]);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const category = this.category()?.trim() || null;
      const limit = this.limit();
      const preferLatest = this.reuseFeaturedCache();

      // Home rails share one catalog request with Categories.
      // Popular on EMI: prefer featured, fall back to latest when none are flagged.
      // New Arrivals: always show latest from the same payload.
      if (!category) {
        this.homeCache
          .getCatalog(50)
          .pipe(
            map((data) => this.pickHomeRailItems(data.items, limit, preferLatest)),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe({
            next: (items) => {
              this.loading.set(false);
              this.products.set(items.map((item) => this.toPopularProduct(item)));
            },
            error: () => {
              this.loading.set(false);
              this.error.set(this.productsApi.error() ?? 'Unable to load products.');
              this.products.set([]);
            },
          });
        return;
      }

      this.productsApi
        .list({ limit, category })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.loading.set(false);
            this.products.set(data.items.map((item) => this.toPopularProduct(item)));
          },
          error: () => {
            this.loading.set(false);
            this.error.set(this.productsApi.error() ?? 'Unable to load products.');
            this.products.set([]);
          },
        });
    });
  }

  /** Featured-first for Popular; latest for New Arrivals; never return an empty rail when catalog has items. */
  private pickHomeRailItems(
    items: CatalogProduct[],
    limit: number,
    preferLatest: boolean,
  ): CatalogProduct[] {
    if (!items.length) return [];
    if (preferLatest) return items.slice(0, limit);

    const featured = items.filter((item) => item.isFeatured);
    return (featured.length > 0 ? featured : items).slice(0, limit);
  }

  toggleWishlist(product: PopularProduct, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.auth.isAuthenticated()) {
      this.auth.setReturnUrl(product.path);
      void this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: product.path },
      });
      return;
    }

    if (product.wishlist) {
      this.wishlistApi.getStatus(product.id).subscribe({
        next: (status) => {
          if (!status.wishlistItemId) return;
          this.wishlistApi.removeItem(status.wishlistItemId).subscribe({
            next: () => this.setWishlist(product.id, false),
          });
        },
      });
      return;
    }

    this.wishlistApi.addItem(product.id).subscribe({
      next: () => this.setWishlist(product.id, true),
    });
  }

  private setWishlist(productId: string, active: boolean): void {
    this.products.update((items) =>
      items.map((item) => (item.id === productId ? { ...item, wishlist: active } : item)),
    );
  }

  private toPopularProduct(product: CatalogProduct): PopularProduct {
    const sellingPrice = product.sellingPrice ?? product.price;
    const emiMonthly = product.emiStartingFrom != null ? product.emiStartingFrom : null;

    return {
      id: product.id,
      name: product.name,
      priceLabel: formatInr(sellingPrice),
      emiLabel:
        product.emiAvailable && emiMonthly != null
          ? `${formatInr(emiMonthly)} / month`
          : product.emiAvailable
            ? 'EMI available'
            : 'EMI not available',
      deliveryLabel:
        product.deliveryCharge > 0
          ? `Delivery ${formatInr(product.deliveryCharge)}`
          : 'Free Delivery',
      imageSrc: resolveMediaUrl(product.imageUrl || product.thumbnail),
      imageAlt: product.name,
      path: `/products/${product.slug || product.id}`,
      wishlist: false,
    };
  }
}
