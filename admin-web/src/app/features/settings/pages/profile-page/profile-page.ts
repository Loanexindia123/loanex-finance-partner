import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/services/auth.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';

function passwordsMatch(group: FormGroup): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule, PasswordModule, ButtonModule, StatusBadge],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);

  readonly user = this.auth.user;
  readonly refreshing = signal(false);

  readonly initials = computed(() => {
    const name = this.user()?.fullName?.trim();
    if (name) {
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
    }
    const email = this.user()?.email?.trim();
    return email ? email[0].toUpperCase() : 'A';
  });

  readonly memberSince = computed(() => {
    const raw = this.user()?.createdAt;
    if (!raw) return '—';
    const d = new Date(raw);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  readonly passwordFormOpen = signal(false);
  readonly saving = signal(false);
  readonly form: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    this.refreshing.set(true);
    this.auth.me().subscribe({
      next: () => this.refreshing.set(false),
      error: () => this.refreshing.set(false),
    });
  }

  changePassword(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        this.passwordFormOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Password updated',
          detail: 'Your password has been changed successfully.',
        });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const body = err instanceof HttpErrorResponse ? (err.error as { message?: string }) : undefined;
        this.messages.add({
          severity: 'error',
          summary: 'Could not update password',
          detail: body?.message || 'Please check your current password and try again.',
        });
      },
    });
  }

  cancelPasswordChange(): void {
    this.form.reset();
    this.passwordFormOpen.set(false);
  }
}