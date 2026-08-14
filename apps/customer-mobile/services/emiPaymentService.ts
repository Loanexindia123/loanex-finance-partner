import { api } from '../lib/apiClient';
import { resolveMediaUrl } from '../utils/mediaUrl';

// ─── Types (mirror the backend /emi/payments responses) ─────────────────────

export interface EmiPaymentDetails {
  emiId: string;
  loan: {
    id: string;
    loanAccountNumber: string;
    applicationNumber: string;
    productName: string | null;
    productImage: string;
    loanStatus: string;
  };
  emi: {
    emiNumber: number;
    dueDate: string;
    principalAmount: number;
    interestAmount: number;
    lateFee: number;
    gst: number;
    totalPayable: number;
    paymentStatus: string;
    paidAt: string | null;
    transactionId: string | null;
  };
  paymentSummary: {
    principal: number;
    interest: number;
    penalty: number;
    gst: number;
    grandTotal: number;
  };
  paymentMethod: { provider: string; label: string };
  canPay: boolean;
  alreadyPaid: boolean;
  paymentDevBypass: boolean;
  existingPayment?: {
    id: string;
    paymentStatus: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
  } | null;
  receiptAvailable: boolean;
}

export interface CreateEmiPaymentOrderResponse {
  emiId: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  paymentDevBypass: boolean;
  paymentSummary: EmiPaymentDetails['paymentSummary'];
  prefill: { name: string; email: string; contact: string };
  notes: Record<string, string>;
}

export interface VerifyEmiPaymentResponse {
  success: boolean;
  alreadyProcessed: boolean;
  emiId: string;
  emiNumber?: number;
  paymentId: string | null;
  paidAmount?: number;
  outstandingAmount?: number;
  remainingEmis?: number;
  nextEmiDueDate?: string | null;
  receiptAvailable?: boolean;
  message: string;
}

export interface LoanDashboardScheduleItem {
  id: string;
  emiNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  emiAmount: number;
  remainingBalance: number;
  paymentStatus: string;
  paidAt: string | null;
}

export interface LoanDashboard {
  canPayEmi: boolean;
  loan: {
    id: string;
    loanAccountNumber: string;
    applicationId: string;
    applicationNumber: string;
    productId: string;
    productName: string;
    productImage: string;
    loanAmount: number;
    emiAmount: number;
    interestRate: number;
    loanTenure: number;
    loanStartDate: string;
    loanEndDate: string;
    loanStatus: string;
    downPaymentPaid: boolean;
    outstandingAmount: number;
    paidAmount: number;
    nextEmiDueDate: string | null;
    lastPaymentDate: string | null;
  };
  summary: {
    outstandingBalance: number;
    totalLoanAmount: number;
    totalInterest: number;
    totalPayable: number;
    emisPaid: number;
    remainingEmis: number;
    nextEmiAmount: number;
    nextEmiDueDate: string | null;
  };
  nextEmi: {
    id: string;
    emiNumber: number;
    amount: number;
    dueDate: string;
    daysRemaining: number;
    status: string;
  } | null;
  schedule: LoanDashboardScheduleItem[];
  recentPayments: Array<{
    emiId: string;
    emiNumber: number;
    dueDate: string;
    paidDate: string;
    amount: number;
    status: string;
    receiptAvailable: boolean;
  }>;
}

// ─── Loan dashboard (drives the My EMIs tab) ────────────────────────────────

export async function getLoanDashboard(): Promise<LoanDashboard | null> {
  const res = await api.get('/loans/dashboard');
  const data = res.data ?? null;
  // Backend returns 200 with loan: null when the user has no EMI loans yet.
  if (!data?.loan) return null;
  return {
    ...data,
    loan: {
      ...data.loan,
      productImage: resolveMediaUrl(data.loan.productImage),
    },
  } as LoanDashboard;
}

// ─── EMI payment ─────────────────────────────────────────────────────────────

export async function getEmiPaymentDetails(emiId: string): Promise<EmiPaymentDetails> {
  const res = await api.get(`/emi/payments/${emiId}`);
  const data = res.data as EmiPaymentDetails;
  return {
    ...data,
    loan: {
      ...data.loan,
      productImage: resolveMediaUrl(data.loan?.productImage),
    },
  };
}

export async function createEmiPaymentOrder(emiId: string): Promise<CreateEmiPaymentOrderResponse> {
  const res = await api.post('/emi/payments/create-order', { emiId });
  return res.data;
}

export async function verifyEmiPayment(payload: {
  emiId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyEmiPaymentResponse> {
  const res = await api.post('/emi/payments/verify', payload);
  return res.data;
}

export async function createDevBypassSignature(razorpayOrderId: string): Promise<{
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  emiId: string | null;
}> {
  const res = await api.post('/emi/payments/dev-bypass-signature', { razorpayOrderId });
  return res.data;
}

export async function downloadEmiReceipt(emiId: string): Promise<Blob> {
  const { SERVER_URL } = await import('../constants/config');
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const token = await AsyncStorage.getItem('@loanex_access_token');
  const res = await fetch(`${SERVER_URL}/api/v1/emi/payments/${emiId}/receipt`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Receipt download failed');
  return res.blob();
}
