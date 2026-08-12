import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { map, of, switchMap } from 'rxjs';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { resolveMediaUrl } from '../../../../core/config/api.config';
import { ProductService } from '../../../products/services/product.service';
import { BannerService } from '../../services/banner.service';
import {
  Banner,
  BannerPlacement,
  bannerPayload,
  normalizeBanner,
} from '../../models/banner.models';

const BANNER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BANNER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const STATUS_FILTER_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
] as const;

const PLACEMENT_FILTER_OPTIONS = [
  { label: 'All placements', value: 'all' },
  { label: 'Home hero', value: 'home' },
  { label: 'Promotional offer', value: 'promotional' },
  { label: 'Product highlight', value: 'product' },
] as const;

const PLACEMENT_OPTIONS: { label: string; value: BannerPlacement }[] = [
  { label: 'Home hero', value: 'home' },
  { label: 'Promotional offer', value: 'promotional' },
  { label: 'Product highlight', value: 'product' },
];

const PLACEMENT_HINTS: Record<BannerPlacement, string> = {
  home: 'Shows in the website home carousel and the app home slider.',
  promotional: 'Shows as the website mid-page offer banner and in the app home slider.',
  product: 'Shows in the website home carousel and the app home slider.',
};

const PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  home: 'Home hero',
  promotional: 'Promotional',
  product: 'Product',
};

