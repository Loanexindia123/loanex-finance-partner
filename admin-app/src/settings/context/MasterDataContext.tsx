import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react';
import api from '../../services/api';
import {
  BrandMaster,
  CategoryMaster,
  CategoryTree,
  DealerMaster,
  DeliveryPartnerMaster,
  DeliveryZoneMaster,
  BranchMaster,
  PincodeMaster,
  SupplierMaster,
  WarehouseMaster,
  WholesalerMaster,
  createMasterId,
  isActiveStatus,
} from '../types/masterData';
import {
  seedBrands,
  seedBranches,
  seedCategories,
  seedDealers,
  seedDeliveryPartners,
  seedDeliveryZones,
  seedPincodes,
  seedSuppliers,
  seedWarehouses,
  seedWholesalers,
} from '../data/masterSeeds';

type NameDraft = { name: string };

function normalizeName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed || null;
}

function nameTaken(
  items: { id: string; name: string }[],
  name: string,
  excludeId?: string,
): boolean {
  const lower = name.toLowerCase();
  return items.some(
    (item) => item.id !== excludeId && item.name.toLowerCase() === lower,
  );
}

function buildCategoryTree(
  categories: CategoryMaster[],
  activeOnly: boolean,
): CategoryTree {
  const filtered = activeOnly
    ? categories.filter((c) => isActiveStatus(c.status))
    : categories;

  const sorted = [...filtered].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name),
  );

  const tops = sorted.filter((c) => !c.parentId);
  const tree: CategoryTree = {};

  for (const top of tops) {
    const subs = sorted.filter((c) => c.parentId === top.id);
    tree[top.name] = {};
    for (const sub of subs) {
      tree[top.name][sub.name] = [];
    }
  }
  return tree;
}

export interface MasterDataContextType {
  brands: BrandMaster[];
  suppliers: SupplierMaster[];
  dealers: DealerMaster[];
  wholesalers: WholesalerMaster[];
  warehouses: WarehouseMaster[];
  deliveryPartners: DeliveryPartnerMaster[];
  deliveryZones: DeliveryZoneMaster[];
  categories: CategoryMaster[];
  branches: BranchMaster[];
  pincodes: PincodeMaster[];

  /** Wizard-compatible nested map (active categories only). */
  categoryTree: CategoryTree;

  // —— Brands ——
  saveBrand: (data: Omit<BrandMaster, 'id'> & { id?: string }) => boolean;
  deleteBrand: (id: string) => void;
  addBrand: (name: string) => boolean;
  renameBrand: (from: string, to: string) => boolean;
  deleteBrandByName: (name: string) => void;

  // —— Categories ——
  saveCategory: (data: Omit<CategoryMaster, 'id'> & { id?: string }) => boolean;
  deleteCategory: (id: string) => void;
  addCategory: (name: string) => boolean;
  renameCategory: (from: string, to: string) => boolean;
  deleteCategoryByName: (name: string) => void;
  addSubCategory: (parentName: string, name: string) => boolean;
  renameSubCategory: (parentName: string, from: string, to: string) => boolean;
  deleteSubCategory: (parentName: string, name: string) => void;

  // —— Suppliers ——
  saveSupplier: (data: Omit<SupplierMaster, 'id'> & { id?: string }) => boolean;
  deleteSupplier: (id: string) => void;
  addSupplier: (name: string) => boolean;
  renameSupplier: (from: string, to: string) => boolean;
  deleteSupplierByName: (name: string) => void;
  findSupplierByName: (name: string) => SupplierMaster | undefined;

  // —— Dealers ——
  saveDealer: (data: Omit<DealerMaster, 'id'> & { id?: string }) => boolean;
  deleteDealer: (id: string) => void;
  addDealer: (name: string) => boolean;
  renameDealer: (from: string, to: string) => boolean;
  deleteDealerByName: (name: string) => void;
  findDealerByName: (name: string) => DealerMaster | undefined;

  // —— Wholesalers ——
  saveWholesaler: (data: Omit<WholesalerMaster, 'id'> & { id?: string }) => boolean;
  deleteWholesaler: (id: string) => void;
  addWholesaler: (name: string) => boolean;
  renameWholesaler: (from: string, to: string) => boolean;
  deleteWholesalerByName: (name: string) => void;

