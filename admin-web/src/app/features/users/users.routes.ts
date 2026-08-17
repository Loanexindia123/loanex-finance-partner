import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/user-list/user-list').then((m) => m.UserList),
    data: { title: 'Users' },
  },
];