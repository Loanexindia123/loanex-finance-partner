import { useSyncExternalStore } from 'react';
import api from '../../../services/api';
import { PRODUCT_TYPES } from './constants';

/**
 * Product Type options for the Product Wizard.
 * Loads from /admin/product_types when permitted; falls back to local seeds.
 * Creates via the same API; on 403 (e.g. Dealer) still keeps a local option
 * so the wizard can select the new value without leaving the flow.
 */

let types: string[] = [...PRODUCT_TYPES];
let loading = false;
let loadError = '';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function unwrapList(payload: unknown): any[] {
  const root = payload as any;
  const data = root?.data ?? root;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function eq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function getProductTypes(): string[] {
  return types;
}

export function getProductTypesLoading(): boolean {
  return loading;
}

export function getProductTypesError(): string {
  return loadError;
}

export function subscribeProductTypes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadProductTypes(): Promise<void> {
  loading = true;
  loadError = '';
  notify();
  try {
    const response = await api.get('/admin/product_types');
    const rows = unwrapList(response.data);
    const active = rows
      .filter((row: any) => String(row?.status ?? 'active').toLowerCase() !== 'inactive')
      .map((row: any) => String(row?.name ?? '').trim())
      .filter(Boolean);
    const all = rows.map((row: any) => String(row?.name ?? '').trim()).filter(Boolean);
    const next = active.length ? active : all;
    if (next.length > 0) {
      types = Array.from(new Set(next));
    }
    loadError = '';
  } catch (err: any) {
    loadError = err?.message || 'Unable to load product types';
    // Keep seeds / previously added local types.
  } finally {
    loading = false;
    notify();
  }
}

/** Optimistic add; persists via API when the caller has masters.create. */
export function addProductType(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (types.some((item) => eq(item, trimmed))) return false;
  types = [...types, trimmed];
  notify();
  api
    .post('/admin/product_types', { name: trimmed, status: 'active' })
    .catch((err) => console.warn('Unable to sync product type:', err));
  return true;
}

export function renameProductType(from: string, to: string): boolean {
  const trimmed = to.trim();
  if (!trimmed) return false;
  if (types.some((item) => item !== from && eq(item, trimmed))) return false;
  const idx = types.findIndex((item) => item === from);
  if (idx < 0) return false;
  types = types.map((item) => (item === from ? trimmed : item));
  notify();
  return true;
}

export function deleteProductType(name: string): void {
  types = types.filter((item) => item !== name);
  notify();
}

export function useProductTypes(): {
  productTypes: string[];
  loading: boolean;
  error: string;
  addProductType: typeof addProductType;
  renameProductType: typeof renameProductType;
  deleteProductType: typeof deleteProductType;
  reload: typeof loadProductTypes;
} {
  const productTypes = useSyncExternalStore(subscribeProductTypes, getProductTypes, getProductTypes);
  const loadingState = useSyncExternalStore(
    subscribeProductTypes,
    getProductTypesLoading,
    getProductTypesLoading,
  );
  const error = useSyncExternalStore(subscribeProductTypes, getProductTypesError, getProductTypesError);
  return {
    productTypes,
    loading: loadingState,
    error,
    addProductType,
    renameProductType,
    deleteProductType,
    reload: loadProductTypes,
  };
}
