import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { LoanService } from '../../services/loan.service';
import {
  LoanDetail as LoanDetailModel,
  LoanPaymentRow,
  loanCompletionPercent,
  loanInstallmentsPaid,
} from '../../models/loan.models';

@Component({
  selector: 'app-loan-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    ButtonModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    EmptyState,
    StatusBadge,
  ],
  templateUrl: './loan-detail.html',
  styleUrl: './loan-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanDetail {
  private readonly loans = inject(LoanService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loanId = this.route.snapshot.paramMap.get('loanId') ?? '';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly loan = signal<LoanDetailModel | null>(null);

  readonly paymentsLoading = signal(true);
  readonly payments = signal<LoanPaymentRow[]>([]);

  readonly installments = computed(() => loanInstallmentsPaid(this.loan()?.schedule ?? []));
  readonly completionPercent = computed(() => {
    const loan = this.loan();
    return loan ? loanCompletionPercent(loan) : 0;
  });

  readonly overdueRows = computed(
    () => (this.loan()?.schedule ?? []).filter((row) => row.paymentStatus === 'OVERDUE').length,
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.loans.getById(this.loanId).subscribe({
      next: (loan) => {
        this.loan.set(loan);
        this.loading.set(false);
        this.loadPayments();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set('Unable to load loan details.');
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/loans']);
  }

  viewApplication(): void {
    const applicationId = this.loan()?.application?.id ?? this.loan()?.applicationId;
    if (!applicationId) return;
    this.router.navigate(['/emi', applicationId]);
  }

  private loadPayments(): void {
    this.paymentsLoading.set(true);
    this.loans.listPayments(this.loanId).subscribe({
      next: (items) => {
        this.payments.set(items);
        this.paymentsLoading.set(false);
      },
      error: () => {
        this.payments.set([]);
        this.paymentsLoading.set(false);
      },
    });
  }
}