  // —— Warehouses ——
  saveWarehouse: (data: Omit<WarehouseMaster, 'id'> & { id?: string }) => boolean;
  deleteWarehouse: (id: string) => void;
  addWarehouse: (name: string) => boolean;
  renameWarehouse: (from: string, to: string) => boolean;
  deleteWarehouseByName: (name: string) => void;

  // —— Delivery Partners ——
  saveDeliveryPartner: (
    data: Omit<DeliveryPartnerMaster, 'id'> & { id?: string },
  ) => boolean;
  deleteDeliveryPartner: (id: string) => void;
  addDeliveryPartner: (name: string) => boolean;
  renameDeliveryPartner: (from: string, to: string) => boolean;
  deleteDeliveryPartnerByName: (name: string) => void;

  // —— Delivery Zones ——
  saveDeliveryZone: (data: Omit<DeliveryZoneMaster, 'id'> & { id?: string }) => boolean;
  deleteDeliveryZone: (id: string) => void;
  addDeliveryZone: (name: string) => boolean;
  renameDeliveryZone: (from: string, to: string) => boolean;
  deleteDeliveryZoneByName: (name: string) => void;

  // —— Branches ——
  saveBranch: (data: Omit<BranchMaster, 'id'> & { id?: string }) => boolean;

  // —— Pincodes ——
  savePincode: (
    data: Omit<PincodeMaster, 'id' | 'name'> & { id?: string; name?: string },
  ) => boolean;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState(seedBrands);
  const [categories, setCategories] = useState(seedCategories);
  const [suppliers, setSuppliers] = useState(seedSuppliers);
  const [dealers, setDealers] = useState(seedDealers);
  const [wholesalers, setWholesalers] = useState(seedWholesalers);
  const [warehouses, setWarehouses] = useState(seedWarehouses);
  const [deliveryPartners, setDeliveryPartners] = useState(seedDeliveryPartners);
  const [deliveryZones, setDeliveryZones] = useState(seedDeliveryZones);
  const [branches, setBranches] = useState(seedBranches);
  const [pincodes, setPincodes] = useState(seedPincodes);

