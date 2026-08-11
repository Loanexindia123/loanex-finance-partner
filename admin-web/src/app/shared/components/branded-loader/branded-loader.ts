import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-branded-loader',
  standalone: true,
  templateUrl: './branded-loader.html',
  styleUrl: './branded-loader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandedLoader {
  readonly message = input('Loading...');
}
