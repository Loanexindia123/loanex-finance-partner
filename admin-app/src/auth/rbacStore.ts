import { useSyncExternalStore } from 'react';
import type { User } from '../services/authService';

interface RbacState {
  user: User | null;
  permissions: string[];
  roleName: string | null;
}

let state: RbacState = { user: null, permissions: [], roleName: null };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setRbacUser(user: User | null): void {
  state = {
    user,
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    roleName: user?.roleName ?? null,
  };
  notify();
}

export function clearRbac(): void {
  state = { user: null, permissions: [], roleName: null };
  notify();
}

export function getRbacState(): RbacState {
  return state;
}

export function isDealer(): boolean {
  const roleName = String(state.roleName ?? state.user?.roleName ?? '').trim().toLowerCase();
  const role = String(state.user?.role ?? '').trim().toLowerCase();
  return roleName === 'dealer' || role === 'dealer';
}

export function isAgent(): boolean {
  const roleName = String(state.roleName ?? state.user?.roleName ?? '').trim().toLowerCase();
  const role = String(state.user?.role ?? '').trim().toLowerCase();
  return roleName === 'agent' || role === 'agent';
}

/** Field actor (Dealer or Agent) — shared APK navigation shell. */
export function isFieldActor(): boolean {
  return isDealer() || isAgent();
}

/** Employee portal role — dedicated EmployeeTabs shell (not Admin-only modules). */
export function isEmployee(): boolean {
  const roleName = String(state.roleName ?? state.user?.roleName ?? '').trim().toLowerCase();
  return roleName === 'employee';
}

/** Employee / Dealer / Agent — catalog restrictions (no publish, no edit of approved). */
export function isRestrictedCatalogUser(): boolean {
  return isEmployee() || isFieldActor();
}

/** Approved (active) products are locked for Employee / Dealer / Agent. */
export function isApprovedProductLocked(status: string | undefined | null): boolean {
  return isRestrictedCatalogUser() && String(status ?? '').trim().toLowerCase() === 'active';
}

/** Dealer/Agent APK can manage own products/agents without Admin Web RBAC keys. */
const FIELD_PRODUCT_PERMISSIONS = new Set(['products.view', 'products.create', 'products.edit']);
const FIELD_AGENT_PERMISSIONS = new Set([
  'freelancers.view',
  'freelancers.create',
  'freelancers.edit',
  'freelancers.delete',
]);
const FIELD_DEALER_PERMISSIONS = new Set([
  'masters.view',
  'masters.create',
  'masters.edit',
]);
const FIELD_LEAD_PERMISSIONS = new Set([
  'leads.view',
  'leads.create',
  'leads.edit',
]);

export function can(permission: string): boolean {
  if (isFieldActor() && FIELD_PRODUCT_PERMISSIONS.has(permission)) return true;
  if (isFieldActor() && FIELD_AGENT_PERMISSIONS.has(permission)) return true;
  if (isFieldActor() && FIELD_DEALER_PERMISSIONS.has(permission)) return true;
  if (isFieldActor() && FIELD_LEAD_PERMISSIONS.has(permission)) return true;
  return state.permissions.includes(permission);
}

export function canAny(...permissions: string[]): boolean {
  return permissions.some((permission) => can(permission));
}

export function subscribeRbac(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook — re-renders the component when permissions change. */
export function useRbac(): RbacState {
  return useSyncExternalStore(subscribeRbac, getRbacState, getRbacState);
}

/** Post-login / splash home route for the current role. */
export function homeRouteName(): 'DealerTabs' | 'EmployeeTabs' | 'Dashboard' {
  if (isFieldActor()) return 'DealerTabs';
  if (isEmployee()) return 'EmployeeTabs';
  return 'Dashboard';
}
