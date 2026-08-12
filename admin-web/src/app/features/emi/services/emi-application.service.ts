import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { EmiApplication, EmiApplicationStatus } from '../models/emi-application.models';
import { FiCase, FiCaseStatus } from '../models/fi-case.models';

/**
 * Raw admin list payload — field names follow the backend serializer and the
 * fallbacks used by admin-app/src/services/emiService.ts `mapEmiApplication`.
 */
interface RawEmiCustomer {
  fullName?: string;
  mobile?: string;
}

interface RawEmiProfile {
  fullName?: string;
  mobile_number?: string;
}

interface RawEmiProduct {
  name?: string;
}

interface RawEmiApplication {
  id?: string;
  status?: string;
  customerName?: string;
  userName?: string;
  customer?: RawEmiCustomer;
  profile?: RawEmiProfile;
  userId?: string;
  mobile?: string;
  userMobile?: string;
  selectedProduct?: string;
  productName?: string;
  product?: RawEmiProduct;
  productId?: string;
  requestedLoanAmount?: number;
  requestedAmount?: number;
  approvedAmount?: number;
  totalAmount?: number;
  planName?: string;
  requestedTenure?: number | string;
  approvedTenure?: number | string;
  tenure?: number | string;
  applicationDate?: string;
  createdAt?: string;
  submittedAt?: string;
  orderId?: string;
  emiPlanId?: string;
  planId?: string;
  downPayment?: number;
  requestedDownPayment?: number;
  monthlyEmi?: number;
  estimatedMonthlyEmi?: number;
  interestRate?: number;
  processingFee?: number;
  loanId?: string;
  loanAccountNumber?: string;
  loanStatus?: string;
  rejectionReason?: string | null;
  updatedAt?: string;
}

interface ListedPayload {
  items?: unknown[];
}

function extractList<T>(data: T[] | ListedPayload | null | undefined): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  return (data?.items as T[] | undefined) ?? [];
}

function toDateString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapStatus(rawStatus: string): EmiApplicationStatus {
  const status = String(rawStatus || '').toUpperCase();
  if (
    status === 'APPROVED' ||
    status === 'ACTIVE' ||
    status === 'ACTIVE_EMI' ||
    status === 'OFFER_ACCEPTED' ||
    status === 'DOWN_PAYMENT_PENDING' ||
    status === 'DOWN_PAYMENT_COMPLETED' ||
    status === 'ORDER_CONFIRMED'
  ) {
    return 'approved';
  }
  if (status === 'REJECTED' || status === 'DECLINED_BY_CUSTOMER') {
    return 'rejected';
  }
  if (status === 'UNDER_REVIEW' || status === 'REVIEW') {
    return 'under_review';
  }
  if (status === 'HOLD' || status === 'ON_HOLD') {
    return 'hold';
  }
  return 'pending';
}

