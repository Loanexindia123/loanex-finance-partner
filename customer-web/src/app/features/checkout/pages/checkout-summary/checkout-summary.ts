import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formatInr } from '../../../../shared/utils/currency';
import { CartService } from '../../../cart/services/cart.service';
import { EmiPlanSelectionService } from '../../../emi/services/emi-plan-selection.service';
import { CheckoutIntentService } from '../../services/checkout-intent.service';
import {
  CheckoutApiService,
  CheckoutSummary,
  PurchaseType,
} from '../../services/checkout-api.service';

@Component({
  selector: 'app-checkout-summary',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './checkout-summary.html',
  styleUrl: './checkout-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutSummaryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly checkoutApi = inject(CheckoutApiService);
  private readonly checkoutIntent = inject(CheckoutIntentService);
  private readonly emiPlan = inject(EmiPlanSelectionService);
  private readonly cartApi = inject(CartService);

  readonly formatInr = formatInr;
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly summary = signal<CheckoutSummary | null>(null);
  readonly productId = signal<string | null>(null);
  readonly variantId = signal<string | null>(null);
  readonly quantity = signal(1);
  readonly mode = signal<'BUY_NOW' | 'CART'>('BUY_NOW');
  readonly isMultipleProducts = signal(false);

  /** COD is blocked above the configurable cap (backend COD_MAX_AMOUNT). */
  readonly codRestricted = signal(false);

  readonly form = this.fb.nonNullable.group({
    purchaseType: ['EMI' as PurchaseType, Validators.required],
    addressId: ['', Validators.required],
  });

  ngOnInit(): void {
    const queryMode = this.route.snapshot.queryParamMap.get('mode');
    const queryProductId = this.route.snapshot.queryParamMap.get('productId');
    const queryVariantId = this.route.snapshot.queryParamMap.get('variantId');
    const queryQty = this.route.snapshot.queryParamMap.get('quantity');
    const intent = this.checkoutIntent.get();
    const plan = this.emiPlan.get();

    // Prefer URL params (current product). Only use session intent/plan as fallback
    // so a stale loanex.checkoutIntent cannot force the wrong product on every PDP.
    const mode =
      queryMode === 'cart'
        ? 'CART'
        : queryMode === 'buy_now'
          ? 'BUY_NOW'
          : intent?.mode === 'CART'
            ? 'CART'
            : 'BUY_NOW';
    const productId =
      queryProductId ||
      (mode === 'CART' ? 'CART' : null) ||
      intent?.productId ||
      plan?.productId ||
      null;
    const variantId =
      queryVariantId || intent?.variantId || plan?.variantId || null;
    const quantity = Number(queryQty) || intent?.quantity || 1;

    // Drop stale BUY_NOW intent when URL explicitly names a different product.
    if (
      queryProductId &&
      intent?.mode === 'BUY_NOW' &&
      intent.productId &&
      intent.productId !== queryProductId
    ) {
      this.checkoutIntent.save({
        productId: queryProductId,
        variantId: variantId ?? undefined,
        quantity,
        mode: 'BUY_NOW',
      });
    }

    if (!productId && mode !== 'CART') {
      this.loading.set(false);
      this.error.set('No product selected for checkout.');
      return;
    }

    this.mode.set(mode);
    this.productId.set(productId);
    this.variantId.set(variantId);
    this.quantity.set(quantity);
    this.load(productId ?? '', quantity, variantId ?? undefined, mode);
  }

  continueCheckout(): void {
    this.form.markAllAsTouched();
    const productId = this.productId();
    const mode = this.mode();
    const data = this.summary();
    
    if ((!productId && mode !== 'CART') || !data || this.form.invalid) {
      this.error.set('Please select a delivery address and purchase option.');
      return;
    }

    // COD — place the order directly (pay on delivery), no payment step.
    if (this.form.controls.purchaseType.value === 'COD') {
      this.placeCodOrder();
      return;
    }

    if (!data.prerequisites.readyForCheckout) {
      void this.router.navigateByUrl('/checkout/personal-details');
      return;
    }

    if (mode === 'CART' && data.items?.some(i => !i.product.inStock)) {
      this.error.set('One or more items are out of stock.');
      return;
    } else if (mode === 'BUY_NOW' && !data.product.inStock) {
      this.error.set('Product is out of stock.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.checkoutApi
      .create({
        productId: productId ?? undefined,
        mode,
        variantId: this.variantId() ?? undefined,
        quantity: this.quantity(),
        purchaseType: this.form.controls.purchaseType.value,
        addressId: this.form.controls.addressId.value,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (result.nextStep === 'EMI_VERIFICATION') {
            const unitPrice = result.summary.pricing.unitPrice;
            const productId = result.summary.product.id;
            const existing = this.emiPlan.get();
            // Prefer PDP-selected plan for this product — never invent terms.
            if (
              existing &&
              existing.productId === productId &&
              existing.requestedDownPayment > 0 &&
              existing.requestedTenure > 0
            ) {
              this.emiPlan.save({
                ...existing,
                productName: result.summary.product.name,
                sellingPrice: unitPrice,
                variantId:
                  result.summary.product.variantId ??
                  this.variantId() ??
                  existing.variantId,
              });
            } else {
              this.submitting.set(false);
              this.error.set(
                'Please choose an EMI plan on the product page before continuing checkout.',
              );
              void this.router.navigate(['/products', productId]);
              return;
            }
          }
          void this.router.navigateByUrl(
            result.nextStep === 'DIRECT_PAYMENT'
              ? `${result.redirectPath}?sessionId=${result.session.id}`
              : result.redirectPath,
          );
        },
        error: () => {
          this.submitting.set(false);
          this.error.set(this.checkoutApi.error() ?? 'Unable to continue checkout.');
        },
      });
  }

  private placeCodOrder(): void {
    const data = this.summary();
    if (!data) return;
    this.submitting.set(true);
    this.error.set(null);

    const items =
      data.items && data.items.length > 0
        ? data.items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            ...(item.variantId ? { variantId: item.variantId } : {}),
          }))
        : [
            {
              productId: data.product.id,
              quantity: data.quantity,
              ...(data.product.variantId ? { variantId: data.product.variantId } : {}),
            },
          ];

    this.checkoutApi.placeCodOrder({
      items,
      addressId: this.form.controls.addressId.value,
    }).subscribe({
      next: (result) => {
        this.submitting.set(false);
        // COD order consumes cart items server-side — don't reuse Shell cache.
        this.cartApi.invalidate();
        // The order is placed — land on the order confirmation page.
        void this.router.navigate(['/orders', result.order.orderNumber || result.order.id], {
          queryParams: { placed: 'true' },
          replaceUrl: true,
        });
      },
      error: () => {
        this.submitting.set(false);
        this.error.set(this.checkoutApi.error() ?? 'Unable to place your order.');
      },
    });
  }

  goBack(): void {
    if (this.mode() === 'CART') {
      void this.router.navigateByUrl('/cart');
      return;
    }
    const productId = this.productId();
    if (productId) {
      void this.router.navigateByUrl(`/products/${productId}`);
      return;
    }
    void this.router.navigateByUrl('/products');
  }

  formatAddress(address: {
    addressLine1: string;
    addressLine2: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  }): string {
    const landmark = address.landmark ? `, ${address.landmark}` : '';
    return `${address.addressLine1}, ${address.addressLine2}${landmark}, ${address.city}, ${address.state} ${address.pincode}`;
  }

  private load(productId: string, quantity: number, variantId?: string, mode?: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.checkoutApi.getSummary(productId, quantity, variantId, mode).subscribe({
      next: (data) => {
        this.loading.set(false);
        this.summary.set(data);
        
        const isMultiple = (data.items?.length ?? 1) > 1;
        this.isMultipleProducts.set(isMultiple);
        if (isMultiple) {
          this.form.controls.purchaseType.setValue('DIRECT');
        }

        // COD cap from the server — show the restriction when it applies.
        const restricted =
          data.codRules != null && data.codRules.maxAmount > 0 && !data.codRules.codAllowed;
        this.codRestricted.set(restricted);
        if (restricted && this.form.controls.purchaseType.value === 'COD') {
          this.form.controls.purchaseType.setValue('DIRECT');
        }

        if (!data.prerequisites.readyForCheckout) {
          this.checkoutIntent.save({
            productId: productId ?? 'CART',
            variantId,
            quantity,
            mode: (mode as 'CART' | 'BUY_NOW') ?? 'BUY_NOW',
          });
          void this.router.navigateByUrl('/checkout/personal-details');
          return;
        }

        const addresses = data.addresses?.length
          ? data.addresses
          : data.address
            ? [{ ...data.address, isDefault: true }]
            : [];
        const selected =
          addresses.find((item) => item.isDefault)?.id ?? addresses[0]?.id ?? '';
        this.form.controls.addressId.setValue(selected);

        if (mode === 'CART' && data.items?.some(i => !i.product.inStock)) {
          this.error.set('One or more products are currently out of stock.');
        } else if (mode === 'BUY_NOW' && !data.product.inStock) {
          this.error.set('This product is currently out of stock.');
        }
      },
      error: () => {
        this.loading.set(false);
        const message = this.checkoutApi.error() ?? 'Unable to load checkout summary.';
        this.error.set(message);
        // Stale session intent (deleted product id) — clear so the next PDP Buy Now works.
        if (/product not found/i.test(message) && this.mode() === 'BUY_NOW') {
          this.checkoutIntent.clear();
        }
      },
    });
  }
}
