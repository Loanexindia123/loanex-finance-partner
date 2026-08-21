import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { RbacService } from '../../../../core/services/rbac.service';
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
  private readonly rbac = inject(RbacService);

  /** Employee/Dealer/Agent: Brands, Product Types, Categories only (admin-app Masters). */
  readonly cards = computed(() => {
    if (this.rbac.isRestrictedCatalogUser()) {
      return MASTER_NAV_CARDS.filter((card) => card.restrictedCatalog);
    }
    return MASTER_NAV_CARDS;
  });
}
