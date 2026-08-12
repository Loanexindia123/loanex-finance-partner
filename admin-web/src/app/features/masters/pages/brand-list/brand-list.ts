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
import { MasterDataService } from '../../services/master-data.service';
import { Brand, brandPayload, normalizeBrand } from '../../models/brand.models';

const BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BRAND_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const STATUS_FILTER_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
] as const;

@Component({
  selector: 'app-brand-list',
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
  templateUrl: './brand-list.html',
  styleUrl: './brand-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandList {
  private readonly masters = inject(MasterDataService);
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
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 },
  ];
  readonly items = signal<Brand[]>([]);
  readonly dialogOpen = signal(false);
  readonly editing = signal<Brand | null>(null);
  readonly draftName = signal('');
  readonly draftDescription = signal('');
  readonly draftLogo = signal('');
  readonly draftActive = signal(true);

  readonly statusOptions = [...STATUS_FILTER_OPTIONS];

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    let list = [...this.items()].sort((a, b) => a.name.localeCompare(b.name));

    if (status !== 'all') {
      list = list.filter((item) => item.status === status);
    }

    if (!term) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    );
  });

  readonly hasActiveFilters = computed(
    () => !!this.searchTerm().trim() || this.statusFilter() !== 'all',
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
    this.editing() ? 'Edit Brand' : 'Add Brand',
  );

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
    this.masters
      .list('/admin/brands')
      .pipe(
        map((rows) => rows.map(normalizeBrand)),
        takeUntilDestroyed(this.destroyRef),
      )
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

  logoSrc(brand: Brand): string {
    return resolveMediaUrl(brand.logo);
  }

  hasLogo(brand: Brand): boolean {
    return !!brand.logo.trim();
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
    this.resetPage();
  }

  openEdit(brand: Brand): void {
    this.releasePendingImage();
    this.editing.set(brand);
    this.draftName.set(brand.name);
    this.draftDescription.set(brand.description);
    this.draftLogo.set(brand.logo);
    this.draftActive.set(brand.status === 'active');
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
    this.draftLogo.set(this.pendingPreviewUrl);
    this.cdr.markForCheck();
  }

  removeImage(): void {
    this.releasePendingImage();
    this.draftLogo.set('');
  }

  isPendingImage(): boolean {
    return !!this.pendingImageFile;
  }

  previewLogo(): string {
    return resolveMediaUrl(this.draftLogo());
  }

  submit(): void {
    const name = this.draftName().trim();
    if (!name) {
      this.messages.add({
        severity: 'warn',
        summary: 'Name required',
        detail: 'Enter a brand name.',
      });
      return;
    }

    const duplicate = this.items().some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        item.id !== this.editing()?.id,
    );
    if (duplicate) {
      this.messages.add({
        severity: 'warn',
        summary: 'Duplicate brand',
        detail: 'A brand with this name already exists.',
      });
      return;
    }

    this.saving.set(true);
    const wasEdit = !!this.editing();
    this.flushPendingImage()
      .pipe(
        switchMap((logo) => {
          const payload = brandPayload({
            name,
            logo: logo || this.draftLogo(),
            description: this.draftDescription(),
            active: this.draftActive(),
          });
          const editing = this.editing();
          return editing
            ? this.masters.update('/admin/brands', editing.id, payload).pipe(map(normalizeBrand))
            : this.masters.create('/admin/brands', payload).pipe(map(normalizeBrand));
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
            summary: wasEdit ? 'Brand updated' : 'Brand added',
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

  toggleStatus(brand: Brand, active: boolean): void {
    this.togglingId.set(brand.id);
    this.masters
      .update('/admin/brands', brand.id, {
        ...brand,
        status: active ? 'active' : 'inactive',
      })
      .pipe(map(normalizeBrand))
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((row) => (row.id === brand.id ? updated : row)));
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

  remove(brand: Brand): void {
    if (!confirm(`Delete brand "${brand.name}"?`)) return;
    this.masters.delete('/admin/brands', brand.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((row) => row.id !== brand.id));
        this.messages.add({ severity: 'success', summary: 'Brand deleted' });
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
      return of(this.draftLogo());
    }
    return this.products.uploadImage(this.pendingImageFile).pipe(
      map((uploaded) => uploaded.url),
    );
  }

  private resetDraft(): void {
    this.draftName.set('');
    this.draftDescription.set('');
    this.draftLogo.set('');
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
      BRAND_IMAGE_TYPES.includes(file.type as (typeof BRAND_IMAGE_TYPES)[number]) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!typeOk) return 'Use a JPG, PNG, WEBP, or GIF file.';
    if (file.size > BRAND_IMAGE_MAX_BYTES) return 'Image must be 5MB or smaller.';
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
