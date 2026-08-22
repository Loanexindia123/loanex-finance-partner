import { jsonDb } from '../../../config/json-db';
import type { ListProductsQuery } from '../dto/product.dto';
import {
  applyCustomerCatalogVisibility,
  isCustomerVisibleProduct,
} from '../utils/customer-visibility';

export type ProductWithReviewStats = any & {
  averageRating: number;
  reviewCount: number;
};

/** Short TTL cache to cut repeat list latency after cold start. */
const listCache = new Map<string, { expires: number; value: { rows: any[]; total: number } }>();
const LIST_CACHE_TTL_MS = 15_000;
const filtersCache: { expires: number; value: any } = { expires: 0, value: null };

export class ProductRepository {
  private resolveCategoryName(categoryId: string | undefined): string {
    if (!categoryId) return '';
    const cat = jsonDb.findOne('categories', { id: categoryId });
    return cat?.name ?? '';
  }

  private enrichProduct(row: any): any {
    return {
      ...row,
      category: row.category || this.resolveCategoryName(row.categoryId),
      isFeatured: row.featured ?? row.isFeatured ?? false,
      rating: row.rating ?? 0,
      totalReviews: row.totalReviews ?? 0,
      emiStartingFrom: row.emiStartingFrom ?? null,
      deliveryCharge: row.deliveryCharge ?? row.deliveryCharges ?? 0,
      discountPrice:
        row.discountPrice ??
        (row.mrp && row.price && row.mrp > row.price ? row.price : null),
      variants: row.variants ?? [],
    };
  }

