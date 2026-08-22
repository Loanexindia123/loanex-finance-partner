export interface MasterNavCard {
  title: string;
  description: string;
  icon: string;
  route: string;
  permission?: string;
  soon?: boolean;
  /**
   * Shown to Employee / Dealer / Agent (matches admin-app DealerMastersHomeScreen).
   * Admin / Super Admin always see every card.
   */
  restrictedCatalog?: boolean;
}

export const MASTER_NAV_CARDS: MasterNavCard[] = [
  {
    title: 'Brands',
    description: 'Product brands used in catalogue and filters',
    icon: 'pi pi-tag',
    route: '/masters/brands',
    restrictedCatalog: true,
  },
  {
    title: 'Product Types',
    description: 'Product type options for create and edit product forms',
    icon: 'pi pi-box',
    route: '/masters/product-types',
    restrictedCatalog: true,
  },
  {
    title: 'Categories & Subcategories',
    description: 'Catalogue hierarchy for products and dealers',
    icon: 'pi pi-sitemap',
    route: '/masters/categories',
    restrictedCatalog: true,
  },
  {
    title: 'Delivery Partners',
    description: 'Courier and logistics partners for fulfilment',
    icon: 'pi pi-truck',
    route: '/masters/delivery-partners',
  },
  {
    title: 'Warehouses',
    description: 'Stock locations and dispatch hubs',
    icon: 'pi pi-building',
    route: '/masters/warehouses',
  },
  {
    title: 'Delivery Zones',
    description: 'Serviceable areas and delivery regions',
    icon: 'pi pi-map',
    route: '/masters/delivery-zones',
  },
  {
    title: 'Banners',
    description: 'Upload banners for the website home and the mobile app',
    icon: 'pi pi-images',
    route: '/masters/banners',
  },
];

/** Masters routes Employees/Dealers/Agents may open (admin-app parity). */
export const RESTRICTED_CATALOG_MASTER_ROUTES = new Set([
  '/masters/brands',
  '/masters/product-types',
  '/masters/categories',
]);

export interface NamedMasterRouteConfig {
  title: string;
  subtitle: string;
  entityLabel: string;
  apiPath: string;
  addPermission?: string;
}

export const NAMED_MASTER_ROUTES: Record<string, NamedMasterRouteConfig> = {
  brands: {
    title: 'Brands',
    subtitle: 'Manage product brands for catalogue and filters',
    entityLabel: 'Brand',
    apiPath: '/admin/brands',
    addPermission: 'masters.create',
  },
  'product-types': {
    title: 'Product Types',
    subtitle: 'Manage product types for catalogue and product forms',
    entityLabel: 'Product Type',
    apiPath: '/admin/product_types',
    addPermission: 'masters.create',
  },
  warehouses: {
    title: 'Warehouses',
    subtitle: 'Manage stock locations and dispatch hubs',
    entityLabel: 'Warehouse',
    apiPath: '/admin/warehouses',
    addPermission: 'masters.create',
  },
  'delivery-partners': {
    title: 'Delivery Partners',
    subtitle: 'Manage courier and logistics partners',
    entityLabel: 'Delivery Partner',
    apiPath: '/admin/delivery_partners',
    addPermission: 'masters.create',
  },
  'delivery-zones': {
    title: 'Delivery Zones',
    subtitle: 'Manage serviceable delivery regions',
    entityLabel: 'Delivery Zone',
    apiPath: '/admin/delivery_zones',
    addPermission: 'masters.create',
  },
};
