import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="stat-card">
      <div class="stat-card__icon" [style.background]="accent() + '1a'" [style.color]="accent()">
        <i class="pi" [class]="icon()"></i>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__label">{{ label() }}</span>
        <span class="stat-card__value">{{ value() }}</span>
        @if (hint()) {
          <span class="stat-card__hint">{{ hint() }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .stat-card {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        background: var(--admin-surface);
        border: 1px solid var(--admin-surface-border);
        border-radius: var(--admin-radius);
        padding: 1.125rem;
      }
      .stat-card__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        flex-shrink: 0;
        font-size: 1.125rem;
      }
      .stat-card__body {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .stat-card__label {
        font-size: 0.75rem;
        color: var(--admin-text-muted);
      }
      .stat-card__value {
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--admin-text);
        line-height: 1.3;
      }
      .stat-card__hint {
        font-size: 0.6875rem;
        color: var(--admin-text-muted);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('pi-chart-bar');
  readonly accent = input('#4f46e5');
  readonly hint = input<string>();
}
