import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RbacService } from '../../core/services/rbac.service';
import { LayoutService } from '../layout.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  readonly layout = inject(LayoutService);

  @ViewChild('profileRoot') private profileRoot?: ElementRef<HTMLElement>;
  @ViewChild('menuTrigger') private menuTrigger?: ElementRef<HTMLButtonElement>;

  readonly user = this.auth.user;
  readonly menuOpen = signal(false);

  readonly displayName = computed(() => {
    const current = this.user();
    if (!current) {
      return '';
    }
    const name = current.fullName?.trim() ?? '';
    if (!name || name === current.email || name === current.mobile) {
      return '';
    }
    return name;
  });

  readonly email = computed(() => this.user()?.email?.trim() ?? '');

  readonly roleName = computed(() => this.user()?.roleName?.trim() ?? '');

  readonly triggerPrimary = computed(() => this.displayName() || this.email());

  readonly triggerSecondary = computed(() => {
    const role = this.roleName();
    if (role) {
      return role;
    }
    return this.displayName() ? this.email() : '';
  });

  readonly initials = computed(() => {
    const name = this.displayName();
    if (name) {
      return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
    }
    const email = this.email();
    if (email) {
      return email[0].toUpperCase();
    }
    const mobile = this.user()?.mobile?.trim();
    return mobile ? mobile[0].toUpperCase() : '';
  });

  readonly canOpenSettings = computed(() => this.rbac.can('settings.view'));

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  closeMenu(restoreFocus = false): void {
    if (!this.menuOpen()) {
      return;
    }
    this.menuOpen.set(false);
    if (restoreFocus) {
      this.menuTrigger?.nativeElement.focus();
    }
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) {
      return;
    }
    const root = this.profileRoot?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu(true);
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen()) {
      return;
    }

    const items = this.menuItems();
    if (!items.length) {
      return;
    }

    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      items[next].focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      items[next].focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  }

  private menuItems(): HTMLElement[] {
    const root = this.profileRoot?.nativeElement;
    if (!root) {
      return [];
    }
    return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
}
