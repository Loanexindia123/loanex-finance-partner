import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/employee-list/employee-list').then((m) => m.EmployeeList),
    data: { title: 'Employees' },
  },
  {
    path: 'onboard',
    canActivate: [permissionGuard('users.create')],
    loadComponent: () =>
      import('./pages/employee-onboard/employee-onboard').then((m) => m.EmployeeOnboard),
    data: { title: 'Employee Onboarding' },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/employee-view/employee-view').then((m) => m.EmployeeView),
    data: { title: 'Employee Profile' },
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard('users.edit')],
    loadComponent: () =>
      import('./pages/employee-onboard/employee-onboard').then((m) => m.EmployeeOnboard),
    data: { title: 'Edit Employee Onboarding' },
  },
];
