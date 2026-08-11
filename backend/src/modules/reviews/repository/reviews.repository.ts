import { jsonDb } from '../../../config/json-db';

export class ReviewsRepository {
  findByProduct(productId: string) {
    const reviews = jsonDb.findMany('reviews', { productId });
    return reviews
      .sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .map((r: any) => ({
        ...r,
        user: { id: r.userId, fullName: r.userName || r.userFullName || 'Customer' },
      }));
  }

  findByUserAndProduct(userId: string, productId: string) {
    const review = jsonDb.findOne('reviews', { userId, productId });
    if (!review) return null;
    return {
      ...review,
      user: { id: review.userId, fullName: review.userName || 'Customer' },
    };
  }

  findById(reviewId: string) {
    const review = jsonDb.findOne('reviews', { id: reviewId });
    if (!review) return null;
    return {
      ...review,
      user: { id: review.userId, fullName: review.userName || 'Customer' },
    };
  }

  async hasEligibleOrder(userId: string, productId: string) {
    await jsonDb.ensureCollection('orders');
    const order = jsonDb.findOne('orders', { userId, productId });
    return order ? { id: order.id } : null;
  }

  async productExists(productId: string) {
    const needle = String(productId || '').trim();
    if (!needle) return null;
    // Accept UUID id or SEO slug — PDP routes often use /products/:slug.
    const byId = jsonDb.findOne('products', { id: needle });
    if (byId?.id) return { id: String(byId.id) };
    const bySlug = jsonDb.findOne('products', { slug: needle });
    if (bySlug?.id) return { id: String(bySlug.id) };
    const lower = needle.toLowerCase();
    const fuzzy = jsonDb
      .findMany('products')
      .find((row: any) => String(row?.slug || '').toLowerCase() === lower);
    return fuzzy?.id ? { id: String(fuzzy.id) } : null;
  }

  create(input: { userId: string; productId: string; rating: number; review: string; userName?: string }) {
    const review = jsonDb.insert('reviews', {
      userId: input.userId,
      productId: input.productId,
      rating: input.rating,
      review: input.review,
      userName: input.userName || 'Customer',
    });
    return {
      ...review,
      user: { id: review.userId, fullName: review.userName || 'Customer' },
    };
  }

  update(reviewId: string, data: { rating?: number; review?: string }) {
    const updated = jsonDb.update('reviews', { id: reviewId }, data);
    if (!updated) return null;
    return {
      ...updated,
      user: { id: updated.userId, fullName: updated.userName || 'Customer' },
    };
  }

  delete(reviewId: string) {
    return jsonDb.delete('reviews', { id: reviewId });
  }

  async getAggregate(productId: string) {
    const reviews = jsonDb.findMany('reviews', { productId });
    if (reviews.length === 0) {
      return { averageRating: 0, totalReviews: 0 };
    }
    const avg =
      reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length;
    return {
      averageRating: Math.round(avg * 10) / 10,
      totalReviews: reviews.length,
    };
  }
}

export const reviewsRepository = new ReviewsRepository();
