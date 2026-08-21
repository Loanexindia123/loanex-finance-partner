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
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { forkJoin, map, of } from 'rxjs';
import { apiUrl } from '../../../../core/config/api.config';
import { ApiEnvelope } from '../../../../core/models/api.models';
import { unwrapApi } from '../../../../core/rxjs/unwrap-api';
import { AuthService } from '../../../../core/services/auth.service';
import { RbacService } from '../../../../core/services/rbac.service';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { StaffUserService } from '../../../masters/services/staff-user.service';
import { ProductService } from '../../../products/services/product.service';
import { BranchService } from '../../../settings/services/branch.service';
import {
  ACCOUNT_NUMBER_PATTERN,
  APPROVE_REQUIRED_FIELDS,
  DOCUMENT_FIELDS,
  EMPLOYMENT_TYPE_OPTIONS,
  FALLBACK_DEPARTMENTS,
  FALLBACK_DESIGNATIONS,
  GENDER_OPTIONS,
  IFSC_PATTERN,
  MARITAL_STATUS_OPTIONS,
  MOBILE_PATTERN,
  NOTICE_PERIOD_OPTIONS,
  ONBOARDING_STEPS,
  PAYMENT_MODE_OPTIONS,
  PROBATION_OPTIONS,
  SHIFT_OPTIONS,
  STEP_REQUIRED_FIELDS,
  VERIFICATION_STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  EmployeeFormStatus,
  EmployeePayload,
  emptyEmployee,
  generateEmployeeId,
  todayIsoDate,
} from '../../models/employee.models';
import { EmployeeService, EmployeeOnboarder } from '../../services/employee.service';
import {
  calculateSalaryTotals,
  suggestBasicFromCtc,
  suggestHraFromBasic,
} from '../../utils/salary-calculations';

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;

