import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { jsonDb } from '../../../config/json-db';
import type { CreateReviewBody, UpdateReviewBody } from '../dto/reviews.dto';
import { reviewsRepository } from '../repository/reviews.repository';

function mapReviewItem(
  row: {
    id: string;
    userId: string;
    rating: number;
    review: string;
    createdAt: Date;
    updatedAt: Date;
    user: { fullName: string };
  },
  currentUserId?: string,
) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.fullName,
    rating: row.rating,
    review: row.review,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(currentUserId && row.userId === currentUserId ? { isOwn: true as const } : {}),
  };
}

export class ReviewsService {
  async create(userId: string, input: CreateReviewBody) {
    await jsonDb.ensureCollection('reviews');
    const product = await reviewsRepository.productExists(input.productId);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }

    const productId = product.id;
    const existing = await reviewsRepository.findByUserAndProduct(userId, productId);
    if (existing) {
      throw new ConflictError('You have already reviewed this product.', {
        reviewId: existing.id,
      });
    }

    const eligibleOrder = await reviewsRepository.hasEligibleOrder(userId, productId);
    if (!eligibleOrder) {
      throw new ForbiddenError(
        'You can only review products from non-cancelled orders.',
      );
    }

    const created = await reviewsRepository.create({
      userId,
      productId,
      rating: input.rating,
      review: input.review,
    });

    return mapReviewItem(created, userId);
  }

  async listByProduct(productIdOrSlug: string, currentUserId?: string) {
    await jsonDb.ensureCollection('reviews');
    const product = await reviewsRepository.productExists(productIdOrSlug);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }

    const productId = product.id;
    const [rows, aggregate, myReviewRow] = await Promise.all([
      reviewsRepository.findByProduct(productId),
      reviewsRepository.getAggregate(productId),
      currentUserId
        ? reviewsRepository.findByUserAndProduct(currentUserId, productId)
        : Promise.resolve(null),
    ]);

    return {
      productId,
      averageRating: aggregate.averageRating,
      totalReviews: aggregate.totalReviews,
      items: rows.map((row: Parameters<typeof mapReviewItem>[0]) =>
        mapReviewItem(row, currentUserId),
      ),
      myReview: myReviewRow ? mapReviewItem(myReviewRow, currentUserId) : null,
    };
  }

  async update(userId: string, reviewId: string, input: UpdateReviewBody) {
    await jsonDb.ensureCollection('reviews');
    const existing = await reviewsRepository.findById(reviewId);
    if (!existing) {
      throw new NotFoundError('Review not found.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('You can only update your own reviews.');
    }

    const updated = await reviewsRepository.update(reviewId, {
      rating: input.rating,
      review: input.review,
    });

    return mapReviewItem(updated, userId);
  }

  async delete(userId: string, reviewId: string) {
    await jsonDb.ensureCollection('reviews');
    const existing = await reviewsRepository.findById(reviewId);
    if (!existing) {
      throw new NotFoundError('Review not found.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError('You can only delete your own reviews.');
    }

    await reviewsRepository.delete(reviewId);

    return { deleted: true, reviewId };
  }
}

export const reviewsService = new ReviewsService();
