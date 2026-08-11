import { Routes } from '@angular/router';

export const FI_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/pages/module-placeholder/module-placeholder').then(
        (m) => m.ModulePlaceholder,
      ),
    data: { title: 'FI Cases' },
  },
];
