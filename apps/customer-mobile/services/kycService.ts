import { CustomerKYC } from '../types';
import { api } from '../lib/apiClient';

/** In-flight single-flight for GET /verification/status — keyed by userId. No TTL cache. */
const kycInFlight = new Map<string, Promise<CustomerKYC | null>>();

/**
 * Fetch KYC + verification flags from GET /verification/status.
 * Top-level aadhaarVerified / panVerified / bankVerified / faceVerified are
 * the source of truth for status UI (do not drop bank/face).
 */
export async function getKYC(userId: string): Promise<CustomerKYC | null> {
  if (!userId) return null;

  const existing = kycInFlight.get(userId);
  if (existing) return existing;

  const request = (async (): Promise<CustomerKYC | null> => {
    try {
      const res = await api.get('/verification/status');
      const status = res.data ?? {};
      const kyc: any = status.kyc ?? {};

      const aadhaarVerified = Boolean(
        status.aadhaarVerified ?? kyc.aadharVerified ?? kyc.aadhaarVerified,
      );
      const panVerified = Boolean(
        status.panVerified ?? kyc.pan_verified ?? kyc.panVerified,
      );
      const bankVerified = Boolean(status.bankVerified ?? kyc.bankVerified);
      const faceVerified = Boolean(
        status.faceVerified ?? kyc.face_verified ?? kyc.faceVerified,
      );
      const completed =
        status.kycCompleted === true ||
        status.verificationStatus === 'COMPLETED' ||
        kyc.kycCompleted === true;

      return {
        ...kyc,
        userId,
        fullName: kyc.fullName ?? '',
        aadharNumber: kyc.aadharNumber ?? kyc.aadhar_number ?? '',
        panNumber: kyc.panNumber ?? '',
        cibilScore: Number(kyc.cibil_score ?? kyc.cibilScore ?? 0),
        cibilChecked: Boolean(kyc.cibilChecked ?? panVerified),
        aadharVerified: aadhaarVerified,
        aadhaarVerified,
        panVerified,
        bankVerified,
        faceVerified,
        kycCompleted: completed,
        kycCompletedAt:
          kyc.kycCompletedAt ?? (completed ? kyc.updatedAt ?? null : null),
        createdAt: kyc.createdAt ?? '',
        updatedAt: kyc.updatedAt ?? '',
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
