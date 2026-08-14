import { Product } from '../types';
import { api } from '../lib/apiClient';
import { withResolvedProductImages } from '../utils/mediaUrl';

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'discount';

export interface FilterOptions {
  query?: string;
  categoryIds?: string[];
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  emiOnly?: boolean;
  minRating?: number;
  sort?: SortOption;
}

/** Coalesce concurrent getProducts() callers onto one in-flight request. */
let productsInFlight: Promise<Product[]> | null = null;

function mapProduct(p: Record<string, unknown>): Product {
  const resolved = withResolvedProductImages(p);
  return {
    ...resolved,
    image:
      (resolved.image as string) ||
      (resolved.imageUrl as string) ||
      (resolved.thumbnail as string) ||
      '',
    originalPrice: (resolved.originalPrice as number) || (resolved.mrp as number) || (resolved.price as number),
    price: (resolved.discountPrice as number) || (resolved.price as number),
    reviews:
      (resolved.reviewCount as number) ||
      (resolved.totalReviews as number) ||
      (resolved.reviews as number) ||
      0,
    rating: (resolved.averageRating as number) || (resolved.rating as number) || 0,
  } as Product;
}

export async function getProducts(): Promise<Product[]> {
  if (productsInFlight) return productsInFlight;

  productsInFlight = (async () => {
    try {
      const res = await api.get('/products');
      const items = res.data?.items || res.data || [];
      return (items as Record<string, unknown>[]).map(mapProduct);
    } catch (err: any) {
      console.error('Error fetching products:', err.message);
      return [];
    } finally {
      productsInFlight = null;
    }
  })();

  return productsInFlight;
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const res = await api.get(`/products/${id}`);
    const p = res.data;
    if (!p) return null;
    return mapProduct(p as Record<string, unknown>);
  } catch {
    try {
      const res = await api.get(`/legacy/products/${id}`);
      return res.data ? mapProduct(res.data as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

/** Pure client-side filter/sort — same rules as before, no network. */
export function applyProductFilters(products: Product[], opts: FilterOptions): Product[] {
  let rows = products.slice();

  if (opts.query?.trim()) {
    const q = opts.query.toLowerCase().trim();
    rows = rows.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  if (opts.categoryIds?.length) {
    const cats = opts.categoryIds.map(c => c.toLowerCase());
    rows = rows.filter(p =>
      cats.includes((p.categoryId || '').toLowerCase()) ||
      cats.includes((p.category || '').toLowerCase()) ||
      cats.includes((p.slug || '').toLowerCase()) ||
      cats.includes((p.id || '').toLowerCase())
    );
  }

  if (opts.brands?.length) {
    const brands = opts.brands.map(b => b.toLowerCase());
    rows = rows.filter(p =>
      brands.includes((p.brand || '').toLowerCase()) ||
      brands.includes((p.brandId || '').toLowerCase())
    );
  }

  if (opts.minPrice !== undefined) {
    rows = rows.filter(p => p.price >= opts.minPrice!);
  }
  if (opts.maxPrice !== undefined) {
    rows = rows.filter(p => p.price <= opts.maxPrice!);
  }

  if (opts.emiOnly) {
    rows = rows.filter(p => p.emiAvailable);
  }

  if (opts.minRating !== undefined) {
    rows = rows.filter(p => p.rating >= opts.minRating!);
  }

  if (opts.sort) {
    switch (opts.sort) {
      case 'price_asc':
        rows.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        rows.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        rows.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case 'discount':
        rows.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
        break;
    }
  }

  return rows;
}

export async function filterAndSortProducts(opts: FilterOptions): Promise<Product[]> {
  return applyProductFilters(await getProducts(), opts);
}

export function brandsFromProducts(products: Product[]): string[] {
  const brands = new Set<string>();
  for (const p of products) {
    if (p.brand) brands.add(p.brand);
  }
  return Array.from(brands).sort();
}

export function priceRangeFromProducts(products: Product[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 100000 };
  const prices = products.map(p => p.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

export async function getAllBrands(): Promise<string[]> {
  return brandsFromProducts(await getProducts());
}

export async function getPriceRange(): Promise<{ min: number; max: number }> {
  return priceRangeFromProducts(await getProducts());
}

export async function searchProducts(query: string): Promise<Product[]> {
  return filterAndSortProducts({ query });
}

export async function getAllProducts(): Promise<Product[]> { return getProducts(); }
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return filterAndSortProducts({ categoryIds: [categoryId] });
}
export async function getFeaturedProducts(): Promise<Product[]> { return getProducts(); }
export async function getDeals(): Promise<Product[]> { return getProducts(); }
export async function getTrendingProducts(): Promise<Product[]> { return getProducts(); }
export async function getRecommendedProducts(): Promise<Product[]> { return getProducts(); }
export async function getNewArrivals(): Promise<Product[]> { return getProducts(); }

export async function createProduct() { throw new Error('Not implemented'); }
export async function updateProduct() { throw new Error('Not implemented'); }
export async function deleteProduct() { throw new Error('Not implemented'); }
