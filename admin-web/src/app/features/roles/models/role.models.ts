import { Permission } from '../../../core/models/permission.models';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
}

export interface RoleUpdatePayload {
  permissions: Permission[];
}

export interface ModuleAccessItem {
  label: string;
  icon: string;
  /** The permission that controls this module's sidebar visibility (nav.config.ts). */
  permission: Permission | null;
  /** Other module labels that share this same permission — shown as a hint, not hidden. */
  sharedWith?: string[];
}

/**
 * Mirrors core/config/nav.config.ts exactly — same modules, same permissions.
 * Dashboard has no permission in nav.config.ts (always visible to everyone),
 * so it's represented here with permission: null and shown as always-on.
 */
export const MODULE_ACCESS_ITEMS: ModuleAccessItem[] = [
  { label: 'Dashboard', icon: 'pi-th-large', permission: null },
  { label: 'Products', icon: 'pi-box', permission: 'products.view' },
  { label: 'Customers', icon: 'pi-users', permission: 'customers.view' },
  { label: 'Orders', icon: 'pi-shopping-cart', permission: 'orders.view' },
  {
    label: 'EMI Applications',
    icon: 'pi-credit-card',
    permission: 'emi.view',
    sharedWith: ['Loans'],
  },
  { label: 'Loans', icon: 'pi-wallet', permission: 'emi.view', sharedWith: ['EMI Applications'] },
  { label: 'FI Cases', icon: 'pi-map-marker', permission: 'fi.view' },
  { label: 'Users', icon: 'pi-user', permission: 'users.view' },
  {
    label: 'Employee Onboarding',
    icon: 'pi-id-card',
    permission: 'users.view',
    sharedWith: ['Users'],
  },
  { label: 'Freelancer / Growing Partner', icon: 'pi-briefcase', permission: 'freelancers.view' },
  { label: 'Notifications', icon: 'pi-bell', permission: 'notifications.view' },
  { label: 'Dealers', icon: 'pi-shop', permission: 'masters.view', sharedWith: ['Masters'] },
  { label: 'Masters', icon: 'pi-database', permission: 'masters.view', sharedWith: ['Dealers'] },
  { label: 'Reports', icon: 'pi-chart-bar', permission: 'reports.view' },
  { label: 'Settings', icon: 'pi-cog', permission: 'settings.view' },
];