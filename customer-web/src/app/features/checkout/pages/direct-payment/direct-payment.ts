import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatInr } from '../../../../shared/utils/currency';
import {
  CheckoutApiService,
  CheckoutSessionResponse,
  CreateDirectPaymentOrderResponse,
  RazorpayVerifyPayload,
} from '../../services/checkout-api.service';
import { CartService } from '../../../cart/services/cart.service';
import { PendingCheckoutService } from '../../services/pending-checkout.service';
import { openRazorpayCheckout } from '../../../emi/utils/razorpay-checkout';

@Component({
  selector: 'app-direct-payment',
  imports: [],
  templateUrl: './direct-payment.html',
  styleUrl: './direct-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectPaymentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checkoutApi = inject(CheckoutApiService);
  private readonly cartService = inject(CartService);
  private readonly pendingCheckout = inject(PendingCheckoutService);

  readonly formatInr = formatInr;
  readonly loading = signal(true);
  readonly processing = signal(false);
  readonly error = signal<string | null>(null);
  /** True once the Razorpay modal was dismissed or payment failed — shows the
   *  "Your items are still in your cart" panel with a Back to Cart action. */
  readonly paymentFailed = signal(false);
  readonly cartItemCount = signal(0);
  readonly data = signal<CheckoutSessionResponse | null>(null);

  private sessionId = '';

  ngOnInit(): void {
    this.sessionId =
      this.route.snapshot.queryParamMap.get('sessionId') ||
      this.checkoutApi.getSavedSessionId() ||
      '';

    if (!this.sessionId) {
      this.loading.set(false);
      this.error.set('Checkout session not found. Please restart checkout.');
      return;
    }

    this.checkoutApi.getSession(this.sessionId).subscribe({
      next: (payload) => {
        this.loading.set(false);
        if (payload.session.purchaseType !== 'DIRECT') {
          this.error.set('This session is not a direct purchase.');
          return;
        }
        this.data.set(payload);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.checkoutApi.error() ?? 'Unable to load payment session.');
      },
    });
  }

  payNow(): void {
    if (this.processing()) return;
    this.processing.set(true);
    this.error.set(null);
    this.paymentFailed.set(false);

    // Create the Razorpay order server-side — never construct the checkout
    // with a hardcoded key or client-computed amount.
    this.checkoutApi.createPaymentOrder(this.sessionId).subscribe({
      next: (order) => {
        if (order.paymentDevBypass) {
          this.completeWithDevBypass();
          return;
        }
        void this.openRazorpayCheckout(order);
      },
      error: () => this.handlePaymentError('Unable to start payment.'),
    });
  }

  goToCheckout(): void {
    const productId = this.data()?.session.productId;
    if (productId) {
      void this.router.navigate(['/checkout'], { queryParams: { productId } });
      return;
    }
    void this.router.navigateByUrl('/checkout');
  }

  /** Failure panel CTA — the cart is preserved server-side until payment
   *  succeeds, so send the customer straight back to it. */
  backToCart(): void {
    void this.router.navigateByUrl('/cart');
  }

  /** Re-open the Razorpay checkout from the failure panel. */
  retryPayment(): void {
    this.payNow();
  }

  private trackCartCount(): void {
    this.cartService.getCart().subscribe({
      next: (cart) => this.cartItemCount.set(cart.summary.totalItems),
      error: () => this.cartItemCount.set(0),
    });
  }

  /** Dev-only path: fabricate a signature via the backend and verify it. */
  private completeWithDevBypass(): void {
    this.checkoutApi.createDevBypassSignature(this.sessionId).subscribe({
      next: (signed) => this.verifyAndNavigate(signed),
      error: () => this.handlePaymentError('Dev payment bypass failed.'),
    });
  }

  private async openRazorpayCheckout(order: CreateDirectPaymentOrderResponse): Promise<void> {
    const description =
      this.data()?.summary.product.name ?? 'Direct Order Payment';

    try {
      await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'LoanEx',
        description,
        order_id: order.razorpayOrderId,
        theme: { color: '#0A2E6F' },
        handler: (response) => {
          this.verifyAndNavigate({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            // The customer closed the checkout without paying — remember the
            // session so the cart can offer a "Resume checkout" prompt. The
            // session and cart stay intact until payment actually succeeds.
            this.pendingCheckout.save({ kind: 'DIRECT', sessionId: this.sessionId });
            this.processing.set(false);
            this.paymentFailed.set(true);
            this.trackCartCount();
          },
        },
      });
    } catch {
      this.pendingCheckout.save({ kind: 'DIRECT', sessionId: this.sessionId });
      this.processing.set(false);
      this.paymentFailed.set(true);
      this.trackCartCount();
    }
  }

  /** Verify the payment server-side, then send the user to their orders. */
  private verifyAndNavigate(payload: RazorpayVerifyPayload): void {
    this.checkoutApi.verifyPayment(this.sessionId, payload).subscribe({
      next: (result) => {
        this.processing.set(false);
        // Payment landed — cart may be cleared server-side; drop in-memory reuse.
        this.cartService.invalidate();
        // Payment landed — no unfinished checkout left to resume.
        this.pendingCheckout.clear();
        this.goToOrder(result, payload.razorpayPaymentId);
      },
      error: () => this.handlePaymentError('Payment verification failed.'),
    });
  }

  private handlePaymentError(fallback: string): void {
    this.processing.set(false);
    if (this.checkoutApi.errorCode() === 'ALREADY_PAID') {
      // Prefer explicit order from error details when present; else My Orders.
      const details = this.checkoutApi as unknown as {
        errorDetails?: { orderNumber?: string; orderId?: string };
      };
      const orderRef =
        details.errorDetails?.orderNumber || details.errorDetails?.orderId;
      // Already paid — nothing left to resume.
      this.pendingCheckout.clear();
      if (orderRef) {
        void this.router.navigate(['/orders', orderRef], {
          queryParams: { paymentSuccess: 'true', alreadyProcessed: 'true' },
          replaceUrl: true,
        });
        return;
      }
      this.goToOrder({ alreadyProcessed: true }, undefined);
      return;
    }
    this.error.set(this.checkoutApi.error() ?? fallback);
  }

  private goToOrder(
    result: {
      orderId?: string | null;
      orderNumber?: string | null;
      alreadyProcessed?: boolean;
    },
    paymentId?: string,
  ): void {
    const orderRef = result.orderNumber || result.orderId || undefined;
    if (orderRef) {
      void this.router.navigate(['/orders', orderRef], {
        queryParams: {
          paymentSuccess: 'true',
          ...(paymentId ? { paymentId } : {}),
          ...(result.alreadyProcessed ? { alreadyProcessed: 'true' } : {}),
        },
        replaceUrl: true,
      });
      return;
    }
    void this.router.navigate(['/my-orders'], {
      queryParams: {
        paymentSuccess: 'true',
        ...(paymentId ? { paymentId } : {}),
        ...(result.alreadyProcessed ? { alreadyProcessed: 'true' } : {}),
      },
      replaceUrl: true,
    });
  }
}
