import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogProduct } from '../../../products/services/products-api.service';
import { resolveMediaUrl } from '../../../../shared/utils/media-url';
import { HomeCategory } from '../../models/catalog.models';
import { HomeDataCacheService } from '../../services/home-data-cache.service';

@Component({
  selector: 'app-categories',
  imports: [RouterLink],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Categories {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly homeCache = inject(HomeDataCacheService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<HomeCategory[]>([]);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      // Shared with Popular / New Arrivals — one Home catalog HTTP call.
      this.homeCache
        .getCatalog(50)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.loading.set(false);
            this.categories.set(this.buildCategories(data.items, data.filters.categories));
          },
          error: () => {
            this.loading.set(false);
            this.error.set('Unable to load categories.');
            this.categories.set([]);
          },
        });
    });
  }

  private buildCategories(items: CatalogProduct[], filterCategories: string[]): HomeCategory[] {
    const categoryNames =
      filterCategories.length > 0
        ? filterCategories
        : [...new Set(items.map((item) => item.category))];

    const thumbnailByCategory = new Map<string, string>();
    for (const item of items) {
      const image = resolveMediaUrl(item.imageUrl || item.thumbnail);
      if (!thumbnailByCategory.has(item.category) && image) {
        thumbnailByCategory.set(item.category, image);
      }
    }

    return categoryNames.map((category) => ({
      id: category.toLowerCase().replace(/\s+/g, '-'),
      label: category,
      category,
      imageSrc:
        this.categoryImage(category) ??
        thumbnailByCategory.get(category) ??
        'assets/images/categories/appliance.svg',
      imageAlt: category,
    }));
  }

  /** Curated category art so labels always match the image. */
  private categoryImage(category: string): string | null {
    const key = category.trim().toLowerCase();
    const map: Record<string, string> = {
      smartphone:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
      smartphones:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
      mobile:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
      laptop:
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80',
      laptops:
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80',
      electronics:
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=400&q=80',
      audio:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
      'smart tv':
        'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80',
      refrigerator:
        'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80',
      refrigerators:
        'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80',
      'washing machine':
        'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=400&q=80',
      'washing machines':
        'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=400&q=80',
      'air conditioner':
        'https://images.pexels.com/photos/5493652/pexels-photo-5493652.jpeg?auto=compress&cs=tinysrgb&w=400',
    };
    return map[key] ?? null;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.dataset['fallback'] === '1') return;
    img.dataset['fallback'] = '1';
    img.src = 'assets/images/categories/appliance.svg';
  }
}
