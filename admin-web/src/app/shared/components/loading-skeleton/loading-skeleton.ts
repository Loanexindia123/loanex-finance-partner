import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [SkeletonModule],
  template: `
    <div class="loading-skeleton">
      @for (row of rowsArray(); track $index) {
        <p-skeleton height="2.5rem" styleClass="mb-2" />
      }
    </div>
  `,
  styles: [
    `
      .loading-skeleton {
        padding: 0.5rem 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingSkeleton {
  readonly rows = input(5);
  readonly rowsArray = () => Array.from({ length: this.rows() });
}
