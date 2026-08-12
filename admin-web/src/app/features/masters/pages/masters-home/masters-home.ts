import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { MASTER_NAV_CARDS } from '../../masters.config';

@Component({
  selector: 'app-masters-home',
  standalone: true,
  imports: [RouterLink, PageHeader, CanDirective],
  templateUrl: './masters-home.html',
  styleUrl: './masters-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MastersHome {
  readonly cards = MASTER_NAV_CARDS;
}
