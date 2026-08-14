import { api } from '../lib/apiClient';
import { resolveMediaUrl } from '../utils/mediaUrl';

export interface DownPaymentContext {
  applicationId: string;
  applicationNumber: string;
  orderNumber: string | null;
  orderId: string | null;
  status: string;
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  approvedLoanAmount: number;
  approvedDownPayment: number;
  remainingFinancedAmount: number;
  paymentSummary: {
    downPayment: number;
    processingFee: number;
    gst: number;
    totalPayableToday: number;
  };
  razorpayKeyId: string;
  paymentDevBypass: boolean;
  currency: string;
  canPay: boolean;
}

export interface CreateDownPaymentOrderResponse {
  applicationId: string;
  applicationNumber: string;
  transactionId: string;
  razorpayOrderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  paymentDevBypass: boolean;
  customer: { name: string; email: string; contact: string };
  prefill: { name: string; email: string; contact: string };
}

export interface VerifyDownPaymentResponse {
  paymentStatus: string;
  alreadyProcessed: boolean;
  transactionId: string;
  applicationId: string;
  applicationNumber: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  loanAccountNumber: string | null;
  amount: number;
  currency: string;
  nextStep: string;
}

export async function getDownPaymentContext(
  applicationId?: string,
): Promise<DownPaymentContext> {
  const res = await api.get(
    applicationId
      ? `/payments/down-payment?applicationId=${encodeURIComponent(applicationId)}`
      : '/payments/down-payment',
  );
  const data = res.data as DownPaymentContext;
  return {
    ...data,
    productImage: resolveMediaUrl(data?.productImage),
  };
}

export async function createDownPaymentOrder(
  applicationId?: string,
): Promise<CreateDownPaymentOrderResponse> {
  const res = await api.post('/payments/create-order', {
    ...(applicationId ? { applicationId } : {}),
  });
  return res.data;
}

export async function verifyDownPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyDownPaymentResponse> {
  const res = await api.post('/payments/verify', payload);
  return res.data;
}

export async function createDownPaymentDevBypassSignature(
  razorpayOrderId: string,
): Promise<{
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}> {
  const res = await api.post('/payments/dev-bypass-signature', { razorpayOrderId });
  return res.data;
}
