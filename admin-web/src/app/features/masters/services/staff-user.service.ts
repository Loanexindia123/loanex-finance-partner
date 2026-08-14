import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';

export interface StaffUser {
  id: string;
  name: string;
  code: string;
  email?: string;
  mobile?: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class StaffUserService {
  private readonly http = inject(HttpClient);

  /**
   * Staff members for Reporting Person / manager pickers.
   * Only admin portal accounts — never customers or generic "authenticated" app users.
   */
  listStaff(): Observable<StaffUser[]> {
    return this.http.get<ApiEnvelope<unknown>>(apiUrl('/admin/users')).pipe(
      unwrapApi(),
      map((raw) => {
        const rows = Array.isArray(raw) ? raw : [];
        return rows
          .map((row) => normalizeStaff(row))
          .filter((u) => isAdminStaff(u) && u.name);
      }),
    );
  }
}

function normalizeStaff(raw: unknown): StaffUser {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const profile =
    row['profile'] && typeof row['profile'] === 'object'
      ? (row['profile'] as Record<string, unknown>)
      : {};
  const name =
    String(profile['name'] ?? profile['fullName'] ?? row['name'] ?? row['email'] ?? row['mobile'] ?? '')
      .trim();
  const id = String(row['id'] ?? '').trim();
  return {
    id,
    name,
    code: pickEmployeeCode(row, profile, id),
    email: row['email'] == null ? undefined : String(row['email']),
    mobile: row['mobile'] == null ? undefined : String(row['mobile'] ?? row['phone']),
    role: row['role'] == null ? undefined : String(row['role']),
  };
}

/** Admin portal staff only — excludes customers and app-only authenticated users. */
function isAdminStaff(user: StaffUser): boolean {
  const role = String(user.role ?? '')
    .trim()
    .toLowerCase();
  return role === 'admin';
}

function pickEmployeeCode(
  row: Record<string, unknown>,
  profile: Record<string, unknown>,
  id: string,
): string {
  const keys = ['employeeCode', 'employee_code', 'agentId', 'staffCode', 'userCode', 'code'];
  for (const key of keys) {
    const fromProfile = profile[key];
    if (fromProfile != null && String(fromProfile).trim()) {
      return String(fromProfile).trim();
    }
    const fromRow = row[key];
    if (fromRow != null && String(fromRow).trim()) {
      return String(fromRow).trim();
    }
  }
  if (id) {
    const compact = id.replace(/-/g, '').slice(-8).toUpperCase();
    return compact ? `EMP-${compact}` : id;
  }
  return '';
}
