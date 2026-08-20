import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { RbacService } from '../../../../core/services/rbac.service';
import { OrderService } from '../../../orders/services/order.service';
import { Order } from '../../../orders/models/order.models';
import {
  EmiApplicationService,
  findFiCaseForApplication,
  ModifyEmiTermsPayload,
} from '../../services/emi-application.service';
import { EmiApplication } from '../../models/emi-application.models';
import { FI_STATUS_LABEL, FiCase } from '../../models/fi-case.models';
import { CreditReviewService } from '../../services/credit-review.service';
import { CreditReview } from '../../models/credit-review.models';
import { CustomerService } from '../../../customers/services/customer.service';
import {
  KycRecord,
  kycAadhaarVerified,
  kycCibilScore,
  kycFaceVerified,
  kycPanVerified,
} from '../../../customers/models/customer.models';
import { AutopayService } from '../../../loans/services/autopay.service';
import { AutopayMandate } from '../../../loans/models/autopay.models';

interface TermsDraft {
  approvedAmount: string;
  approvedTenure: string;
  approvedDownPayment: string;
  interestRate: string;
  processingFee: string;
  adminRemarks: string;
}

interface PaymentHistoryRow {
  label: string;
  date: string | null;
  amount: number;
}

@Component({
  selector: 'app-emi-application-detail',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    ButtonModule,
    DialogModule,
    TextareaModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './emi-application-detail.html',
  styleUrl: './emi-application-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmiApplicationDetail {
  private readonly emi = inject(EmiApplicationService);
  private readonly orders = inject(OrderService);
  private readonly customers = inject(CustomerService);
  private readonly autopay = inject(AutopayService);
  private readonly creditReviews = inject(CreditReviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly rbac = inject(RbacService);

  readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly application = signal<EmiApplication | null>(null);
  readonly fiCase = signal<FiCase | undefined>(undefined);
  readonly order = signal<Order | null>(null);
  readonly kyc = signal<KycRecord | null>(null);
  readonly kycChecked = signal(false);
  readonly mandate = signal<AutopayMandate | null>(null);
  readonly mandateChecked = signal(false);
  readonly creditReview = signal<CreditReview | null>(null);
  readonly creditReviewChecked = signal(false);
  readonly approving = signal(false);
  readonly rejecting = signal(false);
  readonly assigningFi = signal(false);
  readonly publishing = signal(false);
  readonly rejectVisible = signal(false);
  readonly rejectionReason = signal('');
  readonly rejectError = signal<string | null>(null);
  readonly terms = signal<TermsDraft>({
    approvedAmount: '',
    approvedTenure: '',
    approvedDownPayment: '',
    interestRate: '',
    processingFee: '',
    adminRemarks: '',
  });

  readonly canEdit = computed(() => this.rbac.can('emi.edit'));

  readonly canApprove = computed(() => {
    const status = this.application()?.status;
    const fiDone = this.fiCase()?.status === 'completed';
    return (status === 'pending' || status === 'under_review') && fiDone;
  });

  readonly canAssignFi = computed(() => {
    const status = this.application()?.status;
    return (status === 'pending' || status === 'under_review') && !this.fiCase();
  });

  /** Sanction / Publish after FI Accept (or republish when already approved). */
  readonly canEditSanction = computed(() => {
    const status = this.application()?.status;
    const fiDone = this.fiCase()?.status === 'completed';
    if (status === 'approved') return true;
    return status === 'under_review' && fiDone;
  });

  readonly fiReadyForCreditReview = computed(
    () => this.fiCase()?.status === 'completed' && this.application()?.status === 'under_review',
  );

  readonly fiRejectionReason = computed(() => {
    const fiCase = this.fiCase();
    if (fiCase?.status === 'hold' && fiCase.remarks?.trim()) {
      return fiCase.remarks.trim();
    }
    const app = this.application();
    if (app?.status === 'rejected' && app.rejectionReason?.trim()) {
      return app.rejectionReason.trim();
    }
    return null;
  });

  readonly creditReviewStatus = computed(() => {
    const review = this.creditReview();
    if (!review) return this.creditReviewChecked() ? 'Not Started' : 'Waiting';
    return review.creditStatus;
  });

  readonly fiButtonTitle = computed(() => {
    const status = this.fiCase()?.status;
    if (status === 'pending' || status === 'in_progress') return 'View FI Status';
    return 'View FI';
  });

  readonly kycStatusLabel = computed(() => {
    const kyc = this.kyc();
    if (!kyc) return this.kycChecked() ? 'Not Started' : 'Waiting';
    if (kyc.kycCompleted || kyc.kycCompletedAt) return 'Completed';
    return 'In Progress';
  });

  readonly kycAadhaar = computed(() => kycAadhaarVerified(this.kyc()));
  readonly kycPan = computed(() => kycPanVerified(this.kyc()));
  readonly kycFace = computed(() => kycFaceVerified(this.kyc()));
  readonly kycCibil = computed(() => kycCibilScore(this.kyc()));

  readonly mandateStatusLabel = computed(() => {
    const mandate = this.mandate();
    if (!mandate) return this.mandateChecked() ? 'Not Registered' : 'Waiting';
    const labels: Record<string, string> = {
      PENDING: 'Pending Approval',
      ACTIVE: 'Active',
      PAUSED: 'Paused',
      CANCELLED: 'Cancelled',
      EXPIRED: 'Expired',
      FAILED: 'Failed',
    };
    return labels[mandate.status] ?? mandate.status;
  });

  readonly hasLoanLedger = computed(() => {
    const order = this.order();
    return Boolean(
      order &&
        (order.loanStatus || order.loanAccountNumber || (order.emiSchedule ?? []).length > 0),
    );
  });

  readonly paymentHistory = computed<PaymentHistoryRow[]>(() => {
    const order = this.order();
    if (!order) return [];
    const rows: PaymentHistoryRow[] = [];
    if (order.downPaymentCollected && order.downPaymentCollected > 0) {
      rows.push({
        label: 'Down Payment',
        date: order.transactionDate ?? null,
        amount: order.downPaymentCollected,
      });
    }
    for (const payment of order.emiPayments ?? []) {
      rows.push({
        label: `EMI #${payment.emiNumber}`,
        date: payment.paidAt ?? payment.dueDate ?? null,
        amount: payment.amount,
      });
    }
    return rows;
  });

  readonly upcomingInstallments = computed(() =>
    (this.order()?.emiSchedule ?? []).filter((row) => row.paymentStatus !== 'PAID'),
  );

  readonly downPaymentStatus = computed(() => {
    const app = this.application();
    return app?.loanId || app?.orderId ? 'Loan Created' : 'Pending';
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.emi.getById(this.applicationId).subscribe({
      next: (application) => {
        if (!application) {
          this.application.set(null);
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }
        this.application.set(application);
        this.seedTerms(application);
        this.loading.set(false);
        this.loadRelated(application);
      },
      error: () => {
        this.error.set('Unable to load application details.');
        this.loading.set(false);
      },
    });
  }

  back(): void {
    this.router.navigate(['/emi']);
  }

  confirmApprove(): void {
    if (!this.canApprove() || !this.canEdit() || this.approving()) return;
    this.confirmation.confirm({
      header: 'Approve Application?',
      message:
        'Approve this EMI application after Field Investigation? This is the final application approval and publishes sanctioned terms.',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Approve',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approve(),
    });
  }

  openReject(): void {
    if (!this.canApprove() || !this.canEdit() || this.rejecting()) return;
    this.rejectionReason.set('');
    this.rejectError.set(null);
    this.rejectVisible.set(true);
  }

  closeReject(): void {
    if (this.rejecting()) return;
    this.rejectVisible.set(false);
    this.rejectError.set(null);
  }

  confirmReject(): void {
    const reason = this.rejectionReason().trim();
    if (!reason) {
      this.rejectError.set('Please enter a rejection reason.');
      return;
    }
    this.reject(reason);
  }

  confirmPublish(): void {
    if (!this.canEditSanction() || !this.canEdit() || this.publishing()) return;
    this.confirmation.confirm({
      header: 'Publish to Customer?',
      message:
        'The customer will see the modified application and can accept (pay down payment) or decline it.',
      icon: 'pi pi-send',
      acceptLabel: 'Publish',
      rejectLabel: 'Cancel',
      accept: () => this.publishTerms(),
    });
  }

  viewCreditReview(): void {
    this.router.navigate(['/emi', this.applicationId, 'credit-review']);
  }

  viewFi(): void {
    const fiCase = this.fiCase();
    if (!fiCase) return;
    this.router.navigate(['/fi', fiCase.id]);
  }

  confirmAssignFi(): void {
    if (!this.canAssignFi() || !this.canEdit() || this.assigningFi()) return;
    this.confirmation.confirm({
      header: 'Assign Field Investigation?',
      message:
        'This will create an FI case for the field executive. It does not approve the EMI application.',
      icon: 'pi pi-map-marker',
      acceptLabel: 'Assign FI',
      rejectLabel: 'Cancel',
      accept: () => this.assignFi(),
    });
  }

  viewLedger(): void {
    const loanId = this.application()?.loanId;
    if (!loanId) return;
    this.router.navigate(['/loans', loanId]);
  }

  viewOrder(): void {
    const order = this.order();
    if (!order) return;
    this.router.navigate(['/orders', order.id]);
  }

  updateTerm<K extends keyof TermsDraft>(key: K, value: TermsDraft[K]): void {
    this.terms.update((current) => ({ ...current, [key]: value }));
  }

  private seedTerms(application: EmiApplication): void {
    this.terms.update((prev) => ({
      approvedAmount: String(application.totalAmount ?? application.requestedLoanAmount ?? ''),
      approvedTenure: String(application.tenure ?? ''),
      approvedDownPayment: String(application.downPayment ?? ''),
      interestRate: String(application.interestRate ?? 18),
      processingFee: String(application.processingFee ?? 0),
      adminRemarks: prev.adminRemarks || '',
    }));
  }

  private loadRelated(application: EmiApplication): void {
    this.emi.listFiCases().subscribe({
      next: (cases) => this.fiCase.set(findFiCaseForApplication(application, cases)),
      error: () => this.fiCase.set(undefined),
    });

    if (application.orderId) {
      this.orders.getById(application.orderId).subscribe({
        next: (order) => this.order.set(order),
        error: () => this.order.set(null),
      });
    } else {
      this.order.set(null);
    }

    if (application.userId) {
      this.customers.getKycForUser(application.userId).subscribe({
        next: (kyc) => {
          this.kyc.set(kyc);
          this.kycChecked.set(true);
        },
        error: () => this.kycChecked.set(true),
      });
    }

    if (application.loanId) {
      this.autopay.getForLoan(application.loanId).subscribe({
        next: (result) => {
          this.mandate.set(result?.currentMandate ?? result?.mandates?.[0] ?? null);
          this.mandateChecked.set(true);
        },
        error: () => this.mandateChecked.set(true),
      });
    }

    this.creditReviews.getByApplicationId(application.id).subscribe({
      next: (review) => {
        this.creditReview.set(review);
        this.creditReviewChecked.set(true);
      },
      error: () => this.creditReviewChecked.set(true),
    });
  }

  private assignFi(): void {
    const application = this.application();
    if (!application) return;
    this.assigningFi.set(true);
    this.emi.assignFi(application.id).subscribe({
      next: (fiCase) => {
        this.assigningFi.set(false);
        this.fiCase.set(fiCase);
        this.messages.add({
          severity: 'success',
          summary: 'FI assigned',
          detail: 'Field Investigation case created. Final approval happens after FI Accept and Credit Review.',
        });
        this.reloadQuiet();
      },
      error: (err: unknown) => {
        this.assigningFi.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Assign FI failed',
          detail: this.friendlyError(err, 'Unable to assign Field Investigation.'),
        });
      },
    });
  }

  private approve(): void {
    const application = this.application();
    if (!application) return;
    this.approving.set(true);
    this.emi.approve(application.id).subscribe({
      next: () => {
        this.approving.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Application approved',
          detail: 'The EMI application has been approved.',
        });
        this.reloadQuiet();
      },
      error: (err: unknown) => {
        this.approving.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Approval failed',
          detail: this.friendlyError(err, 'Unable to approve this application.'),
        });
      },
    });
  }

  private reject(reason: string): void {
    const application = this.application();
    if (!application) return;
    this.rejecting.set(true);
    this.emi.reject(application.id, reason).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.rejectVisible.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Application rejected',
          detail: 'The EMI application has been rejected.',
        });
        this.reloadQuiet();
      },
      error: (err: unknown) => {
        this.rejecting.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Rejection failed',
          detail: this.friendlyError(err, 'Unable to reject this application.'),
        });
      },
    });
  }

  private publishTerms(): void {
    const application = this.application();
    if (!application) return;
    const draft = this.terms();
    const payload: ModifyEmiTermsPayload = {
      adminRemarks: draft.adminRemarks.trim() || 'Terms modified by admin.',
    };
    const amount = this.optionalNumber(draft.approvedAmount);
    const tenure = this.optionalNumber(draft.approvedTenure);
    const downPayment = this.optionalNumber(draft.approvedDownPayment);
    const interestRate = this.optionalNumber(draft.interestRate);
    const processingFee = this.optionalNumber(draft.processingFee);
    if (amount !== undefined) payload.approvedAmount = amount;
    if (tenure !== undefined) payload.approvedTenure = tenure;
    if (downPayment !== undefined) payload.approvedDownPayment = downPayment;
    if (interestRate !== undefined) payload.interestRate = interestRate;
    if (processingFee !== undefined) payload.processingFee = processingFee;

    this.publishing.set(true);
    this.emi.modifyTerms(application.id, payload).subscribe({
      next: () => {
        this.publishing.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Terms published',
          detail: 'Sanction updated and published to the customer.',
        });
        this.reloadQuiet();
      },
      error: (err: unknown) => {
        this.publishing.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Publish failed',
          detail: this.friendlyError(err, 'Unable to publish modified terms.'),
        });
      },
    });
  }

  private reloadQuiet(): void {
    this.emi.getById(this.applicationId).subscribe({
      next: (application) => {
        if (!application) return;
        this.application.set(application);
        this.seedTerms(application);
        this.loadRelated(application);
      },
    });
  }

  private optionalNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private friendlyError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return fallback;
    }
    return fallback;
  }

  fiStatusLabel(): string {
    const fiCase = this.fiCase();
    return fiCase ? FI_STATUS_LABEL[fiCase.status] : '—';
  }
}
