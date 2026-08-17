import { Permission } from '../models/permission.models';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Item is shown if the user has ANY of these permissions. Empty = always shown. */
  permissions?: Permission[];
  /** When true, active only on exact route match (e.g. Masters hub vs child routes). */
  exact?: boolean;
}

/**
 * Sidebar navigation — only modules actually backed by the current
 * backend/admin-app functionality (see project audit). RBAC hides entries
 * the signed-in admin lacks permission for; the backend remains authoritative.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'pi pi-th-large', route: '/dashboard' },
  { label: 'Products', icon: 'pi pi-box', route: '/products', permissions: ['products.view'] },
  {
    label: 'Dealers',
    icon: 'pi pi-shop',
    route: '/masters/dealers',
    permissions: ['masters.view'],
  },
  { label: 'Customers', icon: 'pi pi-users', route: '/customers', permissions: ['customers.view'] },
  { label: 'Orders', icon: 'pi pi-shopping-cart', route: '/orders', permissions: ['orders.view'] },
  { label: 'EMI Applications', icon: 'pi pi-credit-card', route: '/emi', permissions: ['emi.view'] },
  { label: 'Loans', icon: 'pi pi-wallet', route: '/loans', permissions: ['emi.view'] },
  { label: 'FI Cases', icon: 'pi pi-map-marker', route: '/fi', permissions: ['fi.view'] },
  { label: 'Users', icon: 'pi pi-user', route: '/users', permissions: ['users.view'] },
  {
    label: 'Employee Onboarding',
    icon: 'pi pi-id-card',
    route: '/employees',
    permissions: ['users.view'],
  },
  {
    label: 'Freelancer / Growing Partner',
    icon: 'pi pi-briefcase',
    route: '/employees/freelancer-onboarding',
    permissions: ['freelancers.view'],
  },
  { label: 'Roles', icon: 'pi pi-shield', route: '/roles', permissions: ['roles.view'] },
  {
    label: 'Notifications',
    icon: 'pi pi-bell',
    route: '/notifications',
    permissions: ['notifications.view'],
  },
  { label: 'Masters', icon: 'pi pi-database', route: '/masters', permissions: ['masters.view'], exact: true },
  { label: 'Reports', icon: 'pi pi-chart-bar', route: '/reports', permissions: ['reports.view'] },
  { label: 'Settings', icon: 'pi pi-cog', route: '/settings', permissions: ['settings.view'] },
];
