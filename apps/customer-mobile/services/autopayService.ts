import { api } from '../lib/apiClient';
import type {
  AutopayHistoryResponse,
  AutopayMandate,
  AutopayStatus,
} from '../types';

export type { AutopayHistoryResponse, AutopayMandate, AutopayStatus };

export async function getAutopayStatus(): Promise<AutopayStatus> {
  const res = await api.get('/autopay/status');
  return res.data as AutopayStatus;
}

export async function createMandate(payload: {
  paymentMethod: string;
  bankName?: string;
  upiId?: string;
  maximumDebitAmount?: number;
}): Promise<AutopayMandate> {
  const res = await api.post('/autopay/create-mandate', payload);
  return res.data as AutopayMandate;
}

/**
 * Bank-account eMandate via existing Autopay API.
 * Does not send a UPI ID. Backend creates the Razorpay subscription.
 */
export async function createEmandate(payload?: {
  bankName?: string;
  maximumDebitAmount?: number;
}): Promise<AutopayMandate> {
  return createMandate({
    paymentMethod: 'EMANDATE',
    bankName: payload?.bankName,
    maximumDebitAmount: payload?.maximumDebitAmount,
  });
}

export async function cancelMandate(): Promise<AutopayMandate> {
  const res = await api.post('/autopay/cancel-mandate', {});
  return res.data as AutopayMandate;
}

export async function getAutopayHistory(): Promise<AutopayHistoryResponse> {
  const res = await api.get('/autopay/history');
  return res.data as AutopayHistoryResponse;
}

export function extractAutopayError(err: unknown): string {
  const httpErr = err as {
    status?: number;
    code?: string;
    message?: string;
  };
  if (httpErr?.status === 401 || httpErr?.code === 'SESSION_EXPIRED') {
    return 'Please sign in again to manage Auto EMI.';
  }
  if (httpErr?.status === 409) {
    return httpErr.message || 'An AutoPay mandate already exists for this loan.';
  }
  if (httpErr?.status === 404) {
    return httpErr.message || 'AutoPay details not found. Complete down payment first.';
  }
  if (httpErr?.status === 403) {
    return httpErr.message || 'Auto EMI is only available for an active EMI loan.';
  }
  return httpErr?.message || 'Something went wrong. Please try again.';
}
