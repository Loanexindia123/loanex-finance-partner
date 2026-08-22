import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/services/auth.service';
import { RbacService } from '../../../../core/services/rbac.service';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { DealerService } from '../../services/dealer.service';
import { StaffUser, StaffUserService } from '../../services/staff-user.service';
import {
  BUSINESS_TYPES,
  CREATOR_TYPES,
  DEALER_TYPES,
  PAYMENT_CYCLES,
  PAYMENT_SETTLEMENT_TERMS,
  PRODUCT_DELIVERY_BY,
  VERIFICATION_STATUS_OPTIONS,
  DealerPayload,
  emptyDealer,
} from '../../models/dealer.models';
import { ProductService } from '../../../products/services/product.service';
import { WizardOptionsService } from '../../../products/services/wizard-options.service';
import { forkJoin, map, of, switchMap } from 'rxjs';

const DEALER_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const DEALER_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const DEALER_DOCUMENT_FIELDS = [
  'panCard',
  'gstCertificate',
  'ownerAadhaar',
  'shopAddressProof',
  'cancelledCheque',
  'shopPhotos',
  'dealerAgreement',
] as const;

const SUBMIT_REQUIRED_FIELDS: ReadonlyArray<{
  key: string;
  label: string;
  array?: boolean;
}> = [
    { key: 'creatorType', label: 'Creator Type' },
    { key: 'creatorName', label: 'Search Creator' },
    { key: 'dealerName', label: 'Dealer Name' },
    { key: 'ownerName', label: 'Owner Name' },
    { key: 'businessType', label: 'Business Type' },
    { key: 'mobile', label: 'Mobile Number' },
    { key: 'dealerType', label: 'Dealer Type' },
    { key: 'categoryDepartments', label: 'Category / Department', array: true },
    { key: 'shopAddress', label: 'Complete Shop Address' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'googleLocation', label: 'Google Location' },
    { key: 'deliveryArea', label: 'Delivery Area' },
    { key: 'panCard', label: 'PAN Card' },
    { key: 'shopAddressProof', label: 'Shop Address Proof' },
    { key: 'cancelledCheque', label: 'Cancelled Cheque' },
    { key: 'shopPhotos', label: 'Shop Photos' },
    { key: 'accountHolderName', label: 'Account Holder Name' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'ifscCode', label: 'IFSC Code' },
    { key: 'paymentCycle', label: 'Payment Cycle' },
    { key: 'productDeliveryBy', label: 'Product Delivery By' },
    { key: 'assignedB2BManager', label: 'Assigned B2B Manager' },
  ];

