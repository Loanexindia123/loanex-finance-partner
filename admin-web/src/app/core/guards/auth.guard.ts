import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.whenReady().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        auth.setReturnUrl(state.url);
        return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
      }
      if (auth.user()?.mustChangePassword && !state.url.startsWith('/auth/change-password')) {
        return router.createUrlTree(['/auth/change-password']);
      }
      return true;
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
      if (auth.user()?.mustChangePassword) {
        return router.createUrlTree(['/auth/change-password']);
      }
      return router.parseUrl(auth.getReturnUrl());
    }),
  );
};
