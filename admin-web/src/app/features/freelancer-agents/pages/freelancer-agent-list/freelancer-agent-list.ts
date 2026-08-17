import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { RbacService } from '../../../../core/services/rbac.service';
import { FreelancerAgentService } from '../../services/freelancer-agent.service';
import {
  AGENT_TYPE_OPTIONS,
  FORM_STATUS_OPTIONS,
  FreelancerAgent,
  displayAgentId,
} from '../../models/freelancer-agent.models';

const BASE_PATH = '/employees/freelancer-onboarding';
const AVATAR_TONES = [
  { bg: '#eef2ff', color: '#4338ca' },
  { bg: '#ecfdf5', color: '#047857' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#fdf2f8', color: '#be185d' },
] as const;

@Component({
  selector: 'app-freelancer-agent-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    SelectModule,
    DialogModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatCard,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './freelancer-agent-list.html',
  styleUrl: './freelancer-agent-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreelancerAgentList {
  private readonly agents = inject(FreelancerAgentService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly rbac = inject(RbacService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<FreelancerAgent[]>([]);
  readonly searchTerm = signal('');
  readonly statusFilter = signal('all');
  readonly agentTypeFilter = signal('all');
  readonly pageFirst = signal(0);
  readonly pageSize = signal(10);
  readonly deleteTarget = signal<FreelancerAgent | null>(null);
  readonly deleting = signal(false);
  readonly rejectTarget = signal<FreelancerAgent | null>(null);
  readonly rejectReason = signal('');
  readonly deciding = signal<'approve' | 'reject' | null>(null);

  readonly statusOptions = [{ label: 'All statuses', value: 'all' }, ...FORM_STATUS_OPTIONS];
  readonly agentTypeOptions = [
    { label: 'All agent types', value: 'all' },
    ...AGENT_TYPE_OPTIONS.map((value) => ({ label: value, value })),
  ];

  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  readonly stats = computed(() => {
    const items = this.items();
    return {
      total: items.length,
      draft: items.filter((e) => e.formStatus === 'draft').length,
      pending: items.filter((e) => e.formStatus === 'pending_approval').length,
      approved: items.filter((e) => e.formStatus === 'approved').length,
    };
  });

  readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const agentType = this.agentTypeFilter();
    return this.items().filter((row) => {
      if (status !== 'all' && row.formStatus !== status) return false;
      if (agentType !== 'all' && row.agentType !== agentType) return false;
      if (!term) return true;
      const haystack = [
        row.fullName,
        row.agentId,
        row.mobile,
        row.creatorName,
        row.assignedManager,
        row.branch,
        row.agentType,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  readonly paged = computed(() => {
    const start = this.pageFirst();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize()) || 1));
  readonly currentPage = computed(() => Math.floor(this.pageFirst() / this.pageSize()) + 1);
  readonly pageFrom = computed(() => (this.filtered().length ? this.pageFirst() + 1 : 0));
  readonly pageTo = computed(() => Math.min(this.pageFirst() + this.pageSize(), this.filtered().length));
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.agents.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractMessage(err));
      },
    });
  }

  resetPage(): void {
    this.pageFirst.set(0);
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    this.pageFirst.set((next - 1) * this.pageSize());
  }

  add(): void {
    this.router.navigate([BASE_PATH, 'onboard']);
  }

  view(row: FreelancerAgent): void {
    this.router.navigate([BASE_PATH, row.id]);
  }

  edit(row: FreelancerAgent): void {
    this.router.navigate([BASE_PATH, row.id, 'edit']);
  }

  canEdit(row: FreelancerAgent): boolean {
    return this.rbac.can('freelancers.edit') && (row.formStatus === 'draft' || row.formStatus === 'rejected');
  }

  canApprove(row: FreelancerAgent): boolean {
    return this.rbac.can('freelancers.approve') && row.formStatus === 'pending_approval';
  }

  canReject(row: FreelancerAgent): boolean {
    return this.rbac.can('freelancers.reject') && row.formStatus === 'pending_approval';
  }

  canDelete(row: FreelancerAgent): boolean {
    return this.rbac.can('freelancers.delete') && row.formStatus !== 'approved';
  }

  agentCode(row: FreelancerAgent): string {
    return displayAgentId(row);
  }

  confirmApprove(row: FreelancerAgent): void {
    if (!this.canApprove(row) || this.deciding()) return;
    this.confirmation.confirm({
      header: 'Approve freelancer?',
      message: 'Approving generates an Agent / Growing Partner ID. This person is not an employee.',
      acceptLabel: 'Approve',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approve(row),
    });
  }

  openReject(row: FreelancerAgent): void {
    this.rejectTarget.set(row);
    this.rejectReason.set('');
  }

  cancelReject(): void {
    this.rejectTarget.set(null);
    this.rejectReason.set('');
  }

  confirmDelete(row: FreelancerAgent): void {
    this.deleteTarget.set(row);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  approve(row: FreelancerAgent): void {
    this.deciding.set('approve');
    this.agents.approve(row.id).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        this.deciding.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Approved',
          detail: `Agent ID ${updated.agentId} generated.`,
        });
      },
      error: (err) => {
        this.deciding.set(null);
        this.messages.add({ severity: 'error', summary: 'Approve failed', detail: this.extractMessage(err) });
      },
    });
  }

  rejectConfirmed(): void {
    const target = this.rejectTarget();
    if (!target || this.deciding()) return;
    this.deciding.set('reject');
    this.agents.reject(target.id, this.rejectReason()).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        this.rejectTarget.set(null);
        this.deciding.set(null);
        this.messages.add({ severity: 'success', summary: 'Rejected', detail: 'Record can be edited and resubmitted.' });
      },
      error: (err) => {
        this.deciding.set(null);
        this.messages.add({ severity: 'error', summary: 'Reject failed', detail: this.extractMessage(err) });
      },
    });
  }

  deleteConfirmed(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.agents.delete(target.id).subscribe({
      next: () => {
        this.items.update((list) => list.filter((e) => e.id !== target.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
        this.messages.add({ severity: 'success', summary: 'Onboarding record deleted' });
      },
      error: (err) => {
        this.deleting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  createdDate(row: FreelancerAgent): string {
    return row.createdAt ? row.createdAt.slice(0, 10) : '—';
  }

  avatarInitials(row: FreelancerAgent): string {
    const source = row.fullName || row.agentId || 'GP';
    const parts = source.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'GP';
  }

  avatarTone(row: FreelancerAgent) {
    const key = row.fullName || row.agentId || row.id;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
    return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
