import {
  EmiApplicationStatus,
  VerificationStatus,
} from '@prisma/client';
import { jsonDb } from '../../../config/json-db';

const OPEN_APPLICATION_STATUSES: EmiApplicationStatus[] = [
  EmiApplicationStatus.PENDING,
  EmiApplicationStatus.UNDER_REVIEW,
  EmiApplicationStatus.APPROVED,
  EmiApplicationStatus.OFFER_ACCEPTED,
  EmiApplicationStatus.DOWN_PAYMENT_PENDING,
];

export class EmiApplicationRepository {
  findUserById(userId: string) {
    return jsonDb.findOne('users', { id: userId });
  }

  findProfileById(userId: string) {
    return jsonDb.findOne('profiles', { id: userId });
  }

  findCustomerVerification(userId: string) {
    return jsonDb.findOne('customerVerification', { userId });
  }

  findLatestAadhaar(userId: string) {
    const res = jsonDb.findMany('aadhaarVerification', { userId, verificationStatus: 'VERIFIED' });
    return res.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }

  findLatestPan(userId: string) {
    const res = jsonDb.findMany('panVerification', { userId, status: 'VERIFIED' });
    return res.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }

  findLatestBank(userId: string) {
    const res = jsonDb.findMany('bankVerification', { userId, status: 'VERIFIED' });
    return res.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }

