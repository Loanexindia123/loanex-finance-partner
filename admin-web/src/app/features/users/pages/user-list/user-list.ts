import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { UserService } from '../../services/user.service';
import { CreateUserPayload, StaffRole, StaffUser } from '../../models/user.models';

function passwordsMatch(group: FormGroup): ValidationErrors | null {
  const p = group.get('password')?.value;
  const c = group.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    DialogModule,
    BrandedLoader,
    ErrorState,
    EmptyState,
    CanDirective,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserList {
  private readonly users = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<StaffUser[]>([]);

  readonly roleOptions: { label: string; value: StaffRole }[] = [{ label: 'Sales Executive', value: 'Sales Executive' }];

  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly form: FormGroup = this.fb.group(
    {
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      role: ['Sales Executive' as StaffRole, Validators.required],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.users.listStaff().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  openAdd(): void {
    this.form.reset({ name: '', email: '', mobile: '', role: 'Sales Executive', password: '', confirmPassword: '' });
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) return;
    this.formOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateUserPayload = {
      name: raw.name,
      email: raw.email,
      mobile: raw.mobile,
      role: raw.role,
      password: raw.password,
    };

    this.saving.set(true);
    this.users.createUser(payload).subscribe({
      next: (created) => {
        this.items.update((list) => [created, ...list]);
        this.saving.set(false);
        this.formOpen.set(false);
        this.messages.add({ severity: 'success', summary: 'User created', detail: raw.name });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: 'Could not create user', detail: this.extractMessage(err) });
      },
    });
  }

  toggleStatus(user: StaffUser): void {
    const nextBlocked = user.status !== 'BLOCKED';
    this.users.setBlocked(user.id, nextBlocked).subscribe({
      next: (updated) => {
        this.items.update((list) => list.map((u) => (u.id === user.id ? updated : u)));
        this.messages.add({
          severity: 'success',
          summary: nextBlocked ? 'User disabled' : 'User enabled',
          detail: user.profile?.fullName || user.email,
        });
      },
      error: (err: unknown) => {
        this.messages.add({ severity: 'error', summary: 'Status update failed', detail: this.extractMessage(err) });
      },
    });
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string };
      return body?.message || err.message || 'Something went wrong.';
    }
    return 'Something went wrong.';
  }
}