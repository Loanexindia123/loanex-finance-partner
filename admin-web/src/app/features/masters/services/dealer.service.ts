import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Dealer, DealerPayload, normalizeDealer } from '../models/dealer.models';

@Injectable({ providedIn: 'root' })
export class DealerService {
  private readonly http = inject(HttpClient);

  list(): Observable<Dealer[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/admin/dealers'))
      .pipe(unwrapApi(), map(unwrapDealerList));
  }

  getById(id: string): Observable<Dealer> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl(`/admin/dealers/${id}`))
      .pipe(unwrapApi(), map((raw) => normalizeDealer(raw)));
  }

  create(payload: DealerPayload): Observable<Dealer> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl('/admin/dealers'), payload)
      .pipe(unwrapApi(), map((raw) => normalizeDealer(raw)));
  }

  update(id: string, payload: DealerPayload): Observable<Dealer> {
    return this.http
      .put<ApiEnvelope<unknown>>(apiUrl(`/admin/dealers/${id}`), payload)
      .pipe(unwrapApi(), map((raw) => normalizeDealer(raw)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ApiEnvelope<void>>(apiUrl(`/admin/dealers/${id}`))
      .pipe(unwrapApi());
  }
}

function unwrapDealerList(raw: unknown): Dealer[] {
  if (Array.isArray(raw)) return raw.map(normalizeDealer);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeDealer);
  }
  return [];
}