  async list(
    reqQuery: ListProductsQuery,
    options?: {
      forceCustomerVisible?: boolean;
      /** When set, restrict to these creatorIds before search/pagination. */
      allowedCreatorIds?: Set<string>;
      /** Dealer profile id — include products stamped with this dealerId when allowDealerIdMatch. */
      dealerId?: string;
      allowDealerIdMatch?: boolean;
    },
  ) {
    const effectiveQuery: ListProductsQuery = options?.forceCustomerVisible
      ? { ...reqQuery, status: undefined }
      : reqQuery;
    const creatorKey =
      options?.allowedCreatorIds != null
        ? [...options.allowedCreatorIds].sort().join(',')
        : '';
    const cacheKey = JSON.stringify({
      ...effectiveQuery,
      forceCustomerVisible: !!options?.forceCustomerVisible,
      allowedCreatorIds: creatorKey,
      dealerId: options?.dealerId ?? '',
      allowDealerIdMatch: Boolean(options?.allowDealerIdMatch),
    });
    await jsonDb.refreshCatalogThrottled();
    const cached = listCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const page = Number(effectiveQuery.page) || 1;
    const limit = Math.min(Number(effectiveQuery.limit) || 12, 500);
    const offset = (page - 1) * limit;

    let rows = jsonDb.getCollection('products').slice();

    // Employee/Dealer/Agent hierarchy scope: apply BEFORE search / filters / pagination.
    // Customer catalog (forceCustomerVisible) never receives this option.
    if (options?.allowedCreatorIds) {
      const allowed = options.allowedCreatorIds;
      const dealerId = String(options.dealerId ?? '').trim();
      const allowDealerIdMatch = Boolean(options.allowDealerIdMatch) && !!dealerId;
      rows = rows.filter((p: any) => {
        const owner = String(p.creatorId ?? '').trim();
        if (owner && allowed.has(owner)) return true;
        if (allowDealerIdMatch && String(p.dealerId ?? '').trim() === dealerId) return true;
        return false;
      });
    }

    if (options?.forceCustomerVisible) {
      rows = rows.filter((p: any) => p.status === 'active');
    } else if (effectiveQuery.status && effectiveQuery.status !== 'all') {
      rows = rows.filter((p: any) => p.status === effectiveQuery.status);
    } else if (!effectiveQuery.status) {
      rows = rows.filter((p: any) => p.status === 'active');
    }

    // Hide incomplete wizard placeholders / non-published from the customer catalog.
    rows = applyCustomerCatalogVisibility(rows, effectiveQuery, {
      forceCustomerVisible: options?.forceCustomerVisible,
    });

    if (reqQuery.search) {
      const s = reqQuery.search.toLowerCase();
      rows = rows.filter((p: any) => {
        const name = String(p.name ?? '').toLowerCase();
        const brand = String(p.brand ?? '').toLowerCase();
        const sku = String(p.sku ?? '').toLowerCase();
        const barcode = String(p.barcode ?? '').toLowerCase();
        const productType = String(p.productType ?? '').toLowerCase();
        return (
          name.includes(s) ||
          brand.includes(s) ||
          sku.includes(s) ||
          barcode.includes(s) ||
          productType.includes(s)
        );
      });
    }

    if (reqQuery.brand) {
      const b = reqQuery.brand.toLowerCase();
      rows = rows.filter((p: any) => p.brand?.toLowerCase() === b);
    }

    if (reqQuery.category) {
      const catName = reqQuery.category.toLowerCase();
      rows = rows.filter((p: any) => {
        const resolved = (p.category || this.resolveCategoryName(p.categoryId)).toLowerCase();
        return resolved === catName;
      });
    }

    if (reqQuery.minPrice !== undefined) {
      rows = rows.filter((p: any) => Number(p.price) >= reqQuery.minPrice!);
    }

    if (reqQuery.maxPrice !== undefined) {
      rows = rows.filter((p: any) => Number(p.price) <= reqQuery.maxPrice!);
    }

    if (reqQuery.availability === 'IN_STOCK') {
      rows = rows.filter((p: any) => Number(p.stock) > 0);
    } else if (reqQuery.availability === 'OUT_OF_STOCK') {
      rows = rows.filter((p: any) => Number(p.stock) <= 0);
    }

    if (reqQuery.emiAvailable !== undefined) {
      rows = rows.filter((p: any) => Boolean(p.emiAvailable) === reqQuery.emiAvailable);
    }

    if (reqQuery.featured === true) {
      rows = rows.filter((p: any) => p.featured === true || p.isFeatured === true);
    }

    if (reqQuery.trending === true) {
      rows = rows.filter((p: any) => p.trending === true);
    }

    if (reqQuery.recommended === true || reqQuery.newArrival === true) {
      rows = rows.filter((p: any) => p.recommended === true || p.newArrival === true);
    }

    if (reqQuery.sort === 'price_asc') {
      rows.sort((a: any, b: any) => Number(a.price) - Number(b.price));
    } else if (reqQuery.sort === 'price_desc') {
      rows.sort((a: any, b: any) => Number(b.price) - Number(a.price));
    } else if (reqQuery.sort === 'name') {
      rows.sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''));
    } else {
      rows.sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    }

    const total = rows.length;
    const pageRows = rows.slice(offset, offset + limit).map((r: any) => ({ ...r }));

    const value = {
      rows: pageRows.map((r: any) => this.enrichProduct(r)),
      total,
    };
    listCache.set(cacheKey, { expires: Date.now() + LIST_CACHE_TTL_MS, value });
    if (listCache.size > 100) {
      const first = listCache.keys().next().value;
      if (first) listCache.delete(first);
    }
    return value;
  }

  async findById(productId: string) {
    await jsonDb.refreshCatalogThrottled();
    const row = jsonDb.findOne('products', { id: productId });
    return row ? this.enrichProduct(row) : null;
  }

  async findVariantForProduct(_productId: string, _variantId: string) {
    return null;
  }

  async findDefaultVariant(_productId: string) {
    return null;
  }

  async findByIdWithVariants(productId: string) {
    await jsonDb.refreshCatalogThrottled();
    const row = jsonDb.findOne('products', { id: productId });
    if (!row) return null;
    const product = this.enrichProduct(row);
    const emiPlans = jsonDb.findMany('product_emi_plans', { productId }).sort(
      (a: any, b: any) => Number(a.months) - Number(b.months),
    );
    return { ...product, productEmiPlans: emiPlans };
  }

  async findBySlug(slug: string) {
    await jsonDb.refreshCatalogThrottled();
    const row = jsonDb.findOne('products', { slug });
    return row ? this.enrichProduct(row) : null;
  }

  async findBySlugWithVariants(slug: string) {
    await jsonDb.refreshCatalogThrottled();
    const row = jsonDb.findOne('products', { slug });
    if (!row) return null;
    const product = this.enrichProduct(row);
    const emiPlans = jsonDb.findMany('product_emi_plans', { productId: product.id }).sort(
      (a: any, b: any) => Number(a.months) - Number(b.months),
    );
    return { ...product, productEmiPlans: emiPlans };
  }

  async create(data: any) {
    listCache.clear();
    filtersCache.expires = 0;
    return jsonDb.insertAwaited('products', data);
  }

  async update(id: string, data: any) {
    listCache.clear();
    filtersCache.expires = 0;
    return jsonDb.updateAwaited('products', { id }, data);
  }

  async remove(id: string) {
    listCache.clear();
    filtersCache.expires = 0;
    const existing = jsonDb.findOne('products', { id });
    if (!existing) return null;
    // Remove orphaned EMI plans for this product
    const plans = jsonDb.findMany('product_emi_plans', { productId: id });
    for (const plan of plans) {
      await jsonDb.deleteAwaited('product_emi_plans', { id: plan.id });
    }
    await jsonDb.deleteAwaited('products', { id });
    return existing;
  }

  async getReviewStats(productIds: string[]) {
    if (productIds.length === 0)
      return new Map<string, { averageRating: number; reviewCount: number }>();

    await jsonDb.ensureCollection('reviews');
    const allReviews = jsonDb.getCollection('reviews');
    const byProduct = new Map<string, any[]>();
    for (const review of allReviews) {
      const pid = String(review.productId ?? '');
      if (!pid) continue;
      const bucket = byProduct.get(pid);
      if (bucket) bucket.push(review);
      else byProduct.set(pid, [review]);
    }

    const map = new Map<string, { averageRating: number; reviewCount: number }>();
    for (const pid of productIds) {
      const reviews = byProduct.get(pid) ?? [];
      if (reviews.length === 0) {
        map.set(pid, { averageRating: 0, reviewCount: 0 });
      } else {
        const avg =
          reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) /
          reviews.length;
        map.set(pid, { averageRating: Math.round(avg * 10) / 10, reviewCount: reviews.length });
      }
    }
    return map;
  }

  async getDistinctFilters() {
    await jsonDb.refreshCatalogThrottled();
    if (filtersCache.expires > Date.now() && filtersCache.value) {
      return filtersCache.value;
    }

    const products = jsonDb
      .findMany('products')
      .filter((p: any) => isCustomerVisibleProduct(p));
    const brandSet = new Set<string>();
    const categorySet = new Set<string>();

    for (const p of products) {
      if (p.brand) brandSet.add(p.brand);
      const catName = p.category || this.resolveCategoryName(p.categoryId);
      if (catName) categorySet.add(catName);
    }

    const value = {
      brands: Array.from(brandSet).sort(),
      categories: Array.from(categorySet).sort(),
    };
    filtersCache.expires = Date.now() + LIST_CACHE_TTL_MS;
    filtersCache.value = value;
    return value;
  }
}

export const productRepository = new ProductRepository();
