import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { CategoryRecord, normalizeCategory } from '../models/category.models';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);

  list(): Observable<CategoryRecord[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/categories'))
      .pipe(unwrapApi(), map((raw) => unwrapCategoryList(raw)));
  }

  create(payload: Record<string, unknown>): Observable<CategoryRecord> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl('/categories'), payload)
      .pipe(unwrapApi(), map(normalizeCategory));
  }

  update(id: string, payload: Record<string, unknown>): Observable<CategoryRecord> {
    return this.http
      .put<ApiEnvelope<unknown>>(apiUrl(`/categories/${id}`), payload)
      .pipe(unwrapApi(), map(normalizeCategory));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiEnvelope<void>>(apiUrl(`/categories/${id}`)).pipe(unwrapApi());
  }
}

function unwrapCategoryList(raw: unknown): CategoryRecord[] {
  if (Array.isArray(raw)) return raw.map(normalizeCategory);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeCategory);
  }
  return [];
}
