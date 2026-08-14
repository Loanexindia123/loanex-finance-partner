import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { interval } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

type Step = 'identify' | 'otp' | 'password' | 'done';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly step = signal<Step>('identify');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly mobile = signal('');
  readonly mobileMasked = signal('');
  readonly otpValue = signal('');
  readonly resendSeconds = signal(0);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  readonly identifyForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const left = this.resendSeconds();
        if (left > 0) {
          this.resendSeconds.set(left - 1);
          this.cdr.markForCheck();
        }
      });
  }

  requestOtp(): void {
    if (this.identifyForm.invalid || this.submitting()) {
      this.identifyForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    const identifier = this.identifyForm.controls.identifier.value.trim();
    this.auth.adminForgotPassword(identifier).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.infoMessage.set(res.message);
        if (!res.otpSent || !res.mobile) {
          // Generic response — do not advance when no staff OTP was issued.
          return;
        }
        this.mobile.set(res.mobile);
        this.mobileMasked.set(res.mobileMasked || maskLocal(res.mobile));
        this.startResendCooldown(res.resendCooldownSeconds || 30);
        this.step.set('otp');
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractMessage(err));
      },
    });
  }

  verifyOtp(): void {
    if (this.otpForm.invalid || this.submitting()) {
      this.otpForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const otp = this.otpForm.controls.otp.value.trim();
    this.auth.adminVerifyResetOtp(this.mobile(), otp).subscribe({
      next: () => {
        this.submitting.set(false);
        this.otpValue.set(otp);
        this.step.set('password');
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractMessage(err));
      },
    });
  }

  resendOtp(): void {
    if (this.resendSeconds() > 0 || this.submitting()) return;
    const identifier = this.identifyForm.controls.identifier.value.trim() || this.mobile();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.adminForgotPassword(identifier).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.mobile) this.mobile.set(res.mobile);
        if (res.mobileMasked) this.mobileMasked.set(res.mobileMasked);
        this.startResendCooldown(res.resendCooldownSeconds || 30);
        this.infoMessage.set('A new OTP has been sent if the account is eligible.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractMessage(err));
      },
    });
  }

  resetPassword(): void {
    if (this.passwordForm.invalid || this.submitting()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('New password and confirmation do not match.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.auth.adminResetPassword(this.mobile(), this.otpValue(), newPassword).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.infoMessage.set(res.message || 'Password reset successfully.');
        this.step.set('done');
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractMessage(err));
      },
    });
  }

  backToLogin(): void {
    void this.router.navigateByUrl('/auth/login');
  }

  backToIdentify(): void {
    this.step.set('identify');
    this.errorMessage.set(null);
    this.otpForm.reset();
  }

  toggle(which: 'new' | 'confirm'): void {
    if (which === 'new') this.showNew.update((v) => !v);
    else this.showConfirm.update((v) => !v);
  }

  private startResendCooldown(seconds: number): void {
    this.resendSeconds.set(Math.max(0, Math.floor(seconds)));
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Request failed. Please try again.';
    }
    return 'Request failed. Please try again.';
  }
}

function maskLocal(mobile: string): string {
  const digits = String(mobile ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}
