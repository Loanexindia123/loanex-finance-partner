import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { RbacService } from '../../../../core/services/rbac.service';
import {
  EmiApplicationService,
  findFiCaseForApplication,
} from '../../services/emi-application.service';
import { CreditReviewService } from '../../services/credit-review.service';
import { EmiApplication } from '../../models/emi-application.models';
import { CreditReview } from '../../models/credit-review.models';
import { FiCase } from '../../models/fi-case.models';

@Component({
  selector: 'app-credit-review-detail',
  standalone: true,
  imports: [DatePipe, ButtonModule, PageHeader, BrandedLoader, EmptyState, StatusBadge, CanDirective],
  templateUrl: './credit-review-detail.html',
  styleUrl: './credit-review-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditReviewDetail {
  private readonly emi = inject(EmiApplicationService);
  private readonly creditReviews = inject(CreditReviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly rbac = inject(RbacService);

  readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';
  readonly application = signal<EmiApplication | null>(null);
  readonly applicationLoading = signal(true);
  readonly fiCase = signal<FiCase | undefined>(undefined);
  readonly review = signal<CreditReview | undefined>(undefined);
  readonly reviewLoading = signal(true);
  readonly submitting = signal<'approve' | 'reject' | null>(null);
  readonly canEdit = computed(() => this.rbac.can('emi.edit'));

  /** Credit decision only after FI Accept (FI status completed). */
  readonly canDecide = computed(() => {
    const status = this.application()?.status;
    const fiDone = this.fiCase()?.status === 'completed';
    return (
      this.canEdit() &&
      fiDone &&
      (status === 'pending' || status === 'under_review') &&
      this.review()?.decision !== 'Approved' &&
      this.review()?.decision !== 'Rejected'
    );
  });

  readonly awaitingFi = computed(() => {
    const fi = this.fiCase();
    return !fi || fi.status === 'pending' || fi.status === 'in_progress';
  });

  readonly fiRejected = computed(() => this.fiCase()?.status === 'hold');

  constructor() {
    this.emi.getById(this.applicationId).subscribe({
      next: (application) => {
        this.application.set(application);
        this.applicationLoading.set(false);
        if (application) {
          this.emi.listFiCases().subscribe({
            next: (cases) => this.fiCase.set(findFiCaseForApplication(application, cases)),
            error: () => this.fiCase.set(undefined),
          });
        }
      },
      error: () => this.applicationLoading.set(false),
    });
    this.loadReview();
  }

  private loadReview(): void {
    this.reviewLoading.set(true);
    this.creditReviews.getByApplicationId(this.applicationId).subscribe({
      next: (review) => {
        this.review.set(review ?? undefined);
        this.reviewLoading.set(false);
      },
      error: () => {
        this.review.set(undefined);
        this.reviewLoading.set(false);
      },
    });
  }

  back(): void {
    this.router.navigate(['/emi', this.applicationId]);
  }

  confirmApprove(): void {
    if (!this.canDecide() || this.submitting()) return;
    this.confirmation.confirm({
      header: 'Approve Credit Review?',
      message:
        'Approve this credit review? You can still adjust Down Payment / loan terms on the EMI application and Publish to Customer.',
      acceptLabel: 'Approve',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approve(),
    });
  }

  confirmReject(): void {
    if (!this.canDecide() || this.submitting()) return;
    this.confirmation.confirm({
      header: 'Reject Application',
      message: 'Reject this EMI application after credit review?',
      acceptLabel: 'Reject',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.reject(),
    });
  }

  private approve(): void {
    this.submitting.set('approve');
    this.emi.approve(this.applicationId).subscribe({
      next: () => {
        this.saveReviewDecision({
          decision: 'Approved',
          creditStatus: 'Completed',
          reviewDate: new Date().toISOString().slice(0, 10),
        });
        this.submitting.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Credit approved',
          detail: 'Application approved. Adjust terms if needed, then Publish to Customer.',
        });
        this.emi.getById(this.applicationId).subscribe({
          next: (application) => this.application.set(application),
        });
      },
      error: () => {
        this.submitting.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Approval failed',
          detail:
            'Unable to approve. Field Investigation must be accepted before credit approval.',
        });
      },
    });
  }

  private reject(): void {
    this.submitting.set('reject');
    this.emi.reject(this.applicationId, 'Application rejected by admin.').subscribe({
      next: () => {
        this.saveReviewDecision({
          decision: 'Rejected',
          creditStatus: 'Completed',
          reviewDate: new Date().toISOString().slice(0, 10),
          remarks: 'Application rejected by admin.',
        });
        this.submitting.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Application rejected',
          detail: 'The EMI application has been rejected.',
        });
        this.emi.getById(this.applicationId).subscribe({
          next: (application) => this.application.set(application),
        });
      },
      error: () => {
        this.submitting.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Rejection failed',
          detail: 'Unable to reject this application.',
        });
      },
    });
  }

  private saveReviewDecision(patch: Parameters<CreditReviewService['save']>[1]): void {
    this.creditReviews.save(this.applicationId, patch).subscribe({
      next: (updated) => this.review.set(updated),
      error: () => {
        this.messages.add({
          severity: 'warn',
          summary: 'Credit review not updated',
          detail:
            'The application decision was saved, but the credit review record could not be updated.',
        });
      },
    });
  }
}
