import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';

export interface AutopayMandate {
  id: string;
  provider: string;
  mandateId: string;
  mandateReference: string;
  paymentMethod: string;
  bankName: string | null;
  upiId: string | null;
  maximumDebitAmount: number;
  frequency: string;
  nextDebitDate: string | null;
  status: string;
  failureReason: string | null;
  /** Customer-facing URL to approve a pending mandate (Razorpay payment link). */
  approvalUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  message?: string;
}

export interface AutopayStatus {
  loan: {
    id: string;
    loanAccountNumber: string;
    applicationNumber: string;
    emiAmount: number;
    nextEmiDueDate: string | null;
    loanStatus: string;
    autopayEnabled: boolean;
  };
  autopayStatus: string;
  mandate: AutopayMandate | null;
  options: Array<{ code: string; label: string }>;
  canEnable: boolean;
  canDisable: boolean;
}

export interface AutopayHistoryResponse {
  total: number;
  items: Array<AutopayMandate & { loanAccountNumber: string; applicationNumber: string | null }>;
}

@Injectable({ providedIn: 'root' })
export class AutopayService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/autopay`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  getStatus(): Observable<AutopayStatus> {
    return this.wrap(this.http.get<ApiSuccess<AutopayStatus>>(`${this.baseUrl}/status`));
  }

  createMandate(payload: {
    paymentMethod: string;
    bankName?: string;
    upiId?: string;
    maximumDebitAmount?: number;
  }): Observable<AutopayMandate> {
    return this.wrap(
      this.http.post<ApiSuccess<AutopayMandate>>(`${this.baseUrl}/create-mandate`, payload),
    );
  }

  /** Bank-account eMandate via existing Autopay API (no UPI ID). */
  createEmandate(payload?: {
    bankName?: string;
    maximumDebitAmount?: number;
  }): Observable<AutopayMandate> {
    return this.createMandate({
      paymentMethod: 'EMANDATE',
      bankName: payload?.bankName,
      maximumDebitAmount: payload?.maximumDebitAmount,
    });
  }

  cancelMandate(): Observable<AutopayMandate> {
    return this.wrap(
      this.http.post<ApiSuccess<AutopayMandate>>(`${this.baseUrl}/cancel-mandate`, {}),
    );
  }

  getHistory(): Observable<AutopayHistoryResponse> {
    return this.wrap(this.http.get<ApiSuccess<AutopayHistoryResponse>>(`${this.baseUrl}/history`));
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private wrap<T>(source: Observable<ApiSuccess<T>>): Observable<T> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return source.pipe(
      map((res) => res.data),
      tap(() => this.loadingSignal.set(false)),
      catchError((err: unknown) => {
        this.loadingSignal.set(false);
        this.errorSignal.set(this.extractError(err));
        return throwError(() => err);
      }),
    );
  }

  private extractError(err: unknown): string {
    const httpErr = err as { error?: { message?: string }; message?: string; status?: number };
    if (httpErr?.status === 401) return 'Please sign in again to manage AutoPay.';
    if (httpErr?.status === 409) {
      return httpErr?.error?.message || 'An AutoPay mandate already exists for this loan.';
    }
    if (httpErr?.status === 404) {
      return httpErr?.error?.message || 'AutoPay details not found.';
    }
    return httpErr?.error?.message || httpErr?.message || 'Something went wrong. Please try again.';
  }
}
