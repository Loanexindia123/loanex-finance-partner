import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { Category } from '../models/product.models';

export interface NamedMaster {
  id: string;
  name: string;
  status?: string;
  paymentTerms?: string;
  settlementCycle?: string;
  gstin?: string;
  phone?: string;
  dealerBranch?: string;
  paymentSettlementTerms?: string;
  parentId?: string | null;
}

export type CategoryTree = Record<string, Record<string, string[]>>;

const SEED = {
  brands: ['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Vivo'],
  warehouses: ['Main Hub', 'City Center', 'North Branch'],
  suppliers: ['Supplier A', 'Supplier B'],
  dealers: ['Dealer X', 'Dealer Y'],
  wholesalers: ['Wholesale 1', 'Wholesale 2'],
  delivery_partners: ['BlueDart', 'Delhivery'],
  delivery_zones: ['Zone 1', 'Zone 2'],
} as const;

const PRODUCT_TYPES_API = '/admin/product_types';

function unwrapList(raw: unknown): NamedMaster[] {
  if (Array.isArray(raw)) return raw as NamedMaster[];
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec['items'])) return rec['items'] as NamedMaster[];
  }
  return [];
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeName(name: string): string {
  return name.trim();
}

function extractHttpMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string; error?: string } | null;
    return body?.message || body?.error || err.message || 'Request failed';
  }
  return err instanceof Error ? err.message : 'Request failed';
}

@Injectable({ providedIn: 'root' })
export class WizardOptionsService {
  private readonly http = inject(HttpClient);

  private readonly brandsSig = signal<NamedMaster[]>([]);
  private readonly warehousesSig = signal<NamedMaster[]>([]);
  private readonly suppliersSig = signal<NamedMaster[]>([]);
  private readonly dealersSig = signal<NamedMaster[]>([]);
  private readonly wholesalersSig = signal<NamedMaster[]>([]);
  private readonly partnersSig = signal<NamedMaster[]>([]);
  private readonly zonesSig = signal<NamedMaster[]>([]);
  private readonly categoriesSig = signal<NamedMaster[]>([]);
  private readonly productTypesSig = signal<NamedMaster[]>([]);

  readonly brands = computed(() => activeNames(this.brandsSig()));
  readonly warehouses = computed(() => activeNames(this.warehousesSig()));
  readonly suppliers = computed(() => activeNames(this.suppliersSig()));
  readonly dealers = computed(() => activeNames(this.dealersSig()));
  readonly wholesalers = computed(() => activeNames(this.wholesalersSig()));
  readonly deliveryPartners = computed(() => activeNames(this.partnersSig()));
  readonly deliveryZones = computed(() => activeNames(this.zonesSig()));
  readonly productTypes = computed(() => activeNames(this.productTypesSig()));
  readonly categoryTree = computed(() => buildCategoryTree(this.categoriesSig()));

  readonly productTypesLoading = signal(false);
  readonly productTypesError = signal('');

  constructor() {
    this.seedDefaults();
    this.loadRemote();
  }

  categoryNames(): string[] {
    return Object.keys(this.categoryTree());
  }

  subCategoryNames(category: string): string[] {
    if (!category) return [];
    return Object.keys(this.categoryTree()[category] ?? {});
  }

  findSupplierByName(name: string): NamedMaster | undefined {
    return this.suppliersSig().find((s) => s.name === name);
  }

  findDealerByName(name: string): NamedMaster | undefined {
    return this.dealersSig().find((s) => s.name === name);
  }

  reloadProductTypes(): void {
    this.loadProductTypes();
  }

  /**
   * Create a Product Type via API, refresh local options, and return the saved name.
   * Does not optimistically mutate before the server responds.
   */
  createProductType(name: string): Observable<string> {
    const trimmed = normalizeName(name);
    if (!trimmed) {
      return new Observable((subscriber) => {
        subscriber.error(new Error('Product Type name is required'));
      });
    }
    if (this.productTypesSig().some((item) => eq(item.name, trimmed))) {
      return new Observable((subscriber) => {
        subscriber.error(new Error('A product type with this name already exists.'));
      });
    }

    return this.http
      .post<ApiEnvelope<NamedMaster>>(apiUrl(PRODUCT_TYPES_API), {
        name: trimmed,
        status: 'active',
      })
      .pipe(
        unwrapApi(),
        tap((created) => {
          const savedName = String(created?.name ?? trimmed).trim() || trimmed;
          const item: NamedMaster = {
            id: String(created?.id ?? nextId('ptype')),
            name: savedName,
            status: created?.status || 'active',
          };
          this.productTypesSig.update((list) => {
            if (list.some((row) => eq(row.name, item.name))) return list;
            return [...list, item];
          });
        }),
        map((created) => String(created?.name ?? trimmed).trim() || trimmed),
      );
  }

