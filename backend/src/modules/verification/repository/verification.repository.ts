import { jsonDb } from '../../../config/json-db';
import { authRepository } from '../../auth/auth.repository';

export class VerificationRepository {
  // ─── KYC status from customer_kyc ───────────────────────────────────────────

  /**
   * Targeted Mongo lookup by userId — avoids full customer_kyc collection refresh.
   */
  async findKycByUserId(userId: string) {
    return jsonDb.findOneCached('customer_kyc', { userId });
  }

  async upsertKyc(
    userId: string,
    data: {
      aadharVerified?: boolean;
      aadhar_number?: string;
      aadharRawData?: any;
      fullName?: string;
      dob?: string;
      gender?: string;
      address?: any;
      pan_verified?: boolean;
      panNumber?: string;
      cibil_score?: number;
      experianRawData?: any;
      kycCompleted?: boolean;
      kycCompletedAt?: Date;
      face_verified?: boolean;
      faceMatchScore?: number;
      faceRawData?: any;
    },
  ) {
    const existing = await this.findKycByUserId(userId);
    if (existing) {
      return jsonDb.updateAwaited('customer_kyc', { id: existing.id }, data);
    }
    return jsonDb.insertAwaited('customer_kyc', { userId, ...data });
  }

  // ─── DigiLocker reports ──────────────────────────────────────────────────────

  async findDigilockerByProfileId(profileId: string) {
    return jsonDb.findLatestFromMongo('digilocker_reports', { profileId }, 'createdAt');
  }

  async upsertDigilocker(
    profileId: string,
    data: {
      clientId?: string;
      name?: string;
      gender?: string;
      dob?: string;
      careOf?: string;
      yob?: string;
      zip?: string;
      masked_aadhaar?: string;
      fullAddress?: string;
      father_name?: string;
      profileImage?: string;
      xml_url?: string;
      rawData?: any;
    },
  ) {
    const existing = await this.findDigilockerByProfileId(profileId);
    if (existing) {
      return jsonDb.updateAwaited('digilocker_reports', { id: existing.id }, data);
    }
    return jsonDb.insertAwaited('digilocker_reports', { profileId, ...data });
  }

  // ─── User helpers ────────────────────────────────────────────────────────────

  /**
   * Use auth repository so serverless instances that hydrated before this
   * user was created still resolve the account from Supabase (same as login).
   */
  async findUserById(userId: string) {
    return authRepository.findById(userId);
  }

  findProfileById(userId: string) {
    return jsonDb.findOne('profiles', { id: userId });
  }

  // ─── KYC status summary ──────────────────────────────────────────────────────

  async getStatus(userId: string) {
    const [kyc, customer] = await Promise.all([
      jsonDb.findOneCached('customer_kyc', { userId }),
      jsonDb.findOneCached('customerVerification', { userId }),
    ]);
    const user = this.findUserByIdLocal(userId);

    const mobileVerified = true; // OTP login = mobile verified
    const aadhaarVerified = Boolean(kyc?.aadharVerified || customer?.aadhaarVerified || user?.aadhaarVerified);
    const panVerified = Boolean(kyc?.pan_verified || customer?.panVerified || user?.panVerified);
    const faceVerified = Boolean(kyc?.face_verified);
    const bankVerified = Boolean(customer?.bankVerified || user?.bankVerified);

    const coreSteps = [mobileVerified, aadhaarVerified, panVerified].filter(
      Boolean,
    ).length;
    const totalSteps = 3;
    const overallProgress = Math.round((coreSteps / totalSteps) * 100);

    return {
      mobileVerified,
      aadhaarVerified,
      panVerified,
      faceVerified,
      bankVerified,
      overallProgress,
      completedSteps: coreSteps,
      totalSteps,
      verificationStatus:
        coreSteps === 0
          ? 'NOT_STARTED'
          : coreSteps === totalSteps
            ? 'COMPLETED'
            : 'IN_PROGRESS',
      kycCompleted: coreSteps === totalSteps,
      // Never return Aadhaar photo / Experian blobs on the status poll.
      kyc: kyc
        ? {
            panNumber: kyc.panNumber ?? null,
            cibil_score: kyc.cibil_score ?? null,
            pan_verified: Boolean(kyc.pan_verified),
            aadharVerified: Boolean(kyc.aadharVerified),
            kycCompleted: Boolean(kyc.kycCompleted),
            kycCompletedAt: kyc.kycCompletedAt ?? null,
          }
        : null,
      message: 'Status fetched',
    };
  }

  /** In-memory user lookup — no Mongo. */
  findUserByIdLocal(userId: string) {
    return jsonDb.findOne('users', { id: userId });
  }
}

export const verificationRepository = new VerificationRepository();
