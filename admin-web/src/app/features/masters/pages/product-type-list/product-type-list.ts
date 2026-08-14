import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { MasterDataService } from '../../services/master-data.service';
import {
  ProductType,
  normalizeProductType,
  productTypePayload,
} from '../../models/product-type.models';

const API_PATH = '/admin/product_types';

const STATUS_FILTER_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

@Component({
  selector: 'app-product-type-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
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
  templateUrl: './product-type-list.html',
  styleUrl: './product-type-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTypeList {
  private readonly masters = inject(MasterDataService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

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
  readonly items = signal<ProductType[]>([]);
  readonly dialogOpen = signal(false);
  readonly editing = signal<ProductType | null>(null);
  readonly draftName = signal('');
  readonly draftActive = signal(true);

  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    let list = [...this.items()].sort((a, b) => a.name.localeCompare(b.name));

    if (status !== 'all') {
      list = list.filter((item) => item.status === status);
    }

    if (!term) return list;
    return list.filter((item) => item.name.toLowerCase().includes(term));
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
    this.editing() ? 'Edit Product Type' : 'Add Product Type',
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.masters
      .list(API_PATH)
      .pipe(
        map((rows) => rows.map(normalizeProductType)),
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

  openAdd(): void {
    this.editing.set(null);
    this.resetDraft();
    this.dialogOpen.set(true);
  }

  openEdit(item: ProductType): void {
    this.editing.set(item);
    this.draftName.set(item.name);
    this.draftActive.set(item.status === 'active');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editing.set(null);
    this.resetDraft();
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

  submit(): void {
    const name = this.draftName().trim();
    if (!name) {
      this.messages.add({
        severity: 'warn',
        summary: 'Product Type name required',
        detail: 'Enter a product type name.',
      });
      return;
    }

    const editing = this.editing();
    const duplicate = this.items().some(
      (item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== editing?.id,
    );
    if (duplicate) {
      this.messages.add({
        severity: 'warn',
        summary: 'Duplicate Product Type',
        detail: 'A product type with this name already exists.',
      });
      return;
    }

    const payload = productTypePayload({
      name,
      active: this.draftActive(),
    });

    this.saving.set(true);
    const wasEdit = !!editing;
    const req$ = editing
      ? this.masters.update(API_PATH, editing.id, payload)
      : this.masters.create(API_PATH, payload);

    req$.pipe(map(normalizeProductType)).subscribe({
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
          summary: wasEdit ? 'Product Type updated' : 'Product Type added',
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

  toggleStatus(item: ProductType, active: boolean): void {
    this.togglingId.set(item.id);
    this.masters
      .update(
        API_PATH,
        item.id,
        productTypePayload({
          name: item.name,
          active,
        }),
      )
      .pipe(map(normalizeProductType))
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((row) => (row.id === item.id ? updated : row)));
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

  private resetDraft(): void {
    this.draftName.set('');
    this.draftActive.set(true);
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
