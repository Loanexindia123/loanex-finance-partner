import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { CreateUserPayload, StaffUser } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  /** GET /admin/users returns customers + staff together — filter to staff only. */
  listStaff(): Observable<StaffUser[]> {
    return this.http
      .get<ApiEnvelope<StaffUser[]>>(apiUrl('/admin/users'))
      .pipe(
        unwrapApi(),
        map((users) => users.filter((u) => u.role === 'admin')),
      );
  }

  /**
   * Calls the existing POST /admin/users endpoint. Confirmed against backend
   * source (admin.controller.ts resolveRoleAssignment) that a `role` string
   * matching a seeded role name — e.g. "Sales Executive" — is looked up
   * against the roles collection and assigned correctly. No backend change
   * was needed or made for this to work.
   */
  createUser(payload: CreateUserPayload): Observable<StaffUser> {
    return this.http
      .post<ApiEnvelope<StaffUser>>(apiUrl('/admin/users'), payload)
      .pipe(unwrapApi());
  }

  setBlocked(userId: string, blocked: boolean): Observable<StaffUser> {
    return this.http
      .patch<ApiEnvelope<StaffUser>>(apiUrl(`/admin/users/${userId}`), { blocked })
      .pipe(unwrapApi());
  }
}