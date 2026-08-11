import { Injectable, signal } from '@angular/core';
import { AdminUser } from '../models/auth.models';

const ACCESS_KEY = 'loanexAdmin.accessToken';
const USER_KEY = 'loanexAdmin.user';

/**
 * Admin sessions get an access token only — the backend issues no refresh
 * token for /auth/admin-login. There is deliberately no refresh-token
 * storage/logic here; on expiry the interceptor redirects to login.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly accessTokenSignal = signal<string | null>(this.read(ACCESS_KEY));
  private readonly userSignal = signal<AdminUser | null>(this.readUser());

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();

  setSession(accessToken: string, user: AdminUser): void {
    this.write(ACCESS_KEY, accessToken);
    this.write(USER_KEY, JSON.stringify(user));
    this.accessTokenSignal.set(accessToken);
    this.userSignal.set(user);
  }

  setUser(user: AdminUser): void {
    this.write(USER_KEY, JSON.stringify(user));
    this.userSignal.set(user);
  }

  clear(): void {
    this.remove(ACCESS_KEY);
    this.remove(USER_KEY);
    this.accessTokenSignal.set(null);
    this.userSignal.set(null);
  }

  hasAccessToken(): boolean {
    return !!this.accessTokenSignal();
  }

  /**
   * True when an access token exists and its JWT `exp` claim is still in
   * the future. Malformed/opaque tokens are treated as present-is-enough.
   */
  hasValidAccessToken(): boolean {
    const token = this.accessTokenSignal();
    if (!token) return false;
    const exp = this.readJwtExp(token);
    if (exp == null) return true;
    return exp * 1000 > Date.now() + 30_000;
  }

  private readJwtExp(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      if (typeof atob === 'undefined') return null;
      const parsed = JSON.parse(atob(payload)) as { exp?: number };
      return typeof parsed.exp === 'number' ? parsed.exp : null;
    } catch {
      return null;
    }
  }

  private read(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }

  private write(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  }

  private remove(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  }

  private readUser(): AdminUser | null {
    const raw = this.read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminUser;
    } catch {
      return null;
    }
  }
}
