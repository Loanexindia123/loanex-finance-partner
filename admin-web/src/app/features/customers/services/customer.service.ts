import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import {
  AdminUserRecord,
  Customer,
  CustomerActivity,
  CustomerDetailBundle,
  CustomerEmiApplication,
  CustomerLoan,
  KycRecord,
} from '../models/customer.models';

/** End-user accounts — auth stores `authenticated`; older rows may still say `customer`. */
function isCustomerRole(role: string | null | undefined): boolean {
  const value = String(role ?? '')
    .trim()
    .toLowerCase();
  return value === 'customer' || value === 'authenticated' || value === 'user';
}

function asList<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.items ?? [];
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value;
  try {
    return new Date(value as string | number | Date).toISOString();
  } catch {
    return null;
  }
}

/**
 * Backend has no GET /admin/users/:id — customer detail is composed from
 * list + KYC + activity + loans + EMI applications.
 */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  list(): Observable<Customer[]> {
    return forkJoin({
      users: this.http
        .get<ApiEnvelope<AdminUserRecord[]>>(apiUrl('/admin/users'))
        .pipe(unwrapApi()),
      kyc: this.http
        .get<ApiEnvelope<KycRecord[]>>(apiUrl('/admin/kyc'))
        .pipe(
          unwrapApi(),
          catchError(() => of([] as KycRecord[])),
        ),
    }).pipe(
      map(({ users, kyc }) =>
        users
          .filter((u) => isCustomerRole(u.role) && !u.roleId)
          .map((u) => ({
            ...u,
            kyc: this.findKycForUser(kyc, u.id),
          })),
      ),
    );
  }

  getById(userId: string): Observable<Customer | undefined> {
    return this.getDetail(userId).pipe(map((bundle) => bundle?.customer));
  }

  /** Full customer profile bundle used by the View screen. */
  getDetail(userId: string): Observable<CustomerDetailBundle | undefined> {
    return forkJoin({
      users: this.http
        .get<ApiEnvelope<AdminUserRecord[]>>(apiUrl('/admin/users'))
        .pipe(unwrapApi()),
      kyc: this.http
        .get<ApiEnvelope<KycRecord[]>>(apiUrl(`/admin/users/${userId}/kyc`))
        .pipe(
          unwrapApi(),
          catchError(() => of([] as KycRecord[])),
        ),
      activity: this.http
        .get<ApiEnvelope<CustomerActivity[]>>(apiUrl(`/admin/users/${userId}/activity`))
        .pipe(
          unwrapApi(),
          catchError(() => of([] as CustomerActivity[])),
        ),
      loans: this.http
        .get<ApiEnvelope<CustomerLoan[] | { items?: unknown[] }>>(apiUrl('/admin/loans'))
        .pipe(
          unwrapApi(),
          catchError(() => of({ items: [] })),
        ),
      emi: this.http
        .get<ApiEnvelope<CustomerEmiApplication[] | { items?: unknown[] }>>(
          apiUrl('/admin/emi-applications'),
        )
        .pipe(
          unwrapApi(),
          catchError(() => of({ items: [] })),
        ),
    }).pipe(
      map(({ users, kyc, activity, loans, emi }) => {
        const user = users.find((u) => u.id === userId && isCustomerRole(u.role) && !u.roleId);
        if (!user) return undefined;

        const customer: Customer = {
          ...user,
          kyc: kyc[0] ?? null,
        };

        return {
          customer,
          activity: (Array.isArray(activity) ? activity : []).slice().sort((a, b) => {
            const ta = new Date(a.createdAt ?? 0).getTime();
            const tb = new Date(b.createdAt ?? 0).getTime();
            return tb - ta;
          }),
          loans: this.normalizeLoans(asList(loans as { items?: unknown[] }), userId),
          emiApplications: this.normalizeEmiApps(asList(emi as { items?: unknown[] }), userId),
        };
      }),
    );
  }

  private findKycForUser(records: KycRecord[], userId: string): KycRecord | null {
    return (
      records.find((k) => k.userId === userId) ??
      records.find((k) => (k as { profileId?: string }).profileId === userId) ??
      null
    );
  }

  private normalizeLoans(rows: unknown[], userId: string): CustomerLoan[] {
    return rows
      .map((row): CustomerLoan | null => {
        const raw = row as Record<string, unknown>;
        const customer = (raw['customer'] ?? {}) as Record<string, unknown>;
        const customerId = String(customer['id'] ?? raw['userId'] ?? '');
        if (customerId && customerId !== userId) return null;
        // If customer object missing id, skip rather than attach wrong loans.
        if (!customerId) return null;

        return {
          id: String(raw['id'] ?? ''),
          loanAccountNumber: (raw['loanAccountNumber'] as string) ?? undefined,
          applicationId: (raw['applicationId'] as string) ?? undefined,
          applicationNumber: (raw['applicationNumber'] as string) ?? null,
          productId: (raw['productId'] as string) ?? undefined,
          productName: (raw['productName'] as string) ?? undefined,
          loanAmount: toNumber(raw['loanAmount']),
          emiAmount: toNumber(raw['emiAmount']),
          loanTenure: toNumber(raw['loanTenure'], 0) || null,
          interestRate: raw['interestRate'] == null ? null : toNumber(raw['interestRate']),
          outstandingAmount: toNumber(raw['outstandingAmount']),
          paidAmount: toNumber(raw['paidAmount']),
          loanStatus: String(raw['loanStatus'] ?? raw['status'] ?? 'UNKNOWN'),
          nextEmiDueDate: toIso(raw['nextEmiDueDate']),
          lastPaymentDate: toIso(raw['lastPaymentDate']),
          loanStartDate: toIso(raw['loanStartDate']),
          loanEndDate: toIso(raw['loanEndDate']),
          createdAt: toIso(raw['createdAt']),
          customerId,
        };
      })
      .filter((row): row is CustomerLoan => !!row && !!row.id);
  }

  private normalizeEmiApps(rows: unknown[], userId: string): CustomerEmiApplication[] {
    return rows
      .map((row): CustomerEmiApplication | null => {
        const raw = row as Record<string, unknown>;
        const customer = (raw['customer'] ?? {}) as Record<string, unknown>;
        const ownerId = String(raw['userId'] ?? customer['userId'] ?? '');
        if (ownerId !== userId) return null;

        return {
          id: String(raw['id'] ?? ''),
          applicationNumber: String(raw['applicationNumber'] ?? raw['id'] ?? ''),
          userId: ownerId,
          productName: (raw['productName'] as string) ?? undefined,
          sellingPrice: toNumber(raw['sellingPrice']),
          requestedAmount: toNumber(raw['requestedAmount']),
          monthlyEmi: toNumber(raw['monthlyEmi'] ?? raw['estimatedMonthlyEmi']),
          estimatedMonthlyEmi: toNumber(raw['estimatedMonthlyEmi']),
          approvedAmount:
            raw['approvedAmount'] == null ? null : toNumber(raw['approvedAmount']),
          approvedTenure:
            raw['approvedTenure'] == null ? null : toNumber(raw['approvedTenure']),
          interestRate: raw['interestRate'] == null ? null : toNumber(raw['interestRate']),
          status: String(raw['status'] ?? 'PENDING'),
          submittedAt: toIso(raw['submittedAt']),
          createdAt: toIso(raw['createdAt']),
        };
      })
      .filter((row): row is CustomerEmiApplication => !!row && !!row.id);
  }
}
