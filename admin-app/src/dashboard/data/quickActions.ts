export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  /** RBAC permission required to see this action. */
  permission: string;
}

export const quickActions: QuickAction[] = [
  { id: '1', title: 'Products', icon: 'cube-outline', permission: 'products.view' },
  { id: '1b', title: 'Agents', icon: 'people-outline', permission: 'freelancers.view' },
  { id: '1c', title: 'Dealers', icon: 'storefront-outline', permission: 'masters.view' },
  { id: '1d', title: 'Employees', icon: 'badge-outline', permission: 'users.view' },
  { id: '2', title: 'Orders', icon: 'cart-outline', permission: 'orders.view' },
  { id: '3', title: 'Customers', icon: 'people-outline', permission: 'customers.view' },
  { id: '4', title: 'EMI', icon: 'document-text-outline', permission: 'emi.view' },
  { id: '5', title: 'Loans', icon: 'cash-outline', permission: 'emi.view' },
  { id: '6', title: 'Reports', icon: 'bar-chart-outline', permission: 'reports.view' },
  { id: '7', title: 'Users', icon: 'person-outline', permission: 'users.view' },
  { id: '8', title: 'Roles', icon: 'shield-checkmark-outline', permission: 'roles.view' },
  { id: '9', title: 'Masters', icon: 'layers-outline', permission: 'masters.view' },
  { id: '10', title: 'Settings', icon: 'settings-outline', permission: 'settings.view' },
];
