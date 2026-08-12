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
  DeliveryZone,
  deliveryZonePayload,
  normalizeDeliveryZone,
} from '../../models/delivery-zone.models';

const API_PATH = '/admin/delivery_zones';

const STATUS_FILTER_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

@Component({
  selector: 'app-delivery-zone-list',
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
  templateUrl: './delivery-zone-list.html',
  styleUrl: './delivery-zone-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryZoneList {
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
  readonly items = signal<DeliveryZone[]>([]);
  readonly dialogOpen = signal(false);
  readonly editing = signal<DeliveryZone | null>(null);
  readonly draftName = signal('');
  readonly draftPinCodes = signal('');
  readonly draftDeliveryDays = signal('');
  readonly draftActive = signal(true);

  readonly statusOptions = STATUS_FILTER_OPTIONS;

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    let list = [...this.items()].sort((a, b) => a.name.localeCompare(b.name));

    if (status !== 'all') {
      list = list.filter((item) => item.status === status);
    }

    if (!term) return list;
    return list.filter((item) => {
      const haystack = [item.name, item.pinCodes, item.standardDeliveryDays]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
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
    this.editing() ? 'Edit Delivery Zone' : 'Add Delivery Zone',
  );

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    tooltipStyleClass: 'catalog-tooltip',
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.masters
      .list(API_PATH)
      .pipe(
        map((rows) => rows.map(normalizeDeliveryZone)),
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

  openEdit(zone: DeliveryZone): void {
    this.editing.set(zone);
    this.draftName.set(zone.name);
    this.draftPinCodes.set(zone.pinCodes);
    this.draftDeliveryDays.set(zone.standardDeliveryDays);
    this.draftActive.set(zone.status === 'active');
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
        summary: 'Zone name required',
        detail: 'Enter a delivery zone name.',
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
        summary: 'Duplicate zone',
        detail: 'A delivery zone with this name already exists.',
      });
      return;
    }

    const payload = deliveryZonePayload({
      name,
      pinCodes: this.draftPinCodes(),
      standardDeliveryDays: this.draftDeliveryDays(),
      active: this.draftActive(),
    });

    this.saving.set(true);
    const wasEdit = !!editing;
    const req$ = editing
      ? this.masters.update(API_PATH, editing.id, payload)
      : this.masters.create(API_PATH, payload);

    req$.pipe(map(normalizeDeliveryZone)).subscribe({
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
          summary: wasEdit ? 'Delivery zone updated' : 'Delivery zone added',
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

  toggleStatus(zone: DeliveryZone, active: boolean): void {
    this.togglingId.set(zone.id);
    this.masters
      .update(
        API_PATH,
        zone.id,
        deliveryZonePayload({
          name: zone.name,
          pinCodes: zone.pinCodes,
          standardDeliveryDays: zone.standardDeliveryDays,
          active,
        }),
      )
      .pipe(map(normalizeDeliveryZone))
      .subscribe({
        next: (updated) => {
          this.items.update((list) => list.map((row) => (row.id === zone.id ? updated : row)));
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

  remove(zone: DeliveryZone): void {
    if (!confirm(`Delete delivery zone "${zone.name}"?`)) return;
    this.masters.delete(API_PATH, zone.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((row) => row.id !== zone.id));
        this.messages.add({ severity: 'success', summary: 'Delivery zone deleted' });
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

  private resetDraft(): void {
    this.draftName.set('');
    this.draftPinCodes.set('');
    this.draftDeliveryDays.set('');
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
