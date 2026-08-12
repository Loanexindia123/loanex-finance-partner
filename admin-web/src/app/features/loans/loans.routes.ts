import { Routes } from '@angular/router';

export const LOANS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/loan-list/loan-list').then((m) => m.LoanList),
  },
  {
    path: ':loanId',
    loadComponent: () => import('./pages/loan-detail/loan-detail').then((m) => m.LoanDetail),
  },
];
