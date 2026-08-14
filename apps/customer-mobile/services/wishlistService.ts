import { api } from '../lib/apiClient';
import { WishlistItem, Product } from '../types';
import { withResolvedProductImages } from '../utils/mediaUrl';

function mapProduct(p: any): Product {
  const resolved = withResolvedProductImages({ ...(p || {}) });
  return {
    ...resolved,
    image: resolved.image || resolved.imageUrl || '',
    originalPrice: resolved.originalPrice || resolved.mrp || resolved.price,
    price: resolved.discountPrice || resolved.price,
    reviews: resolved.reviewCount || resolved.totalReviews || resolved.reviews || 0,
    rating: resolved.averageRating || resolved.rating || 0,
  } as Product;
}

function mapWishlistItem(data: any, product?: Product): WishlistItem {
  return {
    id: data.id,
    userId: data.userId || data.user_id,
    productId: data.productId || data.product_id,
    product: product || (data.product ? mapProduct(data.product) : undefined),
    createdAt: data.createdAt || data.created_at,
  };
}

/** Wishlist via Backend API → MongoDB (no direct Supabase). */
export async function getWishlist(_userId: string): Promise<WishlistItem[]> {
  try {
    const res = await api.get('/wishlist');
    const items = res.data?.items || res.data || [];
    return (items as any[]).map((row) => mapWishlistItem(row, row.product ? mapProduct(row.product) : undefined));
  } catch (err: any) {
    console.error('Error fetching wishlist:', err?.message || err);
    return [];
  }
}

export async function addToWishlist(_userId: string, productId: string): Promise<void> {
  await api.post('/wishlist', { productId });
}

export async function removeFromWishlist(_userId: string, productId: string): Promise<void> {
  // Backend supports DELETE /wishlist/:id — resolve by product via list
  const items = await getWishlist(_userId);
  const match = items.find((i) => i.productId === productId);
  if (match?.id) {
    await api.delete(`/wishlist/${match.id}`);
    return;
  }
  await api.delete(`/wishlist/product/${productId}`).catch(async () => {
    // Fallback: some deployments use query form
    await api.post('/wishlist/remove', { productId }).catch(() => undefined);
  });
}

export async function isInWishlist(_userId: string, productId: string): Promise<boolean> {
  try {
    const res = await api.get(`/wishlist/status/${productId}`);
    return Boolean(res.data?.inWishlist ?? res.data?.exists ?? false);
  } catch {
    const items = await getWishlist(_userId);
    return items.some((i) => i.productId === productId);
  }
}
