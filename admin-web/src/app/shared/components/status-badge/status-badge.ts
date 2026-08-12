import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

const SEVERITY_MAP: Record<string, Severity> = {
  active: 'success',
  approved: 'success',
  delivered: 'success',
  completed: 'success',
  accepted: 'success',
  paid: 'success',
  success: 'success',
  verified: 'success',
  confirmed: 'info',
  order_confirmed: 'info',
  processing: 'info',
  packed: 'info',
  shipped: 'info',
  out_for_delivery: 'info',
  in_progress: 'info',
  under_review: 'info',
  pending: 'warn',
  overdue: 'danger',
  created: 'warn',
  hold: 'warn',
  draft: 'secondary',
  inactive: 'secondary',
  blocked: 'danger',
  cancelled: 'danger',
  rejected: 'danger',
  failed: 'danger',
  refunded: 'danger',
};

function normalizeStatusKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Maps common LoanEx status strings to a consistent PrimeNG tag severity. */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [TagModule],
  template: `<p-tag [value]="label()" [severity]="severity()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly status = input.required<string>();

  readonly label = computed(() =>
    this.status()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  );

  readonly severity = computed<Severity>(() => {
    const key = normalizeStatusKey(this.status() ?? '');
    return SEVERITY_MAP[key] ?? SEVERITY_MAP[key.replace(/^order_/, '')] ?? 'secondary';
  });
}