  addBrand(name: string): boolean {
    return this.addNamed(this.brandsSig, name, 'brand', '/admin/brands');
  }
  renameBrand(from: string, to: string): boolean {
    return this.renameNamed(this.brandsSig, from, to, '/admin/brands');
  }
  deleteBrand(name: string): void {
    this.deleteNamed(this.brandsSig, name, '/admin/brands');
  }

  addWarehouse(name: string): boolean {
    return this.addNamed(this.warehousesSig, name, 'warehouse', '/admin/warehouses');
  }
  renameWarehouse(from: string, to: string): boolean {
    return this.renameNamed(this.warehousesSig, from, to, '/admin/warehouses');
  }
  deleteWarehouse(name: string): void {
    this.deleteNamed(this.warehousesSig, name, '/admin/warehouses');
  }

  addSupplier(name: string): boolean {
    return this.addNamed(this.suppliersSig, name, 'supplier', '/admin/suppliers');
  }
  renameSupplier(from: string, to: string): boolean {
    return this.renameNamed(this.suppliersSig, from, to, '/admin/suppliers');
  }
  deleteSupplier(name: string): void {
    this.deleteNamed(this.suppliersSig, name, '/admin/suppliers');
  }

  addDealer(name: string): boolean {
    return this.addNamed(this.dealersSig, name, 'dealer', '/admin/dealers');
  }
  renameDealer(from: string, to: string): boolean {
    return this.renameNamed(this.dealersSig, from, to, '/admin/dealers');
  }
  deleteDealer(name: string): void {
    this.deleteNamed(this.dealersSig, name, '/admin/dealers');
  }

  addWholesaler(name: string): boolean {
    return this.addNamed(this.wholesalersSig, name, 'wholesaler', '/admin/wholesalers');
  }
  renameWholesaler(from: string, to: string): boolean {
    return this.renameNamed(this.wholesalersSig, from, to, '/admin/wholesalers');
  }
  deleteWholesaler(name: string): void {
    this.deleteNamed(this.wholesalersSig, name, '/admin/wholesalers');
  }

  addDeliveryPartner(name: string): boolean {
    return this.addNamed(this.partnersSig, name, 'partner', '/admin/delivery_partners');
  }
  renameDeliveryPartner(from: string, to: string): boolean {
    return this.renameNamed(this.partnersSig, from, to, '/admin/delivery_partners');
  }
  deleteDeliveryPartner(name: string): void {
    this.deleteNamed(this.partnersSig, name, '/admin/delivery_partners');
  }

  addDeliveryZone(name: string): boolean {
    return this.addNamed(this.zonesSig, name, 'zone', '/admin/delivery_zones');
  }
  renameDeliveryZone(from: string, to: string): boolean {
    return this.renameNamed(this.zonesSig, from, to, '/admin/delivery_zones');
  }
  deleteDeliveryZone(name: string): void {
    this.deleteNamed(this.zonesSig, name, '/admin/delivery_zones');
  }

  addCategory(name: string): boolean {
    const trimmed = normalizeName(name);
    if (!trimmed || this.topLevel().some((c) => eq(c.name, trimmed))) return false;
    const item: NamedMaster = { id: nextId('cat'), name: trimmed, parentId: null, status: 'active' };
    this.categoriesSig.update((list) => [...list, item]);
    this.syncCategory(item, false);
    return true;
  }

  renameCategory(from: string, to: string): boolean {
    const trimmed = normalizeName(to);
    if (!trimmed) return false;
    const target = this.topLevel().find((c) => c.name === from);
    if (!target || this.topLevel().some((c) => c.id !== target.id && eq(c.name, trimmed))) return false;
    this.categoriesSig.update((list) =>
      list.map((c) => (c.id === target.id ? { ...c, name: trimmed } : c)),
    );
    this.syncCategory({ ...target, name: trimmed }, true);
    return true;
  }

