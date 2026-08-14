import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { EmployeeService } from '../../services/employee.service';
import { DOCUMENT_FIELDS, Employee } from '../../models/employee.models';

@Component({
  selector: 'app-employee-view',
  standalone: true,
  imports: [ButtonModule, PageHeader, BrandedLoader, ErrorState, StatusBadge, CanDirective],
  templateUrl: './employee-view.html',
  styleUrl: './employee-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employees = inject(EmployeeService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly employee = signal<Employee | null>(null);
  readonly documentFields = DOCUMENT_FIELDS;
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.id) {
      this.loading.set(false);
      this.error.set('Employee id is missing.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.employees.getById(this.id).subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractMessage(err));
      },
    });
  }

  edit(): void {
    this.router.navigate(['/employees', this.id, 'edit']);
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

  hasDocument(employee: Employee, key: string): boolean {
    return !!String((employee as unknown as Record<string, unknown>)[key] ?? '').trim();
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string } | null;
      return body?.message || body?.error || err.message || 'Request failed';
    }
    return err instanceof Error ? err.message : 'Request failed';
  }
}
