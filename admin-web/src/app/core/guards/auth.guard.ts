import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.whenReady().pipe(
    map(() => {
      if (auth.isAuthenticated()) {
        return true;
      }
      auth.setReturnUrl(state.url);
      return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
    }),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.whenReady().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        return true;
      }
      return router.parseUrl(auth.getReturnUrl());
    }),
  );
};