@Component({
  selector: 'app-banner-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    DialogModule,
    ToggleSwitchModule,
    SelectModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './banner-list.html',
  styleUrl: './banner-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerList {
  private readonly banners = inject(BannerService);
  private readonly products = inject(ProductService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  private pendingImageFile: File | null = null;
  private pendingPreviewUrl = '';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly togglingId = signal('');
  readonly error = signal('');
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  readonly placementFilter = signal<'all' | BannerPlacement>('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 },
  ];
  readonly items = signal<Banner[]>([]);
  readonly dialogOpen = signal(false);
  readonly editing = signal<Banner | null>(null);
  readonly draftTitle = signal('');
  readonly draftSubtitle = signal('');
  readonly draftBadge = signal('');
  readonly draftImage = signal('');
  readonly draftLink = signal('/products');
  readonly draftPlacement = signal<BannerPlacement>('home');
  readonly draftSortOrder = signal(0);
  readonly draftActive = signal(true);

  readonly statusOptions = [...STATUS_FILTER_OPTIONS];
  readonly placementFilterOptions = [...PLACEMENT_FILTER_OPTIONS];
  readonly placementOptions = PLACEMENT_OPTIONS;

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const placement = this.placementFilter();
    let list = [...this.items()].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

    if (status !== 'all') {
      list = list.filter((item) => item.status === status);
    }
    if (placement !== 'all') {
      list = list.filter((item) => item.placement === placement);
    }
    if (!term) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.subtitle.toLowerCase().includes(term) ||
        item.badgeText.toLowerCase().includes(term),
    );
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      this.statusFilter() !== 'all' ||
      this.placementFilter() !== 'all',
  );

  readonly paged = computed(() => {
    const start = this.pageFirst();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly pageFrom = computed(() =>
    this.filtered().length === 0 ? 0 : this.pageFirst() + 1,
  );

  readonly pageTo = computed(() =>
    Math.min(this.pageFirst() + this.pageSize(), this.filtered().length),
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );

  readonly currentPage = computed(() =>
    Math.floor(this.pageFirst() / this.pageSize()) + 1,
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const end = Math.min(total, Math.max(1, current - 2) + 4);
    const from = Math.max(1, end - 4);
    return Array.from({ length: end - from + 1 }, (_, i) => from + i);
  });

  readonly dialogTitle = computed(() =>
    this.editing() ? 'Edit Banner' : 'Add Banner',
  );

  readonly placementHint = computed(() => PLACEMENT_HINTS[this.draftPlacement()]);

  placementLabel(placement: BannerPlacement | string): string {
    if (placement === 'promotional' || placement === 'product' || placement === 'home') {
      return PLACEMENT_LABELS[placement];
    }
    return placement || 'Home hero';
  }

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    tooltipStyleClass: 'catalog-tooltip',
  };

  constructor() {
    this.destroyRef.onDestroy(() => this.releasePendingImage());
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.banners
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.items.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(this.extractMessage(err));
        },
      });
  }

  imageSrc(banner: Banner): string {
    return resolveMediaUrl(banner.imageUrl);
  }

  hasImage(banner: Banner): boolean {
    return !!banner.imageUrl.trim();
  }

  openAdd(): void {
    this.editing.set(null);
    this.resetDraft();
    this.dialogOpen.set(true);
  }

  resetPage(): void {
    this.pageFirst.set(0);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    this.pageFirst.set((next - 1) * this.pageSize());
  }

  changePageSize(rows: number): void {
    this.pageSize.set(rows || 10);
    this.resetPage();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.placementFilter.set('all');
    this.resetPage();
  }

  openEdit(banner: Banner): void {
    this.releasePendingImage();
    this.editing.set(banner);
    this.draftTitle.set(banner.title);
    this.draftSubtitle.set(banner.subtitle);
    this.draftBadge.set(banner.badgeText);
    this.draftImage.set(banner.imageUrl);
    this.draftLink.set(banner.link || '/products');
    this.draftPlacement.set(banner.placement);
    this.draftSortOrder.set(banner.sortOrder);
    this.draftActive.set(banner.status === 'active');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editing.set(null);
    this.releasePendingImage();
    this.resetDraft();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const invalid = this.validateImageFile(file);
    if (invalid) {
      this.messages.add({ severity: 'error', summary: 'Invalid image', detail: invalid });
      return;
    }

    this.releasePendingImage();
    this.pendingImageFile = file;
    this.pendingPreviewUrl = URL.createObjectURL(file);
    this.draftImage.set(this.pendingPreviewUrl);
    this.cdr.markForCheck();
  }

  removeImage(): void {
    this.releasePendingImage();
    this.draftImage.set('');
  }

  isPendingImage(): boolean {
    return !!this.pendingImageFile;
  }

  previewImage(): string {
    return resolveMediaUrl(this.draftImage());
  }

  onPlacementChange(value: BannerPlacement): void {
    this.draftPlacement.set(value);
    if (this.editing()) return;
    if (value === 'promotional') this.draftSortOrder.set(10);
    else if (value === 'product') this.draftSortOrder.set(20);
    else this.draftSortOrder.set(0);
  }

  submit(): void {
    const title = this.draftTitle().trim();
    if (!title) {
      this.messages.add({
        severity: 'warn',
        summary: 'Title required',
        detail: 'Enter a banner title.',
      });
      return;
    }

    const image = this.draftImage().trim();
    if (!image && !this.pendingImageFile) {
      this.messages.add({
        severity: 'warn',
        summary: 'Image required',
        detail: 'Upload a banner image to show it on the website and app.',
      });
      return;
    }

    this.saving.set(true);
    const wasEdit = !!this.editing();
    this.flushPendingImage()
      .pipe(
        switchMap((imageUrl) => {
          const payload = bannerPayload({
            title,
            subtitle: this.draftSubtitle(),
            badgeText: this.draftBadge(),
            imageUrl: imageUrl || this.draftImage(),
            link: this.draftLink(),
            placement: this.draftPlacement(),
            sortOrder: this.draftSortOrder(),
            active: this.draftActive(),
          });
          const editing = this.editing();
          return editing
            ? this.banners.update(editing.id, payload).pipe(map(normalizeBanner))
            : this.banners.create(payload).pipe(map(normalizeBanner));
        }),
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          if (this.editing()) {
            this.items.update((list) => list.map((row) => (row.id === saved.id ? saved : row)));
          } else {
            this.items.update((list) => [...list, saved]);
          }
          this.closeDialog();
          this.messages.add({
            severity: 'success',
            summary: wasEdit ? 'Banner updated' : 'Banner added',
            detail: saved.status === 'active'
              ? 'It will appear on the website and app home screens.'
              : 'Inactive banners stay hidden until you enable them.',
          });
        },
        error: (err) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Save failed',
            detail: this.extractMessage(err),
          });
        },
      });
  }

  toggleStatus(banner: Banner, active: boolean): void {
    this.togglingId.set(banner.id);
    this.banners
      .update(banner.id, {
        ...bannerPayload({
          title: banner.title,
          subtitle: banner.subtitle,
          badgeText: banner.badgeText,
          imageUrl: banner.imageUrl,
          link: banner.link,
          placement: banner.placement,
          sortOrder: banner.sortOrder,
          active,
        }),
      })
      .pipe(map(normalizeBanner))
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((row) => (row.id === banner.id ? updated : row)));
          this.togglingId.set('');
        },
        error: (err) => {
          this.togglingId.set('');
          this.messages.add({
            severity: 'error',
            summary: 'Status update failed',
            detail: this.extractMessage(err),
          });
          this.load();
        },
      });
  }

  remove(banner: Banner): void {
    if (!confirm(`Delete banner "${banner.title}"?`)) return;
    this.banners.delete(banner.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((row) => row.id !== banner.id));
        this.messages.add({ severity: 'success', summary: 'Banner deleted' });
      },
      error: (err) => {
        this.messages.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private flushPendingImage() {
    if (!this.pendingImageFile) {
      return of(this.draftImage());
    }
    return this.products.uploadImage(this.pendingImageFile).pipe(
      map((uploaded) => uploaded.url),
    );
  }

  private resetDraft(): void {
    this.draftTitle.set('');
    this.draftSubtitle.set('');
    this.draftBadge.set('');
    this.draftImage.set('');
    this.draftLink.set('/products');
    this.draftPlacement.set('home');
    this.draftSortOrder.set(0);
    this.draftActive.set(true);
  }

  private releasePendingImage(): void {
    if (this.pendingPreviewUrl) {
      URL.revokeObjectURL(this.pendingPreviewUrl);
    }
    this.pendingImageFile = null;
    this.pendingPreviewUrl = '';
  }

  private validateImageFile(file: File): string | null {
    const typeOk =
      BANNER_IMAGE_TYPES.includes(file.type as (typeof BANNER_IMAGE_TYPES)[number]) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!typeOk) return 'Use a JPG, PNG, WEBP, or GIF file.';
    if (file.size > BANNER_IMAGE_MAX_BYTES) return 'Image must be 5MB or smaller.';
    return null;
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
