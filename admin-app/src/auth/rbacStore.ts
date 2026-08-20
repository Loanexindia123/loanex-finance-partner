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

/** Dealer APK can manage own products without Admin Web RBAC keys. */
const DEALER_PRODUCT_PERMISSIONS = new Set(['products.view', 'products.create', 'products.edit']);

export function can(permission: string): boolean {
  if (isDealer() && DEALER_PRODUCT_PERMISSIONS.has(permission)) return true;
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
