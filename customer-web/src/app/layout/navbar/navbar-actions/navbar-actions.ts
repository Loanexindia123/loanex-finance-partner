import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthUser } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../features/cart/services/cart.service';
import { ProfileService } from '../../../features/checkout/services/profile.service';
import { WishlistService } from '../../../features/wishlist/services/wishlist.service';

@Component({
  selector: 'app-navbar-actions',
  imports: [RouterLink],
  templateUrl: './navbar-actions.html',
  styleUrl: './navbar-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarActions {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cartApi = inject(CartService);
  private readonly wishlistApi = inject(WishlistService);
  private readonly profileApi = inject(ProfileService);

  readonly wishlistCount = input(0);
  readonly cartCount = input(0);
  readonly showLogin = input(true);
  readonly user = input<AuthUser | null>(null);

  readonly menuOpen = signal(false);

  readonly initials = computed(() => {
    const name = this.user()?.fullName?.trim() || 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  });

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe({
      next: () => {
        this.cartApi.invalidate();
        this.wishlistApi.invalidate();
        this.profileApi.invalidate();
        void this.router.navigateByUrl('/auth/login');
      },
      error: () => {
        this.cartApi.invalidate();
        this.wishlistApi.invalidate();
        this.profileApi.invalidate();
        void this.router.navigateByUrl('/auth/login');
      },
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }
}
