import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { apiUrl } from '../config/api.config';
import { TokenService } from './token.service';
import { ApiEnvelope } from '../models/api.models';
import {
  AdminLoginCredentials,
  AdminLoginRawResponse,
  AdminUser,
  MeRawResponse,
} from '../models/auth.models';

function normalizeLoginUser(raw: AdminLoginRawResponse['user']): AdminUser {
  return {
    id: raw.id,
    fullName: raw.email || raw.phone,
    mobile: raw.phone,
    email: raw.email,
    roleId: raw.roleId,
    roleName: raw.roleName,
    permissions: raw.permissions ?? [],
    mustChangePassword: !!raw.mustChangePassword,
    status: 'ACTIVE',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function normalizeMeUser(raw: MeRawResponse['user'], fallback: AdminUser | null): AdminUser {
  return {
    id: raw.id,
    fullName: raw.fullName || fallback?.fullName || '',
    mobile: raw.mobile || fallback?.mobile || '',
    email: raw.email || fallback?.email || '',
    roleId: raw.roleId ?? fallback?.roleId ?? null,
    roleName: raw.roleName ?? fallback?.roleName ?? null,
    permissions: raw.permissions ?? fallback?.permissions ?? [],
    mustChangePassword:
      raw.mustChangePassword !== undefined
        ? !!raw.mustChangePassword
        : !!fallback?.mustChangePassword,
    status: raw.status || fallback?.status || 'ACTIVE',
    createdAt: raw.createdAt || fallback?.createdAt || '',
    updatedAt: raw.updatedAt || fallback?.updatedAt || '',
  };
}

export interface AdminForgotPasswordResult {
  otpSent: boolean;
  mobile: string;
  mobileMasked: string;
  expiresInMinutes: number;
  resendCooldownSeconds: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly router = inject(Router);

  private readonly authReadySignal = signal(false);
  private returnUrl = '/dashboard';

  readonly authReady = this.authReadySignal.asReadonly();
  readonly user = this.tokens.user;
  readonly isAuthenticated = computed(
    () => this.tokens.hasValidAccessToken() && !!this.tokens.user(),
  );

  /** Called once at app bootstrap (APP_INITIALIZER) to restore/verify the session. */
  initializeAuth(): Observable<void> {
    if (!this.tokens.hasAccessToken()) {
      this.authReadySignal.set(true);
      return of(void 0);
    }
    return this.me().pipe(
      map(() => void 0),
      catchError(() => {
        this.tokens.clear();
        return of(void 0);
      }),
      tap(() => this.authReadySignal.set(true)),
    );
  }

  login(credentials: AdminLoginCredentials): Observable<AdminUser> {
    return this.http.post<ApiEnvelope<AdminLoginRawResponse>>(
      apiUrl('/auth/admin-login'),
      credentials,
    ).pipe(
      map((res) => {
        if (!res.success) {
          throw res;
        }
        const user = normalizeLoginUser(res.data.user);
        this.tokens.setSession(res.data.token, user);
        return user;
      }),
    );
  }

  me(): Observable<AdminUser> {
    return this.http.get<ApiEnvelope<MeRawResponse>>(apiUrl('/auth/me')).pipe(
      map((res) => {
        if (!res.success) {
          throw res;
        }
        const user = normalizeMeUser(res.data.user, this.tokens.user());
        this.tokens.setUser(user);
        return user;
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<ApiEnvelope<{ changed: boolean }>>(apiUrl('/auth/change-password'), {
        currentPassword,
        newPassword,
      })
      .pipe(map(() => void 0));
  }

  /** Staff-only forgot password — reuses existing OTP SMS pipeline. */
  adminForgotPassword(identifier: string): Observable<AdminForgotPasswordResult> {
    return this.http
      .post<ApiEnvelope<AdminForgotPasswordResult>>(apiUrl('/auth/admin-forgot-password'), {
        identifier: identifier.trim(),
      })
      .pipe(
        map((res) => {
          if (!res.success) throw res;
          const data = (res.data ?? {}) as Partial<AdminForgotPasswordResult>;
          return {
            otpSent: !!data.otpSent,
            mobile: String(data.mobile ?? ''),
            mobileMasked: String(data.mobileMasked ?? ''),
            expiresInMinutes: Number(data.expiresInMinutes ?? 10),
            resendCooldownSeconds: Number(data.resendCooldownSeconds ?? 30),
            message:
              data.message ||
              'If an eligible staff account matches, an OTP has been sent to the registered mobile number.',
          };
        }),
      );
  }

  adminVerifyResetOtp(mobile: string, otp: string): Observable<{ verified: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<{ verified?: boolean; message?: string }>>(
        apiUrl('/auth/admin-verify-reset-otp'),
        { mobile, otp },
      )
      .pipe(
        map((res) => {
          if (!res.success) throw res;
          return {
            verified: !!(res.data as { verified?: boolean } | undefined)?.verified,
            message:
              (res.data as { message?: string } | undefined)?.message ||
              res.message ||
              'OTP verified.',
          };
        }),
      );
  }

  adminResetPassword(
    mobile: string,
    otp: string,
    newPassword: string,
  ): Observable<{ reset: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<{ reset?: boolean; message?: string }>>(apiUrl('/auth/admin-reset-password'), {
        mobile,
        otp,
        newPassword,
      })
      .pipe(
        map((res) => {
          if (!res.success) throw res;
          return {
            reset: !!(res.data as { reset?: boolean } | undefined)?.reset,
            message:
              (res.data as { message?: string } | undefined)?.message ||
              res.message ||
              'Password reset successfully.',
          };
        }),
      );
  }

  /**
   * Admin sessions carry no refresh token, so logout is purely local — this
   * mirrors admin-app/src/services/authService.ts, which never calls the
   * backend /auth/logout route for admin sessions since there's nothing to revoke.
   */
  logout(): void {
    this.tokens.clear();
    this.router.navigate(['/auth/login']);
  }

  /** Invoked by the interceptor on a definitive 401 (invalid/expired token). */
  handleUnauthorized(): void {
    const wasAuthenticated = this.tokens.hasAccessToken();
    this.tokens.clear();
    if (wasAuthenticated) {
      this.redirectToLogin(this.router.url);
    }
  }

  redirectToLogin(returnUrl?: string): void {
    if (returnUrl && !returnUrl.startsWith('/auth/login')) {
      this.setReturnUrl(returnUrl);
    }
    this.router.navigate(['/auth/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
    });
  }

  setReturnUrl(url: string): void {
    this.returnUrl = url;
  }

  getReturnUrl(): string {
    return this.returnUrl;
  }

  whenReady(): Observable<void> {
    if (this.authReadySignal()) {
      return of(void 0);
    }
    return new Observable<void>((subscriber) => {
      const interval = setInterval(() => {
        if (this.authReadySignal()) {
          clearInterval(interval);
          subscriber.next();
          subscriber.complete();
        }
      }, 20);
    });
  }
}
