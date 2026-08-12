import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Branch, BranchPayload } from '../models/branch.models';

/**
 * Backend has no GET /admin/branches/:id (branches are registered through
 * the generic master-data loop, which only exposes list/create/update/delete).
 * "View by id" is therefore a client-side lookup over the cached list.
 */
@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);

  list(): Observable<Branch[]> {
    return this.http.get<ApiEnvelope<Branch[]>>(apiUrl('/admin/branches')).pipe(unwrapApi());
  }

  getById(branchId: string): Observable<Branch | undefined> {
    return this.list().pipe(map((branches) => branches.find((b) => b.id === branchId)));
  }

  create(payload: BranchPayload): Observable<Branch> {
    return this.http
      .post<ApiEnvelope<Branch>>(apiUrl('/admin/branches'), payload)
      .pipe(unwrapApi());
  }

  update(branchId: string, payload: BranchPayload): Observable<Branch> {
    return this.http
      .put<ApiEnvelope<Branch>>(apiUrl(`/admin/branches/${branchId}`), payload)
      .pipe(unwrapApi());
  }

  delete(branchId: string): Observable<void> {
    return this.http
      .delete<ApiEnvelope<void>>(apiUrl(`/admin/branches/${branchId}`))
      .pipe(unwrapApi());
  }
}