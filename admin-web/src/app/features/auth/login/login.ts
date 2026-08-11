import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

const REMEMBERED_EMAIL_KEY = 'loanexAdmin.rememberedEmail';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: [this.readRememberedEmail(), [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [!!this.readRememberedEmail()],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email, password, rememberMe } = this.form.getRawValue();

    this.auth.login({ email: email.trim(), password }).subscribe({
      next: () => {
        this.persistRememberedEmail(rememberMe, email);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractMessage(err));
      },
    });
  }

  showFieldError(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  private readRememberedEmail(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
  }

  private persistRememberedEmail(remember: boolean, email: string): void {
    if (typeof localStorage === 'undefined') return;
    if (remember && email.trim()) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      return;
    }
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Login failed. Check your credentials and try again.';
    }
    return 'Login failed. Check your credentials and try again.';
  }
}