/** Same mapping as admin-app `mapEmiApplication`. */
export function mapEmiApplication(raw: RawEmiApplication): EmiApplication {
  const tenure = raw.requestedTenure ?? raw.approvedTenure ?? raw.tenure;
  const emiPlan =
    raw.planName ||
    (typeof tenure === 'number' || typeof tenure === 'string' ? `${tenure} Months Plan` : '');

  return {
    id: raw.id || '',
    customerName:
      raw.customerName ||
      raw.userName ||
      raw.customer?.fullName ||
      raw.profile?.fullName ||
      (raw.userId ? `User ${String(raw.userId).slice(-4)}` : 'Customer'),
    mobile: raw.mobile || raw.userMobile || raw.customer?.mobile || raw.profile?.mobile_number || '',
    selectedProduct:
      raw.selectedProduct || raw.productName || raw.product?.name || raw.productId || 'Product',
    requestedLoanAmount:
      typeof raw.requestedLoanAmount === 'number'
        ? raw.requestedLoanAmount
        : typeof raw.requestedAmount === 'number'
          ? raw.requestedAmount
          : typeof raw.approvedAmount === 'number'
            ? raw.approvedAmount
            : raw.totalAmount || 0,
    emiPlan,
    applicationDate:
      raw.applicationDate || toDateString(raw.createdAt) || toDateString(raw.submittedAt),
    status: mapStatus(raw.status || ''),
    userId: raw.userId,
    orderId: raw.orderId,
    productId: raw.productId,
    emiPlanId: raw.emiPlanId ?? raw.planId,
    totalAmount: raw.totalAmount,
    downPayment: raw.downPayment ?? raw.requestedDownPayment,
    monthlyEmi: raw.monthlyEmi ?? raw.estimatedMonthlyEmi,
    tenure: (raw.approvedTenure ?? tenure) as number | undefined,
    interestRate: typeof raw.interestRate === 'number' ? raw.interestRate : undefined,
    processingFee: typeof raw.processingFee === 'number' ? raw.processingFee : undefined,
    loanId: raw.loanId ?? undefined,
    loanAccountNumber: raw.loanAccountNumber ?? undefined,
    loanStatus: raw.loanStatus ?? undefined,
    rejectionReason: raw.rejectionReason ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface ModifyEmiTermsPayload {
  approvedAmount?: number;
  approvedTenure?: number;
  approvedDownPayment?: number;
  interestRate?: number;
  processingFee?: number;
  adminRemarks?: string;
}

interface RawFiCase {
  id?: string;
  customerName?: string;
  customer?: { fullName?: string; mobile?: string };
  mobile?: string;
  productName?: string;
  assignedExecutive?: string;
  assignedDate?: string;
  createdAt?: string;
  status?: string;
  applicationId?: string;
  photoCount?: number;
  gpsLocation?: string;
  remarks?: string;
}

function mapFiStatus(rawStatus: string): FiCaseStatus {
  const status = String(rawStatus || '').toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'in_progress' || status === 'in-progress') return 'in_progress';
  if (status === 'hold' || status === 'on_hold') return 'hold';
  return 'pending';
}

export function mapFiCase(raw: RawFiCase): FiCase {
  return {
    id: raw.id || '',
    customerName: raw.customerName || raw.customer?.fullName || 'Customer',
    mobile: raw.mobile || raw.customer?.mobile || '',
    productName: raw.productName || 'Product',
    assignedExecutive: raw.assignedExecutive || 'Unassigned',
    assignedDate:
      raw.assignedDate ||
      (raw.createdAt ? String(raw.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
    status: mapFiStatus(raw.status || ''),
    applicationId: raw.applicationId,
    photoCount: raw.photoCount ?? 0,
    gpsLocation: raw.gpsLocation || '',
    remarks: raw.remarks || '',
  };
}

export function findFiCaseForApplication(
  application: EmiApplication,
  fiCases: FiCase[],
): FiCase | undefined {
  if (application.id) {
    const linked = fiCases.find((fiCase) => fiCase.applicationId === application.id);
    if (linked) return linked;
  }
  return fiCases.find(
    (fiCase) =>
      fiCase.customerName === application.customerName && fiCase.mobile === application.mobile,
  );
}

@Injectable({ providedIn: 'root' })
export class EmiApplicationService {
  private readonly http = inject(HttpClient);

  list(): Observable<EmiApplication[]> {
    return this.http
      .get<ApiEnvelope<RawEmiApplication[] | ListedPayload>>(apiUrl('/admin/emi-applications'))
      .pipe(
        unwrapApi(),
        map((payload) => extractList<RawEmiApplication>(payload).map(mapEmiApplication)),
      );
  }

  getById(applicationId: string): Observable<EmiApplication | null> {
    return this.http
      .get<ApiEnvelope<RawEmiApplication>>(apiUrl(`/admin/emi-applications/${applicationId}`))
      .pipe(
        unwrapApi(),
        map((payload) => (payload ? mapEmiApplication(payload) : null)),
        catchError(() =>
          this.list().pipe(map((items) => items.find((item) => item.id === applicationId) ?? null)),
        ),
      );
  }

  assignFi(applicationId: string): Observable<FiCase> {
    return this.http
      .post<ApiEnvelope<RawFiCase>>(apiUrl(`/admin/emi-applications/${applicationId}/assign-fi`), {})
      .pipe(
        unwrapApi(),
        map((raw) => mapFiCase(raw as RawFiCase)),
      );
  }

  approve(applicationId: string): Observable<unknown> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl(`/admin/emi-applications/${applicationId}/approve`), {})
      .pipe(unwrapApi());
  }

  reject(applicationId: string, reason: string): Observable<unknown> {
    return this.http
      .post<ApiEnvelope<unknown>>(apiUrl(`/admin/emi-applications/${applicationId}/reject`), {
        reason,
      })
      .pipe(unwrapApi());
  }

  modifyTerms(applicationId: string, terms: ModifyEmiTermsPayload): Observable<unknown> {
    return this.http
      .patch<ApiEnvelope<unknown>>(apiUrl(`/admin/emi-applications/${applicationId}/terms`), terms)
      .pipe(unwrapApi());
  }

  listFiCases(): Observable<FiCase[]> {
    return this.http.get<ApiEnvelope<RawFiCase[] | ListedPayload>>(apiUrl('/admin/fi-cases')).pipe(
      unwrapApi(),
      map((payload) => extractList<RawFiCase>(payload).map(mapFiCase)),
      catchError(() => of([])),
    );
  }
}
