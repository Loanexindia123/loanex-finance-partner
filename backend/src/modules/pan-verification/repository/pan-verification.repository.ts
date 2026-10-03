import { PanVerificationStatus, VerificationStatus } from '@prisma/client';
import { jsonDb } from '../../../config/json-db';

export class PanVerificationRepository {
  findUserById(userId: string) {
    return jsonDb.findOne('users', { id: userId });
  }

  findCustomerVerification(userId: string) {
    return jsonDb.findOne('customerVerification', { userId });
  }

  findLatestByUserId(userId: string) {
    const records = jsonDb.findMany('panVerification', { userId });
    records.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return records[0] || null;
  }

  findVerifiedByHash(panHash: string, excludeUserId?: string) {
    const records = jsonDb.findMany('panVerification', { panHash, status: PanVerificationStatus.VERIFIED });
    const filtered = excludeUserId ? records.filter((r: any) => r.userId !== excludeUserId) : records;
    return filtered[0] || null;
  }

  create(data: {
    userId: string;
    panNumberMasked: string;
    panHash: string;
    fullName: string;
    dateOfBirth: Date;
    status: PanVerificationStatus;
    verifiedAt?: Date | null;
  }) {
    return jsonDb.insert('panVerification', {
      userId: data.userId,
      panNumberMasked: data.panNumberMasked,
      panHash: data.panHash,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      status: data.status,
      verifiedAt: data.verifiedAt ?? null,
    });
  }

  async markUserPanVerified(userId: string) {
    await jsonDb.findOneFromMongo('users', { id: userId });
    await jsonDb.updateAwaited('users', { id: userId }, { panVerified: true });
    return jsonDb.findOne('users', { id: userId });
  }

  async upsertCustomerPanVerified(userId: string) {
    const existing = await jsonDb.findOneFromMongo('customerVerification', { userId });

    if (!existing) {
      return jsonDb.insertAwaited('customerVerification', {
        userId,
        mobileVerified: true,
        aadhaarVerified: true,
        panVerified: true,
        verificationStatus: VerificationStatus.IN_PROGRESS,
      });
    }

    const flags = {
      mobileVerified: existing.mobileVerified,
      aadhaarVerified: existing.aadhaarVerified,
      panVerified: true,
      bankVerified: existing.bankVerified,
    };

    const completed = Object.values(flags).filter(Boolean).length;
    const verificationStatus =
      completed === 4
        ? VerificationStatus.COMPLETED
        : completed === 0
          ? VerificationStatus.NOT_STARTED
          : VerificationStatus.IN_PROGRESS;

    await jsonDb.updateAwaited('customerVerification', { userId }, {
      panVerified: true,
      verificationStatus,
    });
    return jsonDb.findOne('customerVerification', { userId });
  }
}

export const panVerificationRepository = new PanVerificationRepository();