@Component({
  selector: 'app-employee-onboard',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    ButtonModule,
    ToggleSwitchModule,
    BrandedLoader,
  ],
  templateUrl: './employee-onboard.html',
  styleUrl: './employee-onboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeOnboard {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employees = inject(EmployeeService);
  private readonly staffUsers = inject(StaffUserService);
  private readonly branchesApi = inject(BranchService);
  private readonly products = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pendingDocuments = new Map<string, File>();
  private readonly pendingPreviewUrls = new Map<string, string>();

  readonly steps = ONBOARDING_STEPS;
  readonly documentFields = DOCUMENT_FIELDS;
  readonly verificationOptions = VERIFICATION_STATUS_OPTIONS;
  readonly genderOptions = toSelect(GENDER_OPTIONS);
  readonly maritalOptions = toSelect(MARITAL_STATUS_OPTIONS);
  readonly employmentTypeOptions = toSelect(EMPLOYMENT_TYPE_OPTIONS);
  readonly workModeOptions = toSelect(WORK_MODE_OPTIONS);
  readonly shiftOptions = toSelect(SHIFT_OPTIONS);
  readonly probationOptions = toSelect(PROBATION_OPTIONS);
  readonly noticeOptions = toSelect(NOTICE_PERIOD_OPTIONS);
  readonly paymentModeOptions = toSelect(PAYMENT_MODE_OPTIONS);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly submittingKind = signal<'draft' | 'approved' | null>(null);
  readonly activeStep = signal(0);
  /** Onboarded By — Employee Master, hierarchy-scoped (not /admin/users). */
  readonly onboarderOptions = signal<OnboarderOption[]>([]);
  /** Reporting Person — separate relationship; admin staff only. */
  readonly staffOptions = signal<StaffOption[]>([]);
  readonly branchOptions = signal<{ label: string; value: string; id: string }[]>([]);
  readonly departmentOptions = signal<{ label: string; value: string }[]>(toSelect(FALLBACK_DEPARTMENTS));
  readonly designationOptions = signal<{ label: string; value: string }[]>(
    toSelect(FALLBACK_DESIGNATIONS),
  );

  readonly employeeId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isEdit = !!this.employeeId;
  readonly currentStep = computed(() => this.steps[this.activeStep()] ?? this.steps[0]);

  readonly form = this.fb.group({
    onboardedBy: [''],
    onboardedById: [''],
    employeeId: [{ value: generateEmployeeId(), disabled: true }],
    onboardingDate: [todayIsoDate()],
    fullName: ['', Validators.required],
    fatherHusbandName: [''],
    dateOfBirth: ['', Validators.required],
    mobile: ['', [Validators.required, Validators.pattern(MOBILE_PATTERN)]],
    whatsapp: ['', optionalMobile],
    email: ['', optionalEmail],
    gender: [''],
    maritalStatus: [''],
    emergencyContact: [''],
    department: ['', Validators.required],
    designation: ['', Validators.required],
    employmentType: ['', Validators.required],
    dateOfJoining: ['', Validators.required],
    branch: ['', Validators.required],
    branchId: [''],
    workMode: ['', Validators.required],
    reportingPerson: ['', Validators.required],
    reportingPersonId: [''],
    reportingPersonPost: [{ value: '', disabled: true }],
    shift: ['', Validators.required],
    probationPeriod: [''],
    noticePeriod: [''],
    monthlyCtc: ['', Validators.required],
    basicSalary: ['', Validators.required],
    hra: [''],
    conveyanceAllowance: [''],
    specialAllowance: [''],
    otherAllowance: [''],
    fixedGrossSalary: [{ value: '', disabled: true }],
    variableIncentive: [''],
    totalMonthlyCtc: [{ value: '', disabled: true }],
    pfApplicable: [false],
    esiApplicable: [false],
    otherDeduction: [''],
    netTakeHome: [{ value: '', disabled: true }],
    salaryEffectiveFrom: ['', Validators.required],
    paymentMode: [''],
    profilePhoto: ['', Validators.required],
    aadhaarCard: ['', Validators.required],
    panCard: ['', Validators.required],
    addressProof: ['', Validators.required],
    educationDocuments: [''],
    experienceLetter: [''],
    cancelledCheque: ['', Validators.required],
    signature: ['', Validators.required],
    appointmentLetter: [''],
    accountHolderName: ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.pattern(ACCOUNT_NUMBER_PATTERN)]],
    ifscCode: ['', [Validators.required, ifscValidator]],
    uanNumber: [''],
    esicNumber: [''],
    verificationStatus: ['pending', Validators.required],
    status: ['active'],
    formStatus: ['draft'],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseAllPendingDocuments());
    this.applyCurrentUserDefaults();
    this.bindLookups();
    this.bindSalary();
    this.bindIfsc();
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    if (this.isEdit) this.loadExisting();
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    this.activeStep.set(index);
  }

  next(): void {
    if (!this.validateCurrentStep()) return;
    this.activeStep.update((i) => Math.min(i + 1, this.steps.length - 1));
  }

  back(): void {
    this.activeStep.update((i) => Math.max(i - 1, 0));
  }

  backToList(): void {
    this.router.navigate(['/employees']);
  }

  isStepComplete(index: number): boolean {
    const keys = STEP_REQUIRED_FIELDS[index] ?? [];
    if (!keys.length) return false;
    return keys.every((key) => String(this.form.get(key)?.getRawValue() ?? '').trim());
  }

  isInvalid(key: string): boolean {
    const control = this.form.get(key);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  fieldError(key: string): string {
    const control = this.form.get(key);
    if (!control || !this.isInvalid(key)) return '';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('pattern') && key === 'mobile') return 'Enter a valid 10-digit mobile number.';
    if (control.hasError('pattern') && key === 'whatsapp') return 'Enter a valid 10-digit WhatsApp number.';
    if (control.hasError('pattern') && key === 'accountNumber') return 'Account number must be 8–18 digits.';
    if (control.hasError('ifsc')) return 'Enter a valid IFSC code (e.g. SBIN0001234).';
    if (control.hasError('required')) return 'This field is required.';
    return 'Invalid value.';
  }

  display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  inr(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(String(value).replace(/,/g, ''));
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
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

  documentLabel(field: string): string {
    if (this.isPendingDocument(field)) return this.pendingDocuments.get(field)?.name ?? 'Selected file';
    const value = String(this.form.get(field)?.value ?? '').trim();
    if (!value) return '';
    try {
      const path = decodeURIComponent(value.split('?')[0] ?? value);
      return path.split('/').pop() || 'Uploaded';
    } catch {
      return 'Uploaded';
    }
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

  previewProfile(): void {
    if (this.employeeId && !this.form.dirty && !this.pendingDocuments.size) {
      this.router.navigate(['/employees', this.employeeId]);
      return;
    }
    this.persist('draft', { previewAfterSave: true });
  }

  approveAndOnboard(): void {
    const missing = this.validateFullForm();
    if (missing.length) {
      this.markApproveTouched();
      this.messages.add({
        severity: 'error',
        summary: 'Complete required fields',
        detail: missing.slice(0, 6).join(', ') + (missing.length > 6 ? '…' : ''),
      });
      const first = APPROVE_REQUIRED_FIELDS.find((item) => missing.includes(item.label));
      if (first) this.goToStep(this.stepIndexForField(first.key));
      return;
    }
    this.persist('approved');
  }

  private applyCurrentUserDefaults(): void {
    if (this.isEdit) return;
    // Prefer Employee Master onboarder once loaded; fall back to session user.
    const current = this.onboarderOptions().find((o) => o.isCurrentUser);
    if (current) {
      this.form.patchValue(
        { onboardedBy: current.name, onboardedById: current.id },
        { emitEvent: false },
      );
      return;
    }
    const user = this.auth.user();
    if (!user) return;
    const name = user.fullName || user.email || user.mobile || '';
    if (!name) return;
    this.form.patchValue({ onboardedBy: name, onboardedById: user.id }, { emitEvent: false });
  }

  private bindLookups(): void {
    this.employees.listOnboarders().subscribe({
      next: (rows) => {
        const options = rows.map((u) => toOnboarderOption(u));
        this.onboarderOptions.set(options);
        if (!this.isEdit) {
          const current = options.find((o) => o.isCurrentUser) ?? options[0];
          if (current) {
            this.form.patchValue(
              { onboardedBy: current.name, onboardedById: current.id },
              { emitEvent: false },
            );
          }
        } else {
          this.ensureOnboarderOptionPresent();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Session fallback already applied in applyCurrentUserDefaults.
      },
    });

    this.staffUsers.listStaff().subscribe({
      next: (users) => {
        this.staffOptions.set(
          users.map((u) => ({
            label: formatStaffLabel(u),
            value: u.name,
            userId: u.id,
            code: u.code,
            role: u.role ?? '',
            email: u.email ?? '',
          })),
        );
      },
      error: () => void 0,
    });

    this.branchesApi.list().subscribe({
      next: (branches) =>
        this.branchOptions.set(
          branches
            .filter((b) => b.status !== 'inactive')
            .map((b) => ({
              label: [b.name, b.city].filter(Boolean).join(' · '),
              value: b.name,
              id: b.id,
            })),
        ),
      error: () => void 0,
    });

    this.http.get<ApiEnvelope<unknown>>(apiUrl('/jobs')).pipe(unwrapApi()).subscribe({
      next: (raw) => {
        const rows = Array.isArray(raw) ? raw : [];
        const fromJobs = rows
          .map((row) => {
            const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
            return String(rec['department'] ?? '').trim();
          })
          .filter(Boolean);
        const merged = [...new Set([...fromJobs, ...FALLBACK_DEPARTMENTS])];
        this.departmentOptions.set(merged.map((name) => ({ label: name, value: name })));
      },
      error: () => void 0,
    });

    this.form
      .get('onboardedById')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (this.isEdit) return;
        const match = this.onboarderOptions().find((o) => o.id === id);
        if (match) {
          this.form.patchValue({ onboardedBy: match.name }, { emitEvent: false });
        }
      });

    this.form
      .get('reportingPerson')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        const match = this.staffOptions().find((o) => o.value === name);
        this.form.patchValue(
          {
            reportingPersonId: match?.code || match?.userId || '',
            reportingPersonPost: match?.role || '',
          },
          { emitEvent: false },
        );
      });

    this.form
      .get('branch')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        const match = this.branchOptions().find((o) => o.value === name);
        this.form.patchValue({ branchId: match?.id ?? '' }, { emitEvent: false });
      });
  }

  /** Keep the original creator visible in the picker while editing. */
  private ensureOnboarderOptionPresent(): void {
    const id = String(this.form.get('onboardedById')?.value ?? '').trim();
    const name = String(this.form.get('onboardedBy')?.value ?? '').trim();
    if (!id) return;
    if (this.onboarderOptions().some((o) => o.id === id)) return;
    this.onboarderOptions.update((opts) => [
      {
        label: name || id,
        value: id,
        id,
        name: name || id,
        email: '',
        isCurrentUser: false,
      },
      ...opts,
    ]);
  }

  private bindSalary(): void {
    const keys = [
      'monthlyCtc',
      'basicSalary',
      'hra',
      'conveyanceAllowance',
      'specialAllowance',
      'otherAllowance',
      'variableIncentive',
      'otherDeduction',
    ] as const;
    for (const key of keys) {
      this.form
        .get(key)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.recalculateSalary(key));
    }
  }

  private recalculateSalary(changed?: string): void {
    const raw = this.form.getRawValue();
    if (changed === 'monthlyCtc' && !String(raw.basicSalary ?? '').trim()) {
      const suggested = suggestBasicFromCtc(raw.monthlyCtc);
      if (suggested) this.form.patchValue({ basicSalary: suggested }, { emitEvent: false });
    }
    const basic = this.form.getRawValue().basicSalary;
    if ((changed === 'monthlyCtc' || changed === 'basicSalary') && !String(raw.hra ?? '').trim()) {
      const suggestedHra = suggestHraFromBasic(basic);
      if (suggestedHra) this.form.patchValue({ hra: suggestedHra }, { emitEvent: false });
    }
    this.form.patchValue(calculateSalaryTotals(this.form.getRawValue()), { emitEvent: false });
    this.cdr.markForCheck();
  }

  private bindIfsc(): void {
    this.form
      .get('ifscCode')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const next = String(value ?? '')
          .toUpperCase()
          .replace(/\s+/g, '');
        if (next !== value) this.form.patchValue({ ifscCode: next }, { emitEvent: false });
      });
  }

  private loadExisting(): void {
    this.loading.set(true);
    this.employees.getById(this.employeeId).subscribe({
      next: (employee) => {
        if (this.rbac.isApprovedFormLocked(employee.formStatus)) {
          this.loading.set(false);
          this.messages.add({
            severity: 'warn',
            summary: 'Employee locked',
            detail: 'This employee has been approved and can no longer be edited.',
          });
          void this.router.navigate(['/employees', this.employeeId]);
          return;
        }
        this.form.patchValue({
          ...employee,
          employeeId: employee.employeeId || generateEmployeeId(),
          onboardingDate: employee.onboardingDate || todayIsoDate(),
        });
        // Original creator is immutable in the UI during edit/approval.
        this.form.get('onboardedBy')?.disable({ emitEvent: false });
        this.form.get('onboardedById')?.disable({ emitEvent: false });
        this.ensureOnboarderOptionPresent();
        this.recalculateSalary();
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
  }

  private validateCurrentStep(): boolean {
    const keys = STEP_REQUIRED_FIELDS[this.activeStep()] ?? [];
    if (!keys.length) return true;
    let valid = true;
    for (const key of keys) {
      const control = this.form.get(key);
      control?.markAsTouched();
      control?.updateValueAndValidity({ emitEvent: false });
      if (control?.invalid) valid = false;
    }
    this.cdr.markForCheck();
    if (!valid) {
      this.messages.add({
        severity: 'warn',
        summary: 'Required information',
        detail: 'Complete the required fields on this step, or Save Draft to continue later.',
      });
    }
    return valid;
  }

  private validateFullForm(): string[] {
    const missing: string[] = [];
    for (const { key, label } of APPROVE_REQUIRED_FIELDS) {
      const value = this.form.get(key)?.getRawValue();
      if (!String(value ?? '').trim()) missing.push(label);
    }
    if (this.form.get('ifscCode')?.invalid) missing.push('Valid IFSC Code');
    if (this.form.get('accountNumber')?.invalid) missing.push('Valid Account Number');
    return [...new Set(missing)];
  }

  private markApproveTouched(): void {
    for (const { key } of APPROVE_REQUIRED_FIELDS) this.form.get(key)?.markAsTouched();
  }

  private stepIndexForField(key: string): number {
    const index = STEP_REQUIRED_FIELDS.findIndex((keys) => keys.includes(key));
    return index >= 0 ? index : 0;
  }

  private persist(formStatus: EmployeeFormStatus, options?: { previewAfterSave?: boolean }): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submittingKind.set(formStatus === 'approved' ? 'approved' : 'draft');
    const payload = this.toPayload(formStatus);

    this.flushPendingDocuments().subscribe({
      next: (uploadedUrls) => {
        const body = { ...payload, ...uploadedUrls };
        for (const [field, url] of Object.entries(uploadedUrls)) {
          if (url) this.form.patchValue({ [field]: url }, { emitEvent: false });
        }
        const request = this.isEdit
          ? this.employees.update(this.employeeId, body)
          : this.employees.create(body);
        request.subscribe({
          next: (saved) => {
            this.submitting.set(false);
            this.submittingKind.set(null);
            this.form.markAsPristine();
            this.messages.add({
              severity: 'success',
              summary: formStatus === 'approved' ? 'Employee onboarded' : 'Draft saved',
              detail:
                formStatus === 'approved'
                  ? `${saved.fullName || saved.employeeId} can sign in with Employee ID, email, or mobile.`
                  : 'You can continue this onboarding later.',
            });
            if (options?.previewAfterSave || formStatus === 'approved') {
              this.router.navigate(['/employees', saved.id]);
              return;
            }
            if (!this.isEdit) {
              this.router.navigate(['/employees', saved.id, 'edit'], { replaceUrl: true });
            }
          },
          error: (err) => this.failSave(err),
        });
      },
      error: (err) => this.failSave(err),
    });
  }

  private failSave(err: unknown): void {
    this.submitting.set(false);
    this.submittingKind.set(null);
    this.messages.add({
      severity: 'error',
      summary: 'Save failed',
      detail: this.extractMessage(err),
    });
  }

  private toPayload(formStatus: EmployeeFormStatus): EmployeePayload {
    const raw = this.form.getRawValue();
    const cleaned = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, value == null ? '' : value]),
    ) as Record<string, unknown>;
    return {
      ...emptyEmployee(),
      ...(cleaned as EmployeePayload),
      employeeId: String(cleaned['employeeId'] ?? '').trim() || generateEmployeeId(),
      onboardingDate: String(cleaned['onboardingDate'] ?? '').trim() || todayIsoDate(),
      ifscCode: String(cleaned['ifscCode'] ?? '')
        .trim()
        .toUpperCase(),
      pfApplicable: !!cleaned['pfApplicable'],
      esiApplicable: !!cleaned['esiApplicable'],
      ...calculateSalaryTotals(cleaned),
      formStatus,
      status: formStatus === 'approved' ? 'active' : cleaned['status'] === 'inactive' ? 'inactive' : 'active',
      verificationStatus:
        (cleaned['verificationStatus'] as EmployeePayload['verificationStatus']) || 'pending',
    };
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
      DOCUMENT_TYPES.includes(file.type as (typeof DOCUMENT_TYPES)[number]) ||
      /\.(jpe?g|png|webp|gif|pdf)$/i.test(file.name);
    if (!typeOk) return 'Use a JPG, PNG, WEBP, GIF, or PDF file.';
    if (file.size > DOCUMENT_MAX_BYTES) return 'File must be 5MB or smaller.';
    return null;
  }

  private releasePendingDocument(field: string): void {
    const previewUrl = this.pendingPreviewUrls.get(field);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    this.pendingDocuments.delete(field);
    this.pendingPreviewUrls.delete(field);
  }

  private releaseAllPendingDocuments(): void {
    for (const field of DOCUMENT_FIELDS) this.releasePendingDocument(field.key);
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}

