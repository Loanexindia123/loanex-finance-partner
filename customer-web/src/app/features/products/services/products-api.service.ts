import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { withResolvedProductImages } from '../../../shared/utils/media-url';
import {
  BreadcrumbTrailItem,
  ProductColorOption,
  ProductImage,
  ProductKeySpec,
  ProductQaItem,
  ProductSpecRow,
  ProductVariantOption,
  ProductVariantSku,
  VariantAttributeGroup,
} from '../models/product-details.models';

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  description: string;
  shortDescription: string;
  price: number;
  discountPrice: number | null;
  sellingPrice: number;
  mrp: number;
  discount: number;
  stock: number;
  stockQuantity: number;
  stockStatus: import('../models/product-details.models').ProductStockStatus;
  inStock: boolean;
  sku: string;
  thumbnail: string;
  imageUrl: string;
  images: string[];
  specifications: unknown;
  emiAvailable: boolean;
  emiStartingFrom: number | null;
  rating: number;
  totalReviews: number;
  averageRating: number;
  reviewCount: number;
  isFeatured: boolean;
  isActive: boolean;
  variant: string | null;
  deliveryCharge: number;
  createdAt: string;
}

export interface ProductDetail extends CatalogProduct {
  imagesGallery: ProductImage[];
  categoryLabel: string;
  subcategoryLabel: string;
  overviewTitle: string;
  overviewBody: string;
  overviewHighlights: string[];
  keySpecs: ProductKeySpec[];
  specificationRows: ProductSpecRow[];
  colors: ProductColorOption[];
  variants: ProductVariantOption[];
  attributeGroups: VariantAttributeGroup[];
  productVariants: ProductVariantSku[];
  selectedVariantId: string | null;
  selectedVariant: ProductVariantSku | null;
  warrantyLabel: string;
  returnsPolicy: string[];
  questions: ProductQaItem[];
  breadcrumbs: BreadcrumbTrailItem[];
  emiPlans?: import('../models/product-details.models').ProductEmiPlan[];
  warranty?: string;
  boxContents?: Array<string | { id?: string; value?: string }>;
  features?: Array<string | { id?: string; value?: string }>;
  deliveryCharges?: number;
  deliveryDays?: number;
  replacementDays?: number;
  /** Raw admin wizard payload — used when top-level fields are empty. */
  wizardData?: {
    emiPlans?: Array<{
      id?: string;
      months?: number | string;
      enabled?: boolean;
      planName?: string;
      downPayment?: number | string;
      serviceCharge?: number | string;
      deliveryCharge?: number | string;
      minEligibilityAmount?: number | string;
      customerVisibility?: string;
      isRecommended?: boolean;
    }>;
    emiEnabled?: boolean;
    warranty?: string;
    shortDescription?: string;
    specifications?: Array<{ id?: string; key?: string; value?: string }>;
    features?: Array<{ id?: string; value?: string }>;
    boxContents?: Array<{ id?: string; value?: string }>;
    deliveryCharges?: number | string;
    deliveryDays?: number | string;
    replacementDays?: number | string;
    subCategory?: string;
    childCategory?: string;
  };
}

export interface ProductListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListFilters {
  brands: string[];
  categories: string[];
}

export interface ProductListResponse {
  items: CatalogProduct[];
  pagination: ProductListPagination;
  filters: ProductListFilters;
}

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/products`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  list(params: Record<string, string | number | boolean | undefined>): Observable<ProductListResponse> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return this.wrap(
      this.http.get<ApiSuccess<ProductListResponse>>(this.baseUrl, { params: httpParams }),
    ).pipe(
      map((data) => ({
        ...data,
        items: (data.items ?? []).map(
          (item) =>
            withResolvedProductImages(item as unknown as Record<string, unknown>) as unknown as CatalogProduct,
        ),
      })),
    );
  }

  getById(id: string): Observable<ProductDetail> {
    if (!id?.trim()) {
      this.errorSignal.set('Invalid product ID.');
      return throwError(() => new Error('Invalid product ID'));
    }

    return this.wrap(this.http.get<ApiSuccess<ProductDetail>>(`${this.baseUrl}/${id}`)).pipe(
      map(
        (detail) =>
          withResolvedProductImages(
            detail as unknown as Record<string, unknown>,
          ) as unknown as ProductDetail,
      ),
    );
  }

  getBySlug(slug: string): Observable<ProductDetail> {
    if (!slug?.trim()) {
      this.errorSignal.set('Invalid product slug.');
      return throwError(() => new Error('Invalid product slug'));
    }

    return this.wrap(
      this.http.get<ApiSuccess<ProductDetail>>(`${this.baseUrl}/slug/${slug}`),
    ).pipe(
      map(
        (detail) =>
          withResolvedProductImages(
            detail as unknown as Record<string, unknown>,
          ) as unknown as ProductDetail,
      ),
    );
  }

  clearError(): void {
    this.errorSignal.set(null);
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
    return 'Unable to load products.';
  }
}
