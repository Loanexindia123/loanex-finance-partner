import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { formatInr } from '../../../../shared/utils/currency';
import { CartService } from '../../../cart/services/cart.service';
import {
  WishlistItem,
  WishlistResponse,
  WishlistService,
} from '../../services/wishlist.service';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WishlistComponent implements OnInit {
  private readonly wishlistApi = inject(WishlistService);
  private readonly cartApi = inject(CartService);
  private readonly auth = inject(AuthService);

  readonly formatInr = formatInr;
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly wishlist = signal<WishlistResponse | null>(null);

  ngOnInit(): void {
    this.load();
  }

  remove(item: WishlistItem): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);

    this.wishlistApi.removeItem(item.id).subscribe({
      next: (data) => {
        this.acting.set(false);
        this.wishlist.set(data);
        this.info.set('Item removed from wishlist.');
      },
      error: () => {
        this.acting.set(false);
        this.error.set(this.wishlistApi.error() ?? 'Unable to remove item.');
      },
    });
  }

  moveToCart(item: WishlistItem): void {
    if (this.acting()) return;
    if (!item.product.inStock) {
      this.error.set('This product is out of stock.');
      return;
    }

    this.acting.set(true);
    this.error.set(null);

    this.wishlistApi.moveToCart(item.id).subscribe({
      next: (data) => {
        this.acting.set(false);
        this.wishlist.set(data);
        this.info.set('Item moved to cart.');
        // Server mutated cart outside CartService — force a fresh GET.
        this.cartApi.invalidate();
        this.cartApi.getCart({ force: true }).subscribe({ error: () => undefined });
      },
      error: () => {
        this.acting.set(false);
        this.error.set(this.wishlistApi.error() ?? 'Unable to move item to cart.');
      },
    });
  }

  stockLabel(status: string): string {
    if (status === 'OUT_OF_STOCK') return 'Out of Stock';
    if (status === 'LOW_STOCK') return 'Low Stock';
    return 'In Stock';
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private load(): void {
    if (!this.auth.isAuthenticated()) {
      this.loading.set(false);
      this.error.set('Please log in to view your wishlist.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.wishlistApi.getWishlist().subscribe({
      next: (data) => {
        this.loading.set(false);
        this.wishlist.set(data);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.wishlistApi.error() ?? 'Unable to load wishlist.');
      },
    });
  }
}
