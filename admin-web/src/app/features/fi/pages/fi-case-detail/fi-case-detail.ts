import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { FiCaseService } from '../../services/fi-case.service';
import { FI_STATUS_LABEL, FiCase } from '../../../emi/models/fi-case.models';

/**
 * Admin FI Case Details — read-only.
 * FI Accept / Reject is performed only in the FI Mobile App.
 * Admin continues the workflow from EMI Application → Credit Review → Publish.
 */
@Component({
  selector: 'app-fi-case-detail',
  standalone: true,
  imports: [
    DatePipe,
    ButtonModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
  ],
  templateUrl: './fi-case-detail.html',
  styleUrl: './fi-case-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiCaseDetail {
  private readonly fi = inject(FiCaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly fiCaseId = this.route.snapshot.paramMap.get('fiCaseId') ?? '';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly fiCase = signal<FiCase | null>(null);

  readonly statusLabel = computed(() => {
    const fiCase = this.fiCase();
    return fiCase ? FI_STATUS_LABEL[fiCase.status] : '—';
  });

  readonly isAccepted = computed(() => this.fiCase()?.status === 'completed');
  readonly isRejected = computed(() => this.fiCase()?.status === 'hold');
  readonly isInProgress = computed(() => {
    const status = this.fiCase()?.status;
    return status === 'pending' || status === 'in_progress';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.fi.getById(this.fiCaseId).subscribe({
      next: (fiCase) => {
        this.fiCase.set(fiCase);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set('Unable to load FI case details.');
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/fi']);
  }

  viewApplication(): void {
    const applicationId = this.fiCase()?.applicationId;
    if (!applicationId) return;
    this.router.navigate(['/emi', applicationId]);
  }
}
