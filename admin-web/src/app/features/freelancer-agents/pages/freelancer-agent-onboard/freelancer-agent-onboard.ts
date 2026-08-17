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
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin, map, of } from 'rxjs';
import { apiUrl } from '../../../../core/config/api.config';
import { ApiEnvelope } from '../../../../core/models/api.models';
import { unwrapApi } from '../../../../core/rxjs/unwrap-api';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { StaffUserService } from '../../../masters/services/staff-user.service';
import { ProductService } from '../../../products/services/product.service';
import { BranchService } from '../../../settings/services/branch.service';
import {
  ACCOUNT_NUMBER_PATTERN,
  AADHAAR_PATTERN,
  AGENT_ID_PLACEHOLDER,
  AGENT_TYPE_OPTIONS,
  ALLOWED_WORK_OPTIONS,
  CREATOR_TYPE_OPTIONS,
  DOCUMENT_FIELDS,
  EDUCATION_OPTIONS,
  FALLBACK_DEPARTMENTS,
  GENDER_OPTIONS,
  IFSC_PATTERN,
  MOBILE_PATTERN,
  OCCUPATION_OPTIONS,
  ONBOARDING_STEPS,
  PAN_PATTERN,
  PAYOUT_BASIS,
  PINCODE_PATTERN,
  POLICY_VERSION,
  STEP_REQUIRED_FIELDS,
  SUBMIT_REQUIRED_FIELDS,
  TRAINING_STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  FreelancerAgentPayload,
  FreelancerCreatorType,
  FreelancerFormStatus,
  displayAgentId,
  emptyFreelancerAgent,
} from '../../models/freelancer-agent.models';
import {
  FreelancerAgentService,
  FreelancerCreatorOption,
} from '../../services/freelancer-agent.service';

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;
const BASE_PATH = '/employees/freelancer-onboarding';