  findActiveByUserId(userId: string) {
    const res = jsonDb.findMany('emi_applications', { userId });
    return (
      res
        .filter((r: any) => OPEN_APPLICATION_STATUSES.includes(r.status))
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] || null
    );
  }

  findByUserId(userId: string) {
    const res = jsonDb.findMany('emi_applications', { userId });
    return res.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }

  async listAllByUserId(userId: string) {
    await jsonDb.refreshCollection('emi_applications');
    const res = jsonDb.findMany('emi_applications', { userId });
    return res.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findById(id: string) {
    return jsonDb.findOne('emi_applications', { id });
  }

  findByIdForUser(id: string, userId: string) {
    return jsonDb.findOne('emi_applications', { id, userId });
  }

  findDefaultShippingAddress(userId: string) {
    const res = jsonDb.findMany('userAddress', { userId, addressType: 'SHIPPING' });
    return res.sort((a: any, b: any) => { if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1; return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); })[0] || null;
  }

  findProductBrand(productId: string) {
    return jsonDb.findOne('products', { id: productId });
  }

  create(data: {
    applicationNumber: string;
    userId: string;
    productId: string;
    productName?: string | null;
    sellingPrice: number;
    requestedAmount: number;
    requestedDownPayment: number;
    requestedTenure: number;
    estimatedMonthlyEmi: number;
    interestRate?: number;
  }) {
    return jsonDb.insert('emi_applications', {
      applicationNumber: data.applicationNumber,
      userId: data.userId,
      productId: data.productId,
      productName: data.productName ?? null,
      sellingPrice: data.sellingPrice,
      requestedAmount: data.requestedAmount,
      requestedDownPayment: data.requestedDownPayment,
      requestedTenure: data.requestedTenure,
      estimatedMonthlyEmi: data.estimatedMonthlyEmi,
      interestRate: data.interestRate ?? 12.5,
      status: EmiApplicationStatus.PENDING,
    });
  }

  markCustomerPendingReview(userId: string) {
    jsonDb.update('customerVerification', { userId }, { verificationStatus: VerificationStatus.PENDING_REVIEW });
    return jsonDb.findOne('customerVerification', { userId });
  }

  listForAdmin(status?: EmiApplicationStatus) {
    const results = status ? jsonDb.findMany('emi_applications', { status }) : jsonDb.findMany('emi_applications', {});
    return results.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  /**
   * Highest application-number sequence used today (e.g. 3 for ...-0003).
   * Uses MAX + 1 semantics (like order numbers) so gaps or stale stores can
   * never hand out a duplicate number — a count-based generator collides when
   * a sequence is missing (e.g. 0001 deleted) or the in-memory store lags the
   * source, and the duplicate then fails the Mongo unique index mirror write.
   */
  async maxApplicationSequenceToday(prefix: string): Promise<number> {
    await jsonDb.refreshCollection('emi_applications');
    let max = 0;
    for (const r of jsonDb.findMany('emi_applications', {})) {
      const num = String(r.applicationNumber ?? '');
      if (!num.startsWith(prefix)) continue;
      const seq = parseInt(num.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
    return max;
  }

  acceptOffer(id: string) {
    jsonDb.update('emi_applications', { id }, {
      status: EmiApplicationStatus.OFFER_ACCEPTED,
      offerAcceptedAt: new Date(),
    });
    return jsonDb.findOne('emi_applications', { id });
  }

  declineOffer(id: string) {
    jsonDb.update('emi_applications', { id }, {
      status: EmiApplicationStatus.DECLINED_BY_CUSTOMER,
      offerDeclinedAt: new Date(),
    });
    return jsonDb.findOne('emi_applications', { id });
  }

  approveForTesting(id: string, data: {
    approvedAmount: number;
    approvedTenure: number;
    approvedDownPayment: number;
    monthlyEmi: number;
    interestRate: number;
    processingFee: number;
    adminRemarks: string;
  }) {
    jsonDb.update('emi_applications', { id }, {
      status: EmiApplicationStatus.APPROVED,
      approvedAmount: data.approvedAmount,
      approvedTenure: data.approvedTenure,
      approvedDownPayment: data.approvedDownPayment,
      monthlyEmi: data.monthlyEmi,
      interestRate: data.interestRate,
      processingFee: data.processingFee,
      adminRemarks: data.adminRemarks,
      rejectionReason: null,
      reviewedAt: new Date(),
      offerAcceptedAt: null,
      offerDeclinedAt: null,
    });
    return jsonDb.findOne('emi_applications', { id });
  }

  reject(id: string, reason: string) {
    jsonDb.update('emi_applications', { id }, {
      status: EmiApplicationStatus.REJECTED,
      rejectionReason: reason || 'Application rejected by admin.',
      adminRemarks: reason || 'Application rejected by admin.',
      reviewedAt: new Date(),
      offerAcceptedAt: null,
      offerDeclinedAt: null,
    });
    return jsonDb.findOne('emi_applications', { id });
  }

  modifyTerms(id: string, data: {
    approvedAmount: number;
    approvedTenure: number;
    approvedDownPayment: number;
    monthlyEmi: number;
    interestRate: number;
    processingFee: number;
    adminRemarks: string;
  }) {
    jsonDb.update('emi_applications', { id }, {
      status: EmiApplicationStatus.APPROVED,
      approvedAmount: data.approvedAmount,
      approvedTenure: data.approvedTenure,
      approvedDownPayment: data.approvedDownPayment,
      monthlyEmi: data.monthlyEmi,
      interestRate: data.interestRate,
      processingFee: data.processingFee,
      adminRemarks: data.adminRemarks,
      termsModifiedAt: new Date(),
      rejectionReason: null,
      reviewedAt: new Date(),
      offerAcceptedAt: null,
      offerDeclinedAt: null,
    });
    return jsonDb.findOne('emi_applications', { id });
  }

  upsertCustomerVerification(userId: string, data: {
    mobileVerified?: boolean;
    aadhaarVerified?: boolean;
    panVerified?: boolean;
    bankVerified?: boolean;
    verificationStatus?: VerificationStatus;
    cibilScore?: number | null;
  }) {
    const existing = jsonDb.findOne('customerVerification', { userId });
    if (existing) {
      jsonDb.update('customerVerification', { userId }, data);
      return jsonDb.findOne('customerVerification', { userId });
    }
    return jsonDb.insert('customerVerification', {
      userId,
      mobileVerified: data.mobileVerified ?? false,
      aadhaarVerified: data.aadhaarVerified ?? false,
      panVerified: data.panVerified ?? false,
      bankVerified: data.bankVerified ?? false,
      verificationStatus: data.verificationStatus ?? VerificationStatus.NOT_STARTED,
      cibilScore: data.cibilScore ?? null,
    });
  }

  /**
   * Targeted Mongo lookup by userId — avoids full customer_kyc collection refresh.
   */
  async findKycSummary(userId: string) {
    return jsonDb.findOneFromMongo('customer_kyc', { userId });
  }

  findLatestMobileVerification(userId: string) {
    const res = jsonDb.findMany('mobileVerification', { userId, verificationStatus: 'VERIFIED' });
    return res.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }
}

export const emiApplicationRepository = new EmiApplicationRepository();
