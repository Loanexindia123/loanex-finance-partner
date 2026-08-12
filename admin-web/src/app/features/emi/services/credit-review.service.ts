import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { CreditReview } from '../models/credit-review.models';

export type CreditReviewSavePayload = Partial<Omit<CreditReview, 'applicationId'>>;

/** Credit review — backed by MongoDB via /admin/credit-reviews/:applicationId. */
@Injectable({ providedIn: 'root' })
export class CreditReviewService {
  private readonly http = inject(HttpClient);

  getByApplicationId(applicationId: string): Observable<CreditReview | null> {
    return this.http
      .get<ApiEnvelope<CreditReview>>(apiUrl(`/admin/credit-reviews/${applicationId}`))
      .pipe(
        unwrapApi(),
        catchError(() => of(null)),
      );
  }

  /** Creates the record on first save, updates it afterwards (upsert). */
  save(applicationId: string, patch: CreditReviewSavePayload): Observable<CreditReview> {
    return this.http
      .patch<ApiEnvelope<CreditReview>>(apiUrl(`/admin/credit-reviews/${applicationId}`), patch)
      .pipe(unwrapApi());
  }
}
