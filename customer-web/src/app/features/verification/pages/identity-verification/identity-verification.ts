import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../../../core/services/auth.service';
import { VerificationService } from '../../services/verification.service';

@Component({
  selector: 'app-identity-verification',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    SkeletonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './identity-verification.html',
  styleUrl: './identity-verification.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityVerificationComponent implements OnInit, OnDestroy {
  private readonly verification = inject(VerificationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);

  readonly bootstrapping = signal(true);
  
  // States
  readonly aadhaarVerified = signal(false);
  readonly panVerified = signal(false);
  readonly bankVerified = signal(false);

  // Data
  readonly displayMobile = signal('');
  readonly maskedAadhaar = signal<string | null>(null);
  readonly maskedPan = signal<string | null>(null);
  readonly creditScore = signal<number | null>(null);
  readonly maskedBankAccount = signal<string | null>(null);
  readonly verifiedBankName = signal<string | null>(null);

  // DigiLocker State
  readonly digilockerStep = signal<'enter' | 'redirect' | 'fetching' | 'done'>('enter');
  readonly digilockerClientId = signal<string | null>(null);
  readonly digilockerUrl = signal<string | null>(null);
  readonly digilockerKycData = signal<{
    name: string; gender: string; dob: string;
    masked_aadhaar: string; father_name: string;
    profile_image: string; address?: any;
  } | null>(null);
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private digilockerMessageHandler: ((event: MessageEvent) => void) | null = null;
  readonly verifyingAadhaar = signal(false);

  // PAN / Experian State
  readonly verifyingPan = signal(false);
  readonly panSuccessPulse = signal(false);

  readonly experianForm = this.fb.nonNullable.group({
    mobile_no: ['', Validators.required],
    pan: ['', [Validators.required, Validators.pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)]],
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    dob: ['', Validators.required],
  });

  // Bank Verification State
  readonly verifyingBank = signal(false);
  readonly bankSuccessPulse = signal(false);
  readonly bankFormError = signal<string | null>(null);
  readonly bankForm = this.fb.nonNullable.group({
    accountHolderName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    bankName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{8,18}$/)]],
    confirmAccountNumber: ['', [Validators.required, Validators.pattern(/^\d{8,18}$/)]],
    ifscCode: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
    accountType: ['SAVINGS' as 'SAVINGS' | 'CURRENT', Validators.required],
  });

  readonly formattedMobile = computed(() => this.formatIndianMobile(this.displayMobile()));
  /** Progress label for KYC stepper — Aadhaar → PAN → Bank → EMI. */
  readonly kycStepLabel = computed(() => {
    if (!this.aadhaarVerified()) return 'Step 1 of 4 — Aadhaar';
    if (!this.panVerified()) return 'Step 2 of 4 — PAN';
    if (!this.bankVerified()) return 'Step 3 of 4 — Bank Account';
    return 'Step 4 of 4 — EMI Eligibility';
  });

  ngOnInit(): void {
    const userMobile = this.auth.user()?.mobile ?? '';
    this.displayMobile.set(userMobile);
    this.loadStatus();
    this.listenForDigilockerMessage();

    // Returning from DigiLocker (query) or same-tab resume (localStorage).
    // Do NOT delete digilocker_client_id until verification succeeds.
    const queryClientId = this.route.snapshot.queryParamMap.get('client_id');
    const storedClientId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('digilocker_client_id')
        : null;
    const clientId = queryClientId || storedClientId;

    if (clientId) {
      this.digilockerClientId.set(clientId);
      this.digilockerStep.set('fetching');
      this.checkAndFetchDigilocker(clientId, true);
    }
  }

  ngOnDestroy(): void {
    this.stopPollingDigilocker();
    if (typeof window !== 'undefined' && this.digilockerMessageHandler) {
      window.removeEventListener('message', this.digilockerMessageHandler);
      this.digilockerMessageHandler = null;
    }
  }

  private loadStatus(): void {
    this.verification.getStatus().subscribe({
      next: (status) => {
        this.bootstrapping.set(false);
        this.aadhaarVerified.set(status.aadhaarVerified);
        this.panVerified.set(status.panVerified);
        this.bankVerified.set(status.bankVerified);

        if (status.aadhaarVerified) {
          this.digilockerStep.set('done');
          this.clearDigilockerClientId();
          this.verification.getAadhaarStatus().subscribe({
            next: (res) => {
              const data: any = res;
              if (data.masked_aadhaar) {
                this.maskedAadhaar.set(data.masked_aadhaar);
              } else if (data.aadhaarNumberMasked) {
                this.maskedAadhaar.set(data.aadhaarNumberMasked);
              }
              this.digilockerKycData.set({
                name: data.name ?? '',
                gender: data.gender ?? '',
                dob: data.dob ?? '',
                masked_aadhaar: data.masked_aadhaar ?? data.aadhaarNumberMasked ?? '',
                father_name: '',
                profile_image: data.profileImage ?? '',
              });
              
              // Pre-fill Experian form with Aadhaar data
              const fullName = data.name ?? '';
              const nameParts = fullName.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
              
              let dobStr = data.dob ?? '';
              if (dobStr && dobStr.includes('-') && dobStr.split('-')[0].length === 2) {
                const parts = dobStr.split('-');
                dobStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
              } else if (dobStr && dobStr.includes('/')) {
                const parts = dobStr.split('/');
                dobStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
              
              this.experianForm.patchValue({
                first_name: firstName,
                last_name: lastName,
                dob: dobStr,
                mobile_no: this.auth.user()?.mobile?.replace(/\D/g, '').slice(-10) ?? ''
              });
            }
          });
        } else {
          // Resume pending DigiLocker from Mongo-backed client_id when local state was lost.
          this.verification.getAadhaarStatus().subscribe({
            next: (aadhaar) => {
              const pendingId = (aadhaar as { client_id?: string | null }).client_id;
              if (!pendingId || this.aadhaarVerified()) return;
              if (this.digilockerClientId()) return;
              this.digilockerClientId.set(pendingId);
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('digilocker_client_id', pendingId);
              }
              this.digilockerStep.set('redirect');
              this.startPollingDigilocker(pendingId);
            },
            error: () => {
              /* optional resume */
            },
          });
        }
        
        if (status.kyc?.cibil_score) {
          this.creditScore.set(status.kyc.cibil_score);
        }

        if (status.kyc?.panNumber) {
          this.maskedPan.set(this.maskString(status.kyc.panNumber));
        }

        if (status.panVerified) {
          this.hydrateBankSection(status.bankVerified);
        }
      },
      error: () => {
        this.bootstrapping.set(false);
        this.toastError('Failed to load verification status.');
      }
    });
  }

  goToSummary(): void {
    void this.router.navigateByUrl('/verification/summary');
  }

  private hydrateBankSection(alreadyBankVerified: boolean): void {
    const fullName = [
      this.experianForm.value.first_name,
      this.experianForm.value.last_name,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName && !this.bankForm.value.accountHolderName) {
      this.bankForm.patchValue({ accountHolderName: fullName });
    }

    this.verification.getBankStatus().subscribe({
      next: (bank) => {
        this.bankVerified.set(bank.bankVerified || alreadyBankVerified);
        if (bank.bankVerified) {
          this.maskedBankAccount.set(bank.accountNumberMasked);
          this.verifiedBankName.set(bank.bankName);
        }
      },
      error: () => {
        /* status endpoint optional for showing the form */
      },
    });
  }

  // --- DigiLocker Flow ---
  startDigilocker(): void {
    this.verifyingAadhaar.set(true);
    this.verification.digilockerGenerate().subscribe({
      next: (res) => {
        this.verifyingAadhaar.set(false);
        if ((res as { alreadyVerified?: boolean; verified?: boolean }).alreadyVerified ||
            (res as { verified?: boolean }).verified) {
          this.aadhaarVerified.set(true);
          this.digilockerStep.set('done');
          this.clearDigilockerClientId();
          this.toastSuccess('Aadhaar is already verified.');
          this.loadStatus();
          return;
        }
        this.digilockerClientId.set(res.client_id);
        if (res.digilocker_url) {
          this.digilockerUrl.set(res.digilocker_url);
          this.digilockerStep.set('redirect');
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('digilocker_client_id', res.client_id);
          }
          this.openDigilockerPopup(res.digilocker_url, res.client_id);
        } else {
          this.toastWarn('Failed to generate DigiLocker URL.');
        }
      },
      error: () => {
        this.verifyingAadhaar.set(false);
        this.toastError(this.verification.error() ?? 'DigiLocker init failed.');
      }
    });
  }

  private listenForDigilockerMessage(): void {
    if (typeof window === 'undefined') return;
    this.digilockerMessageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; client_id?: string | null };
      if (data?.type !== 'loanex-digilocker-complete') return;
      const clientId = data.client_id || this.digilockerClientId();
      if (clientId && !this.aadhaarVerified()) {
        this.checkAndFetchDigilocker(clientId, true);
      }
    };
    window.addEventListener('message', this.digilockerMessageHandler);
  }

  private openDigilockerPopup(url: string, clientId: string): void {
    const width = 500;
    const height = 750;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    const popup = window.open(
      url,
      'DigiLockerVerification',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      this.toastWarn(
        'Popup blocked. Opening DigiLocker in a new tab — keep this page open.',
      );
      // Prefer a new tab over navigating away from /verification (prevents Home bounce).
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) {
        this.toastError(
          'Unable to open DigiLocker. Please allow popups/new tabs and try again.',
        );
        this.digilockerStep.set('enter');
        return;
      }
      this.startPollingDigilocker(clientId);
      return;
    }

    this.startPollingDigilocker(clientId, popup);
  }

  private startPollingDigilocker(clientId: string, popup?: Window): void {
    this.stopPollingDigilocker();
    let attempts = 0;
    const maxAttempts = 60; // 5 mins at 5s interval

    this.pollIntervalId = setInterval(() => {
      attempts++;
      if (popup && popup.closed) {
        this.stopPollingDigilocker();
        this.checkAndFetchDigilocker(clientId, true);
        return;
      }
      this.checkAndFetchDigilocker(clientId, false, popup);
      
      if (attempts >= maxAttempts) {
        this.stopPollingDigilocker();
        this.toastWarn('DigiLocker verification timed out. You can retry from this page.');
        this.digilockerStep.set('redirect');
        this.verifyingAadhaar.set(false);
      }
    }, 5000);
  }

  checkAndFetchDigilocker(clientId: string, isFinal: boolean = false, popup?: Window): void {
    if (this.aadhaarVerified()) return;
    this.verifyingAadhaar.set(true);
    this.verification.digilockerFetch(clientId).subscribe({
      next: (res) => {
        if (res.verified) {
          this.stopPollingDigilocker();
          if (popup && !popup.closed) {
            try { popup.close(); } catch (_) {}
          }
          this.verifyingAadhaar.set(false);
          this.clearDigilockerClientId();
          this.digilockerKycData.set({
            name: res.name,
            gender: res.gender,
            dob: res.dob,
            masked_aadhaar: res.masked_aadhaar,
            father_name: res.father_name,
            profile_image: res.profile_image,
            address: res.address,
          });
          this.aadhaarVerified.set(true);
          this.maskedAadhaar.set(res.masked_aadhaar);
          this.digilockerStep.set('done');
          this.toastSuccess('Aadhaar verified successfully via DigiLocker.');
          // Strip client_id from URL without leaving /verification.
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { client_id: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
          this.loadStatus(); // Reload to pre-fill the experian form
        } else if (isFinal) {
          this.verifyingAadhaar.set(false);
          this.digilockerStep.set('redirect');
          this.toastWarn(
            'DigiLocker authorization is not complete yet. Finish in DigiLocker, then wait or retry.',
          );
        }
      },
      error: () => {
        if (isFinal) {
          this.stopPollingDigilocker();
          this.verifyingAadhaar.set(false);
          this.digilockerStep.set('redirect');
          this.toastError(
            this.verification.error() ??
              'Could not confirm DigiLocker yet. Stay on this page and retry — you will not be sent Home.',
          );
        }
      }
    });
  }

  private stopPollingDigilocker(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /** Re-open DigiLocker without navigating the current /verification tab away. */
  continueDigilockerRedirect(): void {
    const url = this.digilockerUrl();
    const clientId = this.digilockerClientId();
    if (url && clientId) {
      this.openDigilockerPopup(url, clientId);
      return;
    }
    if (clientId && !url) {
      this.startDigilocker();
      return;
    }
    this.toastWarn('DigiLocker session expired. Please start verification again.');
    this.digilockerStep.set('enter');
  }

  private clearDigilockerClientId(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('digilocker_client_id');
    }
  }

  // --- PAN / Experian Flow ---

  onPanInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    this.experianForm.controls.pan.setValue(value);
    input.value = value;
  }

  verifyPanAndCredit(): void {
    if (this.panVerified()) return;

    this.experianForm.markAllAsTouched();
    if (this.experianForm.invalid) {
      this.toastWarn('Please fill out all required Experian API fields correctly.');
      return;
    }

    this.verifyingPan.set(true);

    this.verification
      .verifyPanAndCredit(this.experianForm.getRawValue())
      .subscribe({
        next: (res) => {
          this.verifyingPan.set(false);
          this.panVerified.set(true);
          this.maskedPan.set(this.maskString(this.experianForm.value.pan));
          this.creditScore.set(res.score);
          this.panSuccessPulse.set(true);
          setTimeout(() => this.panSuccessPulse.set(false), 2000);
          this.toastSuccess('Experian Credit Report fetched successfully.');

          this.hydrateBankSection(false);
          window.setTimeout(() => this.scrollToBankSection(), 400);
        },
        error: () => {
          this.verifyingPan.set(false);
          this.toastError(this.verification.error() ?? 'Experian check failed.');
        },
      });
  }

  // --- Bank Verification Flow ---

  onIfscInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 11);
    this.bankForm.controls.ifscCode.setValue(value);
    input.value = value;
  }

  onBankAccountInput(control: 'accountNumber' | 'confirmAccountNumber', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 18);
    this.bankForm.controls[control].setValue(value);
    input.value = value;
  }

  verifyBank(): void {
    if (this.bankVerified()) return;

    this.bankForm.markAllAsTouched();
    if (this.bankForm.invalid) {
      this.bankFormError.set('Please correct the highlighted fields.');
      return;
    }

    const { accountNumber, confirmAccountNumber } = this.bankForm.getRawValue();
    if (accountNumber !== confirmAccountNumber) {
      this.bankFormError.set('Account number and confirm account number must match.');
      return;
    }

    this.bankFormError.set(null);
    this.verifyingBank.set(true);
    const payload = this.bankForm.getRawValue();

    this.verification.verifyBank(payload).subscribe({
      next: (res) => {
        this.verifyingBank.set(false);
        this.bankVerified.set(true);
        this.maskedBankAccount.set(res.accountNumberMasked ?? null);
        this.verifiedBankName.set(res.bankName ?? payload.bankName);
        this.bankSuccessPulse.set(true);
        setTimeout(() => this.bankSuccessPulse.set(false), 2000);
        this.toastSuccess('Bank Account Verified Successfully');
      },
      error: () => {
        this.verifyingBank.set(false);
        this.bankFormError.set(this.verification.error());
        this.toastError(this.verification.error() ?? 'Bank verification failed.');
      },
    });
  }

  private scrollToBankSection(): void {
    window.setTimeout(() => {
      document.getElementById('lx-idv-bank')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // --- Utils ---

  private formatIndianMobile(value: string | null | undefined): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 10) {
      const main = digits.slice(-10);
      return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
    }
    return value;
  }

  private maskString(val: string | null | undefined): string {
    if (!val || val.length < 4) return val || '';
    return 'X'.repeat(val.length - 4) + val.slice(-4);
  }

  private toastSuccess(msg: string) {
    this.messages.add({ severity: 'success', summary: 'Success', detail: msg });
  }

  private toastError(msg: string) {
    this.messages.add({ severity: 'error', summary: 'Error', detail: msg });
  }

  private toastWarn(msg: string) {
    this.messages.add({ severity: 'warn', summary: 'Warning', detail: msg });
  }

}
