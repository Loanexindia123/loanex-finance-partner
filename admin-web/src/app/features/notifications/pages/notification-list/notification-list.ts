import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { NotificationService } from '../../services/notification.service';
import { AppNotification, NotificationType } from '../../models/notification.models';

const ICONS: Record<string, string> = {
  EMI_REQUEST_RECEIVED: 'pi-file-plus',
  EMI_REQUEST_ACCEPTED: 'pi-check-circle',
  EMI_REQUEST_REJECTED: 'pi-times-circle',
};

const TONES: Record<string, 'info' | 'success' | 'danger'> = {
  EMI_REQUEST_RECEIVED: 'info',
  EMI_REQUEST_ACCEPTED: 'success',
  EMI_REQUEST_REJECTED: 'danger',
};

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [ButtonModule, EmptyState, BrandedLoader, ErrorState],
  templateUrl: './notification-list.html',
  styleUrl: './notification-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationList {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<AppNotification[]>([]);
  readonly unreadOnly = signal(false);

  readonly visible = computed(() =>
    this.unreadOnly() ? this.items().filter((n) => !n.isRead) : this.items(),
  );
  readonly unreadCount = computed(() => this.items().filter((n) => !n.isRead).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notifications.list().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        const body = err instanceof HttpErrorResponse ? (err.error as { message?: string }) : undefined;
        this.error.set(body?.message || 'Could not load notifications.');
        this.loading.set(false);
      },
    });
  }

  icon(type: NotificationType): string {
    return ICONS[type] ?? 'pi-bell';
  }

  tone(type: NotificationType): string {
    return TONES[type] ?? 'info';
  }

  timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  open(notification: AppNotification): void {
    if (!notification.isRead) {
      this.notifications.markRead(notification.id).subscribe(() => {
        this.items.update((list) =>
          list.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
      });
    }
    // FI Cases / EMI Applications detail pages are still placeholders — routing to
    // the list page for now; swap to a detail route once one exists, e.g.
    // this.router.navigate(['/fi', notification.metadata?.applicationId]).
    if (notification.metadata?.applicationId) {
      this.router.navigate(['/fi']);
    }
  }

  markAllRead(): void {
    this.notifications.markAllRead().subscribe(() => {
      this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    });
  }
}