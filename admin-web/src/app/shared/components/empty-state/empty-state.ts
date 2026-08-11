import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <i class="pi" [class]="icon()"></i>
      <h3>{{ title() }}</h3>
      @if (description()) {
        <p>{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 3rem 1rem;
        color: var(--admin-text-muted);
      }
      i {
        font-size: 2rem;
        margin-bottom: 0.75rem;
      }
      h3 {
        margin: 0;
        font-size: 0.9375rem;
        color: var(--admin-text);
      }
      p {
        margin: 0.25rem 0 0;
        font-size: 0.8125rem;
        max-width: 360px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('pi-inbox');
  readonly title = input('Nothing here yet');
  readonly description = input<string>();
}
