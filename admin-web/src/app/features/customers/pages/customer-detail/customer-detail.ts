import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CustomerService } from '../../services/customer.service';
import { OrderService } from '../../../orders/services/order.service';
import { Order, orderDisplayId, paymentMethodLabel } from '../../../orders/models/order.models';
import {
  Customer,
  CustomerActivity,
  CustomerEmiApplication,
  CustomerLoan,
  customerDisplayName,
  customerEmail,
  customerKycStatus,
  customerPhone,
  displayAadhaar,
  displayPan,
  formatKycAddress,
  humanizeAction,
  initialsFromName,
  kycAadhaarVerified,
  kycCibilScore,
  kycFaceVerified,
  kycPanVerified,
} from '../../models/customer.models';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ButtonModule,
    TooltipModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    StatusBadge,
  ],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetail {
  private readonly customers = inject(CustomerService);
  private readonly ordersApi = inject(OrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly customer = signal<Customer | undefined>(undefined);
  readonly activity = signal<CustomerActivity[]>([]);
  readonly loans = signal<CustomerLoan[]>([]);
  readonly emiApplications = signal<CustomerEmiApplication[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly customerId = this.route.snapshot.paramMap.get('id')!;

  readonly title = computed(() => {
    const customer = this.customer();
    return customer ? customerDisplayName(customer) : 'Customer';
  });

  readonly initials = computed(() => initialsFromName(this.title()));
  readonly phone = computed(() => {
    const customer = this.customer();
    return customer ? customerPhone(customer) : '—';
  });
  readonly email = computed(() => {
    const customer = this.customer();
    return customer ? customerEmail(customer) : '—';
  });
  readonly kycStatus = computed(() => {
    const customer = this.customer();
    return customer ? customerKycStatus(customer) : 'Not Available';
  });
  readonly accountStatus = computed(() => {
    const customer = this.customer();
    if (!customer) return 'active';
    return customer.blocked ? 'blocked' : customer.status || 'active';
  });
  readonly address = computed(() => formatKycAddress(this.customer()?.kyc));
  readonly aadhaarVerified = computed(() => kycAadhaarVerified(this.customer()?.kyc));
  readonly panVerified = computed(() => kycPanVerified(this.customer()?.kyc));
  readonly faceVerified = computed(() => kycFaceVerified(this.customer()?.kyc));
  readonly aadhaarDisplay = computed(() => displayAadhaar(this.customer()?.kyc));
  readonly panDisplay = computed(() => displayPan(this.customer()?.kyc));
  readonly cibilScore = computed(() => kycCibilScore(this.customer()?.kyc));

  readonly finance = computed(() => {
    const loans = this.loans();
    const active = loans.filter((l) => String(l.loanStatus).toUpperCase() === 'ACTIVE');
    const completed = loans.filter((l) =>
      ['CLOSED', 'COMPLETED', 'SETTLED'].includes(String(l.loanStatus).toUpperCase()),
    );
    return {
      totalLoans: loans.length,
      activeLoans: active.length,
      completedLoans: completed.length,
      outstanding: loans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0),
      paid: loans.reduce((sum, l) => sum + (l.paidAmount || 0), 0),
      totalOrders: this.orders().length,
      emiApps: this.emiApplications().length,
    };
  });

  readonly copyTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 150,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      detail: this.customers.getDetail(this.customerId),
      orders: this.ordersApi.list().pipe(catchError(() => of([] as Order[]))),
    }).subscribe({
      next: ({ detail, orders }) => {
        if (!detail) {
          this.customer.set(undefined);
          this.activity.set([]);
          this.loans.set([]);
          this.emiApplications.set([]);
          this.orders.set([]);
          this.loading.set(false);
          return;
        }

        this.customer.set(detail.customer);
        this.activity.set(detail.activity);
        this.loans.set(detail.loans);
        this.emiApplications.set(detail.emiApplications);

        const phone = customerPhone(detail.customer);
        const phones = new Set(
          [detail.customer.phone, detail.customer.profile?.mobile_number, phone]
            .map((p) => String(p ?? '').trim())
            .filter((p) => p && p !== '—'),
        );

        this.orders.set(
          orders.filter((order) => {
            if (order.customerId === this.customerId || order.userId === this.customerId) {
              return true;
            }
            const orderPhone = String(order.customerPhone ?? '').trim();
            return !!orderPhone && phones.has(orderPhone);
          }),
        );
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  back(): void {
    this.router.navigate(['/customers']);
  }

  orderLabel(order: Order): string {
    return orderDisplayId(order);
  }

  methodLabel(order: Order): string {
    return paymentMethodLabel(order.paymentMethod);
  }

  viewOrder(order: Order): void {
    this.router.navigate(['/orders', order.id]);
  }

  actionLabel(action: string): string {
    return humanizeAction(action);
  }

  async copyId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.customerId);
      this.messages.add({ severity: 'success', summary: 'Customer ID copied' });
    } catch {
      this.messages.add({ severity: 'warn', summary: 'Could not copy customer ID' });
    }
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Unable to load this customer.';
    }
    return 'Unable to load this customer.';
  }
}