interface OnboarderOption {
  label: string;
  /** Bound to onboardedById (stable employee/user id). */
  value: string;
  id: string;
  name: string;
  email: string;
  isCurrentUser: boolean;
}

interface StaffOption {
  label: string;
  value: string;
  userId: string;
  code: string;
  role: string;
  email: string;
}

function toOnboarderOption(user: EmployeeOnboarder): OnboarderOption {
  const extra = [user.designation, user.employeeId, user.email].filter(Boolean).join(' · ');
  const label =
    user.name && extra && !extra.toLowerCase().includes(user.name.toLowerCase())
      ? `${user.name} (${extra})`
      : user.name || user.email || user.id;
  return {
    label,
    value: user.id,
    id: user.id,
    name: user.name || label,
    email: user.email ?? '',
    isCurrentUser: !!user.isCurrentUser,
  };
}

function toSelect(values: readonly string[]): { label: string; value: string }[] {
  return values.map((value) => ({ label: value, value }));
}

function formatStaffLabel(user: { name: string; email?: string; role?: string }): string {
  const name = user.name?.trim();
  const extra = user.role || user.email;
  if (name && extra && extra.toLowerCase() !== name.toLowerCase()) return `${name} (${extra})`;
  return name || user.email || 'Unknown';
}

function optionalEmail(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return Validators.email(control);
}

function optionalMobile(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return MOBILE_PATTERN.test(value) ? null : { pattern: true };
}

function ifscValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!value) return Validators.required(control);
  return IFSC_PATTERN.test(value) ? null : { ifsc: true };
}
