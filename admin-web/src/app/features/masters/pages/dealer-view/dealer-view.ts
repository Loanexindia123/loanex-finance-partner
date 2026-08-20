import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { DealerService } from '../../services/dealer.service';
import { Dealer } from '../../models/dealer.models';
import { DialogModule } from 'primeng/dialog';

const AVATAR_TONES = [
  { bg: '#eef2ff', color: '#4338ca' },
  { bg: '#ecfdf5', color: '#047857' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#fdf2f8', color: '#be185d' },
  { bg: '#ecfeff', color: '#0e7490' },
  { bg: '#fef3c7', color: '#b45309' },
] as const;

const PROFILE_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'dealerCode', label: 'Dealer Code' },
  { key: 'ownerName', label: 'Owner Name' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'dealerType', label: 'Dealer Type' },
  { key: 'categoryDepartment', label: 'Category / Department' },
  { key: 'establishedYear', label: 'Established Year' },
  { key: 'branch', label: 'Dealer Branch' },
];

const TAX_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'gstNumber', label: 'GSTIN / GST Number' },
];

const CONTACT_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'mobile', label: 'Mobile' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
];

const ADDRESS_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'shopAddress', label: 'Shop Address' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'googleLocation', label: 'Google Location' },
  { key: 'deliveryArea', label: 'Delivery Area' },
  { key: 'deliveryTime', label: 'Delivery Time' },
];

const DISPATCH_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'warehouseAddress', label: 'Dispatch From' },
];

const COMMERCIAL_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'paymentSettlementTerms', label: 'Payment Terms' },
  { key: 'paymentCycle', label: 'Settlement Cycle' },
  { key: 'holdPercentage', label: 'Hold Payment %' },
  { key: 'commission', label: 'Dealer Incentive %' },
  { key: 'productDeliveryBy', label: 'Product Delivery By' },
  { key: 'assignedB2BManager', label: 'Assigned B2B Manager' },
  { key: 'accountHolderName', label: 'Account Holder' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'ifscCode', label: 'IFSC Code' },
];

const CREATOR_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'creatorType', label: 'Creator Type' },
  { key: 'creatorName', label: 'Creator' },
  { key: 'creatorId', label: 'Creator ID' },
];

const DOCUMENT_FIELDS: Array<{ key: keyof Dealer; label: string }> = [
  { key: 'panCard', label: 'PAN Card' },
  { key: 'gstCertificate', label: 'GST Certificate' },
  { key: 'ownerAadhaar', label: 'Owner Aadhaar' },
  { key: 'shopAddressProof', label: 'Shop Address Proof' },
  { key: 'cancelledCheque', label: 'Cancelled Cheque' },
  { key: 'shopPhotos', label: 'Shop Photos' },
  { key: 'dealerAgreement', label: 'Dealer Agreement' },
];

@Component({
  selector: 'app-dealer-view',
  standalone: true,
  imports: [DatePipe, ButtonModule, DialogModule, PageHeader, BrandedLoader, StatusBadge, CanDirective],
  templateUrl: './dealer-view.html',
  styleUrl: './dealer-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealerView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dealers = inject(DealerService);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly dealer = signal<Dealer | null>(null);
  readonly dealerId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly profileFields = PROFILE_FIELDS;
  readonly taxFields = TAX_FIELDS;
  readonly contactFields = CONTACT_FIELDS;
  readonly addressFields = ADDRESS_FIELDS;
  readonly dispatchFields = DISPATCH_FIELDS;
  readonly commercialFields = COMMERCIAL_FIELDS;
  readonly creatorFields = CREATOR_FIELDS;
  readonly documentFields = DOCUMENT_FIELDS;

  readonly completion = computed(() => {
    const d = this.dealer();
    if (!d) return { filled: 0, total: 0, percent: 0 };
    const keys = [
      ...PROFILE_FIELDS,
      ...TAX_FIELDS,
      ...CONTACT_FIELDS,
      ...ADDRESS_FIELDS,
      ...DISPATCH_FIELDS,
      ...COMMERCIAL_FIELDS,
      ...CREATOR_FIELDS,
      ...DOCUMENT_FIELDS,
    ].map((f) => f.key);
    const total = keys.length;
    const filled = keys.filter((key) => this.hasValue(d[key])).length;
    return { filled, total, percent: total ? Math.round((filled / total) * 100) : 0 };
  });

  constructor() {
    this.dealers.getById(this.dealerId).subscribe({
      next: (dealer) => {
        this.dealer.set(dealer);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: 'Dealer not found' });
        this.router.navigate(['/masters/dealers']);
      },
    });
  }

  avatarInitials(dealer: Dealer): string {
    const words = dealer.dealerName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
    }
    return (dealer.dealerName || dealer.dealerCode || 'DL').slice(0, 2).toUpperCase();
  }

  avatarTone(dealer: Dealer): { bg: string; color: string } {
    const key = dealer.dealerName || dealer.dealerCode || dealer.id;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash + key.charCodeAt(i)) % AVATAR_TONES.length;
    }
    return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
  }

  hasValue(value: unknown): boolean {
    return String(value ?? '').trim().length > 0;
  }

  fieldValue(dealer: Dealer, key: keyof Dealer): string {
    return String(dealer[key] ?? '').trim();
  }

  isUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  filledCount(dealer: Dealer, fields: Array<{ key: keyof Dealer }>): number {
    return fields.filter((f) => this.hasValue(dealer[f.key])).length;
  }

    readonly hasKycSubmission = computed(() => {
    const d = this.dealer();
    if (!d) return false;
    return (
      this.hasValue(d.panCard) && this.hasValue(d.ownerAadhaar) && this.hasValue(d.gstCertificate)
    );
  });

  readonly savingVerification = signal(false);
  readonly verificationConfirmTarget = signal<'approved' | 'rejected' | null>(null);

  askUpdateVerification(status: 'approved' | 'rejected'): void {
    if (this.savingVerification()) return;
    this.verificationConfirmTarget.set(status);
  }

  cancelUpdateVerification(): void {
    if (this.savingVerification()) return;
    this.verificationConfirmTarget.set(null);
  }

  confirmUpdateVerification(): void {
    const status = this.verificationConfirmTarget();
    const d = this.dealer();
    if (!status || !d || this.savingVerification()) return;

    this.savingVerification.set(true);
    this.dealers.updateVerificationStatus(d, status).subscribe({
      next: (updated) => {
        this.savingVerification.set(false);
        this.verificationConfirmTarget.set(null);
        this.dealer.set(updated);
        this.messages.add({
          severity: 'success',
          summary: status === 'approved' ? 'Dealer KYC approved' : 'Dealer KYC rejected',
          detail: d.dealerName || d.dealerCode,
        });
      },
      error: () => {
        this.savingVerification.set(false);
        this.messages.add({
          severity: 'error',
          summary: 'Could not update verification status',
          detail: d.dealerName || d.dealerCode,
        });
      },
    });
  }

  edit(): void {
    this.router.navigate(['/masters/dealers', this.dealerId, 'edit']);
  }

  back(): void {
    this.router.navigate(['/masters/dealers']);
  }
}
