import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { mapFiCase } from '../../emi/services/emi-application.service';
import { FiCase, FiCaseStatus } from '../../emi/models/fi-case.models';

export interface UpdateFiCasePayload {
  status?: FiCaseStatus;
  remarks?: string;
  gpsLocation?: string;
}

interface ListedPayload {
  items?: unknown[];
}

function extractList<T>(data: T[] | ListedPayload | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  return (data?.items as T[] | undefined) ?? [];
}

@Injectable({ providedIn: 'root' })
export class FiCaseService {
  private readonly http = inject(HttpClient);

  list(): Observable<FiCase[]> {
    return this.http.get<ApiEnvelope<Record<string, unknown>[] | ListedPayload>>(apiUrl('/admin/fi-cases')).pipe(
      unwrapApi(),
      map((payload) =>
        extractList<Record<string, unknown>>(payload).map((raw) =>
          mapFiCase(raw as Parameters<typeof mapFiCase>[0]),
        ),
      ),
    );
  }

  getById(fiCaseId: string): Observable<FiCase> {
    return this.http
      .get<ApiEnvelope<Record<string, unknown>>>(apiUrl(`/admin/fi-cases/${fiCaseId}`))
      .pipe(
        unwrapApi(),
        map((raw) => mapFiCase(raw as Parameters<typeof mapFiCase>[0])),
      );
  }

  update(fiCaseId: string, payload: UpdateFiCasePayload): Observable<FiCase> {
    return this.http
      .patch<ApiEnvelope<Record<string, unknown>>>(apiUrl(`/admin/fi-cases/${fiCaseId}`), payload)
      .pipe(
        unwrapApi(),
        map((raw) => mapFiCase(raw as Parameters<typeof mapFiCase>[0])),
      );
  }
}