  useEffect(() => {
    let cancelled = false;

    const unwrapList = (payload: any): any[] => {
      const data = payload?.data ?? payload;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      return [];
    };

    api
      .get('/categories')
      .then((response) => {
        if (cancelled) return;
        const apiCats: CategoryMaster[] = unwrapList(response.data).map(
          (cat: any, index: number) => ({
            id: cat.id,
            name: cat.name,
            parentId: cat.parentId ?? null,
            displayOrder: cat.sortOrder ?? index,
            status: cat.status || 'active',
          }),
        );
        if (apiCats.length > 0) setCategories(apiCats);
      })
      .catch((err) => console.warn('Unable to load categories from API:', err));

    Promise.allSettled([
      api.get('/admin/suppliers'),
      api.get('/admin/dealers'),
      api.get('/admin/warehouses'),
      api.get('/admin/brands'),
      api.get('/admin/wholesalers'),
      api.get('/admin/delivery_partners'),
      api.get('/admin/delivery_zones'),
      api.get('/admin/branches'),
      api.get('/admin/pincodes'),
    ]).then((results) => {
      if (cancelled) return;
      const [
        suppliersRes,
        dealersRes,
        warehousesRes,
        brandsRes,
        wholesalersRes,
        deliveryPartnersRes,
        deliveryZonesRes,
        branchesRes,
        pincodesRes,
      ] = results;

      const apply = (result: PromiseSettledResult<any>, setter: (list: any[]) => void) => {
        if (result.status === 'fulfilled') {
          const list = unwrapList(result.value.data);
          if (list.length > 0) setter(list);
        } else {
          console.warn('Unable to load master data from API:', result.reason);
        }
      };

      apply(suppliersRes, setSuppliers);
      apply(dealersRes, setDealers);
      apply(warehousesRes, setWarehouses);
      apply(brandsRes, setBrands);
      apply(wholesalersRes, setWholesalers);
      apply(deliveryPartnersRes, setDeliveryPartners);
      apply(deliveryZonesRes, setDeliveryZones);
      // Branches: always replace local seeds with API data (including []).
      // Keeping seeds when the server list is empty caused Edit PUT 404s on
      // client-only UUIDs that were never persisted.
      if (branchesRes.status === 'fulfilled') {
        setBranches(unwrapList(branchesRes.value.data));
      } else {
        console.warn('Unable to load branches from API:', branchesRes.reason);
      }
      apply(pincodesRes, setPincodes);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryTree = useMemo(
    () => buildCategoryTree(categories, true),
    [categories],
  );

  const value = useMemo<MasterDataContextType>(() => {
    const saveNamed = <T extends { id: string; name: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      data: Omit<T, 'id'> & { id?: string },
      idPrefix: string,
    ): boolean => {
      const name = normalizeName(data.name);
      if (!name) return false;
      if (nameTaken(list, name, data.id)) return false;
      if (data.id) {
        setList((prev) =>
          prev.map((item) =>
            item.id === data.id ? ({ ...item, ...data, name } as T) : item,
          ),
        );
      } else {
        setList((prev) => [
          ...prev,
          { ...data, id: createMasterId(idPrefix), name } as T,
        ]);
      }
      return true;
    };

    const addByName = <T extends { id: string; name: string; status: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      name: string,
      idPrefix: string,
      extra: Partial<T> = {},
    ): boolean => {
      const trimmed = normalizeName(name);
      if (!trimmed || nameTaken(list, trimmed)) return false;
      setList((prev) => [
        ...prev,
        {
          id: createMasterId(idPrefix),
          name: trimmed,
          status: 'active',
          ...extra,
        } as T,
      ]);
      return true;
    };

    const renameByName = <T extends { id: string; name: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      from: string,
      to: string,
    ): boolean => {
      const trimmed = normalizeName(to);
      if (!trimmed) return false;
      const target = list.find((item) => item.name === from);
      if (!target) return false;
      if (nameTaken(list, trimmed, target.id)) return false;
      setList((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, name: trimmed } : item)),
      );
      return true;
    };

    const deleteByName = <T extends { name: string }>(
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      name: string,
    ) => {
      setList((prev) => prev.filter((item) => item.name !== name));
    };

    const syncUpsert = (path: string, item: { id: string }) => {
      const isEdit = !!item.id;
      const url = isEdit ? `${path}/${item.id}` : path;
      api[isEdit ? 'put' : 'post'](url, item).catch((err) =>
        console.warn(`Failed to sync ${path}:`, err),
      );
    };

    const syncDelete = (path: string, id?: string) => {
      if (!id) return;
      api.delete(`${path}/${id}`).catch((err) =>
        console.warn(`Failed to delete ${path}:`, err),
      );
    };

    /** saveNamed that also persists to the backend. */
    const saveNamedSynced = <T extends { id: string; name: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      data: Omit<T, 'id'> & { id?: string },
      idPrefix: string,
      path: string,
    ): boolean => {
      const name = normalizeName(data.name);
      if (!name) return false;
      if (nameTaken(list, name, data.id)) return false;
      const item = { ...data, id: data.id ?? createMasterId(idPrefix), name } as T;
      setList((prev) =>
        data.id
          ? prev.map((it) => (it.id === data.id ? item : it))
          : [...prev, item],
      );
      syncUpsert(path, item);
      return true;
    };

    const addByNameSynced = <T extends { id: string; name: string; status: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      name: string,
      idPrefix: string,
      path: string,
      extra: Partial<T> = {},
    ): boolean => {
      const trimmed = normalizeName(name);
      if (!trimmed || nameTaken(list, trimmed)) return false;
      const item = {
        id: createMasterId(idPrefix),
        name: trimmed,
        status: 'active',
        ...extra,
      } as T;
      setList((prev) => [...prev, item]);
      syncUpsert(path, item);
      return true;
    };

    const renameByNameSynced = <T extends { id: string; name: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      from: string,
      to: string,
      path: string,
    ): boolean => {
      const trimmed = normalizeName(to);
      if (!trimmed) return false;
      const target = list.find((item) => item.name === from);
      if (!target) return false;
      if (nameTaken(list, trimmed, target.id)) return false;
      const updated = { ...target, name: trimmed } as T;
      setList((prev) => prev.map((item) => (item.id === target.id ? updated : item)));
      syncUpsert(path, updated);
      return true;
    };

    const deleteByNameSynced = <T extends { id: string; name: string }>(
      list: T[],
      setList: React.Dispatch<React.SetStateAction<T[]>>,
      name: string,
      path: string,
    ) => {
      const target = list.find((item) => item.name === name);
      setList((prev) => prev.filter((item) => item.name !== name));
      syncDelete(path, target?.id);
    };

    return {
      brands,
      suppliers,
      dealers,
      wholesalers,
      warehouses,
      deliveryPartners,
      deliveryZones,
      categories,
      categoryTree,
      branches,
      pincodes,

      saveBrand: (data) => saveNamedSynced(brands, setBrands, data, 'brand', '/admin/brands'),
      deleteBrand: (id) => {
        setBrands((prev) => prev.filter((b) => b.id !== id));
        syncDelete('/admin/brands', id);
      },
      addBrand: (name) => addByNameSynced(brands, setBrands, name, 'brand', '/admin/brands'),
      renameBrand: (from, to) => renameByNameSynced(brands, setBrands, from, to, '/admin/brands'),
      deleteBrandByName: (name) => deleteByNameSynced(brands, setBrands, name, '/admin/brands'),

      saveCategory: (data) => {
        const name = normalizeName(data.name);
        if (!name) return false;

        const isEdit = !!data.id;
        const method = isEdit ? 'put' : 'post';
        const url = isEdit ? `/categories/${data.id}` : '/categories';

        api[method](url, {
          name,
          parentId: data.parentId ?? null,
          status: data.status || 'active',
          sortOrder: data.displayOrder || 0,
        })
          .then((response) => {
            const saved = response.data?.data;
            if (saved?.id) {
              setCategories((prev) => {
                // Replace the optimistic row (create path) so the category
                // isn't duplicated in the list after the server responds.
                const optimistic = prev.find(
                  (c) =>
                    c.id !== saved.id &&
                    c.name === saved.name &&
                    c.parentId === (saved.parentId ?? data.parentId ?? null),
                );
                if (optimistic) {
                  return prev.map((c) =>
                    c.id === optimistic.id
                      ? {
                          id: saved.id,
                          name: saved.name,
                          parentId: saved.parentId ?? null,
                          displayOrder: saved.sortOrder ?? c.displayOrder ?? 0,
                          status: saved.status || 'active',
                        }
                      : c,
                  );
                }
                const exists = prev.some((c) => c.id === saved.id);
                if (exists) {
                  return prev.map((c) =>
                    c.id === saved.id ? { ...c, name: saved.name, status: saved.status } : c,
                  );
                }
                return [
                  ...prev,
                  {
                    id: saved.id,
                    name: saved.name,
                    parentId: data.parentId ?? null,
                    displayOrder: saved.sortOrder ?? 0,
                    status: saved.status || 'active',
                  },
                ];
              });
            }
          })
          .catch((err) => console.warn('Failed to save category to API:', err));

        // Optimistic local state update
        if (data.id) {
          setCategories((prev) =>
            prev.map((c) => (c.id === data.id ? { ...c, ...data, name } : c)),
          );
        } else {
          setCategories((prev) => [
            ...prev,
            { ...data, id: createMasterId('cat'), name, parentId: data.parentId ?? null },
          ]);
        }
        return true;
      },
      deleteCategory: (id) => {
        // Backend rejects deleting a category that still has subcategories.
        // Mirror that check locally so the UI doesn't pretend it worked.
        const hasChildren = categories.some((c) => c.parentId === id);
        if (hasChildren) {
          const message = 'This category has subcategories. Delete them first.';
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(message);
          } else {
            console.warn(message);
          }
          return;
        }
        api
          .delete(`/categories/${id}`)
          .catch((err) => console.warn('Failed to delete category from API:', err));
        setCategories((prev) => prev.filter((c) => c.id !== id));
      },
      addCategory: (name) =>
        addByName(categories, setCategories, name, 'cat', {
          parentId: null,
        } as Partial<CategoryMaster>),
      renameCategory: (from, to) => {
        const trimmed = normalizeName(to);
        if (!trimmed) return false;
        const target = categories.find((c) => !c.parentId && c.name === from);
        if (!target) return false;
        const siblings = categories.filter(
          (c) => !c.parentId && c.id !== target.id,
        );
        if (siblings.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return false;
        setCategories((prev) =>
          prev.map((c) => (c.id === target.id ? { ...c, name: trimmed } : c)),
        );
        return true;
      },
      deleteCategoryByName: (name) => {
        const target = categories.find((c) => !c.parentId && c.name === name);
        if (!target) return;
        setCategories((prev) => {
          const childIds = new Set(
            prev.filter((c) => c.parentId === target.id).map((c) => c.id),
          );
          return prev.filter((c) => c.id !== target.id && !childIds.has(c.id));
        });
      },
      addSubCategory: (parentName, name) => {
        const trimmed = normalizeName(name);
        if (!trimmed) return false;
        const parent = categories.find((c) => !c.parentId && c.name === parentName);
        if (!parent) return false;
        const siblings = categories.filter((c) => c.parentId === parent.id);
        if (siblings.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return false;
        setCategories((prev) => [
          ...prev,
          {
            id: createMasterId('cat'),
            name: trimmed,
            parentId: parent.id,
            status: 'active',
          },
        ]);
        return true;
      },
      renameSubCategory: (parentName, from, to) => {
        const trimmed = normalizeName(to);
        if (!trimmed) return false;
        const parent = categories.find((c) => !c.parentId && c.name === parentName);
        if (!parent) return false;
        const target = categories.find(
          (c) => c.parentId === parent.id && c.name === from,
        );
        if (!target) return false;
        const siblings = categories.filter(
          (c) => c.parentId === parent.id && c.id !== target.id,
        );
        if (siblings.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return false;
        setCategories((prev) =>
          prev.map((c) => (c.id === target.id ? { ...c, name: trimmed } : c)),
        );
        return true;
      },
      deleteSubCategory: (parentName, name) => {
        const parent = categories.find((c) => !c.parentId && c.name === parentName);
        if (!parent) return;
        setCategories((prev) =>
          prev.filter((c) => !(c.parentId === parent.id && c.name === name)),
        );
      },

      saveSupplier: (data) => {
        const isEdit = !!data.id;
        const method = isEdit ? 'put' : 'post';
        const url = isEdit ? `/admin/suppliers/${data.id}` : '/admin/suppliers';
        api[method](url, data).catch((err) => console.warn('Failed to save supplier:', err));
        return saveNamed(suppliers, setSuppliers, data, 'supplier');
      },
      deleteSupplier: (id) => {
        api
          .delete(`/admin/suppliers/${id}`)
          .catch((err) => console.warn('Failed to delete supplier:', err));
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
      },
      addSupplier: (name) => addByName(suppliers, setSuppliers, name, 'supplier'),
      renameSupplier: (from, to) => renameByName(suppliers, setSuppliers, from, to),
      deleteSupplierByName: (name) => deleteByName(setSuppliers, name),
      findSupplierByName: (name) => suppliers.find((s) => s.name === name),

      saveDealer: (data) => {
        const isEdit = !!data.id;
        const method = isEdit ? 'put' : 'post';
        const url = isEdit ? `/admin/dealers/${data.id}` : '/admin/dealers';
        api[method](url, data).catch((err) => console.warn('Failed to save dealer:', err));
        
        // Use 'dealerCode' or 'dealerName' for the 'name' field which is required by saveNamed 
        const mappedData = { ...data, name: data.dealerName || data.dealerCode || 'Dealer' };
        return saveNamed(dealers, setDealers, mappedData, 'dealer');
      },
      deleteDealer: (id) => {
        api
          .delete(`/admin/dealers/${id}`)
          .catch((err) => console.warn('Failed to delete dealer:', err));
        setDealers((prev) => prev.filter((d) => d.id !== id));
      },
      addDealer: (name) => addByName(dealers, setDealers, name, 'dealer'),
      renameDealer: (from, to) => renameByName(dealers, setDealers, from, to),
      deleteDealerByName: (name) => deleteByName(setDealers, name),
      findDealerByName: (name) => dealers.find((d) => d.name === name),

      saveWholesaler: (data) =>
        saveNamedSynced(wholesalers, setWholesalers, data, 'wholesaler', '/admin/wholesalers'),
      deleteWholesaler: (id) => {
        setWholesalers((prev) => prev.filter((w) => w.id !== id));
        syncDelete('/admin/wholesalers', id);
      },
      addWholesaler: (name) =>
        addByNameSynced(wholesalers, setWholesalers, name, 'wholesaler', '/admin/wholesalers'),
      renameWholesaler: (from, to) =>
        renameByNameSynced(wholesalers, setWholesalers, from, to, '/admin/wholesalers'),
      deleteWholesalerByName: (name) =>
        deleteByNameSynced(wholesalers, setWholesalers, name, '/admin/wholesalers'),

      saveWarehouse: (data) => {
        const isEdit = !!data.id;
        const method = isEdit ? 'put' : 'post';
        const url = isEdit ? `/admin/warehouses/${data.id}` : '/admin/warehouses';
        api[method](url, data).catch((err) => console.warn('Failed to save warehouse:', err));
        return saveNamed(warehouses, setWarehouses, data, 'warehouse');
      },
      deleteWarehouse: (id) => {
        api
          .delete(`/admin/warehouses/${id}`)
          .catch((err) => console.warn('Failed to delete warehouse:', err));
        setWarehouses((prev) => prev.filter((w) => w.id !== id));
      },
      addWarehouse: (name) => addByName(warehouses, setWarehouses, name, 'warehouse'),
      renameWarehouse: (from, to) => renameByName(warehouses, setWarehouses, from, to),
      deleteWarehouseByName: (name) => deleteByName(setWarehouses, name),

      saveDeliveryPartner: (data) =>
        saveNamedSynced(
          deliveryPartners,
          setDeliveryPartners,
          data,
          'partner',
          '/admin/delivery_partners',
        ),
      deleteDeliveryPartner: (id) => {
        setDeliveryPartners((prev) => prev.filter((p) => p.id !== id));
        syncDelete('/admin/delivery_partners', id);
      },
      addDeliveryPartner: (name) =>
        addByNameSynced(
          deliveryPartners,
          setDeliveryPartners,
          name,
          'partner',
          '/admin/delivery_partners',
          { serviceableZones: [] } as Partial<DeliveryPartnerMaster>,
        ),
      renameDeliveryPartner: (from, to) => {
        const ok = renameByNameSynced(
          deliveryPartners,
          setDeliveryPartners,
          from,
          to,
          '/admin/delivery_partners',
        );
        return ok;
      },
      deleteDeliveryPartnerByName: (name) =>
        deleteByNameSynced(
          deliveryPartners,
          setDeliveryPartners,
          name,
          '/admin/delivery_partners',
        ),

      saveDeliveryZone: (data) => {
        const ok = saveNamedSynced(
          deliveryZones,
          setDeliveryZones,
          data,
          'zone',
          '/admin/delivery_zones',
        );
        if (ok && data.id) {
          const old = deliveryZones.find((z) => z.id === data.id);
          if (old && old.name !== data.name.trim()) {
            const newName = data.name.trim();
            setDeliveryPartners((prev) =>
              prev.map((p) => ({
                ...p,
                serviceableZones: (p.serviceableZones || []).map((z) =>
                  z === old.name ? newName : z,
                ),
              })),
            );
          }
        }
        return ok;
      },
      deleteDeliveryZone: (id) => {
        const zone = deliveryZones.find((z) => z.id === id);
        setDeliveryZones((prev) => prev.filter((z) => z.id !== id));
        syncDelete('/admin/delivery_zones', id);
        if (zone) {
          setDeliveryPartners((prev) =>
            prev.map((p) => ({
              ...p,
              serviceableZones: (p.serviceableZones || []).filter((z) => z !== zone.name),
            })),
          );
        }
      },
      addDeliveryZone: (name) =>
        addByNameSynced(deliveryZones, setDeliveryZones, name, 'zone', '/admin/delivery_zones'),
      renameDeliveryZone: (from, to) => {
        const trimmed = normalizeName(to);
        if (!trimmed) return false;
        const ok = renameByNameSynced(
          deliveryZones,
          setDeliveryZones,
          from,
          to,
          '/admin/delivery_zones',
        );
        if (ok) {
          setDeliveryPartners((prev) =>
            prev.map((p) => ({
              ...p,
              serviceableZones: (p.serviceableZones || []).map((z) =>
                z === from ? trimmed : z,
              ),
            })),
          );
        }
        return ok;
      },
      deleteDeliveryZoneByName: (name) => {
        deleteByNameSynced(deliveryZones, setDeliveryZones, name, '/admin/delivery_zones');
        setDeliveryPartners((prev) =>
          prev.map((p) => ({
            ...p,
            serviceableZones: (p.serviceableZones || []).filter((z) => z !== name),
          })),
        );
      },

      saveBranch: (data) => {
        const name = normalizeName(data.name);
        const branchCode = normalizeName(data.branchCode);
        if (!name || !branchCode) return false;
        if (nameTaken(branches, name, data.id)) return false;
        if (
          branches.some(
            (b) =>
              b.id !== data.id &&
              b.branchCode.toLowerCase() === branchCode.toLowerCase(),
          )
        ) {
          return false;
        }

        const isEdit = !!data.id;
        const payload = {
          ...data,
          name,
          branchCode,
          city: data.city.trim(),
          state: data.state.trim(),
          branchManager: data.branchManager.trim(),
          mobile: data.mobile.trim(),
        };

        if (isEdit) {
          const old = branches.find((b) => b.id === data.id);
          const item = { ...payload, id: data.id } as BranchMaster;
          setBranches((prev) =>
            prev.map((b) => (b.id === data.id ? { ...b, ...item } : b)),
          );
          if (old && old.name !== name) {
            setPincodes((prev) =>
              prev.map((p) =>
                p.branchName === old.name ? { ...p, branchName: name } : p,
              ),
            );
          }
          // Prefer PUT. If the id only exists locally (never POSTed), create it.
          api
            .put(`/admin/branches/${data.id}`, item)
            .catch((err) => {
              if (err?.response?.status === 404) {
                return api.post('/admin/branches', item);
              }
              console.warn('Failed to save branch:', err);
              return undefined;
            })
            .catch((err) => console.warn('Failed to save branch:', err));
        } else {
          const item = { ...payload, id: createMasterId('branch') } as BranchMaster;
          setBranches((prev) => [...prev, item]);
          api
            .post('/admin/branches', item)
            .catch((err) => console.warn('Failed to save branch:', err));
        }
        return true;
      },

      savePincode: (data) => {
        const pincode = normalizeName(data.pincode);
        if (!pincode) return false;
        if (pincodes.some((p) => p.id !== data.id && p.pincode === pincode)) {
          return false;
        }
        if (!normalizeName(data.branchName || '')) return false;

        const payload: PincodeMaster = {
          id: data.id || createMasterId('pincode'),
          name: pincode,
          pincode,
          city: data.city.trim(),
          state: data.state.trim(),
          branchName: data.branchName.trim(),
          status: data.status,
        };

        if (data.id) {
          setPincodes((prev) =>
            prev.map((item) => (item.id === data.id ? payload : item)),
          );
          syncUpsert('/admin/pincodes', payload);
        } else {
          setPincodes((prev) => [...prev, payload]);
          syncUpsert('/admin/pincodes', payload);
        }
        return true;
      },
    };
  }, [
    brands,
    categories,
    categoryTree,
    suppliers,
    dealers,
    wholesalers,
    warehouses,
    deliveryPartners,
    deliveryZones,
    branches,
    pincodes,
  ]);

  return (
    <MasterDataContext.Provider value={value}>{children}</MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const ctx = useContext(MasterDataContext);
  if (!ctx) throw new Error('useMasterData must be used within MasterDataProvider');
  return ctx;
}

/** Active display names for wizard dropdowns. */
export function activeNames<T extends { name: string; status: string }>(
  items: T[],
): string[] {
  return items.filter((i) => i.status === 'active').map((i) => i.name);
}
