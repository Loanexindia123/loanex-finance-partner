import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { NAV_ITEMS, NavItem } from '../../core/config/nav.config';
import { RbacService } from '../../core/services/rbac.service';
import { LayoutService } from '../layout.service';

const NAV_GROUPS: readonly { routes: readonly string[] }[] = [
  { routes: ['/dashboard', '/products', '/masters/dealers', '/customers', '/orders'] },
  { routes: ['/emi', '/loans', '/fi'] },
  { routes: ['/users', '/employees', '/roles', '/notifications'] },
  { routes: ['/masters', '/reports', '/settings'] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TooltipModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly rbac = inject(RbacService);
  readonly layout = inject(LayoutService);

  readonly collapsed = this.layout.sidebarCollapsed;

  readonly items = computed(() =>
    NAV_ITEMS.filter((item) => !item.permissions?.length || this.rbac.canAny(...item.permissions)),
  );

  readonly groups = computed(() => {
    const visible = this.items();
    const groupedRoutes = new Set(NAV_GROUPS.flatMap((group) => group.routes));
    const grouped = NAV_GROUPS.map((group) =>
      group.routes
        .map((route) => visible.find((item) => item.route === route))
        .filter((item): item is NavItem => !!item),
    ).filter((group) => group.length > 0);
    const leftovers = visible.filter((item) => !groupedRoutes.has(item.route));
    return leftovers.length ? [...grouped, leftovers] : grouped;
  });

  onLinkClick(): void {
    this.layout.closeMobileSidebar();
  }
}