  deleteCategory(name: string): void {
    const target = this.topLevel().find((c) => c.name === name);
    if (!target) return;
    this.categoriesSig.update((list) =>
      list.filter((c) => c.id !== target.id && c.parentId !== target.id),
    );
    this.http
      .delete(apiUrl(`/categories/${target.id}`))
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  addSubCategory(category: string, name: string): boolean {
    const trimmed = normalizeName(name);
    const parent = this.topLevel().find((c) => c.name === category);
    if (!parent || !trimmed) return false;
    const siblings = this.categoriesSig().filter((c) => c.parentId === parent.id);
    if (siblings.some((c) => eq(c.name, trimmed))) return false;
    const item: NamedMaster = {
      id: nextId('cat'),
      name: trimmed,
      parentId: parent.id,
      status: 'active',
    };
    this.categoriesSig.update((list) => [...list, item]);
    this.syncCategory(item, false);
    return true;
  }

  renameSubCategory(category: string, from: string, to: string): boolean {
    const trimmed = normalizeName(to);
    const parent = this.topLevel().find((c) => c.name === category);
    if (!parent || !trimmed) return false;
    const target = this.categoriesSig().find((c) => c.parentId === parent.id && c.name === from);
    if (!target) return false;
    const taken = this.categoriesSig().some(
      (c) => c.parentId === parent.id && c.id !== target.id && eq(c.name, trimmed),
    );
    if (taken) return false;
    this.categoriesSig.update((list) =>
      list.map((c) => (c.id === target.id ? { ...c, name: trimmed } : c)),
    );
    this.syncCategory({ ...target, name: trimmed }, true);
    return true;
  }

  deleteSubCategory(category: string, name: string): void {
    const parent = this.topLevel().find((c) => c.name === category);
    if (!parent) return;
    const target = this.categoriesSig().find((c) => c.parentId === parent.id && c.name === name);
    if (!target) return;
    this.categoriesSig.update((list) => list.filter((c) => c.id !== target.id));
    this.http
      .delete(apiUrl(`/categories/${target.id}`))
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  ensureName(kind: keyof typeof SEED, name: string): void {
    const trimmed = normalizeName(name);
    if (!trimmed) return;
    const map: Record<keyof typeof SEED, WritableSignal<NamedMaster[]>> = {
      brands: this.brandsSig,
      warehouses: this.warehousesSig,
      suppliers: this.suppliersSig,
      dealers: this.dealersSig,
      wholesalers: this.wholesalersSig,
      delivery_partners: this.partnersSig,
      delivery_zones: this.zonesSig,
    };
    const dest = map[kind];
    if (dest().some((item) => eq(item.name, trimmed))) return;
    dest.update((list) => [...list, { id: nextId(kind), name: trimmed, status: 'active' }]);
  }

  private seedDefaults(): void {
    this.brandsSig.set(seedList('brand', SEED.brands));
    this.warehousesSig.set(seedList('warehouse', SEED.warehouses));
    this.suppliersSig.set(seedList('supplier', SEED.suppliers));
    this.dealersSig.set(seedList('dealer', SEED.dealers));
    this.wholesalersSig.set(seedList('wholesaler', SEED.wholesalers));
    this.partnersSig.set(seedList('partner', SEED.delivery_partners));
    this.zonesSig.set(seedList('zone', SEED.delivery_zones));
    this.categoriesSig.set(
      ['Smartphone', 'Tablet', 'Laptop'].map((name) => ({
        id: nextId('cat'),
        name,
        parentId: null,
        status: 'active',
      })),
    );
    // Product types come from API only — no hardcoded frontend seed.
    this.productTypesSig.set([]);
  }

  private loadRemote(): void {
    this.http
      .get<ApiEnvelope<Category[]>>(apiUrl('/categories'))
      .pipe(
        unwrapApi(),
        catchError(() => of([] as Category[])),
      )
      .subscribe((cats) => {
        const mapped = (cats ?? [])
          .filter((c) => c?.name)
          .map((c) => ({
            id: c.id,
            name: c.name,
            parentId: c.parentId ?? null,
            status: c.status || 'active',
          }));
        if (mapped.length) this.categoriesSig.set(mapped);
      });

    this.loadMaster('/admin/brands', this.brandsSig);
    this.loadMaster('/admin/warehouses', this.warehousesSig);
    this.loadMaster('/admin/suppliers', this.suppliersSig);
    this.loadMaster('/admin/dealers', this.dealersSig);
    this.loadMaster('/admin/wholesalers', this.wholesalersSig);
    this.loadMaster('/admin/delivery_partners', this.partnersSig);
    this.loadMaster('/admin/delivery_zones', this.zonesSig);
    this.loadProductTypes();
  }

  private loadProductTypes(): void {
    this.productTypesLoading.set(true);
    this.productTypesError.set('');
    this.http
      .get<ApiEnvelope<unknown>>(apiUrl(PRODUCT_TYPES_API))
      .pipe(
        unwrapApi(),
        catchError((err) => {
          this.productTypesLoading.set(false);
          this.productTypesError.set(extractHttpMessage(err));
          return of(null);
        }),
      )
      .subscribe((raw) => {
        if (raw == null) return;
        const list = unwrapList(raw)
          .map((item) => ({
            ...item,
            id: String(item.id ?? nextId('ptype')),
            name: String(item.name ?? '').trim(),
            status: item.status || 'active',
          }))
          .filter((item) => item.name);
        this.productTypesSig.set(list);
        this.productTypesLoading.set(false);
        this.productTypesError.set('');
      });
  }

  private loadMaster(path: string, dest: WritableSignal<NamedMaster[]>): void {
    this.http
      .get<ApiEnvelope<unknown>>(apiUrl(path))
      .pipe(
        unwrapApi(),
        catchError(() => of(null)),
      )
      .subscribe((raw) => {
        const list = unwrapList(raw)
          .map((item) => ({
            ...item,
            id: String(item.id ?? nextId('m')),
            name: String(item.name ?? '').trim(),
          }))
          .filter((item) => item.name);
        if (list.length) dest.set(list);
      });
  }

  private addNamed(
    dest: WritableSignal<NamedMaster[]>,
    name: string,
    prefix: string,
    path: string,
  ): boolean {
    const trimmed = normalizeName(name);
    if (!trimmed || dest().some((item) => eq(item.name, trimmed))) return false;
    const item: NamedMaster = { id: nextId(prefix), name: trimmed, status: 'active' };
    dest.update((list) => [...list, item]);
    this.syncUpsert(path, item, false);
    return true;
  }

  private renameNamed(
    dest: WritableSignal<NamedMaster[]>,
    from: string,
    to: string,
    path: string,
  ): boolean {
    const trimmed = normalizeName(to);
    if (!trimmed) return false;
    const target = dest().find((item) => item.name === from);
    if (!target || dest().some((item) => item.id !== target.id && eq(item.name, trimmed))) {
      return false;
    }
    const updated = { ...target, name: trimmed };
    dest.update((list) => list.map((item) => (item.id === target.id ? updated : item)));
    this.syncUpsert(path, updated, true);
    return true;
  }

  private deleteNamed(
    dest: WritableSignal<NamedMaster[]>,
    name: string,
    path: string,
  ): void {
    const target = dest().find((item) => item.name === name);
    dest.update((list) => list.filter((item) => item.name !== name));
    if (!target?.id) return;
    this.http
      .delete(apiUrl(`${path}/${target.id}`))
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private syncUpsert(path: string, item: NamedMaster, isEdit: boolean): void {
    const req$ = isEdit
      ? this.http.put(apiUrl(`${path}/${item.id}`), item)
      : this.http.post(apiUrl(path), item);
    req$.pipe(catchError(() => of(null))).subscribe();
  }

  private syncCategory(item: NamedMaster, isEdit: boolean): void {
    const body = {
      name: item.name,
      parentId: item.parentId ?? null,
      status: item.status || 'active',
    };
    const req$ = isEdit
      ? this.http.put(apiUrl(`/categories/${item.id}`), body)
      : this.http.post<ApiEnvelope<Category>>(apiUrl('/categories'), body);
    req$
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        const saved = (res as ApiEnvelope<Category> | null)?.success
          ? (res as ApiEnvelope<Category> & { success: true }).data
          : null;
        if (saved?.id) {
          this.categoriesSig.update((list) =>
            list.map((c) =>
              c.id === item.id || (c.name === saved.name && c.parentId === (item.parentId ?? null))
                ? { ...c, id: saved.id, name: saved.name, parentId: saved.parentId ?? null }
                : c,
            ),
          );
        }
      });
  }

  private topLevel(): NamedMaster[] {
    return this.categoriesSig().filter((c) => !c.parentId);
  }
}

function activeNames(items: NamedMaster[]): string[] {
  return items
    .filter((item) => !item.status || item.status === 'active')
    .map((item) => item.name)
    .filter(Boolean);
}

function buildCategoryTree(categories: NamedMaster[]): CategoryTree {
  const active = categories.filter((c) => !c.status || c.status === 'active');
  const tops = active.filter((c) => !c.parentId);
  const tree: CategoryTree = {};
  for (const top of tops) {
    tree[top.name] = {};
    for (const sub of active.filter((c) => c.parentId === top.id)) {
      tree[top.name][sub.name] = [];
    }
  }
  return tree;
}

function seedList(prefix: string, names: readonly string[]): NamedMaster[] {
  return names.map((name) => ({ id: nextId(prefix), name, status: 'active' }));
}

function eq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
