import { Routes } from '@angular/router';

export const FI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/fi-case-list/fi-case-list').then((m) => m.FiCaseList),
  },
  {
    path: ':fiCaseId',
    loadComponent: () =>
      import('./pages/fi-case-detail/fi-case-detail').then((m) => m.FiCaseDetail),
  },
];
