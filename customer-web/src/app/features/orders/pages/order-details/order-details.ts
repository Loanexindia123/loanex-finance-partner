import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Dialog } from 'primeng/dialog';
import { forkJoin, of, catchError } from 'rxjs';
import { formatInr } from '../../../../shared/utils/currency';
import { paymentTypeLabel } from '../../../../shared/utils/payment-labels';
import { LayoutUiService } from '../../../../layout/services/layout-ui.service';
import { AutopayService, AutopayStatus } from '../../../emi/services/autopay.service';
import {
  CreatePaymentOrderResponse,
  PaymentService,
} from '../../../emi/services/payment.service';
import {
  OrderConfirmationDetails,
  OrderService,
  OrderTrackingDetails,
} from '../../../emi/services/order.service';
import { openRazorpayCheckout } from '../../../emi/utils/razorpay-checkout';
import {
  AUTO_EMI_POLL_INTERVAL_MS,
  AUTO_EMI_POLL_MAX_ATTEMPTS,
  AutoEmiUiPhase,
  isAutoEmiActive,
  isEmiOrder,
  isTerminalMandateFailure,
  openApprovalUrl,
} from '../../../emi/utils/autopay-ui.helper';

@Component({
  selector: 'app-order-details',
  imports: [RouterLink, Dialog],
  templateUrl: './order-details.html',
  styleUrl: './order-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsComponent implements OnInit {
  private readonly orderApi = inject(OrderService);
  private readonly paymentApi = inject(PaymentService);
  private readonly autopayApi = inject(AutopayService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layoutUi = inject(LayoutUiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly downloading = signal(false);
  readonly paying = signal(false);
  readonly showAutopayDialog = signal(false);
  readonly autopaySubmitting = signal(false);
  readonly autoEmiPhase = signal<AutoEmiUiPhase>('setup');
  readonly autopayStatus = signal<AutopayStatus | null>(null);
  readonly approvalUrl = signal<string | null>(null);
  readonly popupBlocked = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly order = signal<OrderConfirmationDetails | null>(null);
  readonly tracking = signal<OrderTrackingDetails | null>(null);

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAttempts = 0;
  private visibilityHandler: (() => void) | null = null;

  readonly payLabel = computed(() => {
    const emi = this.order()?.emi;
    if (emi?.downPayment !== undefined && emi?.downPayment !== null) {
      return `Pay Down Payment (${formatInr(emi.downPayment)})`;
    }
    return 'Pay Down Payment';
  });

  readonly hasInterestRate = computed(() => {
    const rate = this.order()?.emi?.interestRate;
    return rate !== null && rate !== undefined;
  });

  readonly hasProcessingFee = computed(() => {
    const fee = this.order()?.emi?.processingFee;
    return fee !== null && fee !== undefined && fee > 0;
  });

  readonly showAutoEmiCard = computed(() => {
    const order = this.order();
    return Boolean(order && isEmiOrder(order.paymentType) && order.downPaymentPaid);
  });

  readonly isAutoEmiActiveView = computed(() => isAutoEmiActive(this.autopayStatus()));

  readonly dialogHeader = computed(() => {
    switch (this.autoEmiPhase()) {
      case 'active':
        return 'Auto EMI Active';
      case 'confirming':
      case 'pending_timeout':
        return 'Confirming Auto EMI';
      case 'incomplete':
        return 'Auto EMI Setup';
      case 'opening':
        return 'Starting Auto EMI';
      default:
        return 'Set Up Auto EMI Payment';
    }
  });

  /**
   * Upcoming (unpaid) installments from the live loan schedule — the mirror
   * of the paid history above, showing due dates and amounts still to pay.
   */
  readonly upcomingInstallments = computed(() => {
    const order = this.order();
    if (!order?.emiSchedule) return [];
    return order.emiSchedule.filter((row) => row.paymentStatus !== 'PAID');
  });

  /**
   * Live payment history, mirroring the invoice's Payment History table:
   * the collected down payment first, then each paid EMI (only collected rows).
   */
  readonly paymentHistory = computed(() => {
    const order = this.order();
    if (!order) return [];
    const rows: { label: string; date: string | null; amount: number }[] = [];
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
    // COD cash is collected at delivery — show it in the history once paid.
    if (
      order.paymentType === 'COD' &&
      order.amountPaid > 0 &&
      (order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'PAID')
    ) {
      rows.push({
        label: 'Paid at Delivery',
        date: order.paidAtDelivery ?? order.transactionDate ?? null,
        amount: order.amountPaid,
      });
    }
    return rows;
  });

  private orderRef = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.teardownAutopayWatch());
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const nextRef = params.get('orderId') ?? '';
      if (!nextRef.trim()) {
        this.loading.set(false);
        this.error.set('Invalid order reference.');
        this.order.set(null);
        return;
      }
      if (nextRef === this.orderRef && this.order()) {
        return;
      }
      this.orderRef = nextRef;
      this.load();
    });
  }

  downloadInvoice(): void {
    const current = this.order();
    if (!current?.id || this.downloading() || !current.invoiceAvailable) return;

    this.downloading.set(true);
    this.error.set(null);
    this.info.set(null);

    this.orderApi.downloadInvoice(current.id).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        if (blob.type?.includes('application/json')) {
          void blob.text().then((text) => {
            try {
              const parsed = JSON.parse(text) as { message?: string };
              this.error.set(parsed.message ?? 'Unable to download invoice.');
            } catch {
              this.error.set('Unable to download invoice.');
            }
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${current.orderNumber}-invoice.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.info.set('Invoice downloaded successfully.');
      },
      error: () => {
        this.downloading.set(false);
        this.error.set(this.orderApi.error() ?? 'Unable to download invoice.');
      },
    });
  }

  payDownPayment(): void {
    if (this.paying() || !this.order()?.canPayDownPayment) return;
    this.paying.set(true);
    this.error.set(null);

    this.paymentApi.createOrder().subscribe({
      next: (paymentOrder) => {
        if (paymentOrder.paymentDevBypass) {
          this.completeWithDevBypass(paymentOrder);
          return;
        }
        void this.openCheckout(paymentOrder);
      },
      error: () => {
        this.paying.set(false);
        this.error.set(this.paymentApi.error() ?? 'Unable to start payment.');
      },
    });
  }

  /** Start bank eMandate authorization after successful down payment. */
  setupAutoEmi(): void {
    if (this.autopaySubmitting()) return;
    const order = this.order();
    if (!order || !isEmiOrder(order.paymentType) || !order.downPaymentPaid) return;

    this.autopaySubmitting.set(true);
    this.error.set(null);
    this.info.set(null);
    this.popupBlocked.set(false);
    this.autoEmiPhase.set('opening');

    this.autopayApi.createEmandate().subscribe({
      next: (result) => this.afterMandateCreated(result.approvalUrl ?? null, result.status),
      error: () => {
        this.autopaySubmitting.set(false);
        this.autoEmiPhase.set('incomplete');
        this.error.set(this.autopayApi.error() ?? 'Unable to start Auto EMI setup.');
        this.showAutopayDialog.set(true);
      },
    });
  }

  /**
   * Retry only when backend allows it. Cancels a PENDING mandate first
   * (never ACTIVE), then creates a new EMANDATE — no duplicate create while PENDING.
   */
  retryAutoEmi(): void {
    if (this.autopaySubmitting()) return;
    const order = this.order();
    if (!order || !isEmiOrder(order.paymentType) || !order.downPaymentPaid) return;

    this.autopaySubmitting.set(true);
    this.error.set(null);
    this.info.set(null);
    this.popupBlocked.set(false);
    this.autoEmiPhase.set('opening');

    this.autopayApi.getStatus().subscribe({
      next: (status) => {
        this.autopayStatus.set(status);
        if (isAutoEmiActive(status)) {
          this.autopaySubmitting.set(false);
          this.autoEmiPhase.set('active');
          this.showAutopayDialog.set(true);
          return;
        }

        const mandateStatus = status.mandate?.status;
        if (mandateStatus === 'PENDING') {
          // Backend blocks recreate while PENDING — cancel first, never cancel ACTIVE.
          this.autopayApi.cancelMandate().subscribe({
            next: () => this.createEmandateAndOpen(),
            error: () => {
              this.autopaySubmitting.set(false);
              this.autoEmiPhase.set('pending_timeout');
              this.error.set(
                this.autopayApi.error() ??
                  'A pending Auto EMI authorization already exists. Complete it from the approval link, or try again later.',
              );
              this.approvalUrl.set(status.mandate?.approvalUrl ?? this.approvalUrl());
              this.showAutopayDialog.set(true);
            },
          });
          return;
        }

        if (status.canEnable || isTerminalMandateFailure(status) || !status.mandate) {
          this.createEmandateAndOpen();
          return;
        }

        this.autopaySubmitting.set(false);
        this.autoEmiPhase.set('incomplete');
        this.error.set(
          'Auto EMI cannot be restarted from the current mandate state. Open Auto EMI settings for details.',
        );
        this.showAutopayDialog.set(true);
      },
      error: () => {
        this.autopaySubmitting.set(false);
        this.autoEmiPhase.set('incomplete');
        this.error.set(this.autopayApi.error() ?? 'Unable to check Auto EMI status.');
        this.showAutopayDialog.set(true);
      },
    });
  }

  dismissAutopay(): void {
    if (this.autopaySubmitting()) return;
    this.showAutopayDialog.set(false);
  }

  openPendingApproval(): void {
    const url = this.approvalUrl() || this.autopayStatus()?.mandate?.approvalUrl;
    if (!url) return;
    const opened = openApprovalUrl(url);
    this.popupBlocked.set(!opened);
    if (opened) {
      this.autoEmiPhase.set('confirming');
      this.startStatusPoll();
    }
  }

  refreshAutoEmiStatus(): void {
    this.loadAutopayStatus({ openDialogIfNeeded: false, startPollIfPending: true });
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return formatInr(value);
  }

  formatPaymentType(value: string | null | undefined): string {
    return paymentTypeLabel(value);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDeliveryDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatRate(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value}% p.a.`;
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ');
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      order: this.orderApi.getById(this.orderRef),
      tracking: this.orderApi.getTracking(this.orderRef).pipe(
        catchError(() =>
          of({
            steps: [],
            trackingEvents: [],
          } as Partial<OrderTrackingDetails> as OrderTrackingDetails),
        ),
      ),
    }).subscribe({
      next: ({ order, tracking }) => {
        this.loading.set(false);
        this.order.set(order);
        this.setBreadcrumbs(order);

        const steps =
          tracking.steps?.length
            ? tracking.steps
            : ((tracking as { trackingSteps?: OrderTrackingDetails['steps'] }).trackingSteps ??
              []);
        this.tracking.set({
          ...order,
          ...tracking,
          steps,
        });

        // Prefer human-readable URL, but never leave the page stuck loading.
        const publicRef = order.orderNumber || order.id;
        if (
          publicRef &&
          publicRef !== this.orderRef &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            this.orderRef,
          )
        ) {
          this.orderRef = publicRef;
          void this.router.navigate(['/orders', publicRef], {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
        }

        const wantSetupPrompt =
          this.route.snapshot.queryParamMap.get('autopay') === '1' &&
          isEmiOrder(order.paymentType) &&
          Boolean(order.downPaymentPaid);

        if (isEmiOrder(order.paymentType) && order.downPaymentPaid) {
          this.loadAutopayStatus({
            openDialogIfNeeded: wantSetupPrompt,
            startPollIfPending: true,
          });
        } else {
          this.teardownAutopayWatch();
          this.autopayStatus.set(null);
          this.showAutopayDialog.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.order.set(null);
        this.error.set(this.orderApi.error() ?? 'Order not found or you do not have access.');
      },
    });
  }

  private setBreadcrumbs(order: OrderConfirmationDetails): void {
    this.layoutUi.setBreadcrumbs([
      { label: 'Home', path: '/' },
      { label: 'Orders', path: '/my-orders' },
      { label: order.orderNumber || 'Order Details' },
    ]);
  }

  private reloadOrder(): void {
    this.orderApi.getById(this.orderRef).subscribe({
      next: (order) => {
        this.order.set(order);
        this.setBreadcrumbs(order);
        if (isEmiOrder(order.paymentType) && order.downPaymentPaid) {
          this.loadAutopayStatus({ openDialogIfNeeded: true, startPollIfPending: true });
        }
      },
      error: () => {
        this.error.set(this.orderApi.error() ?? 'Unable to refresh order details.');
      },
    });
  }

  private loadAutopayStatus(options: {
    openDialogIfNeeded: boolean;
    startPollIfPending: boolean;
  }): void {
    this.autopayApi.getStatus().subscribe({
      next: (status) => {
        this.autopayStatus.set(status);
        this.approvalUrl.set(status.mandate?.approvalUrl ?? this.approvalUrl());

        if (isAutoEmiActive(status)) {
          this.stopStatusPoll();
          this.autoEmiPhase.set('active');
          if (options.openDialogIfNeeded) {
            this.showAutopayDialog.set(true);
          }
          return;
        }

        if (status.mandate?.status === 'PENDING') {
          this.autoEmiPhase.set('confirming');
          if (options.openDialogIfNeeded) {
            this.showAutopayDialog.set(true);
          }
          if (options.startPollIfPending) {
            this.startStatusPoll();
          }
          this.attachVisibilityWatch();
          return;
        }

        if (isTerminalMandateFailure(status)) {
          this.autoEmiPhase.set('incomplete');
          if (options.openDialogIfNeeded) {
            this.showAutopayDialog.set(true);
          }
          return;
        }

        if (status.canEnable) {
          this.autoEmiPhase.set('setup');
          if (options.openDialogIfNeeded) {
            this.showAutopayDialog.set(true);
          }
          return;
        }

        this.autoEmiPhase.set('setup');
      },
      error: () => {
        // No active loan yet / Autopay unavailable — still allow setup prompt after DP
        // if the user landed with ?autopay=1; create-mandate will surface real errors.
        if (options.openDialogIfNeeded) {
          this.autoEmiPhase.set('setup');
          this.showAutopayDialog.set(true);
        }
      },
    });
  }

  private createEmandateAndOpen(): void {
    this.autopayApi.createEmandate().subscribe({
      next: (result) => this.afterMandateCreated(result.approvalUrl ?? null, result.status),
      error: () => {
        this.autopaySubmitting.set(false);
        this.autoEmiPhase.set('incomplete');
        this.error.set(this.autopayApi.error() ?? 'Unable to start Auto EMI setup.');
        this.showAutopayDialog.set(true);
      },
    });
  }

  private afterMandateCreated(url: string | null, mandateStatus: string): void {
    this.autopaySubmitting.set(false);
    this.approvalUrl.set(url);

    // Never treat create success as Active — backend creates PENDING.
    if (mandateStatus === 'ACTIVE') {
      // Defensive: only if backend ever returns ACTIVE immediately (e.g. stub).
      this.loadAutopayStatus({ openDialogIfNeeded: true, startPollIfPending: false });
      return;
    }

    this.autoEmiPhase.set('confirming');
    this.showAutopayDialog.set(true);

    if (url) {
      const opened = openApprovalUrl(url);
      this.popupBlocked.set(!opened);
    } else {
      this.popupBlocked.set(true);
      this.error.set(
        'Mandate was created, but no authorization link was returned. Please open Auto EMI settings to continue.',
      );
    }

    this.startStatusPoll();
    this.attachVisibilityWatch();
    // Refresh local status snapshot from backend (source of truth).
    this.autopayApi.getStatus().subscribe({
      next: (status) => this.autopayStatus.set(status),
      error: () => undefined,
    });
  }

  private startStatusPoll(): void {
    this.stopStatusPoll();
    this.pollAttempts = 0;
    this.autoEmiPhase.set('confirming');

    const tick = (): void => {
      this.autopayApi.getStatus().subscribe({
        next: (status) => {
          this.autopayStatus.set(status);
          this.approvalUrl.set(status.mandate?.approvalUrl ?? this.approvalUrl());

          if (isAutoEmiActive(status)) {
            this.stopStatusPoll();
            this.autoEmiPhase.set('active');
            this.info.set('Auto EMI Active');
            this.showAutopayDialog.set(true);
            return;
          }

          if (isTerminalMandateFailure(status)) {
            this.stopStatusPoll();
            this.autoEmiPhase.set('incomplete');
            this.showAutopayDialog.set(true);
            return;
          }

          this.pollAttempts += 1;
          if (this.pollAttempts >= AUTO_EMI_POLL_MAX_ATTEMPTS) {
            this.stopStatusPoll();
            this.autoEmiPhase.set(
              status.mandate?.status === 'PENDING' ? 'pending_timeout' : 'incomplete',
            );
            this.showAutopayDialog.set(true);
            return;
          }

          this.pollTimer = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
        },
        error: () => {
          this.pollAttempts += 1;
          if (this.pollAttempts >= AUTO_EMI_POLL_MAX_ATTEMPTS) {
            this.stopStatusPoll();
            this.autoEmiPhase.set('incomplete');
            return;
          }
          this.pollTimer = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
        },
      });
    };

    this.pollTimer = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
  }

  private stopStatusPoll(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private attachVisibilityWatch(): void {
    if (this.visibilityHandler || typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return;
      const phase = this.autoEmiPhase();
      if (phase === 'confirming' || phase === 'pending_timeout' || phase === 'opening') {
        this.autopayApi.getStatus().subscribe({
          next: (status) => {
            this.autopayStatus.set(status);
            if (isAutoEmiActive(status)) {
              this.stopStatusPoll();
              this.autoEmiPhase.set('active');
            } else if (isTerminalMandateFailure(status)) {
              this.stopStatusPoll();
              this.autoEmiPhase.set('incomplete');
            }
          },
          error: () => undefined,
        });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private teardownAutopayWatch(): void {
    this.stopStatusPoll();
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private completeWithDevBypass(order: CreatePaymentOrderResponse): void {
    this.paymentApi.createDevBypassSignature(order.razorpayOrderId).subscribe({
      next: (signed) => this.verifyPayment(signed),
      error: () => {
        this.paying.set(false);
        this.error.set(this.paymentApi.error() ?? 'Dev payment bypass failed.');
      },
    });
  }

  private async openCheckout(order: CreatePaymentOrderResponse): Promise<void> {
    try {
      await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'LoanEx',
        description: `Down payment for ${order.applicationNumber}`,
        order_id: order.razorpayOrderId,
        prefill: order.prefill,
        notes: order.notes,
        theme: { color: '#0A2E6F' },
        handler: (response) => {
          this.verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            this.paying.set(false);
            this.error.set('Payment was cancelled. You can try again when ready.');
          },
        },
      });
    } catch {
      this.paying.set(false);
      this.error.set('Unable to open Razorpay checkout. Please try again.');
    }
  }

  private verifyPayment(payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): void {
    this.paymentApi.verify(payload).subscribe({
      next: (result) => {
        this.paying.set(false);
        this.info.set('Down payment completed successfully.');
        if (result.orderNumber || result.orderId) {
          const nextRef = result.orderNumber || result.orderId!;
          if (nextRef !== this.orderRef) {
            void this.router.navigate(['/orders', nextRef], {
              queryParams: { autopay: 1 },
              replaceUrl: true,
            });
            return;
          }
        }
        this.reloadOrder();
      },
      error: () => {
        this.paying.set(false);
        this.error.set(this.paymentApi.error() ?? 'Payment verification failed.');
      },
    });
  }
}
