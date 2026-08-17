import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { RbacService } from '../../../../core/services/rbac.service';
import { resolveMediaUrl } from '../../../../core/config/api.config';
import { FreelancerAgentService } from '../../services/freelancer-agent.service';
import {
  DOCUMENT_FIELDS,
  FreelancerAgent,
  displayAgentId,
} from '../../models/freelancer-agent.models';

const BASE_PATH = '/employees/freelancer-onboarding';

@Component({
  selector: 'app-freelancer-agent-view',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    StatusBadge,
  ],
  templateUrl: './freelancer-agent-view.html',
  styleUrl: './freelancer-agent-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreelancerAgentView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agents = inject(FreelancerAgentService);
  private readonly rbac = inject(RbacService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly record = signal<FreelancerAgent | null>(null);
  readonly documentFields = DOCUMENT_FIELDS;
  readonly rejectOpen = signal(false);
  readonly rejectReason = signal('');
  readonly deciding = signal<'approve' | 'reject' | null>(null);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly agentCode = computed(() => {
    const row = this.record();
    return row ? displayAgentId(row) : 'AUTO-GENERATED AFTER APPROVAL';
  });
  readonly canEditRecord = computed(() => {
    const row = this.record();
    return !!row && this.rbac.can('freelancers.edit') && (row.formStatus === 'draft' || row.formStatus === 'rejected');
  });
  readonly canApproveRecord = computed(() => {
    const row = this.record();
    return !!row && this.rbac.can('freelancers.approve') && row.formStatus === 'pending_approval';
  });
  readonly canRejectRecord = computed(() => {
    const row = this.record();
    return !!row && this.rbac.can('freelancers.reject') && row.formStatus === 'pending_approval';
  });

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.id) {
      this.loading.set(false);
      this.error.set('Freelancer id is missing.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.agents.getById(this.id).subscribe({
      next: (record) => {
        this.record.set(record);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractMessage(err));
      },
    });
  }

  edit(): void {
    this.router.navigate([BASE_PATH, this.id, 'edit']);
  }

  confirmApprove(): void {
    if (!this.canApproveRecord() || this.deciding()) return;
    this.confirmation.confirm({
      header: 'Approve freelancer?',
      message: 'Approving generates an Agent / Growing Partner ID. This person is not an employee.',
      acceptLabel: 'Approve',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approve(),
    });
  }

  openReject(): void {
    this.rejectReason.set('');
    this.rejectOpen.set(true);
  }

  approve(): void {
    this.deciding.set('approve');
    this.agents.approve(this.id).subscribe({
      next: (updated) => {
        this.record.set(updated);
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
    this.deciding.set('reject');
    this.agents.reject(this.id, this.rejectReason()).subscribe({
      next: (updated) => {
        this.record.set(updated);
        this.rejectOpen.set(false);
        this.deciding.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Rejected',
          detail: 'Record can be edited and resubmitted.',
        });
      },
      error: (err) => {
        this.deciding.set(null);
        this.messages.add({ severity: 'error', summary: 'Reject failed', detail: this.extractMessage(err) });
      },
    });
  }

  display(value: unknown): string {
    if (value === null || value === undefined || value === '' || value === false) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    return String(value);
  }

  hasDocument(row: FreelancerAgent, key: string): boolean {
    return !!String((row as unknown as Record<string, unknown>)[key] ?? '').trim();
  }

  documentHref(row: FreelancerAgent, key: string): string {
    const value = String((row as unknown as Record<string, unknown>)[key] ?? '').trim();
    return resolveMediaUrl(value);
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
