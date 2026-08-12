import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { BranchService } from '../../services/branch.service';
import { Branch, BranchPayload, BranchStatus } from '../../models/branch.models';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DialogModule,
    ToggleSwitchModule,
    TooltipModule,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './branch-list.html',
  styleUrl: './branch-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchList {
  private readonly branches = inject(BranchService);
  private readonly messages = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Branch[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  readonly statusFilterOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  readonly statusOptions: { label: string; value: BranchStatus }[] = [
    { label: 'Enable', value: 'active' },
    { label: 'Disable', value: 'inactive' },
  ];

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  // Add/Edit dialog state
  readonly formOpen = signal(false);
  readonly formMode = signal<'add' | 'edit'>('add');
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    branchCode: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    branchManager: ['', Validators.required],
    mobile: ['', Validators.required],
    isActive: [true],
  });

  // View dialog state
  readonly viewTarget = signal<Branch | null>(null);

  // Delete dialog state
  readonly deleteTarget = signal<Branch | null>(null);
  readonly deleting = signal(false);

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter((b) => {
      const matchesTerm =
        !term ||
        b.name.toLowerCase().includes(term) ||
        b.branchCode.toLowerCase().includes(term) ||
        b.city.toLowerCase().includes(term) ||
        b.state.toLowerCase().includes(term) ||
        b.branchManager.toLowerCase().includes(term) ||
        b.mobile.includes(term);
      const matchesStatus = status === 'all' || b.status === status;
      return matchesTerm && matchesStatus;
    });
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.branches.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  trackById(_index: number, branch: Branch): string {
    return branch.id;
  }

  // ---- Add / Edit ----

  openAdd(): void {
    this.formMode.set('add');
    this.editingId.set(null);
    this.form.reset({
      name: '',
      branchCode: '',
      city: '',
      state: '',
      branchManager: '',
      mobile: '',
      isActive: true,
    });
    this.formOpen.set(true);
  }

  openEdit(branch: Branch): void {
    this.formMode.set('edit');
    this.editingId.set(branch.id);
    this.form.reset({
      name: branch.name,
      branchCode: branch.branchCode,
      city: branch.city,
      isActive: branch.status === 'active',
      branchManager: branch.branchManager,
      mobile: branch.mobile,
      status: branch.status,
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  submitForm(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: BranchPayload = { ...raw, status: raw.isActive ? 'active' : 'inactive' };
    delete (payload as any).isActive;

    this.saving.set(true);
    const id = this.editingId();
    const request = id ? this.branches.update(id, payload) : this.branches.create(payload);

    request.subscribe({
      next: (saved) => {
        this.items.update((list) =>
          id ? list.map((b) => (b.id === id ? saved : b)) : [saved, ...list],
        );
        this.saving.set(false);
        this.formOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: id ? 'Branch updated' : 'Branch added',
          detail: saved.name,
        });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: id ? 'Update failed' : 'Add failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  // ---- View ----

  view(branch: Branch): void {
    this.viewTarget.set(branch);
  }

  closeView(): void {
    this.viewTarget.set(null);
  }

  // ---- Status toggle from table ----

  toggleStatus(branch: Branch): void {
    const nextStatus: BranchStatus = branch.status === 'active' ? 'inactive' : 'active';
    const payload: BranchPayload = {
      name: branch.name,
      branchCode: branch.branchCode,
      city: branch.city,
      state: branch.state,
      branchManager: branch.branchManager,
      mobile: branch.mobile,
      status: nextStatus,
    };
    this.branches.update(branch.id, payload).subscribe({
      next: (saved) => {
        this.items.update((list) => list.map((b) => (b.id === branch.id ? saved : b)));
        this.messages.add({
          severity: 'success',
          summary: nextStatus === 'active' ? 'Branch enabled' : 'Branch disabled',
          detail: branch.name,
        });
      },
      error: (err: unknown) => {
        this.messages.add({
          severity: 'error',
          summary: 'Status update failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  // ---- Delete ----

  askDelete(branch: Branch): void {
    if (this.deleting()) return;
    this.deleteTarget.set(branch);
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const branch = this.deleteTarget();
    if (!branch || this.deleting()) return;

    this.deleting.set(true);
    this.branches.delete(branch.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((b) => b.id !== branch.id));
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.messages.add({ severity: 'success', summary: 'Branch deleted', detail: branch.name });
      },
      error: (err: unknown) => {
        this.deleting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || err.message || 'Something went wrong.';
    }
    return 'Something went wrong.';
  }
}