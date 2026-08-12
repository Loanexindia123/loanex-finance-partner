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
import { CategoryService } from '../../services/category.service';
import {
  CategoryRecord,
  CategoryTableRow,
  categoryPayload,
  flattenCategories,
} from '../../models/category.models';

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const STATUS_FILTER_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const TYPE_FILTER_OPTIONS = [
  { label: 'All types', value: 'all' },
  { label: 'Categories', value: 'category' },
  { label: 'Subcategories', value: 'subcategory' },
];

type DialogMode = 'category' | 'subcategory';

@Component({
  selector: 'app-category-list',
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
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryList {
  private readonly categories = inject(CategoryService);
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
  readonly typeFilter = signal<'all' | 'category' | 'subcategory'>('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 },
  ];
  readonly items = signal<CategoryRecord[]>([]);
  readonly dialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('category');
  readonly editing = signal<CategoryRecord | null>(null);
  readonly draftName = signal('');
  readonly draftDescription = signal('');
  readonly draftIcon = signal('');
  readonly draftActive = signal(true);
  readonly draftParentId = signal('');

  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly typeOptions = TYPE_FILTER_OPTIONS;

  readonly parentOptions = computed(() =>
    this.items()
      .filter((item) => !item.parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ label: item.name, value: item.id })),
  );

  readonly isSubcategoryForm = computed(() => {
    const editing = this.editing();
    if (editing) return !!editing.parentId;
    return this.dialogMode() === 'subcategory';
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    let rows = flattenCategories(this.items());

    if (status !== 'all') {
      rows = rows.filter((row) => row.status === status);
    }
    if (type !== 'all') {
      rows = rows.filter((row) => row.rowType === type);
    }
    if (!term) return rows;

    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.description.toLowerCase().includes(term) ||
        row.parentName.toLowerCase().includes(term),
    );
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      this.statusFilter() !== 'all' ||
      this.typeFilter() !== 'all',
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

  readonly dialogTitle = computed(() => {
    const editing = this.editing();
    if (editing) {
      return editing.parentId ? 'Edit Subcategory' : 'Edit Category';
    }
    return this.dialogMode() === 'subcategory' ? 'Add Subcategory' : 'Add Category';
  });

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
    this.categories
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

  iconSrc(row: CategoryTableRow): string {
    return resolveMediaUrl(row.icon);
  }

  hasIcon(row: CategoryTableRow): boolean {
    return !!row.icon.trim();
  }

  openAddCategory(): void {
    this.editing.set(null);
    this.dialogMode.set('category');
    this.resetDraft();
    this.draftParentId.set('');
    this.dialogOpen.set(true);
  }

  openAddSubcategory(): void {
    this.editing.set(null);
    this.dialogMode.set('subcategory');
    this.resetDraft();
    this.draftParentId.set(this.parentOptions()[0]?.value ?? '');
    this.dialogOpen.set(true);
  }

  openEdit(row: CategoryTableRow): void {
    this.releasePendingImage();
    this.editing.set(row);
    this.dialogMode.set(row.parentId ? 'subcategory' : 'category');
    this.draftName.set(row.name);
    this.draftDescription.set(row.description);
    this.draftIcon.set(row.icon);
    this.draftActive.set(row.status === 'active');
    this.draftParentId.set(row.parentId ?? '');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editing.set(null);
    this.releasePendingImage();
    this.resetDraft();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.typeFilter.set('all');
    this.resetPage();
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
    this.draftIcon.set(this.pendingPreviewUrl);
    this.cdr.markForCheck();
  }

  removeImage(): void {
    this.releasePendingImage();
    this.draftIcon.set('');
  }

  isPendingImage(): boolean {
    return !!this.pendingImageFile;
  }

  previewIcon(): string {
    return resolveMediaUrl(this.draftIcon());
  }

  submit(): void {
    const name = this.draftName().trim();
    const editing = this.editing();
    const isSubcategory = this.isSubcategoryForm();
    const parentId = isSubcategory ? this.draftParentId().trim() : null;

    if (!name) {
      this.messages.add({
        severity: 'warn',
        summary: 'Name required',
        detail: 'Enter a category name.',
      });
      return;
    }

    if (isSubcategory && !parentId) {
      this.messages.add({
        severity: 'warn',
        summary: 'Parent required',
        detail: 'Select a parent category.',
      });
      return;
    }

    const duplicate = this.items().some(
      (item) =>
        item.name.toLowerCase() === name.toLowerCase() &&
        (item.parentId ?? null) === parentId &&
        item.id !== editing?.id,
    );
    if (duplicate) {
      this.messages.add({
        severity: 'warn',
        summary: 'Duplicate name',
        detail: 'This name already exists under the selected parent.',
      });
      return;
    }

    this.saving.set(true);
    const wasEdit = !!editing;

    this.flushPendingImage()
      .pipe(
        switchMap((icon) => {
          const payload = categoryPayload({
            name,
            icon: icon || this.draftIcon(),
            description: this.draftDescription(),
            active: this.draftActive(),
            parentId,
          });
          return editing
            ? this.categories.update(editing.id, payload)
            : this.categories.create(payload);
        }),
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          if (wasEdit) {
            this.items.update((list) => list.map((row) => (row.id === saved.id ? saved : row)));
          } else {
            this.items.update((list) => [...list, saved]);
          }
          this.closeDialog();
          this.messages.add({
            severity: 'success',
            summary: wasEdit ? 'Category updated' : 'Category added',
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

  toggleStatus(row: CategoryTableRow, active: boolean): void {
    this.togglingId.set(row.id);
    this.categories
      .update(
        row.id,
        categoryPayload({
          name: row.name,
          icon: row.icon,
          description: row.description,
          active,
          parentId: row.parentId,
        }),
      )
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((item) => (item.id === row.id ? updated : item)));
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

  remove(row: CategoryTableRow): void {
    const label = row.rowType === 'category' ? 'category' : 'subcategory';
    if (!confirm(`Delete ${label} "${row.name}"?`)) return;

    this.categories.delete(row.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((item) => item.id !== row.id && item.parentId !== row.id));
        this.messages.add({ severity: 'success', summary: 'Deleted successfully' });
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
    if (!this.pendingImageFile) return of(this.draftIcon());
    return this.products.uploadImage(this.pendingImageFile).pipe(map((uploaded) => uploaded.url));
  }

  private resetDraft(): void {
    this.draftName.set('');
    this.draftDescription.set('');
    this.draftIcon.set('');
    this.draftActive.set(true);
    this.draftParentId.set('');
  }

  private releasePendingImage(): void {
    if (this.pendingPreviewUrl) URL.revokeObjectURL(this.pendingPreviewUrl);
    this.pendingImageFile = null;
    this.pendingPreviewUrl = '';
  }

  private validateImageFile(file: File): string | null {
    const typeOk =
      IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number]) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!typeOk) return 'Use a JPG, PNG, WEBP, or GIF file.';
    if (file.size > IMAGE_MAX_BYTES) return 'Image must be 5MB or smaller.';
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