@Component({
  selector: 'app-freelancer-agent-onboard',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    ButtonModule,
    DialogModule,
    BrandedLoader,
  ],
  templateUrl: './freelancer-agent-onboard.html',
  styleUrl: './freelancer-agent-onboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreelancerAgentOnboard {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agents = inject(FreelancerAgentService);
  private readonly staffUsers = inject(StaffUserService);
  private readonly branchesApi = inject(BranchService);
  private readonly products = inject(ProductService);
  private readonly http = inject(HttpClient);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pendingDocuments = new Map<string, File>();
  private readonly pendingPreviewUrls = new Map<string, string>();

  readonly steps = ONBOARDING_STEPS;
  readonly documentFields = DOCUMENT_FIELDS;
  readonly creatorTypeOptions = toSelect(CREATOR_TYPE_OPTIONS);
  readonly genderOptions = toSelect(GENDER_OPTIONS);
  readonly educationOptions = toSelect(EDUCATION_OPTIONS);
  readonly occupationOptions = toSelect(OCCUPATION_OPTIONS);
  readonly workModeOptions = toSelect(WORK_MODE_OPTIONS);
  readonly agentTypeOptions = toSelect(AGENT_TYPE_OPTIONS);
  readonly trainingOptions = toSelect(TRAINING_STATUS_OPTIONS);
  readonly allowedWorkOptions = toSelect(ALLOWED_WORK_OPTIONS);
  readonly agentIdPlaceholder = AGENT_ID_PLACEHOLDER;

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly submittingKind = signal<'draft' | 'submit' | null>(null);
  readonly activeStep = signal(0);
  readonly previewOpen = signal(false);
  readonly creatorOptions = signal<CreatorOption[]>([]);
  readonly staffOptions = signal<StaffOption[]>([]);
  readonly branchOptions = signal<{ label: string; value: string; id: string }[]>([]);
  readonly departmentOptions = signal<{ label: string; value: string }[]>(toSelect(FALLBACK_DEPARTMENTS));
  readonly savedAgentId = signal('');
  readonly savedFormStatus = signal<FreelancerFormStatus>('draft');
  readonly savedIssued = signal(false);

  readonly recordId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly isEdit = !!this.recordId;
  readonly currentStep = computed(() => this.steps[this.activeStep()] ?? this.steps[0]);
  readonly creatorSearchEnabled = computed(() => this.form.get('creatorType')?.value !== 'Direct');
  readonly agentIdLabel = computed(() =>
    displayAgentId({
      agentId: this.savedAgentId(),
      agentIdIssued: this.savedIssued(),
      formStatus: this.savedFormStatus(),
    }),
  );

  readonly form = this.fb.group({
    creatorType: ['', Validators.required],
    creatorId: [''],
    creatorName: [''],
    fullName: ['', Validators.required],
    fatherHusbandName: [''],
    dateOfBirth: ['', Validators.required],
    mobile: ['', [Validators.required, Validators.pattern(MOBILE_PATTERN)]],
    whatsapp: ['', optionalMobile],
    email: ['', optionalEmail],
    gender: [''],
    education: [''],
    occupation: [''],
    currentAddress: ['', Validators.required],
    pincode: ['', [Validators.required, Validators.pattern(PINCODE_PATTERN)]],
    googleLocation: [''],
    preferredWorkArea: ['', Validators.required],
    workMode: ['', Validators.required],
    emergencyContactName: [''],
    emergencyContactMobile: ['', optionalMobile],
    profilePhoto: ['', Validators.required],
    aadhaarFront: ['', Validators.required],
    aadhaarBack: ['', Validators.required],
    aadhaarNumber: ['', optionalAadhaar],
    panCard: ['', Validators.required],
    panNumber: ['', optionalPan],
    addressProof: [''],
    cancelledCheque: ['', Validators.required],
    signature: ['', Validators.required],
    agentType: ['', Validators.required],
    preferredDepartments: [[] as string[], Validators.required],
    allowedWork: [[] as string[], Validators.required],
    assignedManager: [''],
    assignedManagerId: ['', Validators.required],
    branch: [''],
    branchId: [''],
    trainingStatus: ['Pending'],
    accountNumber: ['', [Validators.required, Validators.pattern(ACCOUNT_NUMBER_PATTERN)]],
    confirmAccountNumber: ['', [Validators.required, accountMatchValidator]],
    ifscCode: ['', [Validators.required, ifscValidator]],
    policyAccepted: [false, Validators.requiredTrue],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseAllPendingDocuments());
    this.bindLookups();
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
    this.router.navigate([BASE_PATH]);
  }

  isStepComplete(index: number): boolean {
    const keys = STEP_REQUIRED_FIELDS[index] ?? [];
    if (!keys.length) return false;
    return keys.every((key) => {
      const value = this.form.get(key)?.getRawValue();
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'boolean') return value === true;
      return String(value ?? '').trim().length > 0;
    });
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
    if (control.hasError('pattern') && (key === 'whatsapp' || key === 'emergencyContactMobile')) {
      return 'Enter a valid 10-digit mobile number.';
    }
    if (control.hasError('pattern') && key === 'pincode') return 'Enter a valid 6-digit Indian pincode.';
    if (control.hasError('pattern') && key === 'accountNumber') return 'Account number must be 8–18 digits.';
    if (control.hasError('accountMatch')) return 'Account number and confirmation must match.';
    if (control.hasError('ifsc')) return 'Enter a valid IFSC code (e.g. SBIN0001234).';
    if (control.hasError('pan')) return 'Enter a valid PAN (e.g. ABCDE1234F).';
    if (control.hasError('aadhaar')) return 'Enter a valid 12-digit Aadhaar number.';
    if (control.hasError('required') || control.hasError('requiredTrue')) return 'This field is required.';
    return 'Invalid value.';
  }

  display(value: unknown): string {
    if (value === null || value === undefined || value === '' || value === false) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    return String(value);
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

  copyMobileToWhatsapp(): void {
    const mobile = String(this.form.get('mobile')?.value ?? '').trim();
    this.form.patchValue({ whatsapp: mobile });
    this.form.get('whatsapp')?.markAsTouched();
  }

  saveDraft(): void {
    this.persist('draft');
  }

  openPreview(): void {
    this.previewOpen.set(true);
  }

  closePreview(): void {
    this.previewOpen.set(false);
  }

  submitForApproval(): void {
    const missing = this.validateFullForm();
    if (missing.length) {
      this.markSubmitTouched();
      this.messages.add({
        severity: 'error',
        summary: 'Complete required fields',
        detail: missing.slice(0, 6).join(', ') + (missing.length > 6 ? '…' : ''),
      });
      const first = SUBMIT_REQUIRED_FIELDS.find((item) => missing.includes(item.label));
      if (first) this.goToStep(this.stepIndexForField(first.key));
      return;
    }
    this.confirmation.confirm({
      header: 'Submit for approval?',
      message:
        'This profile will be sent for approval. No Agent / Growing Partner ID is generated until an authorized approver accepts it.',
      acceptLabel: 'Submit',
      rejectLabel: 'Cancel',
      accept: () => this.persist('pending_approval'),
    });
  }

  private bindLookups(): void {
    this.staffUsers.listStaff().subscribe({
      next: (users) => {
        this.staffOptions.set(
          users.map((u) => ({
            label: formatStaffLabel(u),
            value: u.id,
            name: u.name,
            userId: u.id,
            code: u.code,
            role: u.role ?? '',
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
      .get('creatorType')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => {
        const creatorType = String(type ?? '') as FreelancerCreatorType;
        if (creatorType === 'Direct') {
          this.form.patchValue({ creatorId: '', creatorName: '' }, { emitEvent: false });
          this.form.get('creatorId')?.disable({ emitEvent: false });
          this.creatorOptions.set([]);
          return;
        }
        this.form.get('creatorId')?.enable({ emitEvent: false });
        if (creatorType === 'Employee' || creatorType === 'Existing Agent') {
          this.loadCreators(creatorType);
        }
      });

    this.form
      .get('creatorId')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        const match = this.creatorOptions().find((o) => o.id === id);
        if (match) {
          this.form.patchValue({ creatorName: match.name }, { emitEvent: false });
        }
      });

    this.form
      .get('assignedManagerId')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        const match = this.staffOptions().find((o) => o.value === id);
        this.form.patchValue({ assignedManager: match?.name || '' }, { emitEvent: false });
      });

    this.form
      .get('branch')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        const match = this.branchOptions().find((o) => o.value === name);
        this.form.patchValue({ branchId: match?.id ?? '' }, { emitEvent: false });
      });

    this.form
      .get('accountNumber')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.get('confirmAccountNumber')?.updateValueAndValidity({ emitEvent: false }));
  }

  private loadCreators(type: FreelancerCreatorType): void {
    this.agents.listCreators(type).subscribe({
      next: (rows) => {
        this.creatorOptions.set(rows.map(toCreatorOption));
        this.cdr.markForCheck();
      },
      error: () => this.creatorOptions.set([]),
    });
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
    this.form
      .get('panNumber')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const next = String(value ?? '')
          .toUpperCase()
          .replace(/\s+/g, '');
        if (next !== value) this.form.patchValue({ panNumber: next }, { emitEvent: false });
      });
  }

  private loadExisting(): void {
    this.loading.set(true);
    this.agents.getById(this.recordId).subscribe({
      next: (record) => {
        this.savedAgentId.set(record.agentId);
        this.savedFormStatus.set(record.formStatus);
        this.savedIssued.set(record.agentIdIssued);
        this.form.patchValue({
          ...record,
          preferredDepartments: record.preferredDepartments ?? [],
          allowedWork: record.allowedWork ?? [],
          confirmAccountNumber: record.accountNumber,
        });
        if (record.formStatus === 'pending_approval' || record.formStatus === 'approved') {
          this.form.disable({ emitEvent: false });
        }
        const creatorType = record.creatorType as FreelancerCreatorType;
        if (creatorType === 'Employee' || creatorType === 'Existing Agent') {
          this.loadCreators(creatorType);
        }
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
      if (key === 'creatorType' && this.form.get('creatorType')?.value !== 'Direct') {
        const creatorId = this.form.get('creatorId');
        creatorId?.markAsTouched();
        if (!String(creatorId?.value ?? '').trim()) valid = false;
      }
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
    const raw = this.form.getRawValue();
    for (const { key, label } of SUBMIT_REQUIRED_FIELDS) {
      const value = this.form.get(key)?.getRawValue();
      if (key === 'creatorType' && raw.creatorType !== 'Direct' && !String(raw.creatorId ?? '').trim()) {
        missing.push('Search Creator');
      }
      if (Array.isArray(value)) {
        if (!value.length) missing.push(label);
        continue;
      }
      if (typeof value === 'boolean') {
        if (!value) missing.push(label);
        continue;
      }
      if (!String(value ?? '').trim()) missing.push(label);
    }
    if (this.form.get('ifscCode')?.invalid) missing.push('Valid IFSC Code');
    if (this.form.get('accountNumber')?.invalid) missing.push('Valid Account Number');
    if (this.form.get('confirmAccountNumber')?.invalid) missing.push('Matching Account Number');
    if (this.form.get('mobile')?.invalid) missing.push('Valid Mobile Number');
    if (this.form.get('pincode')?.invalid) missing.push('Valid Pincode');
    return [...new Set(missing)];
  }

  private markSubmitTouched(): void {
    for (const { key } of SUBMIT_REQUIRED_FIELDS) this.form.get(key)?.markAsTouched();
    this.form.get('creatorId')?.markAsTouched();
  }

  private stepIndexForField(key: string): number {
    const index = STEP_REQUIRED_FIELDS.findIndex((keys) => keys.includes(key));
    return index >= 0 ? index : 0;
  }

  private persist(formStatus: FreelancerFormStatus): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submittingKind.set(formStatus === 'pending_approval' ? 'submit' : 'draft');
    const payload = this.toPayload(formStatus);

    this.flushPendingDocuments().subscribe({
      next: (uploadedUrls) => {
        const body = { ...payload, ...uploadedUrls };
        for (const [field, url] of Object.entries(uploadedUrls)) {
          if (url) this.form.patchValue({ [field]: url }, { emitEvent: false });
        }
        const request = this.isEdit
          ? this.agents.update(this.recordId, body)
          : this.agents.create(body);
        request.subscribe({
          next: (saved) => {
            this.submitting.set(false);
            this.submittingKind.set(null);
            this.form.markAsPristine();
            this.savedAgentId.set(saved.agentId);
            this.savedFormStatus.set(saved.formStatus);
            this.savedIssued.set(saved.agentIdIssued);
            this.messages.add({
              severity: 'success',
              summary: formStatus === 'pending_approval' ? 'Submitted for approval' : 'Draft saved',
              detail:
                formStatus === 'pending_approval'
                  ? 'Freelancer / Growing Partner submitted for approval.'
                  : 'You can continue this onboarding later.',
            });
            if (formStatus === 'pending_approval') {
              this.router.navigate([BASE_PATH, saved.id]);
              return;
            }
            if (!this.isEdit) {
              this.router.navigate([BASE_PATH, saved.id, 'edit'], { replaceUrl: true });
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

  private toPayload(formStatus: FreelancerFormStatus): FreelancerAgentPayload {
    const raw = this.form.getRawValue();
    const base = emptyFreelancerAgent();
    return {
      ...base,
      creatorType: String(raw.creatorType ?? ''),
      creatorId: String(raw.creatorId ?? ''),
      creatorName: String(raw.creatorName ?? ''),
      fullName: String(raw.fullName ?? ''),
      fatherHusbandName: String(raw.fatherHusbandName ?? ''),
      dateOfBirth: String(raw.dateOfBirth ?? ''),
      mobile: String(raw.mobile ?? ''),
      whatsapp: String(raw.whatsapp ?? ''),
      email: String(raw.email ?? ''),
      gender: String(raw.gender ?? ''),
      education: String(raw.education ?? ''),
      occupation: String(raw.occupation ?? ''),
      currentAddress: String(raw.currentAddress ?? ''),
      pincode: String(raw.pincode ?? ''),
      googleLocation: String(raw.googleLocation ?? ''),
      preferredWorkArea: String(raw.preferredWorkArea ?? ''),
      workMode: String(raw.workMode ?? ''),
      emergencyContactName: String(raw.emergencyContactName ?? ''),
      emergencyContactMobile: String(raw.emergencyContactMobile ?? ''),
      profilePhoto: String(raw.profilePhoto ?? ''),
      aadhaarFront: String(raw.aadhaarFront ?? ''),
      aadhaarBack: String(raw.aadhaarBack ?? ''),
      aadhaarCard: String(raw.aadhaarFront ?? ''),
      aadhaarNumber: String(raw.aadhaarNumber ?? ''),
      panCard: String(raw.panCard ?? ''),
      panNumber: String(raw.panNumber ?? ''),
      addressProof: String(raw.addressProof ?? ''),
      cancelledCheque: String(raw.cancelledCheque ?? ''),
      signature: String(raw.signature ?? ''),
      agentType: String(raw.agentType ?? ''),
      preferredDepartments: Array.isArray(raw.preferredDepartments) ? raw.preferredDepartments : [],
      allowedWork: Array.isArray(raw.allowedWork) ? raw.allowedWork : [],
      assignedManager: String(raw.assignedManager ?? ''),
      assignedManagerId: String(raw.assignedManagerId ?? ''),
      branch: String(raw.branch ?? ''),
      branchId: String(raw.branchId ?? ''),
      trainingStatus: String(raw.trainingStatus ?? 'Pending'),
      accountNumber: String(raw.accountNumber ?? ''),
      confirmAccountNumber: String(raw.confirmAccountNumber ?? ''),
      ifscCode: String(raw.ifscCode ?? '').toUpperCase(),
      payoutBasis: PAYOUT_BASIS,
      policyAccepted: !!raw.policyAccepted,
      policyAcceptedAt: raw.policyAccepted ? new Date().toISOString() : '',
      policyVersion: POLICY_VERSION,
      formStatus,
      status: 'inactive',
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

interface CreatorOption {
  label: string;
  value: string;
  id: string;
  name: string;
  code: string;
}

interface StaffOption {
  label: string;
  value: string;
  name: string;
  userId: string;
  code: string;
  role: string;
}

function toCreatorOption(row: FreelancerCreatorOption): CreatorOption {
  const extra = [row.code, row.extra, row.email].filter(Boolean).join(' · ');
  return {
    label: extra ? `${row.name} (${extra})` : row.name,
    value: row.id,
    id: row.id,
    name: row.name,
    code: row.code,
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

function optionalPan(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '')
    .trim()
    .toUpperCase();
  if (!value) return null;
  return PAN_PATTERN.test(value) ? null : { pan: true };
}

function optionalAadhaar(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').replace(/\D/g, '');
  if (!value) return null;
  return AADHAAR_PATTERN.test(value) ? null : { aadhaar: true };
}

function ifscValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!value) return Validators.required(control);
  return IFSC_PATTERN.test(value) ? null : { ifsc: true };
}

function accountMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  const confirm = String(control.value ?? '').trim();
  const account = String(parent?.get('accountNumber')?.value ?? '').trim();
  if (!confirm) return Validators.required(control);
  return confirm === account ? null : { accountMatch: true };
}
