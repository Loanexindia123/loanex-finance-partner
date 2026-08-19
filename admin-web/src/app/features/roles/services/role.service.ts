import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Role, RoleUpdatePayload } from '../models/role.models';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);

  list(): Observable<Role[]> {
    return this.http.get<ApiEnvelope<Role[]>>(apiUrl('/admin/roles')).pipe(unwrapApi());
  }

  updatePermissions(roleId: string, payload: RoleUpdatePayload): Observable<Role> {
    return this.http
      .patch<ApiEnvelope<Role>>(apiUrl(`/admin/roles/${roleId}`), payload)
      .pipe(unwrapApi());
  }
}