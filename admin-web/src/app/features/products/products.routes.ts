import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/product-list/product-list').then((m) => m.ProductList),
  },
  {
    path: 'new',
    canActivate: [permissionGuard('products.create')],
    loadComponent: () => import('./pages/product-form/product-form').then((m) => m.ProductForm),
  },
  {
    path: ':id/view',
    loadComponent: () => import('./pages/product-detail/product-detail').then((m) => m.ProductDetail),
  },
  {
    path: ':id',
    canActivate: [permissionGuard('products.edit')],
    loadComponent: () => import('./pages/product-form/product-form').then((m) => m.ProductForm),
  },
];