@Component({
  selector: 'app-dealer-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    ButtonModule,
    BrandedLoader,
  ],
  templateUrl: './dealer-form.html',
  styleUrl: './dealer-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealerForm {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dealers = inject(DealerService);
  private readonly staffUsers = inject(StaffUserService);
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly products = inject(ProductService);
  private readonly wizard = inject(WizardOptionsService);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pendingDocuments = new Map<string, File>();
  private readonly pendingPreviewUrls = new Map<string, string>();

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly staffOptions = signal<
    { label: string; value: string; userId: string; email: string }[]
  >([]);

  readonly isEdit = !!this.route.snapshot.paramMap.get('id');
  readonly dealerId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly returnTo = this.route.snapshot.queryParamMap.get('returnTo');
  readonly returnLabel = this.route.snapshot.queryParamMap.get('returnLabel') ?? 'Back';

  readonly creatorTypeOptions = CREATOR_TYPES.map((v) => ({ label: v, value: v }));
  readonly businessTypeOptions = BUSINESS_TYPES.map((v) => ({ label: v, value: v }));
  readonly dealerTypeOptions = DEALER_TYPES.map((v) => ({ label: v, value: v }));
  readonly paymentCycleOptions = PAYMENT_CYCLES.map((v) => ({ label: v, value: v }));
  readonly paymentTermsOptions = PAYMENT_SETTLEMENT_TERMS.map((v) => ({ label: v, value: v }));
  readonly productDeliveryOptions = PRODUCT_DELIVERY_BY.map((v) => ({ label: v, value: v }));
  readonly verificationOptions = VERIFICATION_STATUS_OPTIONS;

  readonly documentFields = [
    { key: 'panCard', label: 'PAN Card *', hint: 'PDF / JPG' },
    { key: 'gstCertificate', label: 'GST Certificate', hint: 'Upload or Not Registered' },
    { key: 'ownerAadhaar', label: 'Owner Aadhaar', hint: 'Front + Back (optional)' },
    { key: 'shopAddressProof', label: 'Shop Address Proof *', hint: 'Registration / Bill / Agreement' },
    { key: 'cancelledCheque', label: 'Cancelled Cheque *', hint: 'Cheque image' },
    { key: 'shopPhotos', label: 'Shop Photos *', hint: 'Front + Inside' },
  ] as const;

  readonly categoryDepartmentOptions = computed(() => {
    const tree = this.wizard.categoryTree();
    const options: { label: string; value: string }[] = [];
    for (const category of Object.keys(tree)) {
      options.push({ label: category, value: category });
      for (const sub of Object.keys(tree[category] ?? {})) {
        options.push({ label: `${category} / ${sub}`, value: `${category} / ${sub}` });
      }
    }
    return options;
  });

  readonly form: FormGroup = this.fb.group({
    dealerCode: [''],
    dealerName: ['', Validators.required],
    creatorType: ['', Validators.required],
    creatorId: [''],
    creatorName: ['', Validators.required],
    ownerName: ['', Validators.required],
    businessType: ['', Validators.required],
    mobile: ['', Validators.required],
    whatsapp: [''],
    email: ['', optionalEmail],
    dealerType: ['', Validators.required],
    categoryDepartments: [[], requiredNonEmptyArray],
    establishedYear: [''],
    shopAddress: ['', Validators.required],
    pincode: ['', Validators.required],
    googleLocation: ['', Validators.required],
    deliveryArea: ['', Validators.required],
    deliveryTime: [''],
    warehouseAddress: [''],
    panCard: ['', Validators.required],
    gstCertificate: [''],
    ownerAadhaar: [''],
    shopAddressProof: ['', Validators.required],
    cancelledCheque: ['', Validators.required],
    shopPhotos: ['', Validators.required],
    accountHolderName: ['', Validators.required],
    accountNumber: ['', Validators.required],
    ifscCode: ['', Validators.required],
    paymentCycle: ['', Validators.required],
    paymentSettlementTerms: [''],
    holdPercentage: ['', nonNegativePercent],
    commission: ['', nonNegativePercent],
    productDeliveryBy: ['', Validators.required],
    assignedB2BManager: ['', Validators.required],
    verificationStatus: ['pending', Validators.required],
    dealerAgreement: [''],
    gstNumber: ['', optionalGstin],
    branch: [''],
    status: [true],
    formStatus: ['draft'],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseAllPendingDocuments());

    this.staffUsers.listStaff().subscribe({
      next: (users) => this.applyStaffOptions(users),
      error: () => this.applyStaffOptions([]),
    });

    this.form
      .get('creatorName')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => this.onCreatorSelected(String(name ?? '')));

    if (this.isEdit) {
      this.loading.set(true);
      this.dealers.getById(this.dealerId).subscribe({
        next: (dealer) => {
          if (this.rbac.isApprovedFormLocked(dealer.formStatus)) {
            this.loading.set(false);
            this.messages.add({
              severity: 'warn',
              summary: 'Dealer locked',
              detail: 'This dealer has been approved and can no longer be edited.',
            });
            void this.router.navigate(['/masters/dealers', this.dealerId]);
            return;
          }
          this.form.patchValue({
            ...dealer,
            categoryDepartments: this.splitCategories(dealer.categoryDepartment),
            status: dealer.status === 'active',
            branch: dealer.branch || dealer.dealerBranch || '',
            paymentSettlementTerms: dealer.paymentSettlementTerms || '',
            commission:
              dealer.commission != null && dealer.commission !== 0
                ? String(dealer.commission)
                : '',
            holdPercentage: dealer.holdPercentage || (dealer.holdDays > 0 ? String(dealer.holdDays) : ''),
          });
          // Ownership is server-authoritative and immutable for non–Super Admin editors.
          this.form.get('creatorType')?.disable({ emitEvent: false });
          this.form.get('creatorName')?.disable({ emitEvent: false });
          this.form.get('creatorId')?.disable({ emitEvent: false });
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Load failed',
            detail: this.extractMessage(err),
          });
        },
      });
    } else {
      this.applyCurrentUserAsCreator();
    }
  }

  private applyStaffOptions(users: StaffUser[]): void {
    const options = users.map((u) => ({
      label: formatStaffLabel(u),
      value: u.name,
      userId: u.id,
      email: u.email ?? '',
    }));
    this.staffOptions.set(this.withCurrentUserStaffOption(options));
    this.defaultAssignedB2BManager();
  }

  private withCurrentUserStaffOption(
    options: { label: string; value: string; userId: string; email: string }[],
  ): { label: string; value: string; userId: string; email: string }[] {
    const user = this.auth.user();
    if (!user) return options;
    if (options.some((option) => option.userId === user.id)) return options;
    const name = user.fullName || user.email || user.mobile || 'Employee';
    return [
      {
        label: formatStaffLabel({ name, email: user.email }),
        value: name,
        userId: user.id,
        email: user.email ?? '',
      },
      ...options,
    ];
  }

  private defaultAssignedB2BManager(): void {
    if (this.isEdit) return;
    const control = this.form.get('assignedB2BManager');
    if (control?.value) return;
    const userId = this.auth.user()?.id;
    const match = this.staffOptions().find((option) => option.userId === userId);
    if (match) {
      control?.setValue(match.value, { emitEvent: false });
    }
  }

  /** Backend overwrites creatorId from the session; UI defaults to the signed-in user. */
  private applyCurrentUserAsCreator(): void {
    const user = this.auth.user();
    if (!user) return;
    const name = user.fullName || user.email || user.mobile || 'Employee';
    this.form.patchValue(
      {
        creatorType: 'Employee',
        creatorName: name,
        creatorId: user.id,
      },
      { emitEvent: false },
    );
    this.form.get('creatorType')?.disable({ emitEvent: false });
    this.form.get('creatorName')?.disable({ emitEvent: false });
    this.form.get('creatorId')?.disable({ emitEvent: false });
  }

  onCreatorSelected(name: string): void {
    const match = this.staffOptions().find((o) => o.value === name);
    this.form.patchValue(
      { creatorId: match?.userId ?? '' },
      { emitEvent: false },
    );
  }

  isInvalid(key: string): boolean {
    const control = this.form.get(key);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  fieldError(key: string): string {
    const control = this.form.get(key);
    if (!control || !this.isInvalid(key)) return '';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('gstin')) return 'Enter a valid 15-character GSTIN.';
    if (control.hasError('percent')) return 'Enter a valid non-negative percentage.';
    if (control.hasError('required')) return 'This field is required.';
    return 'Invalid value.';
  }

  mergedSelectOptions(
    current: unknown,
    options: Array<{ label: string; value: string }>,
  ): Array<{ label: string; value: string }> {
    const value = String(current ?? '').trim();
    if (value && !options.some((opt) => opt.value === value)) {
      return [{ label: value, value }, ...options];
    }
    return options;
  }

  isPendingDocument(field: string): boolean {
    return this.pendingDocuments.has(field);
  }

  hasDocument(field: string): boolean {
    return !!String(this.form.get(field)?.value ?? '').trim();
  }

  onDocumentSelected(event: Event, field: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const invalid = this.validateDocumentFile(file);
    if (invalid) {
      this.messages.add({ severity: 'error', summary: 'Invalid file', detail: invalid });
      return;
    }

    this.releasePendingDocument(field);
    const previewUrl = URL.createObjectURL(file);
    this.pendingDocuments.set(field, file);
    this.pendingPreviewUrls.set(field, previewUrl);
    this.form.patchValue({ [field]: previewUrl });
    this.form.get(field)?.markAsDirty();
    this.cdr.markForCheck();
  }

  saveDraft(): void {
    this.persist('draft');
  }

  preview(): void {
    if (this.isEdit && this.dealerId) {
      this.router.navigate(['/masters/dealers', this.dealerId]);
      return;
    }
    this.persist('draft', { previewAfterSave: true });
  }

  submit(): void {
    this.persist('pending');
  }

  /** Admin approval — sets formStatus approved so backend provisions dealer login. */
  approveAndProvision(): void {
    this.form.markAllAsTouched();
    const missing = this.validateFullForm();
    if (missing.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Incomplete form',
        detail: `Please fill: ${missing.join(', ')}`,
      });
      return;
    }
    this.persist('approved');
  }

  cancel(): void {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
      return;
    }
    if (this.isEdit) {
      this.router.navigate(['/masters/dealers', this.dealerId]);
    } else {
      this.router.navigate(['/masters/dealers']);
    }
  }

  private persist(
    formStatus: 'draft' | 'pending' | 'approved',
    options?: { previewAfterSave?: boolean },
  ): void {
    if (!this.form.get('dealerName')?.value?.trim()) {
      this.form.markAllAsTouched();
      this.messages.add({
        severity: 'warn',
        summary: 'Required fields',
        detail: 'Dealer Name is required.',
      });
      return;
    }

    const formatKeys = ['email', 'gstNumber', 'holdPercentage', 'commission'] as const;
    const formatInvalid = formatKeys.some((key) => this.form.get(key)?.invalid);
    if (formatInvalid) {
      this.form.markAllAsTouched();
      this.messages.add({
        severity: 'warn',
        summary: 'Invalid fields',
        detail: 'Please correct GSTIN, email, or percentage values.',
      });
      return;
    }

    if (formStatus === 'pending' || formStatus === 'approved') {
      this.form.markAllAsTouched();
      const missing = this.validateFullForm();
      if (missing.length) {
        this.messages.add({
          severity: 'warn',
          summary: 'Incomplete form',
          detail: `Please fill: ${missing.join(', ')}`,
        });
        return;
      }
    }

    const raw = this.form.getRawValue();
    const dealerName = String(raw.dealerName).trim();
    const dealerCode = String(raw.dealerCode ?? '').trim();
    const categoryDepartment = this.joinCategories(raw.categoryDepartments);
    const payload: DealerPayload = this.toPayload(raw, {
      dealerName,
      dealerCode,
      categoryDepartment,
      formStatus,
    });

    this.submitting.set(true);
    this.flushPendingDocuments()
      .pipe(
        switchMap((uploadedUrls) => {
          for (const [field, url] of Object.entries(uploadedUrls)) {
            this.releasePendingDocument(field);
            this.form.patchValue({ [field]: url }, { emitEvent: false });
          }

          const latest = this.form.getRawValue();
          const latestPayload: DealerPayload = {
            ...payload,
            ...this.toPayload(latest, {
              dealerName,
              dealerCode,
              categoryDepartment,
              formStatus,
            }),
            ...uploadedUrls,
          };

          return this.isEdit
            ? this.dealers.update(this.dealerId, latestPayload)
            : this.dealers.create(latestPayload);
        }),
      )
      .subscribe({
        next: (saved) => {
          this.submitting.set(false);
          this.messages.add({
            severity: 'success',
            summary:
              formStatus === 'draft'
                ? 'Draft saved'
                : formStatus === 'approved'
                  ? 'Dealer approved'
                  : 'Dealer submitted for approval',
            detail:
              formStatus === 'approved'
                ? saved.userId
                  ? 'Dealer login account is ready (welcome@123).'
                  : 'Dealer approved.'
                : undefined,
          });
          if (options?.previewAfterSave || formStatus === 'approved') {
            this.router.navigate(['/masters/dealers', saved.id]);
            return;
          }
          if (this.returnTo) {
            this.router.navigateByUrl(this.returnTo, {
              state: { selectedDealerId: saved.id, selectedDealerName: saved.dealerName },
            });
          } else {
            this.router.navigate(['/masters/dealers', saved.id]);
          }
        },
        error: (err) => {
          this.submitting.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Save failed',
            detail: this.extractMessage(err),
          });
        },
      });
  }

  private flushPendingDocuments() {
    const entries = [...this.pendingDocuments.entries()];
    if (!entries.length) return of({} as Record<string, string>);

    return forkJoin(
      entries.map(([field, file]) =>
        this.products.uploadImage(file).pipe(map((uploaded) => ({ field, url: uploaded.url }))),
      ),
    ).pipe(
      map((results) => {
        const uploadedUrls: Record<string, string> = {};
        for (const { field, url } of results) {
          if (url) uploadedUrls[field] = url;
        }
        return uploadedUrls;
      }),
    );
  }

  private validateDocumentFile(file: File): string | null {
    const typeOk =
      DEALER_DOCUMENT_TYPES.includes(file.type as (typeof DEALER_DOCUMENT_TYPES)[number]) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!typeOk) return 'Use a JPG, PNG, WEBP, or GIF file.';
    if (file.size > DEALER_DOCUMENT_MAX_BYTES) return 'File must be 5MB or smaller.';
    return null;
  }

  private releasePendingDocument(field: string): void {
    const previewUrl = this.pendingPreviewUrls.get(field);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this.pendingDocuments.delete(field);
    this.pendingPreviewUrls.delete(field);
  }

  private releaseAllPendingDocuments(): void {
    for (const field of DEALER_DOCUMENT_FIELDS) {
      this.releasePendingDocument(field);
    }
  }

  private validateFullForm(): string[] {
    const missing: string[] = [];
    for (const { key, label, array } of SUBMIT_REQUIRED_FIELDS) {
      const control = this.form.get(key);
      if (array) {
        if (!Array.isArray(control?.value) || control.value.length === 0) missing.push(label);
        continue;
      }
      if (!String(control?.value ?? '').trim()) missing.push(label);
    }
    return missing;
  }

  private splitCategories(value: string): string[] {
    return String(value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private joinCategories(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value.map((part) => String(part).trim()).filter(Boolean).join(', ');
  }

  private toPayload(
    raw: Record<string, unknown>,
    extras: {
      dealerName: string;
      dealerCode: string;
      categoryDepartment: string;
      formStatus: 'draft' | 'pending' | 'approved';
    },
  ): DealerPayload {
    const branch = String(raw['branch'] ?? '').trim();
    const paymentCycle = String(raw['paymentCycle'] ?? '').trim();
    const paymentSettlementTerms = String(raw['paymentSettlementTerms'] ?? '').trim();
    const holdPercentage = String(raw['holdPercentage'] ?? '').trim();
    const commissionRaw = String(raw['commission'] ?? '').trim();
    const { categoryDepartments: _categories, commission: _commissionInput, ...rest } = raw;
    const verificationFromForm =
      (raw['verificationStatus'] as DealerPayload['verificationStatus']) || 'pending';
    return {
      ...emptyDealer(),
      ...(rest as Partial<DealerPayload>),
      name: extras.dealerName,
      dealerName: extras.dealerName,
      dealerCode: extras.dealerCode,
      categoryDepartment: extras.categoryDepartment,
      status: raw['status'] ? 'active' : 'inactive',
      formStatus: extras.formStatus,
      // Approve button must also mark verification approved so provisioning runs.
      verificationStatus:
        extras.formStatus === 'approved' ? 'approved' : verificationFromForm,
      dealer_address: String(raw['shopAddress'] ?? ''),
      dealerMobile: String(raw['mobile'] ?? ''),
      branch,
      dealerBranch: branch,
      paymentCycle,
      paymentSchedule: paymentCycle,
      paymentSettlementTerms,
      holdPercentage,
      holdDays: Number(holdPercentage) || 0,
      commission: commissionRaw ? Number(commissionRaw) || 0 : 0,
      gstNumber: String(raw['gstNumber'] ?? '').trim().toUpperCase(),
      warehouseAddress: String(raw['warehouseAddress'] ?? '').trim(),
    };
  }

  private generateDealerCode(dealerName: string): string {
    const slug = dealerName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    return `DLR-${slug || 'NEW'}-${suffix}`;
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}

function formatStaffLabel(user: { name: string; email?: string; role?: string }): string {
  const name = user.name?.trim();
  const email = user.email?.trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`;
  }
  return name || email || 'Unknown';
}

function requiredNonEmptyArray(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return Array.isArray(value) && value.length > 0 ? null : { required: true };
}

function optionalEmail(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return Validators.email(control);
}

function optionalGstin(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return /^[0-9A-Z]{15}$/i.test(value) ? null : { gstin: true };
}

function nonNegativePercent(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? null : { percent: true };
}
