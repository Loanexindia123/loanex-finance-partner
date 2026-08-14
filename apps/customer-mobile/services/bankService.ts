import { api } from '../lib/apiClient';

export type BankAccountType = 'SAVINGS' | 'CURRENT';

export interface VerifyBankPayload {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  accountType: BankAccountType;
}

export interface BankStatus {
  bankVerified: boolean;
  accountNumberMasked: string | null;
  bankName: string | null;
  accountType: string | null;
  ifscCode: string | null;
  status: string | null;
  verifiedAt: string | null;
}

export interface BankVerifyResult {
  success: boolean;
  message: string;
  bankVerified: boolean;
  accountNumberMasked: string | null;
  bankName: string | null;
  alreadyVerified?: boolean;
  error?: string;
}

/** GET /verification/bank/status — reuse existing backend status. */
export async function getBankStatus(): Promise<BankStatus> {
  const res = await api.get('/verification/bank/status');
  const data = res.data ?? {};
  return {
    bankVerified: Boolean(data.bankVerified),
    accountNumberMasked: data.accountNumberMasked ?? null,
    bankName: data.bankName ?? null,
    accountType: data.accountType ?? null,
    ifscCode: data.ifscCode ?? null,
    status: data.status ?? null,
    verifiedAt: data.verifiedAt ?? null,
  };
}

/**
 * POST /verification/bank/verify — existing IDSPay pennyless backend.
 * Does not invent a new API; mirrors the web payload shape.
 */
export async function verifyBankAccount(payload: VerifyBankPayload): Promise<BankVerifyResult> {
  try {
    const res = await api.post('/verification/bank/verify', {
      accountHolderName: payload.accountHolderName.trim(),
      bankName: payload.bankName.trim(),
      accountNumber: payload.accountNumber.trim(),
      confirmAccountNumber: payload.confirmAccountNumber.trim(),
      ifscCode: payload.ifscCode.trim().toUpperCase(),
      accountType: payload.accountType,
    });
    const data = res.data ?? {};
    return {
      success: true,
      message: res.message || 'Bank Account Verified Successfully',
      bankVerified: Boolean(data.bankVerified ?? true),
      accountNumberMasked: data.accountNumberMasked ?? null,
      bankName: data.bankName ?? payload.bankName,
    };
  } catch (e: any) {
    const msg = String(e?.message || 'Bank account verification failed.');
    // Backend ConflictError when already verified — treat as success for UX.
    if (/already verified/i.test(msg)) {
      try {
        const status = await getBankStatus();
        if (status.bankVerified) {
          return {
            success: true,
            alreadyVerified: true,
            message: 'Bank account is already verified.',
            bankVerified: true,
            accountNumberMasked: status.accountNumberMasked,
            bankName: status.bankName,
          };
        }
      } catch {
        // fall through to failure
      }
    }
    return {
      success: false,
      message: msg,
      error: msg,
      bankVerified: false,
      accountNumberMasked: null,
      bankName: null,
    };
  }
}
