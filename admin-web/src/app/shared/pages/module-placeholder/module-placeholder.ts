import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageHeader } from '../../components/page-header/page-header';
import { EmptyState } from '../../components/empty-state/empty-state';

/**
 * Temporary stand-in for a feature route not yet built in the current
 * phase. Route `data.title`/`data.description` control the copy.
 */
@Component({
  selector: 'app-module-placeholder',
  standalone: true,
  imports: [PageHeader, EmptyState],
  template: `
    <app-page-header [title]="title" [subtitle]="subtitle" />
    <app-empty-state icon="pi-hourglass" title="Coming in a later phase" [description]="description" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModulePlaceholder {
  private readonly route = inject(ActivatedRoute);
  readonly title = (this.route.snapshot.data['title'] as string) ?? 'Module';
  readonly subtitle = this.route.snapshot.data['subtitle'] as string | undefined;
  readonly description =
    (this.route.snapshot.data['description'] as string) ??
    'This section is scaffolded and will be wired up to the backend in an upcoming build phase.';
}
