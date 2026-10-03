import {
  VerificationStatus,
} from '@prisma/client';
import { jsonDb } from '../../../config/json-db';

const BankVerificationStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
} as const;

type BankAccountType = 'SAVINGS' | 'CURRENT';
type BankVerificationStatusValue =
  (typeof BankVerificationStatus)[keyof typeof BankVerificationStatus];

export class BankVerificationRepository {
  findUserById(userId: string) {
      return jsonDb.findOneFromMongo('users', { id: userId });
  }

  findCustomerVerification(userId: string) {
      return jsonDb.findOneFromMongo('customerVerification', { userId });
  }

  findLatestByUserId(userId: string) {
    const records = jsonDb.findMany('bankVerification', { userId });
    records.sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return records[0] || null;
  }

  findVerifiedByHash(accountNumberHash: string, excludeUserId?: string) {
    const records = jsonDb.findMany('bankVerification', {
      accountNumberHash,
      status: BankVerificationStatus.VERIFIED,
    });
    const filtered = excludeUserId
      ? records.filter((r: any) => r.userId !== excludeUserId)
      : records;
    return filtered[0] || null;
  }

  create(data: {
    userId: string;
    accountHolderName: string;
    bankName: string;
    accountNumberMasked: string;
    accountNumberHash: string;
    ifscCode: string;
    accountType: BankAccountType;
    status: BankVerificationStatusValue;
    verifiedAt?: Date | null;
  }) {
    return jsonDb.insert('bankVerification', {
      userId: data.userId,
      accountHolderName: data.accountHolderName,
      bankName: data.bankName,
      accountNumberMasked: data.accountNumberMasked,
      accountNumberHash: data.accountNumberHash,
      ifscCode: data.ifscCode,
      accountType: data.accountType,
      status: data.status,
      verifiedAt: data.verifiedAt ?? null,
    });
  }

  // --- Statement upload helpers (temporarily disabled) ---
  // createUpload(...) { ... }
  // findByClientId(...) { ... }
  // updateById(...) { ... }

  markUserBankVerified(userId: string) {
    jsonDb.update('users', { id: userId }, { bankVerified: true });
    return jsonDb.findOne('users', { id: userId });
  }

  async upsertCustomerBankVerified(userId: string) {
    const existing = jsonDb.findOne('customerVerification', { userId });

    if (!existing) {
      return jsonDb.insert('customerVerification', {
        userId,
        mobileVerified: true,
        aadhaarVerified: true,
        panVerified: true,
        bankVerified: true,
        verificationStatus: VerificationStatus.COMPLETED,
      });
    }

    const flags = {
      mobileVerified: existing.mobileVerified,
      aadhaarVerified: existing.aadhaarVerified,
      panVerified: existing.panVerified,
      bankVerified: true,
    };

    const completed = Object.values(flags).filter(Boolean).length;
    const verificationStatus =
      completed === 4
        ? VerificationStatus.COMPLETED
        : completed === 0
          ? VerificationStatus.NOT_STARTED
          : VerificationStatus.IN_PROGRESS;

    jsonDb.update(
      'customerVerification',
      { userId },
      {
        bankVerified: true,
        verificationStatus,
      },
    );
    return jsonDb.findOne('customerVerification', { userId });
  }
}

export const bankVerificationRepository = new BankVerificationRepository();
