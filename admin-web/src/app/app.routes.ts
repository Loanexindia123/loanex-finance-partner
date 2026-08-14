import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'auth/forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'auth/change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password').then((m) => m.ChangePassword),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/admin-shell/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'products',
        canActivate: [permissionGuard('products.view')],
        loadChildren: () =>
          import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: 'customers',
        canActivate: [permissionGuard('customers.view')],
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        path: 'orders',
        canActivate: [permissionGuard('orders.view')],
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'emi',
        canActivate: [permissionGuard('emi.view')],
        loadChildren: () => import('./features/emi/emi.routes').then((m) => m.EMI_ROUTES),
      },
      {
        path: 'loans',
        canActivate: [permissionGuard('emi.view')],
        loadChildren: () => import('./features/loans/loans.routes').then((m) => m.LOANS_ROUTES),
      },
      {
        path: 'fi',
        canActivate: [permissionGuard('fi.view')],
        loadChildren: () => import('./features/fi/fi.routes').then((m) => m.FI_ROUTES),
      },
      {
        path: 'users',
        canActivate: [permissionGuard('users.view')],
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'employees',
        canActivate: [permissionGuard('users.view')],
        loadChildren: () =>
          import('./features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard('roles.view')],
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES),
      },
      {
        path: 'notifications',
        canActivate: [permissionGuard('notifications.view')],
        loadChildren: () =>
          import('./features/notifications/notifications.routes').then(
            (m) => m.NOTIFICATIONS_ROUTES,
          ),
      },
      {
        path: 'settings',
        canActivate: [permissionGuard('settings.view')],
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'masters',
        canActivate: [permissionGuard('masters.view')],
        loadChildren: () =>
          import('./features/masters/masters.routes').then((m) => m.MASTERS_ROUTES),
      },
      {
        path: 'reports',
        canActivate: [permissionGuard('reports.view')],
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./shared/pages/forbidden/forbidden').then((m) => m.Forbidden),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./shared/pages/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
