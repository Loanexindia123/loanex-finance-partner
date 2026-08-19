import { Routes } from '@angular/router';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/role-permissions/role-permissions').then((m) => m.RolePermissions),
    data: { title: 'Roles' },
  },
];