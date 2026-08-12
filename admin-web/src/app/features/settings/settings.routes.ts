// import { Routes } from '@angular/router';

// export const SETTINGS_ROUTES: Routes = [
//   {
//     path: '',
//     loadComponent: () =>
//       import('../../shared/pages/module-placeholder/module-placeholder').then(
//         (m) => m.ModulePlaceholder,
//       ),
//     data: { title: 'Settings' },
//   },
// ];


import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/settings-shell/settings-shell').then((m) => m.SettingsShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'branches' },
      {
        path: 'branches',
        canActivate: [permissionGuard('masters.view')],
        loadComponent: () =>
          import('./pages/branch-list/branch-list').then((m) => m.BranchList),
        data: { title: 'Branches' },
      },
    ],
  },
];
