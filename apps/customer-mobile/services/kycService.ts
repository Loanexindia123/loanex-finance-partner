import { CustomerKYC } from '../types';
import { api } from '../lib/apiClient';

/** In-flight single-flight for GET /verification/status — keyed by userId. No TTL cache. */
const kycInFlight = new Map<string, Promise<CustomerKYC | null>>();

/**
 * Fetch the customer's KYC row from the real backend aggregate
 * (GET /verification/status). Returns the raw customer_kyc record with
 * completion derived from the server-side verification flags, so the UI's
 * "KYC verified" state matches what the website shows.
 *
 * Concurrent callers for the same userId share one HTTP request; different
 * userIds never share. After settle, the in-flight entry is cleared so the
 * next call issues a fresh network request.
 */
export async function getKYC(userId: string): Promise<CustomerKYC | null> {
  if (!userId) return null;

  const existing = kycInFlight.get(userId);
  if (existing) return existing;

  const request = (async (): Promise<CustomerKYC | null> => {
    try {
      const res = await api.get('/verification/status');
      const status = res.data ?? {};
      const kyc: any = status.kyc ?? null;
      if (!kyc) return null;
      const completed =
        kyc.kycCompleted === true ||
        status.kycCompleted === true ||
        status.verificationStatus === 'COMPLETED';
      return {
        ...kyc,
        userId,
        kycCompleted: completed,
        kycCompletedAt: kyc.kycCompletedAt ?? (completed ? kyc.updatedAt ?? null : null),
      };
    } catch {
      return null;
    } finally {
      kycInFlight.delete(userId);
    }
  })();

  kycInFlight.set(userId, request);
  return request;
}

/**
 * KYC persistence happens server-side through the verification endpoints
 * (digilocker fetch, PAN/credit report, face match) — there is no separate
 * "save KYC" call. This re-fetches the authoritative row after the steps run.
 */
export async function saveKYC(userId: string, _kyc: any): Promise<CustomerKYC> {
  const fresh = await getKYC(userId);
  if (!fresh) {
    throw new Error('KYC could not be confirmed on the server. Please retry.');
  }
  return fresh;
}

/**
 * Real PAN + Experian credit report via the backend
 * (POST /verification/pan/experian-credit-report). The backend gates this on
 * Aadhaar being verified first (same as the web flow), so the mobile flow
 * runs Aadhaar (DigiLocker) before this step.
 */
export async function fetchExperianReport(params: any) {
  try {
    const res = await api.post('/verification/pan/experian-credit-report', {
      pan: params?.pan,
      mobile_no: params?.mobile,
      first_name: params?.firstName,
      last_name: params?.lastName,
      dob: params?.dob,
      email_id: params?.email ?? undefined,
    });
    const data = res.data ?? {};
    const bureauScore = Number(data?.score ?? data?.bureau_score ?? 0);
    return {
      success: true,
      score: bureauScore,
      error: undefined as string | undefined,
      data: {
        first_name: params?.firstName || '',
        last_name: params?.lastName || '',
        date_of_birth_applicant: params?.dob || '',
        mobile_phone_number: params?.mobile || '',
        income_tax_pan: params?.pan || '',
        email_id: params?.email || '',
        bureau_score: bureauScore,
        flat_no_plot_no_house_no: null,
        raw: data,
      },
    };
  } catch (e: any) {
    return {
      success: false,
      score: 0,
      error: e?.message || 'Failed to verify PAN and credit profile.',
      data: null,
    };
  }
}
