import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { LoanDetail, LoanListItem, LoanPaymentRow } from '../models/loan.models';

interface RawEmiPaymentsPayload {
  total?: number;
  items?: LoanPaymentRow[];
}

interface RawLoanListPayload {
  total?: number;
  items?: LoanListItem[];
}

@Injectable({ providedIn: 'root' })
export class LoanService {
  private readonly http = inject(HttpClient);

  list(status?: 'ACTIVE' | 'CLOSED'): Observable<LoanListItem[]> {
    const query = status ? `?status=${status}` : '';
    return this.http
      .get<ApiEnvelope<RawLoanListPayload>>(apiUrl(`/admin/loans${query}`))
      .pipe(
        unwrapApi(),
        map((payload) => payload.items ?? []),
      );
  }

  getById(loanId: string): Observable<LoanDetail> {
    return this.http
      .get<ApiEnvelope<LoanDetail>>(apiUrl(`/admin/loans/${loanId}`))
      .pipe(unwrapApi());
  }

  listPayments(loanId: string): Observable<LoanPaymentRow[]> {
    return this.http
      .get<ApiEnvelope<RawEmiPaymentsPayload>>(apiUrl(`/admin/emi-payments?loanId=${loanId}`))
      .pipe(
        unwrapApi(),
        map((payload) => payload.items ?? []),
      );
  }
}
