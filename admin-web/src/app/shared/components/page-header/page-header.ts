import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="page-header">
      <div class="page-header__left">
        @if (backLink()) {
          <a
            pButton
            type="button"
            icon="pi pi-arrow-left"
            [label]="backLabel()"
            [text]="true"
            [routerLink]="backLink()"
          ></a>
        }
        <ng-content select="[leading]" />
        <div class="page-header__titles">
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="page-header__actions">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }
      .page-header__left {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.15rem;
        min-width: 0;
        flex: 1;
      }
      .page-header__titles {
        min-width: 0;
      }
      h1 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--admin-text);
      }
      p {
        margin: 0.25rem 0 0;
        font-size: 0.8125rem;
        color: var(--admin-text-muted);
      }
      .page-header__actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly backLink = input<string>();
  readonly backLabel = input('Back');
}
