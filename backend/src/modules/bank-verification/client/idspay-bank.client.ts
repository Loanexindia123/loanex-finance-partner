import axios from 'axios';
import { BadRequestError } from '../../../common/errors/app-error';
import { env } from '../../../config/env';

const IDSPAY_BASE = 'https://javabackend.idspay.in/api/v1/prod';
const BANK_VERIFY_PATH = '/bank-verification/pennyless';

// --- Bank Statement Analysis (temporarily disabled — IDSPay account not entitled) ---
// const BANK_STATEMENT_PATH = '/srv2/statement-analyzer';
// export type IdsPayStatementUploadResult = { clientId: string; raw: unknown };
// export type IdsPayStatementDownloadResult = {
//   clientId: string;
//   details: Record<string, unknown>;
//   raw: unknown;
//   ready: boolean;
// };

export type IdsPayBankVerifyInput = {
  accountNumber: string;
  bankIfsc: string;
  referenceId: string;
  latitude: string;
  longitude: string;
};

export type IdsPayBankVerifyResult = {
  referenceId: string;
  accountExists: boolean;
  accountHolderName: string | null;
  verificationStatus: string | null;
  raw: unknown;
};

function requireIdsPayCredentials(): { api_id: string; api_key: string; token_id: string } {
  const api_id = env.DIGILOCKER_API_ID?.trim() || process.env['DIGILOCKER_API_ID']?.trim() || '';
  const api_key =
    env.DIGILOCKER_API_KEY?.trim() || process.env['DIGILOCKER_API_KEY']?.trim() || '';
  const token_id =
    env.DIGILOCKER_TOKEN_ID?.trim() || process.env['DIGILOCKER_TOKEN_ID']?.trim() || '';

  if (!api_id || !api_key || !token_id) {
    throw new BadRequestError(
      'IDSPay credentials are not configured. Bank verification cannot proceed.',
      { code: 'KYC_PROVIDER_NOT_CONFIGURED' },
    );
  }

  return { api_id, api_key, token_id };
}

function isProviderSuccess(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return (
    data?.status?.code === 200 ||
    data?.statuscode === '200' ||
    data?.statusCode === 200 ||
    data?.status === true ||
    data?.status === 'SUCCESS' ||
    String(data?.status?.message || '')
      .toLowerCase()
      .includes('success')
  );
}

function pickAccountHolderName(data: any): string | null {
  const candidates = [
    data?.data?.account_holder_name,
    data?.data?.accountHolderName,
    data?.data?.name,
    data?.data?.beneficiaryName,
    data?.data?.result?.account_holder_name,
    data?.account_holder_name,
    data?.name,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickAccountExists(data: any): boolean {
  const flags = [
    data?.data?.account_exists,
    data?.data?.accountExists,
    data?.data?.isAccountExists,
    data?.data?.valid,
    data?.account_exists,
  ];
  for (const flag of flags) {
    if (typeof flag === 'boolean') return flag;
    if (flag === 'true' || flag === 'Y' || flag === 'yes') return true;
    if (flag === 'false' || flag === 'N' || flag === 'no') return false;
  }
  return isProviderSuccess(data);
}

/**
 * IDSPay bank account verification (Penny Less).
 * Temporary active path while Statement Analyzer is unauthorized on this account.
 */
export async function verifyBankAccountWithIdsPay(
  input: IdsPayBankVerifyInput,
): Promise<IdsPayBankVerifyResult> {
  const creds = requireIdsPayCredentials();
  // Penny Less body only — do not send reference_id / latitude / longitude to IDSPay.
  const payload = {
    api_id: creds.api_id,
    api_key: creds.api_key,
    token_id: creds.token_id,
    account_number: input.accountNumber,
    bank_ifsc: input.bankIfsc,
    ifsc_details: true,
  };

  let resp;
  try {
    resp = await axios.post(`${IDSPAY_BASE}${BANK_VERIFY_PATH}`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 45_000,
    });
  } catch (err: any) {
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.status?.message ||
      err?.message ||
      'IDSPay bank verification request failed';
    throw new BadRequestError(String(message), { code: 'BANK_PROVIDER_ERROR' });
  }

  const data = resp.data;
  if (!isProviderSuccess(data)) {
    const errorMessage =
      data?.statusMessage ||
      data?.message ||
      data?.status?.message ||
      'Bank account verification failed at provider';
    throw new BadRequestError(`IDSPay Error: ${errorMessage}`, {
      code: 'BANK_PROVIDER_REJECTED',
    });
  }

  const accountExists = pickAccountExists(data);
  if (!accountExists) {
    throw new BadRequestError('Bank account could not be verified with the provided details.', {
      code: 'BANK_ACCOUNT_NOT_FOUND',
    });
  }

  return {
    referenceId: input.referenceId,
    accountExists: true,
    accountHolderName: pickAccountHolderName(data),
    verificationStatus: String(data?.status?.message || data?.status || 'VERIFIED'),
    raw: data,
  };
}

// --- Bank Statement Analysis helpers (commented until IDSPay enables the product) ---
// export async function uploadBankStatementWithIdsPay(...) { ... }
// export async function fetchBankStatementDetailsWithIdsPay(...) { ... }
