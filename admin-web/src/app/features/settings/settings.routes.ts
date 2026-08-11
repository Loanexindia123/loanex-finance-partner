import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/pages/module-placeholder/module-placeholder').then(
        (m) => m.ModulePlaceholder,
      ),
    data: { title: 'Settings' },
  },
];
