import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <div class="error-state">
      <i class="pi pi-exclamation-triangle"></i>
      <h3>Something went wrong</h3>
      <p>{{ message() }}</p>
      @if (retryable()) {
        <button pButton size="small" label="Retry" (click)="retry.emit()"></button>
      }
    </div>
  `,
  styles: [
    `
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 3rem 1rem;
        color: var(--admin-text-muted);
      }
      i {
        font-size: 2rem;
        color: var(--admin-danger);
        margin-bottom: 0.75rem;
      }
      h3 {
        margin: 0;
        font-size: 0.9375rem;
        color: var(--admin-text);
      }
      p {
        margin: 0.25rem 0 1rem;
        font-size: 0.8125rem;
        max-width: 360px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorState {
  readonly message = input('Unable to load this data. Please try again.');
  readonly retryable = input(true);
  readonly retry = output<void>();
}
