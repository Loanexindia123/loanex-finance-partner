import api from './api';
import { EmiApplicationStatus } from '../types/emiApplication';
import { FiCaseStatus } from '../types/fiCase';

// ==================== EMI Applications ====================

export interface EmiApplication {
  id: string;
  customerName: string;
  mobile: string;
  selectedProduct: string;
  requestedLoanAmount: number;
  emiPlan: string;
  applicationDate: string;
  status: EmiApplicationStatus;

  // Backend fields if present
  userId?: string;
  orderId?: string;
  productId?: string;
  emiPlanId?: string;
  totalAmount?: number;
  downPayment?: number;
  monthlyEmi?: number;
  tenure?: number;
  loanId?: string;
  loanAccountNumber?: string;
  loanStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

function toDateString(value: any): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function mapEmiApplication(raw: any): EmiApplication {
  const rawStatus = String(raw.status || '').toUpperCase();
  let status: EmiApplicationStatus = 'pending';
  if (
    rawStatus === 'APPROVED' ||
    rawStatus === 'ACTIVE' ||
    rawStatus === 'ACTIVE_EMI' ||
    rawStatus === 'OFFER_ACCEPTED' ||
    rawStatus === 'DOWN_PAYMENT_PENDING' ||
    rawStatus === 'DOWN_PAYMENT_COMPLETED' ||
    rawStatus === 'ORDER_CONFIRMED'
  ) {
    status = 'approved';
  } else if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED_BY_CUSTOMER') {
    status = 'rejected';
  } else if (rawStatus === 'UNDER_REVIEW' || rawStatus === 'REVIEW') {
    status = 'under_review';
  } else if (rawStatus === 'HOLD' || rawStatus === 'ON_HOLD') {
    status = 'hold';
  }

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
    mobile:
      raw.mobile || raw.userMobile || raw.customer?.mobile || raw.profile?.mobile_number || '',
    selectedProduct:
      raw.selectedProduct ||
      raw.productName ||
      raw.product?.name ||
      raw.productId ||
      'Product',
    requestedLoanAmount:
      typeof raw.requestedLoanAmount === 'number'
        ? raw.requestedLoanAmount
        : typeof raw.requestedAmount === 'number'
          ? raw.requestedAmount
          : typeof raw.approvedAmount === 'number'
            ? raw.approvedAmount
            : raw.totalAmount || 0,
    emiPlan,
    applicationDate: raw.applicationDate || toDateString(raw.createdAt) || toDateString(raw.submittedAt),
    status,
    userId: raw.userId,
    orderId: raw.orderId,
    productId: raw.productId,
    emiPlanId: raw.emiPlanId ?? raw.planId,
    totalAmount: raw.totalAmount,
    downPayment: raw.downPayment ?? raw.requestedDownPayment,
    monthlyEmi: raw.monthlyEmi ?? raw.estimatedMonthlyEmi,
    tenure: raw.approvedTenure ?? tenure,
    loanId: raw.loanId ?? undefined,
    loanAccountNumber: raw.loanAccountNumber ?? undefined,
    loanStatus: raw.loanStatus ?? undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Get ALL EMI applications (admin endpoint)
 */
export const getAllEmiApplications = async (): Promise<EmiApplication[]> => {
  const response = await api.get('/admin/emi-applications');
  const data = response.data.data || [];
  const list = Array.isArray(data) ? data : data.items || [];
  return list.map(mapEmiApplication);
};

/**
 * Get single EMI application detail (admin endpoint)
 */
export const getEmiApplicationById = async (applicationId: string): Promise<EmiApplication | null> => {
  try {
    const response = await api.get(`/admin/emi-applications/${applicationId}`);
    if (response.data.data) {
      return mapEmiApplication(response.data.data);
    }
  } catch (error) {
    // Fallback: search in full list
  }
  const all = await getAllEmiApplications();
  return all.find((app) => app.id === applicationId) || null;
};

/**
 * Assign Field Investigation for an EMI application (does not approve the loan).
 */
export const assignFiForApplication = async (applicationId: string): Promise<FiCase> => {
  const response = await api.post(`/admin/emi-applications/${applicationId}/assign-fi`);
  return mapFiCase(response.data.data);
};

/**
 * Approve an EMI application (admin endpoint)
 */
export const approveEmiApplication = async (applicationId: string): Promise<any> => {
  const response = await api.post(`/admin/emi-applications/${applicationId}/approve`);
  return response.data.data;
};

/**
 * Reject an EMI application (admin endpoint)
 */
export const rejectEmiApplication = async (
  applicationId: string,
  reason: string,
): Promise<any> => {
  const response = await api.post(`/admin/emi-applications/${applicationId}/reject`, {
    reason,
  });
  return response.data.data;
};

/**
 * Edit the sanction (loan terms) and publish to the customer (admin endpoint).
 * The customer then sees the modified application and can accept (pay down
 * payment) or decline (application closes).
 */
export const modifyEmiApplicationTerms = async (
  applicationId: string,
  terms: {
    approvedAmount?: number;
    approvedTenure?: number;
    approvedDownPayment?: number;
    interestRate?: number;
    processingFee?: number;
    adminRemarks?: string;
  },
): Promise<any> => {
  const response = await api.patch(`/admin/emi-applications/${applicationId}/terms`, terms);
  return response.data.data;
};

// ==================== FI Cases ====================

export interface FiCase {
  id: string;
  customerName: string;
  mobile: string;
  productName: string;
  assignedExecutive: string;
  assignedDate: string;
  status: FiCaseStatus;
  applicationId?: string;
  photoCount?: number;
  gpsLocation?: string;
  remarks?: string;
}

export function mapFiCase(raw: any): FiCase {
  const rawStatus = String(raw.status || '').toLowerCase();
  let status: FiCaseStatus = 'pending';
  if (rawStatus === 'completed') status = 'completed';
  else if (rawStatus === 'in_progress' || rawStatus === 'in-progress') status = 'in_progress';
  else if (rawStatus === 'hold' || rawStatus === 'on_hold') status = 'hold';
  else if (rawStatus === 'pending') status = 'pending';

  return {
    id: raw.id || '',
    customerName: raw.customerName || raw.customer?.fullName || 'Customer',
    mobile: raw.mobile || raw.customer?.mobile || '',
    productName: raw.productName || 'Product',
    assignedExecutive: raw.assignedExecutive || 'Unassigned',
    assignedDate: raw.assignedDate || (raw.createdAt ? raw.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    status,
    applicationId: raw.applicationId,
    photoCount: raw.photoCount ?? 0,
    gpsLocation: raw.gpsLocation || '',
    remarks: raw.remarks || '',
  };
}

/**
 * Get ALL FI cases (admin endpoint)
 */
export const getAllFiCases = async (): Promise<FiCase[]> => {
  try {
    const response = await api.get('/admin/fi-cases');
    const data = response.data.data || [];
    const list = Array.isArray(data) ? data : data.items || [];
    return list.map(mapFiCase);
  } catch (error) {
    return [];
  }
};

/**
 * Get single FI case detail (admin endpoint)
 */
export const getFiCaseById = async (fiCaseId: string): Promise<FiCase | null> => {
  try {
    const response = await api.get(`/admin/fi-cases/${fiCaseId}`);
    if (response.data.data) {
      return mapFiCase(response.data.data);
    }
  } catch (error) {
    // Fallback: search in full list
  }
  const all = await getAllFiCases();
  return all.find((item) => item.id === fiCaseId) || null;
};

/**
 * Update FI case (admin endpoint)
 */
export const updateFiCase = async (fiCaseId: string, data: Partial<FiCase>): Promise<FiCase> => {
  const response = await api.patch(`/admin/fi-cases/${fiCaseId}`, data);
  return mapFiCase(response.data.data);
};

// ==================== Loans ====================

export interface LoanScheduleRow {
  id: string;
  emiNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  emiAmount: number;
  remainingBalance: number;
  paymentStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'FAILED';
  paidAt?: string | null;
}

export interface Loan {
  id: string;
  loanAccountNumber: string;
  applicationId: string;
  applicationNumber: string;
  userId: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  productPrice: number;
  loanAmount: number;
  downPaymentPaid: number;
  processingFee: number;
  interestRate: number;
  loanTenure: number;
  emiAmount: number;
  totalInterest: number;
  totalPayable: number;
  outstandingAmount: number;
  paidAmount: number;
  nextEmiDueDate: string | null;
  lastPaymentDate: string | null;
  loanStatus: 'ACTIVE' | 'CLOSED';
  loanStartDate: string | null;
  loanEndDate: string | null;
  createdAt: string;
  updatedAt: string;
  // List payload extras
  customer?: { userId: string; fullName: string; email: string; mobile: string } | null;
  // Details payload extras
  application?: {
    id: string;
    applicationNumber: string;
    status: string;
    productName: string;
    adminRemarks?: string | null;
    rejectionReason?: string | null;
  } | null;
  schedule?: LoanScheduleRow[];
}

export function mapLoan(raw: any): Loan {
  return {
    id: String(raw.id ?? ''),
    loanAccountNumber: String(raw.loanAccountNumber ?? raw.id ?? ''),
    applicationId: String(raw.applicationId ?? ''),
    applicationNumber: String(raw.applicationNumber ?? raw.applicationId ?? ''),
    userId: String(raw.userId ?? ''),
    productId: String(raw.productId ?? ''),
    productName: String(raw.productName ?? 'Product'),
    productImage: raw.productImage ?? null,
    productPrice: Number(raw.productPrice ?? 0),
    loanAmount: Number(raw.loanAmount ?? 0),
    downPaymentPaid: Number(raw.downPaymentPaid ?? 0),
    processingFee: Number(raw.processingFee ?? 0),
    interestRate: Number(raw.interestRate ?? 0),
    loanTenure: Number(raw.loanTenure ?? 0),
    emiAmount: Number(raw.emiAmount ?? 0),
    totalInterest: Number(raw.totalInterest ?? 0),
    totalPayable: Number(raw.totalPayable ?? 0),
    outstandingAmount: Number(raw.outstandingAmount ?? 0),
    paidAmount: Number(raw.paidAmount ?? 0),
    nextEmiDueDate: raw.nextEmiDueDate ?? null,
    lastPaymentDate: raw.lastPaymentDate ?? null,
    loanStatus: raw.loanStatus === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
    loanStartDate: raw.loanStartDate ?? null,
    loanEndDate: raw.loanEndDate ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    customer: raw.customer ?? null,
    application: raw.application ?? null,
    schedule: Array.isArray(raw.schedule)
      ? raw.schedule.map((row: any) => ({
          id: String(row.id ?? ''),
          emiNumber: Number(row.emiNumber ?? 0),
          dueDate: row.dueDate ?? '',
          principalAmount: Number(row.principalAmount ?? 0),
          interestAmount: Number(row.interestAmount ?? 0),
          emiAmount: Number(row.emiAmount ?? 0),
          remainingBalance: Number(row.remainingBalance ?? 0),
          paymentStatus: row.paymentStatus ?? 'PENDING',
          paidAt: row.paidAt ?? null,
        }))
      : undefined,
  };
}

/**
 * Get ALL loans (admin endpoint)
 */
export const getAllLoans = async (): Promise<Loan[]> => {
  const response = await api.get('/admin/loans');
  const data = response.data.data || [];
  const list = Array.isArray(data) ? data : data.items || [];
  return list.map(mapLoan);
};

/**
 * Get a single loan detail (admin endpoint)
 */
export const getLoanById = async (loanId: string): Promise<Loan> => {
  const response = await api.get(`/admin/loans/${loanId}`);
  return mapLoan(response.data.data);
};

/**
 * Update loan details (admin endpoint)
 */
export const updateLoan = async (loanId: string, data: Partial<Loan>): Promise<Loan> => {
  const response = await api.patch(`/admin/loans/${loanId}`, data);
  return mapLoan(response.data.data);
};

/**
 * Get EMI schedule for a loan
 */
export const getLoanEmiSchedule = async (loanId: string): Promise<LoanScheduleRow[]> => {
  const response = await api.get(`/loans/${loanId}/emi-schedule`);
  const data = response.data.data;
  const list = Array.isArray(data) ? data : data?.items || [];
  return list.map((row: any) => ({
    id: String(row.id ?? ''),
    emiNumber: Number(row.emiNumber ?? 0),
    dueDate: row.dueDate ?? '',
    principalAmount: Number(row.principalAmount ?? 0),
    interestAmount: Number(row.interestAmount ?? 0),
    emiAmount: Number(row.emiAmount ?? 0),
    remainingBalance: Number(row.remainingBalance ?? 0),
    paymentStatus: row.paymentStatus ?? 'PENDING',
    paidAt: row.paidAt ?? null,
  }));
};

// ==================== EMI Payments ====================

export interface EmiPayment {
  id: string;
  type: 'DOWN_PAYMENT' | 'EMI';
  emiScheduleId: string | null;
  emiNumber: number | null;
  amount: number;
  paymentStatus: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function mapEmiPayment(raw: any): EmiPayment {
  return {
    id: String(raw.id ?? ''),
    type: raw.type === 'DOWN_PAYMENT' ? 'DOWN_PAYMENT' : 'EMI',
    emiScheduleId: raw.emiScheduleId ?? null,
    emiNumber: raw.emiNumber != null ? Number(raw.emiNumber) : null,
    amount: Number(raw.amount ?? 0),
    paymentStatus: String(raw.paymentStatus ?? 'PENDING'),
    razorpayOrderId: raw.razorpayOrderId ?? null,
    razorpayPaymentId: raw.razorpayPaymentId ?? null,
    paidAt: raw.paidAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Get the full payment history for a loan (down payment + EMI instalments,
 * newest first). Admin endpoint — requires the loanId query parameter.
 */
export const getAllEmiPayments = async (loanId?: string): Promise<EmiPayment[]> => {
  const url = loanId
    ? `/admin/emi-payments?loanId=${encodeURIComponent(loanId)}`
    : '/admin/emi-payments';
  const response = await api.get(url);
  const data = response.data.data || {};
  const items = Array.isArray(data) ? data : data.items || [];
  return items.map(mapEmiPayment);
};

// ==================== Autopay ====================

export interface Autopay {
  id: string;
  userId: string;
  loanId: string;
  status: string;
  createdAt: string;
}

/**
 * Get ALL autopay mandates (admin endpoint)
 */
export const getAllAutopay = async (): Promise<Autopay[]> => {
  const response = await api.get('/admin/autopay');
  const data = response.data.data || [];
  return Array.isArray(data) ? data : data.items || [];
};

/**
 * Get autopay for a specific loan (admin endpoint)
 */
export const getAutopayByLoanId = async (loanId: string): Promise<Autopay> => {
  const response = await api.get(`/admin/autopay/${loanId}`);
  return response.data.data;
};

/**
 * Update autopay settings (admin endpoint)
 */
export const updateAutopay = async (loanId: string, data: Partial<Autopay>): Promise<Autopay> => {
  const response = await api.patch(`/admin/autopay/${loanId}`, data);
  return response.data.data;
};
