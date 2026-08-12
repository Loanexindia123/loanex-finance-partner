import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Banner, normalizeBanner } from '../models/banner.models';

@Injectable({ providedIn: 'root' })
export class BannerService {
  private readonly http = inject(HttpClient);

  list(): Observable<Banner[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/banners/manage'))
      .pipe(unwrapApi(), map(unwrapBannerList));
  }

  create(payload: Record<string, unknown>): Observable<Banner> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl('/banners'), payload)
      .pipe(unwrapApi(), map(normalizeBanner));
  }

  update(id: string, payload: Record<string, unknown>): Observable<Banner> {
    return this.http
      .put<ApiEnvelope<unknown>>(apiUrl(`/banners/${id}`), payload)
      .pipe(unwrapApi(), map(normalizeBanner));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiEnvelope<void>>(apiUrl(`/banners/${id}`)).pipe(unwrapApi());
  }
}

function unwrapBannerList(raw: unknown): Banner[] {
  if (Array.isArray(raw)) return raw.map(normalizeBanner);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeBanner);
  }
  return [];
}
