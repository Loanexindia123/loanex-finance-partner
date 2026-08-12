import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { AutopayForLoan } from '../models/autopay.models';

/** eMandate — backed by /admin/autopay/:loanId (see backend autopay module). */
@Injectable({ providedIn: 'root' })
export class AutopayService {
  private readonly http = inject(HttpClient);

  getForLoan(loanId: string): Observable<AutopayForLoan | null> {
    return this.http
      .get<ApiEnvelope<AutopayForLoan>>(apiUrl(`/admin/autopay/${loanId}`))
      .pipe(
        unwrapApi(),
        catchError(() => of(null)),
      );
  }
}
