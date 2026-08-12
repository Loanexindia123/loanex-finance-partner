import { Routes } from '@angular/router';

export const EMI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/emi-application-list/emi-application-list').then(
        (m) => m.EmiApplicationList,
      ),
  },
  {
    path: ':applicationId/credit-review',
    loadComponent: () =>
      import('./pages/credit-review-detail/credit-review-detail').then((m) => m.CreditReviewDetail),
  },
  {
    path: ':applicationId',
    loadComponent: () =>
      import('./pages/emi-application-detail/emi-application-detail').then(
        (m) => m.EmiApplicationDetail,
      ),
  },
];
