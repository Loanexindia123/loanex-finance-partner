import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import {
  Category,
  Product,
  ProductListPage,
  ProductPayload,
  ProductQueryParams,
} from '../models/product.models';

interface RawProductList {
  items?: Product[];
  products?: Product[];
  pagination?: { page?: number; limit?: number; total?: number };
  total?: number;
}

function toProductPage(data: Product[] | RawProductList | null | undefined): ProductListPage {
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  const items = data?.items ?? data?.products ?? [];
  const total = data?.pagination?.total ?? data?.total ?? items.length;
  return {
    items,
    total,
    page: data?.pagination?.page,
    limit: data?.pagination?.limit,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  listWithMeta(query: ProductQueryParams = {}): Observable<ProductListPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<ApiEnvelope<Product[] | RawProductList>>(apiUrl('/products'), { params })
      .pipe(unwrapApi(), map(toProductPage));
  }

  list(query: ProductQueryParams = {}): Observable<Product[]> {
    return this.listWithMeta(query).pipe(map((page) => page.items));
  }

  getById(productId: string): Observable<Product> {
    return this.http
      .get<ApiEnvelope<Product>>(apiUrl(`/products/${productId}`))
      .pipe(unwrapApi());
  }

  create(payload: ProductPayload): Observable<Product> {
    return this.http.post<ApiEnvelope<Product>>(apiUrl('/products'), payload).pipe(unwrapApi());
  }

  update(productId: string, payload: ProductPayload | Partial<ProductPayload>): Observable<Product> {
    return this.http
      .put<ApiEnvelope<Product>>(apiUrl(`/products/${productId}`), payload)
      .pipe(unwrapApi());
  }

  /** Approve a pending product for customer visibility (status → active). */
  approve(productId: string): Observable<Product> {
    return this.update(productId, { status: 'active' });
  }

  /** Reject a pending product (status → rejected). Remains hidden from customers. */
  reject(productId: string): Observable<Product> {
    return this.update(productId, { status: 'rejected' });
  }

  delete(productId: string): Observable<void> {
    return this.http
      .delete<ApiEnvelope<void>>(apiUrl(`/products/${productId}`))
      .pipe(unwrapApi());
  }

  categories(): Observable<Category[]> {
    return this.http
      .get<ApiEnvelope<Category[]>>(apiUrl('/categories'))
      .pipe(unwrapApi());
  }

  uploadImage(file: File): Observable<{ id: string; url: string; fileName: string }> {
    const body = new FormData();
    body.append('image', file, file.name);
    return this.http
      .post<ApiEnvelope<{ id: string; url: string; fileName: string }>>(
        apiUrl('/products/images'),
        body,
      )
      .pipe(unwrapApi());
  }
}
