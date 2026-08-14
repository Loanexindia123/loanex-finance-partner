import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { TokenService } from '../../../core/services/token.service';
import {
  AadhaarVerificationStatus,
  BankVerificationStatusResponse,
  MobileVerificationStatus,
  PanVerificationStatusResponse,
  SendAadhaarOtpResponse,
  SendMobileOtpResponse,
  VerificationStatusResponse,
  VerificationStepCard,
  VerifyAadhaarResponse,
  VerifyBankResponse,
  VerifyMobileOtpResponse,
  VerifyPanResponse,
} from '../models/verification.models';

@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/verification`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly statusSignal = signal<VerificationStatusResponse | null>(null);
  private readonly mobileStatusSignal = signal<MobileVerificationStatus | null>(null);
  private readonly mobileVerifiedSignal = signal(false);
  private readonly aadhaarStatusSignal = signal<AadhaarVerificationStatus | null>(null);
  private readonly aadhaarVerifiedSignal = signal(false);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly mobileStatus = this.mobileStatusSignal.asReadonly();
  readonly mobileVerified = this.mobileVerifiedSignal.asReadonly();
  readonly aadhaarStatus = this.aadhaarStatusSignal.asReadonly();
  readonly aadhaarVerified = this.aadhaarVerifiedSignal.asReadonly();

  getStatus(): Observable<VerificationStatusResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .get<ApiSuccess<VerificationStatusResponse>>(`${this.baseUrl}/status`)
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.statusSignal.set(data);
          this.mobileVerifiedSignal.set(data.mobileVerified);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  getMobileStatus(): Observable<MobileVerificationStatus> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .get<ApiSuccess<MobileVerificationStatus>>(`${this.baseUrl}/mobile/status`)
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.mobileStatusSignal.set(data);
          this.mobileVerifiedSignal.set(data.mobileVerified);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  sendMobileOtp(payload?: { mobile?: string }): Observable<SendMobileOtpResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<ApiSuccess<SendMobileOtpResponse>>(`${this.baseUrl}/mobile/send-otp`, payload ?? {})
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.mobileVerifiedSignal.set(data.mobileVerified);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  verifyMobileOtp(payload: { otp: string; mobile?: string }): Observable<VerifyMobileOtpResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<ApiSuccess<VerifyMobileOtpResponse>>(`${this.baseUrl}/mobile/verify-otp`, payload)
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.mobileVerifiedSignal.set(true);
          this.tokens.setUser(data.user);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  getAadhaarStatus(): Observable<AadhaarVerificationStatus> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .get<ApiSuccess<AadhaarVerificationStatus>>(`${this.baseUrl}/aadhaar/status`)
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.aadhaarStatusSignal.set(data);
          this.aadhaarVerifiedSignal.set(data.aadhaarVerified);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  sendAadhaarOtp(payload: { aadhaarNumber: string }): Observable<SendAadhaarOtpResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<ApiSuccess<SendAadhaarOtpResponse>>(`${this.baseUrl}/aadhaar/send-otp`, payload)
      .pipe(
        map((res) => res.data),
        tap((data) => {
          this.aadhaarVerifiedSignal.set(data.aadhaarVerified);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  verifyAadhaar(payload: { otp: string }): Observable<VerifyAadhaarResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<ApiSuccess<VerifyAadhaarResponse>>(`${this.baseUrl}/aadhaar/verify`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.aadhaarVerifiedSignal.set(true);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  digilockerGenerate(aadhaarNumber?: string): Observable<{ client_id: string; digilocker_url: string | null; message: string }> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    const frontendOrigin =
      typeof window !== 'undefined' ? window.location.origin : undefined;
    return this.http
      .post<ApiSuccess<{ client_id: string; digilocker_url: string | null; message: string }>>(
        `${this.baseUrl}/aadhaar/digilocker/generate`,
        { aadhaar_number: aadhaarNumber ?? '', frontendOrigin },
      )
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  digilockerFetch(clientId: string): Observable<{
    verified: boolean; name: string; gender: string; dob: string;
    masked_aadhaar: string; father_name: string; address: Record<string, string>;
    profile_image: string; message: string;
  }> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    return this.http
      .post<ApiSuccess<any>>(`${this.baseUrl}/aadhaar/digilocker/fetch`, { client_id: clientId })
      .pipe(
        map((res) => res.data),
        tap((data) => {
          if (data?.verified) this.aadhaarVerifiedSignal.set(true);
          this.loadingSignal.set(false);
        }),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  getPanStatus(): Observable<PanVerificationStatusResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .get<ApiSuccess<PanVerificationStatusResponse>>(`${this.baseUrl}/pan/status`)
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  verifyPan(payload: {
    panNumber: string;
    fullName: string;
    dateOfBirth: string;
  }): Observable<VerifyPanResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<{
        success: true;
        message: string;
        status: 'VERIFIED';
        data: VerifyPanResponse;
      }>(`${this.baseUrl}/pan/verify`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  verifyPanAndCredit(payload: { pan: string }): Observable<any> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<ApiSuccess<any>>(`${this.baseUrl}/pan/experian-credit-report`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  verifyFace(payload: { capturedImage: string }): Observable<any> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<ApiSuccess<any>>(`${this.baseUrl}/face-match`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  getBankStatus(): Observable<BankVerificationStatusResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .get<ApiSuccess<BankVerificationStatusResponse>>(`${this.baseUrl}/bank/status`)
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  verifyBank(payload: {
    accountHolderName: string;
    bankName: string;
    accountNumber: string;
    confirmAccountNumber: string;
    ifscCode: string;
    accountType: 'SAVINGS' | 'CURRENT';
  }): Observable<VerifyBankResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http
      .post<{
        success: true;
        message: string;
        status: 'VERIFIED';
        data: VerifyBankResponse;
      }>(`${this.baseUrl}/bank/verify`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => this.loadingSignal.set(false)),
        catchError((err: unknown) => {
          this.loadingSignal.set(false);
          this.errorSignal.set(this.extractError(err));
          return throwError(() => err);
        }),
      );
  }

  // --- Bank Statement PDF (temporarily disabled — IDSPay not authorized) ---
  // uploadBankStatement(file: File): Observable<VerifyBankResponse> { ... }
  // uploadBankStatementWithProgress(file, onProgress): Observable<VerifyBankResponse> { ... }
  // fetchBankStatement(clientId: string): Observable<VerifyBankResponse> { ... }

  clearError(): void {
    this.errorSignal.set(null);
  }

  buildStepCards(status: VerificationStatusResponse): VerificationStepCard[] {
    return [
      {
        key: 'mobile',
        icon: 'pi pi-mobile',
        title: 'Mobile Verification',
        description: 'Confirm your registered mobile number with a one-time password.',
        completed: status.mobileVerified,
        actionLabel: status.mobileVerified ? 'View' : 'Start Verification',
        actionPath: '/verification',
      },
      {
        key: 'aadhaar',
        icon: 'pi pi-id-card',
        title: 'Aadhaar Verification',
        description: 'Verify your Aadhaar to confirm your identity securely.',
        completed: status.aadhaarVerified,
        actionLabel: status.aadhaarVerified ? 'View' : 'Start Verification',
        actionPath: '/verification',
      },
      {
        key: 'pan',
        icon: 'pi pi-file',
        title: 'PAN Verification',
        description: 'Enter your PAN details exactly as shown on your PAN card.',
        completed: status.panVerified,
        actionLabel: status.panVerified ? 'View' : 'Start Verification',
        actionPath: '/verification',
      },
      {
        key: 'bank',
        icon: 'pi pi-building',
        title: 'Bank Account Verification',
        description: 'Verify your bank account to complete EMI eligibility checks.',
        completed: status.bankVerified,
        actionLabel: status.bankVerified ? 'View' : 'Start Verification',
        actionPath: '/verification',
      },
    ];
  }

  private extractError(err: unknown): string {
    const httpErr = err as { error?: { message?: string }; message?: string };
    return httpErr?.error?.message || httpErr?.message || 'Something went wrong. Please try again.';
  }
}
