import { api } from '../lib/apiClient';

// ─── Types (mirror the backend /payments/kyc-fee flow) ──────────────────────

export interface KycFeeStatus {
  paid: boolean;
  amount: number;
  purpose: string;
  paymentId: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
}

export interface CreateKycFeeOrderResponse {
  transactionId: string;
  razorpayOrderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  paymentDevBypass: boolean;
  purpose: string;
  customer: { name: string; email: string; contact: string };
  prefill: { name: string; email: string; contact: string };
  notes: Record<string, string>;
}

export interface VerifyKycFeeResponse {
  paymentStatus: 'SUCCESS';
  alreadyProcessed: boolean;
  purpose: string;
  amount: number;
  transactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  paidAt: string | null;
}

/** Lifetime one-time KYC verification fee status (₹399, backend-enforced). */
export async function getKycFeeStatus(): Promise<KycFeeStatus> {
  const res = await api.get('/payments/kyc-fee/status');
  return res.data;
}

/** Create the Razorpay order for the KYC verification fee. */
export async function createKycFeeOrder(): Promise<CreateKycFeeOrderResponse> {
  const res = await api.post('/payments/kyc-fee/create-order', {});
  return res.data;
}

/** Dev-only: sign a payment without Razorpay (PAYMENT_DEV_BYPASS=true). */
export async function createPaymentDevBypassSignature(razorpayOrderId: string): Promise<{
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}> {
  const res = await api.post('/payments/dev-bypass-signature', { razorpayOrderId });
  return res.data;
}

/** Verify the KYC fee payment (marks it SUCCESS server-side). */
export async function verifyKycFeePayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyKycFeeResponse> {
  const res = await api.post('/payments/kyc-fee/verify', payload);
  return res.data;
}
