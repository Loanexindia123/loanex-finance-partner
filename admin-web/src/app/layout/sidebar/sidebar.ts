import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { TooltipModule } from 'primeng/tooltip';
import { NAV_ITEMS, NavItem } from '../../core/config/nav.config';
import { RbacService } from '../../core/services/rbac.service';
import { LayoutService } from '../layout.service';

const NAV_GROUPS: readonly { routes: readonly string[] }[] = [
  { routes: ['/dashboard', '/products', '/masters/dealers', '/customers', '/orders'] },
  { routes: ['/emi', '/loans', '/fi'] },
  { routes: ['/users', '/employees', '/employees/freelancer-onboarding', '/roles', '/notifications'] },
  { routes: ['/masters', '/reports', '/settings'] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, TooltipModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly rbac = inject(RbacService);
  private readonly router = inject(Router);
  readonly layout = inject(LayoutService);

  readonly collapsed = this.layout.sidebarCollapsed;
  private readonly currentUrl = signal(this.pathOnly(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.currentUrl.set(this.pathOnly(event.urlAfterRedirects)));
  }

  readonly items = computed(() => {
    const role = this.rbac.roleKey();
    return NAV_ITEMS.filter((item) => {
      if (item.hideForRoles?.some((r) => r.trim().toLowerCase() === role)) {
        return false;
      }
      return !item.permissions?.length || this.rbac.canAny(...item.permissions);
    });
  });

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

  isActive(item: NavItem): boolean {
    const url = this.currentUrl();
    if (item.exact) {
      return url === item.route;
    }
    if (!this.matchesRoute(url, item.route)) {
      return false;
    }
    return !NAV_ITEMS.some(
      (other) =>
        other.route !== item.route &&
        other.route.length > item.route.length &&
        this.matchesRoute(url, other.route),
    );
  }

  onLinkClick(): void {
    this.layout.closeMobileSidebar();
  }

  private pathOnly(url: string): string {
    return url.split('?')[0]?.split('#')[0] ?? url;
  }

  private matchesRoute(url: string, route: string): boolean {
    return url === route || url.startsWith(`${route}/`);
  }
}
