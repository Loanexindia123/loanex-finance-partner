import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductCardComponent } from '../../../../shared/components/product-card/product-card';
import { ProductCardItem } from '../../../../shared/models/product-card.model';
import { formatInr } from '../../../../shared/utils/currency';
import { ProductListResponse, ProductsApiService } from '../../services/products-api.service';
import { ShopCatalogCacheService } from '../../services/shop-catalog-cache.service';
import { toProductCardItem } from '../../utils/map-catalog-product-card';

type AvailabilityFilter = 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK';
type SortOption = 'latest' | 'price_asc' | 'price_desc' | 'name';

@Component({
  selector: 'app-product-catalog',
  imports: [ReactiveFormsModule, ProductCardComponent],
  templateUrl: './product-catalog.html',
  styleUrl: './product-catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCatalogComponent implements OnInit {
  private readonly productsApi = inject(ProductsApiService);
  private readonly catalogCache = inject(ShopCatalogCacheService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly formatInr = formatInr;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly catalog = signal<ProductListResponse | null>(null);
  readonly cardItems = signal<ProductCardItem[]>([]);
  /** Active category from the shareable URL query param. */
  readonly activeCategory = signal('');

  readonly pageTitle = computed(() => {
    const category = this.activeCategory().trim();
    return category ? category : 'Shop';
  });

  readonly pageSubtitle = computed(() => {
    const category = this.activeCategory().trim();
    return category
      ? `Showing products in “${category}”.`
      : 'Browse products with flexible EMI and easy checkout.';
  });

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    brand: [''],
    category: [''],
    minPrice: [''],
    maxPrice: [''],
    availability: ['ALL' as AvailabilityFilter],
    emiAvailable: [false],
    sort: ['latest' as SortOption],
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const category = params.get('category') ?? '';
      this.activeCategory.set(category);
      this.filterForm.patchValue(
        {
          search: params.get('q') ?? params.get('search') ?? '',
          brand: params.get('brand') ?? '',
          category,
          minPrice: params.get('minPrice') ?? '',
          maxPrice: params.get('maxPrice') ?? '',
          availability: (params.get('availability') as AvailabilityFilter) || 'ALL',
          emiAvailable: params.get('emiAvailable') === 'true',
          sort: (params.get('sort') as SortOption) || 'latest',
        },
        { emitEvent: false },
      );

      this.loadCatalog(Number(params.get('page') ?? 1));
    });

    this.filterForm.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
  }

  applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildQueryParams(1),
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      search: '',
      brand: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      availability: 'ALL',
      emiAvailable: false,
      sort: 'latest',
    });
    void this.router.navigate(['/products']);
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildQueryParams(page),
    });
  }

  private buildQueryParams(page: number): Record<string, string | number | boolean | null> {
    const value = this.filterForm.getRawValue();
    return {
      q: value.search.trim() || null,
      brand: value.brand || null,
      category: value.category || null,
      minPrice: value.minPrice ? Number(value.minPrice) : null,
      maxPrice: value.maxPrice ? Number(value.maxPrice) : null,
      availability: value.availability === 'ALL' ? null : value.availability,
      emiAvailable: value.emiAvailable ? true : null,
      sort: value.sort === 'latest' ? null : value.sort,
      page,
    };
  }

  onWishlistToggle(_product: ProductCardItem): void {
    // Wishlist toggle handled on PDP; catalog cards are browse-only.
  }

  private loadCatalog(page: number, options?: { force?: boolean }): void {
    const value = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    const params: Record<string, string | number | boolean | undefined> = {
      search: value.search.trim() || undefined,
      brand: value.brand || undefined,
      category: value.category || undefined,
      minPrice: value.minPrice ? Number(value.minPrice) : undefined,
      maxPrice: value.maxPrice ? Number(value.maxPrice) : undefined,
      availability: value.availability,
      emiAvailable: value.emiAvailable || undefined,
      sort: value.sort,
      page,
      limit: 12,
    };

    this.catalogCache.list(params, { force: options?.force === true }).subscribe({
      next: (data) => {
        this.loading.set(false);
        this.catalog.set(data);
        this.cardItems.set(data.items.map((item) => toProductCardItem(item)));
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.productsApi.error() ?? 'Unable to load products.');
      },
    });
  }
}
