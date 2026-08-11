import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { AuthService } from '../../../../../core/services/auth.service';
import { ProductDetails } from '../../../models/product-details.models';
import {
  ProductReviewsResponse,
  ReviewItem,
  ReviewsService,
} from '../../../services/reviews.service';

export interface RatingSummary {
  averageRating: number;
  totalReviews: number;
}

@Component({
  selector: 'app-specification',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, ReactiveFormsModule],
  templateUrl: './specification.html',
  styleUrl: './specification.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecificationComponent {
  readonly product = input.required<ProductDetails>();
  readonly productId = input<string>('');

  readonly ratingSummaryChange = output<RatingSummary>();

  private readonly reviewsApi = inject(ReviewsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly activeTab = signal<string | number>('overview');
  readonly overviewExpanded = signal(false);
  readonly reviewsLoading = signal(false);
  readonly reviewsError = signal<string | null>(null);
  readonly reviewsInfo = signal<string | null>(null);
  readonly reviewsData = signal<ProductReviewsResponse | null>(null);
  readonly editingReview = signal(false);
  readonly submitting = signal(false);

  readonly reviewForm = this.fb.nonNullable.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    review: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    effect(() => {
      const id = this.resolvedProductId();
      if (id) {
        this.loadReviews(id);
      }
    });
  }

  onTabChange(value: string | number | undefined): void {
    if (value !== undefined) {
      this.activeTab.set(value);
      if (value === 'reviews') {
        const id = this.resolvedProductId();
        // Same endpoint/params as the initial effect load — reuse when already loaded.
        if (id && this.reviewsData()?.productId === id) {
          return;
        }
        if (id) {
          this.loadReviews(id);
        }
      }
    }
  }

  toggleOverview(): void {
    this.overviewExpanded.update((value) => !value);
  }

  startEdit(review: ReviewItem): void {
    this.editingReview.set(true);
    this.reviewForm.patchValue({
      rating: review.rating,
      review: review.review,
    });
  }

  cancelEdit(): void {
    this.editingReview.set(false);
    this.reviewForm.reset({ rating: 5, review: '' });
  }

  submitReview(): void {
    if (this.reviewForm.invalid || this.submitting()) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    if (!this.auth.isAuthenticated()) {
      const id = this.resolvedProductId();
      void this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: `/products/${id}` },
      });
      return;
    }

    const productId = this.resolvedProductId();
    if (!productId) return;

    const value = this.reviewForm.getRawValue();
    this.submitting.set(true);
    this.reviewsError.set(null);
    this.reviewsInfo.set(null);

    const data = this.reviewsData();
    const myReview = data?.myReview;

    if (this.editingReview() && myReview) {
      this.reviewsApi
        .update(myReview.id, { rating: value.rating, review: value.review.trim() })
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.editingReview.set(false);
            this.reviewForm.reset({ rating: 5, review: '' });
            this.reviewsInfo.set('Review updated.');
            this.loadReviews(productId, true);
          },
          error: () => {
            this.submitting.set(false);
            this.reviewsError.set(this.reviewsApi.error() ?? 'Unable to update review.');
          },
        });
      return;
    }

    this.reviewsApi
      .create({
        productId,
        rating: value.rating,
        review: value.review.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.reviewForm.reset({ rating: 5, review: '' });
          this.reviewsInfo.set('Review submitted. Thank you!');
          this.loadReviews(productId, true);
        },
        error: () => {
          this.submitting.set(false);
          this.reviewsError.set(this.reviewsApi.error() ?? 'Unable to submit review.');
        },
      });
  }

  deleteReview(): void {
    const myReview = this.reviewsData()?.myReview;
    if (!myReview || this.submitting()) return;

    this.submitting.set(true);
    this.reviewsError.set(null);

    this.reviewsApi.delete(myReview.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.editingReview.set(false);
        this.reviewForm.reset({ rating: 5, review: '' });
        this.reviewsInfo.set('Review deleted.');
        this.loadReviews(this.resolvedProductId(), true);
      },
      error: () => {
        this.submitting.set(false);
        this.reviewsError.set(this.reviewsApi.error() ?? 'Unable to delete review.');
      },
    });
  }

  reviewCountLabel(): number {
    return this.reviewsData()?.totalReviews ?? this.product().reviewCount;
  }

  formatReviewDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private resolvedProductId(): string {
    // Prefer the loaded product UUID — route `:productId` may be a slug
    // (e.g. samsung-galaxy-...), which the reviews API rejects with 404.
    const fromProduct = this.product()?.id?.trim();
    if (fromProduct) return fromProduct;
    return this.productId()?.trim() || '';
  }

  private loadReviews(productId: string, force = false): void {
    if (!productId?.trim()) return;

    // In-memory reuse keyed by productId (tab open / same-product effect re-runs).
    if (!force && this.reviewsData()?.productId === productId) {
      return;
    }

    this.reviewsLoading.set(true);
    this.reviewsError.set(null);

    this.reviewsApi.listByProduct(productId).subscribe({
      next: (data) => {
        this.reviewsLoading.set(false);
        this.reviewsData.set(data);
        this.ratingSummaryChange.emit({
          averageRating: data.averageRating,
          totalReviews: data.totalReviews,
        });
      },
      error: () => {
        this.reviewsLoading.set(false);
        this.reviewsError.set(this.reviewsApi.error() ?? 'Unable to load reviews.');
      },
    });
  }
}
