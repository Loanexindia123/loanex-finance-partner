import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import {
  FreelancerAgent,
  FreelancerAgentPayload,
  FreelancerCreatorType,
  normalizeFreelancerAgent,
} from '../models/freelancer-agent.models';

export interface FreelancerCreatorOption {
  id: string;
  name: string;
  code: string;
  email: string;
  mobile: string;
  extra: string;
  isCurrentUser: boolean;
}

@Injectable({ providedIn: 'root' })
export class FreelancerAgentService {
  private readonly http = inject(HttpClient);

  list(): Observable<FreelancerAgent[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/admin/freelancer-agents'))
      .pipe(unwrapApi(), map(unwrapList));
  }

  listCreators(type: FreelancerCreatorType): Observable<FreelancerCreatorOption[]> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl('/admin/freelancer-agents/creators'), {
        params: { type },
      })
      .pipe(unwrapApi(), map(unwrapCreators));
  }

  getById(id: string): Observable<FreelancerAgent> {
    return this.http
      .get<ApiEnvelope<unknown>>(apiUrl(`/admin/freelancer-agents/${id}`))
      .pipe(unwrapApi(), map((raw) => normalizeFreelancerAgent(raw)));
  }

  create(payload: FreelancerAgentPayload): Observable<FreelancerAgent> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl('/admin/freelancer-agents'), payload)
      .pipe(unwrapApi(), map((raw) => normalizeFreelancerAgent(raw)));
  }

  update(id: string, payload: FreelancerAgentPayload): Observable<FreelancerAgent> {
    return this.http
      .put<ApiEnvelope<unknown>>(apiUrl(`/admin/freelancer-agents/${id}`), payload)
      .pipe(unwrapApi(), map((raw) => normalizeFreelancerAgent(raw)));
  }

  approve(id: string): Observable<FreelancerAgent> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl(`/admin/freelancer-agents/${id}/approve`), {})
      .pipe(unwrapApi(), map((raw) => normalizeFreelancerAgent(raw)));
  }

  reject(id: string, reason = ''): Observable<FreelancerAgent> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl(`/admin/freelancer-agents/${id}/reject`), { reason })
      .pipe(unwrapApi(), map((raw) => normalizeFreelancerAgent(raw)));
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete<ApiEnvelope<void>>(apiUrl(`/admin/freelancer-agents/${id}`))
      .pipe(unwrapApi());
  }
}

function unwrapList(raw: unknown): FreelancerAgent[] {
  if (Array.isArray(raw)) return raw.map(normalizeFreelancerAgent);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeFreelancerAgent);
  }
  return [];
}

function unwrapCreators(raw: unknown): FreelancerCreatorOption[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return {
        id: String(rec['id'] ?? '').trim(),
        name: String(rec['name'] ?? '').trim(),
        code: String(rec['code'] ?? '').trim(),
        email: String(rec['email'] ?? '').trim(),
        mobile: String(rec['mobile'] ?? '').trim(),
        extra: String(rec['extra'] ?? '').trim(),
        isCurrentUser: rec['isCurrentUser'] === true,
      };
    })
    .filter((row) => row.id && row.name);
}
