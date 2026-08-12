import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';

export type BannerPlacement = 'home' | 'promotional' | 'product' | string;

export interface StoreBanner {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  imageUrl: string;
  link: string;
  placement: BannerPlacement;
  sortOrder: number;
  status: string;
  createdAt?: string;
}

/** Soft-navigation TTL for Home banners (in-memory only). */
const HOME_BANNERS_TTL_MS = 45_000;

@Injectable({ providedIn: 'root' })
export class BannersApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/banners`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly bannersSignal = signal<StoreBanner[]>([]);
  /** True after the primary Home Hero `list()` finishes (success or error). */
  private readonly loadedSignal = signal(false);

  private list$: Observable<StoreBanner[]> | null = null;
  private listExpiresAt = 0;

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly banners = this.bannersSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();

  list(): Observable<StoreBanner[]> {
    const now = Date.now();
    if (this.list$ && now < this.listExpiresAt) {
      return this.list$;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.listExpiresAt = now + HOME_BANNERS_TTL_MS;

    this.list$ = this.http.get<ApiSuccess<StoreBanner[]>>(this.baseUrl).pipe(
      map((res) =>
        (res.data ?? [])
          .map((banner) => ({ ...banner, imageUrl: resolveBannerImage(banner.imageUrl) }))
          .filter(
            (banner: StoreBanner) =>
              banner.status === 'active' && Boolean(banner.imageUrl?.trim()),
          )
          .sort(
            (a: StoreBanner, b: StoreBanner) =>
              Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0),
          ),
      ),
      tap((banners) => {
        this.bannersSignal.set(banners);
        this.loadingSignal.set(false);
        this.loadedSignal.set(true);
      }),
      catchError(() => {
        this.loadingSignal.set(false);
        this.errorSignal.set('Unable to load banners.');
        this.bannersSignal.set([]);
        this.loadedSignal.set(true);
        this.list$ = null;
        this.listExpiresAt = 0;
        return of([]);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.list$;
  }

  /** Drop cached banners so the next `list()` hits the network. */
  invalidate(): void {
    this.list$ = null;
    this.listExpiresAt = 0;
  }

  byPlacement(placement: BannerPlacement): Observable<StoreBanner[]> {
    return this.list().pipe(
      map((banners) => {
        const matched = banners.filter(
          (banner) => String(banner.placement || 'home').toLowerCase() === placement,
        );
        return matched.length > 0 ? matched : banners;
      }),
    );
  }
}

function resolveBannerImage(url: string | null | undefined): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/api/')) {
    return `${environment.apiBaseUrl}${trimmed}`;
  }
  return trimmed;
}

