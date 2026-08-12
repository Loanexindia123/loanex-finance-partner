import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';

export interface MasterRecord {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

function unwrapList(raw: unknown): MasterRecord[] {
  if (Array.isArray(raw)) return raw as MasterRecord[];
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items as MasterRecord[];
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private readonly http = inject(HttpClient);

  list(apiPath: string): Observable<MasterRecord[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl(apiPath))
      .pipe(unwrapApi(), map(unwrapList));
  }

  create(apiPath: string, payload: Record<string, unknown>): Observable<MasterRecord> {
    return this.http
      .post<ApiEnvelope<MasterRecord>>(apiUrl(apiPath), payload)
      .pipe(unwrapApi());
  }

  update(apiPath: string, id: string, payload: Record<string, unknown>): Observable<MasterRecord> {
    return this.http
      .put<ApiEnvelope<MasterRecord>>(apiUrl(`${apiPath}/${id}`), payload)
      .pipe(unwrapApi());
  }

  delete(apiPath: string, id: string): Observable<void> {
    return this.http.delete<ApiEnvelope<void>>(apiUrl(`${apiPath}/${id}`)).pipe(unwrapApi());
  }
}
