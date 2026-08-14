import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const MASTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/masters-home/masters-home').then((m) => m.MastersHome),
    data: { title: 'Masters' },
  },
  {
    path: 'brands',
    loadComponent: () =>
      import('./pages/brand-list/brand-list').then((m) => m.BrandList),
    data: { title: 'Brands' },
  },
  {
    path: 'product-types',
    loadComponent: () =>
      import('./pages/product-type-list/product-type-list').then((m) => m.ProductTypeList),
    data: { title: 'Product Types' },
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./pages/category-list/category-list').then((m) => m.CategoryList),
    data: { title: 'Categories & Subcategories' },
  },
  {
    path: 'delivery-partners',
    loadComponent: () =>
      import('./pages/delivery-partner-list/delivery-partner-list').then((m) => m.DeliveryPartnerList),
    data: { title: 'Delivery Partners' },
  },
  {
    path: 'warehouses',
    loadComponent: () =>
      import('./pages/warehouse-list/warehouse-list').then((m) => m.WarehouseList),
    data: { title: 'Warehouses' },
  },
  {
    path: 'delivery-zones',
    loadComponent: () =>
      import('./pages/delivery-zone-list/delivery-zone-list').then((m) => m.DeliveryZoneList),
    data: { title: 'Delivery Zones' },
  },
  {
    path: 'banners',
    loadComponent: () =>
      import('./pages/banner-list/banner-list').then((m) => m.BannerList),
    data: { title: 'Banners' },
  },
  {
    path: 'dealers',
    loadComponent: () =>
      import('./pages/dealer-list/dealer-list').then((m) => m.DealerList),
    data: { title: 'Dealers' },
  },
  {
    path: 'dealers/new',
    canActivate: [permissionGuard('masters.create')],
    loadComponent: () =>
      import('./pages/dealer-form/dealer-form').then((m) => m.DealerForm),
    data: { title: 'Add Dealer' },
  },
  {
    path: 'dealers/:id',
    loadComponent: () =>
      import('./pages/dealer-view/dealer-view').then((m) => m.DealerView),
    data: { title: 'Dealer Details' },
  },
  {
    path: 'dealers/:id/edit',
    canActivate: [permissionGuard('masters.edit')],
    loadComponent: () =>
      import('./pages/dealer-form/dealer-form').then((m) => m.DealerForm),
    data: { title: 'Edit Dealer' },
  },
];
