import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

/** admin-login itself must never receive a stale Bearer header. */
const PUBLIC_AUTH_PATH = /\/api\/v1\/auth\/admin-login(?:\?|$)/i;

/**
 * Attaches the admin Bearer token to every request and handles 401s.
 * There is deliberately NO refresh-token retry here — admin-login issues
 * an access token only, so an expired/invalid token means "log in again".
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenService);
  const auth = inject(AuthService);

  const isPublicAuth = PUBLIC_AUTH_PATH.test(req.url);
  const accessToken = tokens.accessToken();

  const authReq =
    accessToken && !isPublicAuth
      ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isPublicAuth) {
        auth.handleUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
