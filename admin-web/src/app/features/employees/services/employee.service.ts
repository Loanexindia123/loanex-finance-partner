import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Employee, EmployeePayload, normalizeEmployee } from '../models/employee.models';

export interface EmployeeOnboarder {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  mobile: string;
  designation: string;
  department: string;
  isCurrentUser: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);

  list(): Observable<Employee[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/admin/employees'))
      .pipe(unwrapApi(), map(unwrapEmployeeList));
  }

  /** Eligible Onboarded By people from Employee Master (hierarchy-scoped). */
  listOnboarders(): Observable<EmployeeOnboarder[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/admin/employees/onboarders'))
      .pipe(unwrapApi(), map(unwrapOnboarders));
  }

  getById(id: string): Observable<Employee> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl(`/admin/employees/${id}`))
      .pipe(unwrapApi(), map((raw) => normalizeEmployee(raw)));
  }

  create(payload: EmployeePayload): Observable<Employee> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl('/admin/employees'), payload)
      .pipe(unwrapApi(), map((raw) => normalizeEmployee(raw)));
  }

  update(id: string, payload: EmployeePayload): Observable<Employee> {
    return this.http
      .put<ApiEnvelope<unknown>>(apiUrl(`/admin/employees/${id}`), payload)
      .pipe(unwrapApi(), map((raw) => normalizeEmployee(raw)));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiEnvelope<void>>(apiUrl(`/admin/employees/${id}`)).pipe(unwrapApi());
  }
}

function unwrapEmployeeList(raw: unknown): Employee[] {
  if (Array.isArray(raw)) return raw.map(normalizeEmployee);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeEmployee);
  }
  return [];
}

function unwrapOnboarders(raw: unknown): EmployeeOnboarder[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return {
        id: String(rec['id'] ?? '').trim(),
        name: String(rec['name'] ?? '').trim(),
        employeeId: String(rec['employeeId'] ?? '').trim(),
        email: String(rec['email'] ?? '').trim(),
        mobile: String(rec['mobile'] ?? '').trim(),
        designation: String(rec['designation'] ?? '').trim(),
        department: String(rec['department'] ?? '').trim(),
        isCurrentUser: rec['isCurrentUser'] === true,
      };
    })
    .filter((o) => o.id && o.name);
}
