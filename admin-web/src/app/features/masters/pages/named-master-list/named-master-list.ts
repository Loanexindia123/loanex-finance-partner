import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { NAMED_MASTER_ROUTES } from '../../masters.config';
import { MasterDataService, MasterRecord } from '../../services/master-data.service';

@Component({
  selector: 'app-named-master-list',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    PageHeader,
    BrandedLoader,
    EmptyState,
    CanDirective,
  ],
  templateUrl: './named-master-list.html',
  styleUrl: './named-master-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NamedMasterList {
  private readonly route = inject(ActivatedRoute);
  private readonly masters = inject(MasterDataService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly config = NAMED_MASTER_ROUTES[this.route.snapshot.data['masterKey'] as string];
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly searchTerm = signal('');
  readonly items = signal<MasterRecord[]>([]);
  readonly addOpen = signal(false);
  readonly editOpen = signal(false);
  readonly draftName = signal('');
  readonly editing = signal<MasterRecord | null>(null);

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = [...this.items()].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return list;
    return list.filter((item) => item.name.toLowerCase().includes(term));
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.config) {
      this.error.set('Master configuration not found.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.masters
      .list(this.config.apiPath)
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

  openAdd(): void {
    this.draftName.set('');
    this.addOpen.set(true);
  }

  openEdit(item: MasterRecord): void {
    this.editing.set(item);
    this.draftName.set(item.name);
    this.editOpen.set(true);
  }

  submitAdd(): void {
    const name = this.draftName().trim();
    if (!name || !this.config) return;
    if (this.items().some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      this.messages.add({
        severity: 'warn',
        summary: 'Duplicate name',
        detail: `${this.config.entityLabel} already exists.`,
      });
      return;
    }

    this.saving.set(true);
    this.masters.create(this.config.apiPath, { name, status: 'active' }).subscribe({
      next: (created) => {
        this.items.update((list) => [...list, created]);
        this.saving.set(false);
        this.addOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: `${this.config.entityLabel} added`,
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

  submitEdit(): void {
    const item = this.editing();
    const name = this.draftName().trim();
    if (!item || !name || !this.config) return;

    this.saving.set(true);
    this.masters.update(this.config.apiPath, item.id, { ...item, name }).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((row) => (row.id === item.id ? updated : row)));
        this.saving.set(false);
        this.editOpen.set(false);
        this.editing.set(null);
        this.messages.add({
          severity: 'success',
          summary: `${this.config.entityLabel} updated`,
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Update failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  remove(item: MasterRecord): void {
    if (!this.config) return;
    const ok = confirm(`Delete ${this.config.entityLabel.toLowerCase()} "${item.name}"?`);
    if (!ok) return;

    this.masters.delete(this.config.apiPath, item.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((row) => row.id !== item.id));
        this.messages.add({
          severity: 'success',
          summary: `${this.config.entityLabel} deleted`,
        });
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

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
