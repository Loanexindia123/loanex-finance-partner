import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatInr } from '../../../../shared/utils/currency';
import { AutopayService, AutopayStatus } from '../../services/autopay.service';
import {
  AUTO_EMI_POLL_INTERVAL_MS,
  AUTO_EMI_POLL_MAX_ATTEMPTS,
  autoEmiStatusMessage,
  isAutoEmiActive,
  isTerminalMandateFailure,
  openApprovalUrl,
} from '../../utils/autopay-ui.helper';

@Component({
  selector: 'app-autopay',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './autopay.html',
  styleUrl: './autopay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutopayComponent implements OnInit {
  private readonly autopayApi = inject(AutopayService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly status = signal<AutopayStatus | null>(null);
  readonly approvalUrl = signal<string | null>(null);
  readonly popupBlocked = signal(false);
  readonly confirming = signal(false);
  readonly pollTimedOut = signal(false);

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAttempts = 0;
  private visibilityHandler: (() => void) | null = null;

  readonly form = this.fb.nonNullable.group({
    paymentMethod: ['EMANDATE', Validators.required],
    bankName: [''],
    upiId: [''],
    maximumDebitAmount: [''],
  });

  readonly selectedMethod = computed(() => this.form.controls.paymentMethod.value);
  readonly isActive = computed(() => isAutoEmiActive(this.status()));
  readonly statusMessage = computed(() => autoEmiStatusMessage(this.status()));
  readonly mandateStatus = computed(() => this.status()?.mandate?.status ?? null);
  readonly canRetry = computed(() => {
    const data = this.status();
    if (!data || this.isActive()) return false;
    if (data.canEnable) return true;
    if (data.mandate?.status === 'PENDING') return true;
    return isTerminalMandateFailure(data);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.teardown());
  }

  ngOnInit(): void {
    this.load({ startPollIfPending: true });
  }

  enableAutopay(): void {
    if (this.submitting() || !this.status()?.canEnable) return;
    this.submitting.set(true);
    this.error.set(null);
    this.info.set(null);
    this.popupBlocked.set(false);
    this.pollTimedOut.set(false);

    const raw = this.form.getRawValue();
    const maxDebit = raw.maximumDebitAmount.trim()
      ? Number(raw.maximumDebitAmount)
      : undefined;
    const method = raw.paymentMethod || 'EMANDATE';

    // EMANDATE must not send a UPI ID; UPI Autopay still requires one when selected.
    if (method === 'UPI_AUTOPAY' && !raw.upiId.trim()) {
      this.submitting.set(false);
      this.error.set('UPI ID is required for UPI AutoPay.');
      return;
    }

    this.autopayApi
      .createMandate({
        paymentMethod: method,
        bankName: raw.bankName.trim() || undefined,
        upiId: method === 'UPI_AUTOPAY' ? raw.upiId.trim() : undefined,
        maximumDebitAmount: maxDebit && Number.isFinite(maxDebit) ? maxDebit : undefined,
      })
      .subscribe({
        next: (result) => this.afterMandateCreated(result),
        error: () => {
          this.submitting.set(false);
          this.error.set(this.autopayApi.error() ?? 'Unable to create Auto EMI mandate.');
        },
      });
  }

  /** Safe retry: cancel PENDING only (never ACTIVE), then create EMANDATE. */
  retryAutoEmi(): void {
    if (this.submitting()) return;
    const data = this.status();
    if (!data || this.isActive()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.info.set(null);
    this.popupBlocked.set(false);
    this.pollTimedOut.set(false);

    if (data.mandate?.status === 'PENDING') {
      this.autopayApi.cancelMandate().subscribe({
        next: () => this.createDefaultEmandate(),
        error: () => {
          this.submitting.set(false);
          this.error.set(
            this.autopayApi.error() ??
              'A pending authorization already exists. Complete it from the approval link, or try again later.',
          );
          this.approvalUrl.set(data.mandate?.approvalUrl ?? this.approvalUrl());
        },
      });
      return;
    }

    if (data.canEnable || isTerminalMandateFailure(data)) {
      this.createDefaultEmandate();
      return;
    }

    this.submitting.set(false);
    this.error.set('Auto EMI cannot be restarted from the current mandate state.');
  }

  disableAutopay(): void {
    if (this.submitting() || !this.status()?.canDisable) return;
    this.submitting.set(true);
    this.error.set(null);

    this.autopayApi.cancelMandate().subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.info.set(result.message ?? 'Auto EMI disabled.');
        this.stopPoll();
        this.confirming.set(false);
        this.load({ startPollIfPending: false });
      },
      error: () => {
        this.submitting.set(false);
        this.error.set(this.autopayApi.error() ?? 'Unable to cancel Auto EMI mandate.');
      },
    });
  }

  openPendingApproval(): void {
    const url = this.approvalUrl() || this.status()?.mandate?.approvalUrl;
    if (!url) return;
    const opened = openApprovalUrl(url);
    this.popupBlocked.set(!opened);
    if (opened) {
      this.confirming.set(true);
      this.startPoll();
    }
  }

  refreshStatus(): void {
    this.load({ startPollIfPending: true });
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return formatInr(value);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatStatus(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replaceAll('_', ' ');
  }

  private createDefaultEmandate(): void {
    const raw = this.form.getRawValue();
    const maxDebit = raw.maximumDebitAmount.trim()
      ? Number(raw.maximumDebitAmount)
      : undefined;

    this.autopayApi
      .createEmandate({
        bankName: raw.bankName.trim() || undefined,
        maximumDebitAmount: maxDebit && Number.isFinite(maxDebit) ? maxDebit : undefined,
      })
      .subscribe({
        next: (result) => this.afterMandateCreated(result),
        error: () => {
          this.submitting.set(false);
          this.error.set(this.autopayApi.error() ?? 'Unable to start Auto EMI setup.');
        },
      });
  }

  private afterMandateCreated(result: {
    approvalUrl?: string | null;
    status: string;
    message?: string;
  }): void {
    this.submitting.set(false);
    this.approvalUrl.set(result.approvalUrl ?? null);

    // Never treat create success as Active.
    if (result.status === 'ACTIVE') {
      this.load({ startPollIfPending: false });
      return;
    }

    this.confirming.set(true);
    this.info.set('Auto EMI setup is being confirmed.');

    if (result.approvalUrl) {
      const opened = openApprovalUrl(result.approvalUrl);
      this.popupBlocked.set(!opened);
    } else {
      this.popupBlocked.set(true);
      this.error.set(
        'Mandate was created, but no authorization link was returned. Try Continue Bank Authorization after refresh.',
      );
    }

    this.startPoll();
    this.attachVisibilityWatch();
    this.load({ startPollIfPending: false });
  }

  private load(options: { startPollIfPending: boolean }): void {
    this.loading.set(true);
    this.autopayApi.getStatus().subscribe({
      next: (data) => {
        this.loading.set(false);
        this.status.set(data);
        this.approvalUrl.set(data.mandate?.approvalUrl ?? this.approvalUrl());

        if (!this.form.controls.maximumDebitAmount.value) {
          this.form.patchValue({
            maximumDebitAmount: String(Math.round(data.loan.emiAmount * 1.2)),
          });
        }

        // Prefer EMANDATE as the default setup method.
        if (data.canEnable && this.form.controls.paymentMethod.value === 'UPI_AUTOPAY') {
          const hasEmandate = data.options.some((o) => o.code === 'EMANDATE');
          if (hasEmandate) {
            this.form.patchValue({ paymentMethod: 'EMANDATE' });
          }
        }

        if (isAutoEmiActive(data)) {
          this.stopPoll();
          this.confirming.set(false);
          this.pollTimedOut.set(false);
          this.info.set('Auto EMI Active');
          return;
        }

        if (data.mandate?.status === 'PENDING') {
          this.confirming.set(true);
          this.attachVisibilityWatch();
          if (options.startPollIfPending) {
            this.startPoll();
          }
          return;
        }

        if (isTerminalMandateFailure(data)) {
          this.confirming.set(false);
          this.stopPoll();
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.autopayApi.error() ?? 'Unable to load Auto EMI status.');
      },
    });
  }

  private startPoll(): void {
    this.stopPoll();
    this.pollAttempts = 0;
    this.confirming.set(true);
    this.pollTimedOut.set(false);

    const tick = (): void => {
      this.autopayApi.getStatus().subscribe({
        next: (data) => {
          this.status.set(data);
          this.approvalUrl.set(data.mandate?.approvalUrl ?? this.approvalUrl());

          if (isAutoEmiActive(data)) {
            this.stopPoll();
            this.confirming.set(false);
            this.info.set('Auto EMI Active');
            return;
          }

          if (isTerminalMandateFailure(data)) {
            this.stopPoll();
            this.confirming.set(false);
            this.info.set(null);
            return;
          }

          this.pollAttempts += 1;
          if (this.pollAttempts >= AUTO_EMI_POLL_MAX_ATTEMPTS) {
            this.stopPoll();
            this.pollTimedOut.set(data.mandate?.status === 'PENDING');
            return;
          }

          this.pollTimer = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
        },
        error: () => {
          this.pollAttempts += 1;
          if (this.pollAttempts >= AUTO_EMI_POLL_MAX_ATTEMPTS) {
            this.stopPoll();
            this.pollTimedOut.set(true);
            return;
          }
          this.pollTimer = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
        },
      });
    };

    this.pollTimer = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private attachVisibilityWatch(): void {
    if (this.visibilityHandler || typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return;
      if (!this.confirming() && !this.pollTimedOut()) return;
      this.autopayApi.getStatus().subscribe({
        next: (data) => {
          this.status.set(data);
          if (isAutoEmiActive(data)) {
            this.stopPoll();
            this.confirming.set(false);
            this.pollTimedOut.set(false);
            this.info.set('Auto EMI Active');
          } else if (isTerminalMandateFailure(data)) {
            this.stopPoll();
            this.confirming.set(false);
          }
        },
        error: () => undefined,
      });
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private teardown(): void {
    this.stopPoll();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}
