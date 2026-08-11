import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiSuccess } from '../../../core/models/auth.models';
import { TokenService } from '../../../core/services/token.service';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface ProfileAddress {
  id: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  addressType: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfilePayload {
  id: string | null;
  fullName: string;
  email: string;
  mobile: string;
  dob: string | null;
  gender: Gender | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProfileResponse {
  profile: UserProfilePayload;
  address: ProfileAddress | null;
  billingAddress: ProfileAddress | null;
  billingSameAsShipping: boolean;
  addresses: ProfileAddress[];
  hasProfile: boolean;
  hasAddress: boolean;
}

export interface AddressListResponse {
  items: ProfileAddress[];
  totalItems: number;
}

export interface AddressPayload {
  addressLine1: string;
  addressLine2: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault?: boolean;
  addressType?: 'SHIPPING' | 'BILLING';
}

export interface UpsertProfileRequest {
  fullName: string;
  email: string;
  dob: string;
  gender: Gender;
  address: {
    addressLine1: string;
    addressLine2: string;
    landmark?: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  billingSameAsShipping: boolean;
  billingAddress?: UpsertProfileRequest['address'];
}

export interface UpdatePersonalRequest {
  fullName: string;
  email: string;
  dob: string;
  gender: Gender;
}

/** Soft reuse for PDP pincode / Buy Now gates — invalidated on address mutations. */
const PROFILE_TTL_MS = 45_000;

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenService);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/profile`;

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  private cache: {
    userKey: string;
    data: ProfileResponse;
    expiresAt: number;
  } | null = null;

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /**
   * Load profile. Reuses a short in-memory payload for the current user when
   * still within TTL. Pass `{ force: true }` after an explicit refresh.
   */
  get(options?: { force?: boolean }): Observable<ProfileResponse> {
    const userKey = this.currentUserKey();
    const now = Date.now();
    if (
      !options?.force &&
      this.cache &&
      this.cache.userKey === userKey &&
      userKey !== '' &&
      now < this.cache.expiresAt
    ) {
      return of(this.cache.data);
    }

    return this.wrap(this.http.get<ApiSuccess<ProfileResponse>>(this.baseUrl)).pipe(
      map((data) => this.normalize(data)),
      tap((data) => this.storeCache(userKey, data)),
    );
  }

  create(payload: UpsertProfileRequest): Observable<ProfileResponse> {
    return this.wrap(this.http.post<ApiSuccess<ProfileResponse>>(this.baseUrl, payload)).pipe(
      map((data) => this.normalize(data)),
      tap((data) => this.storeCache(this.currentUserKey(), data)),
    );
  }

  update(payload: UpsertProfileRequest): Observable<ProfileResponse> {
    return this.wrap(this.http.put<ApiSuccess<ProfileResponse>>(this.baseUrl, payload)).pipe(
      map((data) => this.normalize(data)),
      tap((data) => this.storeCache(this.currentUserKey(), data)),
    );
  }

  updatePersonal(payload: UpdatePersonalRequest): Observable<ProfileResponse> {
    return this.wrap(
      this.http.put<ApiSuccess<ProfileResponse>>(`${this.baseUrl}/personal`, payload),
    ).pipe(
      map((data) => this.normalize(data)),
      tap((data) => this.storeCache(this.currentUserKey(), data)),
    );
  }

  listAddresses(): Observable<AddressListResponse> {
    return this.wrap(
      this.http.get<ApiSuccess<AddressListResponse>>(`${this.baseUrl}/addresses`),
    );
  }

  createAddress(payload: AddressPayload): Observable<AddressListResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<AddressListResponse>>(`${this.baseUrl}/addresses`, payload),
    ).pipe(tap(() => this.invalidate()));
  }

  updateAddress(addressId: string, payload: AddressPayload): Observable<AddressListResponse> {
    return this.wrap(
      this.http.put<ApiSuccess<AddressListResponse>>(
        `${this.baseUrl}/addresses/${addressId}`,
        payload,
      ),
    ).pipe(tap(() => this.invalidate()));
  }

  deleteAddress(addressId: string): Observable<AddressListResponse> {
    return this.wrap(
      this.http.delete<ApiSuccess<AddressListResponse>>(
        `${this.baseUrl}/addresses/${addressId}`,
      ),
    ).pipe(tap(() => this.invalidate()));
  }

  setDefaultAddress(addressId: string): Observable<AddressListResponse> {
    return this.wrap(
      this.http.post<ApiSuccess<AddressListResponse>>(
        `${this.baseUrl}/addresses/${addressId}/default`,
        {},
      ),
    ).pipe(tap(() => this.invalidate()));
  }

  /** Drop cached profile (logout, address change, explicit refresh). */
  invalidate(): void {
    this.cache = null;
  }

  clearError(): void {
    this.errorSignal.set(null);
  }

  private normalize(data: ProfileResponse): ProfileResponse {
    return {
      ...data,
      addresses: data.addresses ?? (data.address ? [data.address] : []),
    };
  }

  private storeCache(userKey: string, data: ProfileResponse): void {
    if (!userKey) {
      this.cache = null;
      return;
    }
    this.cache = {
      userKey,
      data,
      expiresAt: Date.now() + PROFILE_TTL_MS,
    };
  }

  private currentUserKey(): string {
    const user = this.tokens.user();
    return user?.id || user?.uuid || '';
  }

  private wrap<T>(source: Observable<ApiSuccess<T>>): Observable<T> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return source.pipe(
      map((res) => res.data),
      tap(() => this.loadingSignal.set(false)),
      catchError((err: unknown) => {
        this.loadingSignal.set(false);
        this.errorSignal.set(this.extractError(err));
        return throwError(() => err);
      }),
    );
  }

  private extractError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (
        err as {
          error?: {
            message?: string;
            details?: Array<{ path?: string; message?: string }> | unknown;
          };
        }
      ).error;
      const details = Array.isArray(body?.details) ? body.details : [];
      const dobDetail = details.find((d) => String(d?.path ?? '') === 'dob')?.message;
      const genderDetail = details.find((d) => String(d?.path ?? '') === 'gender')?.message;
      if (dobDetail && genderDetail) return `${dobDetail} ${genderDetail}`;
      if (dobDetail) return dobDetail;
      if (genderDetail) return genderDetail;
      if (body?.message) return body.message;
    }
    return 'Unable to complete profile request.';
  }
}
