import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { AdminUserRecord, Customer, KycRecord } from '../models/customer.models';

/**
 * Backend has no GET /admin/users/:id — every "single customer" lookup is a
 * client-side filter over the full list, mirroring admin-app's customerService.
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  list(): Observable<Customer[]> {
    return forkJoin({
      users: this.http
        .get<ApiEnvelope<AdminUserRecord[]>>(apiUrl('/admin/users'))
        .pipe(unwrapApi()),
      kyc: this.http.get<ApiEnvelope<KycRecord[]>>(apiUrl('/admin/kyc')).pipe(unwrapApi()),
    }).pipe(
      map(({ users, kyc }) =>
        users
          .filter((u) => u.role === 'customer')
          .map((u) => ({ ...u, kyc: kyc.find((k) => k.userId === u.id) ?? null })),
      ),
    );
  }

  getById(userId: string): Observable<Customer | undefined> {
    return this.list().pipe(map((customers) => customers.find((c) => c.id === userId)));
  }
}
