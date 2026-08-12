import { EmiApplicationStatus, VerificationStatus } from '@prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { env } from '../../../config/env';
import { jsonDb } from '../../../config/json-db';
import { maskPan } from '../../../common/utils/pan';
import { auditLogService } from '../../verification/service/audit-log.service';
import { orderRepository } from '../../order/repository/order.repository';
import { generateSequentialOrderNumber } from '../../../common/utils/order-number';
import { loanRepository } from '../../loan/repository/loan.repository';
import {
  calculateMonthlyEmi,
  DEFAULT_ANNUAL_INTEREST_RATE_PERCENT,
  round2,
} from '../../loan/service/emi-calculator.service';
import type { CreateEmiApplicationBody } from '../dto/emi-application.dto';
import { emiApplicationRepository } from '../repository/emi-application.repository';
import { paymentRepository } from '../../payment/repository/payment.repository';
import {
  KYC_FEE_AMOUNT_INR,
  KYC_VERIFICATION_PURPOSE,
} from '../../payment/kyc-fee.constants';

function toNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function formatShippingAddress(address: {
  addressLine1: string;
  addressLine2: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}): string {
  return [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    `${address.city}, ${address.state} ${address.pincode}`,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}

function serializeApplication(app: {
  id: string;
  createdAt: Date | null;
  updatedAt?: Date | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  termsModifiedAt?: Date | null;
  offerAcceptedAt?: Date | null;
  offerDeclinedAt?: Date | null;
  status: string | null;
  userId: string | null;
  productId: string | null;
  productName?: string | null;
  orderId?: string | null;
  planId?: string | null;
  applicationNumber?: string | null;
  sellingPrice: any;
  requestedAmount: any;
  requestedDownPayment: any;
  requestedTenure: any;
  estimatedMonthlyEmi: any;
  approvedAmount: any;
  approvedTenure: any;
  approvedDownPayment: any;
  monthlyEmi: any;
  interestRate: any;
  processingFee: any;
  adminRemarks: string | null;
  rejectionReason: string | null;
  loanAmount: any;
  downPayment: any;
  adminNotes: string | null;
}) {
  const requestedTenure = toNumber(app.requestedTenure) ?? toNumber(app.approvedTenure) ?? 12;
  return {
    id: app.id,
    applicationNumber: app.applicationNumber || app.id.split('-')[0].toUpperCase(),
    userId: app.userId || '',
    productId: app.productId || '',
    productName: app.productName || 'Loan Plan',
    sellingPrice: toNumber(app.sellingPrice) ?? toNumber(app.loanAmount) ?? 0,
    requestedAmount: toNumber(app.requestedAmount) ?? toNumber(app.loanAmount) ?? 0,
    requestedDownPayment: toNumber(app.requestedDownPayment) ?? toNumber(app.downPayment) ?? 0,
    requestedTenure,
    estimatedMonthlyEmi: toNumber(app.estimatedMonthlyEmi) ?? toNumber(app.monthlyEmi) ?? 0,
    approvedAmount: toNumber(app.approvedAmount) ?? toNumber(app.loanAmount) ?? null,
    approvedTenure: toNumber(app.approvedTenure) ?? toNumber(app.requestedTenure) ?? 12,
    approvedDownPayment: toNumber(app.approvedDownPayment) ?? toNumber(app.downPayment) ?? null,
    monthlyEmi: toNumber(app.monthlyEmi) ?? toNumber(app.estimatedMonthlyEmi) ?? 0,
    interestRate: toNumber(app.interestRate) ?? 0,
    processingFee: toNumber(app.processingFee) ?? 0,
    status: (app.status as EmiApplicationStatus) || 'PENDING',
    adminRemarks: app.adminRemarks ?? app.adminNotes ?? null,
    rejectionReason: app.rejectionReason ?? null,
    submittedAt: app.submittedAt || app.createdAt || new Date(),
    reviewedAt: app.reviewedAt ?? null,
    termsModifiedAt: app.termsModifiedAt ?? null,
    offerAcceptedAt: app.offerAcceptedAt ?? null,
    offerDeclinedAt: app.offerDeclinedAt ?? null,
    createdAt: app.createdAt || new Date(),
    updatedAt: app.updatedAt || app.createdAt || new Date(),
  };
}


function toStatusPayload(app: Parameters<typeof serializeApplication>[0], customer?: {
  mobileVerified: boolean;
  aadhaarVerified: boolean;
  panVerified: boolean;
  bankVerified: boolean;
} | null) {
  const status = app.status;
  const serialized = serializeApplication(app);
  return {
    applicationNumber: serialized.applicationNumber,
    status,
    submittedAt: serialized.submittedAt,
    approvedAmount: serialized.approvedAmount,
    approvedTenure: serialized.approvedTenure,
    approvedDownPayment: serialized.approvedDownPayment,
    rejectionReason: serialized.rejectionReason,
    adminRemarks: serialized.adminRemarks,
    canModifyApplication: false,
    canSubmitAnother:
      status === EmiApplicationStatus.REJECTED ||
      status === EmiApplicationStatus.DECLINED_BY_CUSTOMER ||
      status === EmiApplicationStatus.DOWN_PAYMENT_COMPLETED ||
      status === EmiApplicationStatus.ORDER_CONFIRMED ||
      status === EmiApplicationStatus.ACTIVE_EMI,
    canPayDownPayment:
      status === EmiApplicationStatus.APPROVED ||
      status === EmiApplicationStatus.OFFER_ACCEPTED ||
      status === EmiApplicationStatus.DOWN_PAYMENT_PENDING,
    canAcceptOffer: status === EmiApplicationStatus.APPROVED,
    timeline: {
      mobileVerified: Boolean(customer?.mobileVerified),
      aadhaarVerified: Boolean(customer?.aadhaarVerified),
      panVerified: Boolean(customer?.panVerified),
      bankVerified: Boolean(customer?.bankVerified),
      applicationSubmitted: true,
      waitingForAdminReview:
        status === EmiApplicationStatus.PENDING ||
        status === EmiApplicationStatus.UNDER_REVIEW,
      underReview: status === EmiApplicationStatus.UNDER_REVIEW,
      approved: status === EmiApplicationStatus.APPROVED,
      rejected: status === EmiApplicationStatus.REJECTED,
    },
    application: serialized,
  };
}

function historyNextStep(status: EmiApplicationStatus, loanStatus?: string | null): string {
  if (loanStatus === 'CLOSED') {
    return 'LOAN_COMPLETED';
  }
  switch (status) {
    case EmiApplicationStatus.APPROVED:
      return 'VIEW_OFFER';
    case EmiApplicationStatus.OFFER_ACCEPTED:
    case EmiApplicationStatus.DOWN_PAYMENT_PENDING:
      return 'PAY_DOWN_PAYMENT';
    case EmiApplicationStatus.DOWN_PAYMENT_COMPLETED:
    case EmiApplicationStatus.ORDER_CONFIRMED:
      return 'VIEW_ORDER';
    case EmiApplicationStatus.ACTIVE_EMI:
      return 'VIEW_LOAN';
    case EmiApplicationStatus.REJECTED:
    case EmiApplicationStatus.DECLINED_BY_CUSTOMER:
      return 'APPLY_AGAIN';
    default:
      return 'VIEW_STATUS';
  }
}

export class EmiApplicationService {
  async getReview(userId: string) {
    const user = await emiApplicationRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const customer = await emiApplicationRepository.findCustomerVerification(userId);
    const [profile, aadhaar, pan, bank, active, kyc] = await Promise.all([
      emiApplicationRepository.findProfileById(userId),
      emiApplicationRepository.findLatestAadhaar(userId),
      emiApplicationRepository.findLatestPan(userId),
      emiApplicationRepository.findLatestBank(userId),
      emiApplicationRepository.findActiveByUserId(userId),
      emiApplicationRepository.findKycSummary(userId),
    ]);

    const mobileVerified = Boolean(customer?.mobileVerified);
    const aadhaarVerified = Boolean(customer?.aadhaarVerified);
    const panVerified = Boolean(customer?.panVerified);
    const bankVerified = Boolean(customer?.bankVerified);
    const overallStatus =
      (customer?.verificationStatus as VerificationStatus) ??
      customer?.status ??
      VerificationStatus.NOT_STARTED;

    const aadhaarNumberMasked =
      aadhaar?.aadhaarNumberMasked ?? kyc?.aadhar_number ?? null;
    const panNumberMasked =
      pan?.panNumberMasked ??
      (kyc?.panNumber ? maskPan(String(kyc.panNumber)) : null);
    const accountHolderName = bank?.accountHolderName ?? kyc?.fullName ?? null;

    const coreVerified = mobileVerified && aadhaarVerified && panVerified;

    return {
      personal: {
        fullName: profile?.fullName ?? user?.fullName ?? 'Customer',
        mobile: profile?.mobileNumber ?? profile?.mobile_number ?? '',
        email: user.email,
      },
      aadhaar: {
        aadhaarNumberMasked: aadhaarNumberMasked,
        status: aadhaarVerified ? 'Verified' : 'Pending',
        verified: aadhaarVerified,
      },
      pan: {
        panNumberMasked: panNumberMasked,
        status: panVerified ? 'Verified' : 'Pending',
        verified: panVerified,
      },
      bank: {
        accountHolderName,
        bankName: bank?.bankName ?? null,
        accountNumberMasked: bank?.accountNumberMasked ?? null,
        ifscCode: bank?.ifscCode ?? null,
        status: bankVerified ? 'Verified' : 'Pending',
        verified: bankVerified,
      },
      verification: {
        mobileVerified,
        aadhaarVerified,
        panVerified,
        bankVerified,
        overallStatus,
        canSubmit: coreVerified && !active,
      },
      activeApplication: active ? serializeApplication(active) : null,
    };
  }

  private async syncCustomerVerification(userId: string) {
    const kyc = await emiApplicationRepository.findKycSummary(userId);
    const mobile = await emiApplicationRepository.findLatestMobileVerification(userId);
    const existing = await emiApplicationRepository.findCustomerVerification(userId);

    const mobileVerified = Boolean(mobile) || Boolean(existing?.mobileVerified);
    const aadhaarVerified = Boolean(kyc?.aadharVerified) || Boolean(existing?.aadhaarVerified);
    const panVerified = Boolean(kyc?.pan_verified) || Boolean(existing?.panVerified);
    const bankVerified = Boolean(existing?.bankVerified);

    const coreDone = mobileVerified && aadhaarVerified && panVerified;
    const verificationStatus = coreDone
      ? VerificationStatus.COMPLETED
      : ((existing?.verificationStatus ?? existing?.status) as VerificationStatus) ??
        VerificationStatus.NOT_STARTED;

    return emiApplicationRepository.upsertCustomerVerification(userId, {
      mobileVerified,
      aadhaarVerified,
      panVerified,
      bankVerified,
      verificationStatus,
      cibilScore: kyc?.cibil_score ?? existing?.cibilScore ?? null,
    });
  }

  async create(
    userId: string,
    input: CreateEmiApplicationBody,
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const user = await emiApplicationRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const customer = await this.syncCustomerVerification(userId);
    if (!customer) {
      throw new BadRequestError('Complete all verification steps before submitting an application.');
    }

    const incomplete =
      !customer.mobileVerified ||
      !customer.aadhaarVerified ||
      !customer.panVerified ||
      ((customer.verificationStatus ?? customer.status) !== VerificationStatus.COMPLETED &&
        (customer.verificationStatus ?? customer.status) !== VerificationStatus.PENDING_REVIEW);

    if (incomplete) {
      throw new BadRequestError(
        'All verification steps must be completed before submitting an EMI application.',
        {
          mobileVerified: customer.mobileVerified,
          aadhaarVerified: customer.aadhaarVerified,
          panVerified: customer.panVerified,
          bankVerified: customer.bankVerified,
          overallStatus: customer.verificationStatus ?? customer.status,
        },
      );
    }

    // Lifetime ₹299 KYC fee — Mongo-backed SUCCESS payment required before EMI create.
    const kycFeePaid = await paymentRepository.findSuccessKycVerification(userId);
    if (!kycFeePaid) {
      throw new ConflictError('KYC verification fee must be paid before submitting an EMI application.', {
        code: 'KYC_FEE_REQUIRED',
        paid: false,
        amount: KYC_FEE_AMOUNT_INR,
        purpose: KYC_VERIFICATION_PURPOSE,
      });
    }

    const existing = await emiApplicationRepository.findActiveByUserId(userId);
    if (existing) {
      throw new ConflictError('An active EMI application already exists for this account.', {
        applicationNumber: existing.id,
        status: existing.status,
      });
    }

    if (input.requestedDownPayment + input.requestedAmount > input.sellingPrice + 0.01) {
      throw new BadRequestError('Requested amount and down payment cannot exceed selling price.');
    }

    const applicationNumber = await this.generateApplicationNumber();
    // Client Excel model: 0% interest. Prefer PDP-calculated estimate (fee-in-principal).
    const interestRate = 0;
    const estimatedMonthlyEmi =
      input.estimatedMonthlyEmi > 0
        ? round2(input.estimatedMonthlyEmi)
        : calculateMonthlyEmi(input.requestedAmount, interestRate, input.requestedTenure);
    const created = await emiApplicationRepository.create({
      applicationNumber,
      userId,
      productId: input.productId,
      productName: input.productName ?? null,
      sellingPrice: input.sellingPrice,
      requestedAmount: input.requestedAmount,
      requestedDownPayment: input.requestedDownPayment,
      requestedTenure: input.requestedTenure,
      estimatedMonthlyEmi,
      interestRate,
    });

    await emiApplicationRepository.markCustomerPendingReview(userId);

    await auditLogService.log({
      userId,
      action: 'APPLICATION_SUBMITTED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber,
        productId: input.productId,
        timestamp: created.createdAt instanceof Date ? created.createdAt.toISOString() : String(created.createdAt),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    return {
      ...serializeApplication(created),
      message: 'EMI application submitted successfully',
      nextStep: 'PENDING_REVIEW' as const,
    };
  }

  async getCurrent(
    userId: string,
    meta?: {
      event?: 'viewed' | 'refreshed';
      ipAddress?: string | null;
      applicationId?: string;
    },
  ) {
    const app = meta?.applicationId
      ? await emiApplicationRepository.findByIdForUser(meta.applicationId, userId)
      : await emiApplicationRepository.findByUserId(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    const customer = await emiApplicationRepository.findCustomerVerification(userId);
    const payload = toStatusPayload(app, customer);
    const order = await orderRepository.findByApplicationId(app.id);

    await auditLogService.log({
      userId,
      action: meta?.event === 'refreshed' ? 'STATUS_REFRESHED' : 'STATUS_VIEWED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber: app.id,
        status: app.status,
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
      },
    });

    return {
      ...payload,
      application: {
        ...payload.application,
        orderId: order?.id ?? null,
        orderNumber: order?.orderNumber ?? null,
      },
    };
  }

  /** Explicit application lookup — same payload shape as getCurrent. */
  async getById(
    userId: string,
    applicationId: string,
    meta?: { event?: 'viewed' | 'refreshed'; ipAddress?: string | null },
  ) {
    return this.getCurrent(userId, { ...meta, applicationId });
  }

  async getStatus(
    userId: string,
    meta?: { event?: 'viewed' | 'refreshed'; ipAddress?: string | null },
  ) {
    const app = await emiApplicationRepository.findByUserId(userId);
    if (!app) {
      return {
        hasApplication: false,
        applicationNumber: null,
        status: null,
        submittedAt: null,
        approvedAmount: null,
        approvedTenure: null,
        approvedDownPayment: null,
        canProceedToDownPayment: false,
        canModifyApplication: false,
        canSubmitAnother: true,
        canPayDownPayment: false,
        canAcceptOffer: false,
      };
    }

    const customer = await emiApplicationRepository.findCustomerVerification(userId);
    const payload = toStatusPayload(app, customer);

    if (meta?.event) {
      await auditLogService.log({
        userId,
        action: meta.event === 'refreshed' ? 'STATUS_REFRESHED' : 'STATUS_VIEWED',
        entity: 'emi_applications',
        metadata: {
          applicationNumber: app.id,
          status: app.status,
          timestamp: new Date().toISOString(),
          ipAddress: meta.ipAddress ?? null,
        },
      });
    }

    return {
      hasApplication: true,
      ...payload,
      canProceedToDownPayment: payload.canPayDownPayment,
    };
  }

  async getCurrentOffer(
    userId: string,
    meta?: { ipAddress?: string | null; applicationId?: string },
  ) {
    const app = meta?.applicationId
      ? await emiApplicationRepository.findByIdForUser(meta.applicationId, userId)
      : await emiApplicationRepository.findByUserId(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    if (app.status === EmiApplicationStatus.OFFER_ACCEPTED) {
      throw new ConflictError('Offer already accepted.', {
        code: 'OFFER_ALREADY_ACCEPTED',
        applicationNumber: app.id,
        status: app.status,
        nextStep: 'DOWN_PAYMENT',
      });
    }

    if (app.status === EmiApplicationStatus.DECLINED_BY_CUSTOMER) {
      throw new ConflictError('Offer was declined by the customer.', {
        code: 'OFFER_DECLINED',
        applicationNumber: app.id,
        status: app.status,
      });
    }

    if (app.status !== EmiApplicationStatus.APPROVED) {
      throw new BadRequestError('Approved loan offer is not available for this application.', {
        code: 'OFFER_NOT_AVAILABLE',
        applicationNumber: app.id,
        status: app.status,
      });
    }

    const serialized = serializeApplication(app);

    await auditLogService.log({
      userId,
      action: 'OFFER_VIEWED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber: app.id,
        status: app.status,
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
      },
    });

    return {
      applicationNumber: serialized.applicationNumber,
      applicationDate: serialized.createdAt,
      submittedAt: serialized.submittedAt,
      status: serialized.status,
      productName: serialized.productName,
      productPrice: serialized.sellingPrice,
      sellingPrice: serialized.sellingPrice,
      approvedLoanAmount: serialized.approvedAmount,
      approvedAmount: serialized.approvedAmount,
      approvedDownPayment: serialized.approvedDownPayment,
      approvedTenure: serialized.approvedTenure,
      monthlyEmi: serialized.monthlyEmi,
      interestRate: serialized.interestRate,
      processingFee: serialized.processingFee,
      adminRemarks: serialized.adminRemarks,
      termsModified: Boolean(app.termsModifiedAt),
      termsModifiedAt: app.termsModifiedAt ?? null,
      canAcceptOffer: true,
      canDeclineOffer: true,
      nextStep: 'ACCEPT_OR_DECLINE' as const,
    };
  }

  async acceptOffer(
    userId: string,
    meta?: { ipAddress?: string | null; userAgent?: string | null; applicationId?: string },
  ) {
    const app = meta?.applicationId
      ? await emiApplicationRepository.findByIdForUser(meta.applicationId, userId)
      : await emiApplicationRepository.findByUserId(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    if (app.status === EmiApplicationStatus.OFFER_ACCEPTED) {
      throw new ConflictError('Offer already accepted.', {
        code: 'OFFER_ALREADY_ACCEPTED',
        applicationNumber: app.id,
        status: app.status,
        nextStep: 'DOWN_PAYMENT',
      });
    }

    if (app.status !== EmiApplicationStatus.APPROVED) {
      throw new BadRequestError('Approved loan offer is not available to accept.', {
        code: 'OFFER_NOT_AVAILABLE',
        applicationNumber: app.id,
        status: app.status,
      });
    }

    const updated = await emiApplicationRepository.acceptOffer(app.id);
    const serialized = serializeApplication(updated);

    await auditLogService.log({
      userId,
      action: 'OFFER_ACCEPTED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber: updated.id,
        status: updated.status,
        offerAcceptedAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : String(updated.createdAt ?? ''),
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    return {
      ...serialized,
      message: 'Loan offer accepted successfully',
      nextStep: 'DOWN_PAYMENT' as const,
    };
  }

  async declineOffer(
    userId: string,
    meta?: { ipAddress?: string | null; userAgent?: string | null; applicationId?: string },
  ) {
    const app = meta?.applicationId
      ? await emiApplicationRepository.findByIdForUser(meta.applicationId, userId)
      : await emiApplicationRepository.findByUserId(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    if (app.status === EmiApplicationStatus.DECLINED_BY_CUSTOMER) {
      throw new ConflictError('Offer was already declined.', {
        code: 'OFFER_DECLINED',
        applicationNumber: app.id,
        status: app.status,
      });
    }

    if (app.status === EmiApplicationStatus.OFFER_ACCEPTED) {
      throw new ConflictError('Offer already accepted and cannot be declined.', {
        code: 'OFFER_ALREADY_ACCEPTED',
        applicationNumber: app.id,
        status: app.status,
      });
    }

    if (app.status !== EmiApplicationStatus.APPROVED) {
      throw new BadRequestError('Approved loan offer is not available to decline.', {
        code: 'OFFER_NOT_AVAILABLE',
        applicationNumber: app.id,
        status: app.status,
      });
    }

    const updated = await emiApplicationRepository.declineOffer(app.id);
    const serialized = serializeApplication(updated);

    await auditLogService.log({
      userId,
      action: 'OFFER_DECLINED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber: updated.id,
        status: updated.status,
        offerDeclinedAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : String(updated.createdAt ?? ''),
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    return {
      ...serialized,
      message: 'Loan offer declined',
      nextStep: 'HOME' as const,
    };
  }

  async listForAdmin(statusQuery?: string) {
    let status: EmiApplicationStatus | undefined;
    if (statusQuery) {
      const normalized = statusQuery.toUpperCase();
      if (!(normalized in EmiApplicationStatus)) {
        throw new BadRequestError('Invalid status filter');
      }
      status = normalized as EmiApplicationStatus;
    }

    const rows = await emiApplicationRepository.listForAdmin(status);
    const items = await Promise.all(
      rows.map(async (row) => {
        const [profile, user] = await Promise.all([
          emiApplicationRepository.findProfileById(row.userId),
          emiApplicationRepository.findUserById(row.userId),
        ]);
        return {
          ...serializeApplication(row),
          customer: {
            userId: row.userId,
            fullName: profile?.fullName ?? user?.fullName ?? 'Customer',
            email: user?.email ?? '',
            mobile: profile?.mobileNumber ?? profile?.mobile_number ?? '',
          },
        };
      }),
    );
    return {
      items,
      total: items.length,
    };
  }

  async getForAdmin(applicationId: string) {
    const row = await emiApplicationRepository.findById(applicationId);
    if (!row) {
      throw new NotFoundError('EMI application not found');
    }

    const [profile, user, order, loan] = await Promise.all([
      emiApplicationRepository.findProfileById(row.userId),
      emiApplicationRepository.findUserById(row.userId),
      orderRepository.findByApplicationId(row.id),
      loanRepository.findByApplicationId(row.id),
    ]);

    return {
      ...serializeApplication(row),
      customer: {
        userId: row.userId,
        fullName: profile?.fullName ?? user?.fullName ?? 'Customer',
        email: user?.email ?? '',
        mobile: profile?.mobileNumber ?? profile?.mobile_number ?? '',
      },
      orderId: order?.id ?? null,
      orderNumber: order?.orderNumber ?? null,
      loanId: loan?.id ?? null,
      loanAccountNumber: loan?.loanAccountNumber ?? null,
      loanStatus: loan?.loanStatus ?? null,
    };
  }

  async getHistory(userId: string) {
    const apps = await emiApplicationRepository.listAllByUserId(userId);
    const items = await Promise.all(
      apps.map(async (app) => {
        const serialized = serializeApplication(app);
        const order = await orderRepository.findByApplicationId(app.id);
        const loan = await loanRepository.findByApplicationId(app.id);
        return {
          ...serialized,
          orderId: order?.id ?? null,
          orderNumber: order?.orderNumber ?? null,
          loanAccountNumber: loan?.loanAccountNumber ?? null,
          loanId: loan?.id ?? null,
          loanStatus: loan?.loanStatus ?? null,
          nextStep: historyNextStep(serialized.status, loan?.loanStatus),
        };
      }),
    );
    return { items, total: items.length };
  }

  /** Local/dev-only — simulates Admin approve so the customer flow can be tested. */
  async devApprove(userId: string) {
    if (env.NODE_ENV === 'production') {
      throw new ForbiddenError('Dev approve is disabled.');
    }

    const app = await emiApplicationRepository.findByUserId(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    if (
      app.status !== EmiApplicationStatus.PENDING &&
      app.status !== EmiApplicationStatus.UNDER_REVIEW
    ) {
      throw new BadRequestError('Only PENDING or UNDER_REVIEW applications can be approved.', {
        status: app.status,
      });
    }

    return this.finalizeApproval(app, this.buildApprovalTerms(app, {
      adminRemarks: 'Approved via pending-page test button.',
    }), {
      auditAction: 'APPLICATION_APPROVED_DEV',
      userId,
      message: 'Application approved (dev)',
    });
  }

  /**
   * Assign Field Investigation for an EMI application.
   * Does NOT approve the application — FI Accept later returns it to UNDER_REVIEW.
   */
  async adminAssignFi(applicationId: string, adminUserId: string) {
    const app = await emiApplicationRepository.findById(applicationId);
    if (!app) {
      throw new NotFoundError('EMI application not found.');
    }

    if (
      app.status !== EmiApplicationStatus.PENDING &&
      app.status !== EmiApplicationStatus.UNDER_REVIEW
    ) {
      throw new BadRequestError('Only PENDING or UNDER_REVIEW applications can be assigned to FI.', {
        status: app.status,
      });
    }

    const existingFi = jsonDb.findOne('fi_cases', { applicationId: app.id });
    if (existingFi) {
      return existingFi;
    }

    const profile = await emiApplicationRepository.findProfileById(app.userId);
    const created = jsonDb.insert('fi_cases', {
      applicationId: app.id,
      userId: app.userId,
      customerName: profile?.fullName ?? 'Customer',
      mobile: profile?.mobileNumber ?? profile?.mobile_number ?? '',
      productName: app.productName ?? 'Product',
      assignedExecutive: 'Unassigned',
      assignedDate: new Date().toISOString(),
      status: 'pending',
      photoCount: 0,
      gpsLocation: '',
      remarks: '',
    });

    await auditLogService.log({
      userId: app.userId,
      action: 'FI_ASSIGNED',
      entity: 'fi_cases',
      metadata: {
        applicationId: app.id,
        applicationNumber: app.applicationNumber ?? app.id,
        fiCaseId: created.id,
        assignedBy: adminUserId,
        timestamp: new Date().toISOString(),
      },
    });

    return created;
  }

  async adminApprove(applicationId: string, adminUserId: string) {
    const app = await emiApplicationRepository.findById(applicationId);
    if (!app) {
      throw new NotFoundError('EMI application not found.');
    }

    if (
      app.status !== EmiApplicationStatus.PENDING &&
      app.status !== EmiApplicationStatus.UNDER_REVIEW
    ) {
      throw new BadRequestError('Only PENDING or UNDER_REVIEW applications can be approved.', {
        status: app.status,
      });
    }

    const fiCase = jsonDb.findOne('fi_cases', { applicationId: app.id });
    if (!fiCase || String(fiCase.status || '').toLowerCase() !== 'completed') {
      throw new BadRequestError(
        'Field Investigation must be accepted before final application approval.',
        { fiStatus: fiCase?.status ?? null },
      );
    }

    return this.finalizeApproval(app, this.buildApprovalTerms(app, {
      adminRemarks: 'Approved by admin.',
    }), {
      auditAction: 'APPLICATION_APPROVED',
      userId: app.userId,
      message: 'Application approved',
      approvedBy: adminUserId,
    });
  }

  async adminReject(applicationId: string, adminUserId: string, reason?: string) {
    const app = await emiApplicationRepository.findById(applicationId);
    if (!app) {
      throw new NotFoundError('EMI application not found.');
    }

    if (
      app.status !== EmiApplicationStatus.PENDING &&
      app.status !== EmiApplicationStatus.UNDER_REVIEW
    ) {
      throw new BadRequestError('Only PENDING or UNDER_REVIEW applications can be rejected.', {
        status: app.status,
      });
    }

    const updated = await emiApplicationRepository.reject(app.id, reason ?? '');

    await auditLogService.log({
      userId: app.userId,
      action: 'APPLICATION_REJECTED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber: updated.applicationNumber ?? updated.id,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        rejectedBy: adminUserId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      ...serializeApplication(updated),
      message: 'Application rejected',
      nextStep: 'CLOSED' as const,
    };
  }

  async adminModifyTerms(
    applicationId: string,
    adminUserId: string,
    input: {
      approvedAmount?: number;
      approvedTenure?: number;
      approvedDownPayment?: number;
      monthlyEmi?: number;
      interestRate?: number;
      processingFee?: number;
      adminRemarks?: string;
    },
  ) {
    const app = await emiApplicationRepository.findById(applicationId);
    if (!app) {
      throw new NotFoundError('EMI application not found.');
    }

    if (
      app.status !== EmiApplicationStatus.PENDING &&
      app.status !== EmiApplicationStatus.UNDER_REVIEW &&
      app.status !== EmiApplicationStatus.APPROVED
    ) {
      throw new BadRequestError('Only PENDING, UNDER_REVIEW or APPROVED applications can be modified.', {
        status: app.status,
      });
    }

    // Publish to Customer requires FI Accept first (unless already APPROVED / republishing).
    if (app.status !== EmiApplicationStatus.APPROVED) {
      const fiCase = jsonDb.findOne('fi_cases', { applicationId: app.id });
      if (!fiCase || String(fiCase.status || '').toLowerCase() !== 'completed') {
        throw new BadRequestError(
          'Field Investigation must be accepted before publishing terms to the customer.',
          { fiStatus: fiCase?.status ?? null },
        );
      }
    }

    const counterOffer = this.buildApprovalTerms(app, {
      approvedAmount: input.approvedAmount,
      approvedTenure: input.approvedTenure,
      approvedDownPayment: input.approvedDownPayment,
      interestRate: input.interestRate,
      processingFee: input.processingFee,
      // Prefer rate-derived EMI; only use admin monthlyEmi when rate is explicitly 0.
      monthlyEmi: input.monthlyEmi,
      adminRemarks: input.adminRemarks ?? 'Terms modified by admin.',
    });

    const updated = await emiApplicationRepository.modifyTerms(app.id, counterOffer);

    await auditLogService.log({
      userId: app.userId,
      action: 'APPLICATION_TERMS_MODIFIED',
      entity: 'emi_applications',
      metadata: {
        applicationNumber: updated.applicationNumber ?? updated.id,
        status: updated.status,
        terms: counterOffer,
        modifiedBy: adminUserId,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      ...serializeApplication(updated),
      message: 'Loan terms modified. Customer will be asked to accept or decline.',
      nextStep: 'COUNTER_OFFER_SENT' as const,
    };
  }

  /** Derive approval terms with reducing-balance EMI from principal + rate + tenure. */
  private buildApprovalTerms(
    app: any,
    overrides: {
      approvedAmount?: number;
      approvedTenure?: number;
      approvedDownPayment?: number;
      monthlyEmi?: number;
      interestRate?: number;
      processingFee?: number;
      adminRemarks?: string;
    } = {},
  ) {
    const approvedAmount = Number(
      overrides.approvedAmount ?? app.approvedAmount ?? app.requestedAmount ?? app.loanAmount ?? 0,
    );
    const approvedTenure = Number(
      overrides.approvedTenure ?? app.approvedTenure ?? app.requestedTenure ?? 12,
    );
    const approvedDownPayment = Number(
      overrides.approvedDownPayment ??
        app.approvedDownPayment ??
        app.requestedDownPayment ??
        app.downPayment ??
        0,
    );
    const interestRate = Number(
      overrides.interestRate ?? app.interestRate ?? DEFAULT_ANNUAL_INTEREST_RATE_PERCENT,
    );
    const calculatedEmi = calculateMonthlyEmi(approvedAmount, interestRate, approvedTenure);
    const monthlyEmi =
      interestRate === 0 && overrides.monthlyEmi != null && overrides.monthlyEmi > 0
        ? Number(overrides.monthlyEmi)
        : calculatedEmi;

    return {
      approvedAmount,
      approvedTenure,
      approvedDownPayment,
      monthlyEmi,
      interestRate,
      processingFee: Number(overrides.processingFee ?? app.processingFee ?? 499),
      adminRemarks: overrides.adminRemarks ?? 'Approved.',
    };
  }

  private async finalizeApproval(
    app: {
      id: string;
      userId: string;
      productId: string;
      applicationNumber: string;
    },
    approvalData: {
      approvedAmount: number;
      approvedTenure: number;
      approvedDownPayment: number;
      monthlyEmi: number;
      interestRate: number;
      processingFee: number;
      adminRemarks: string;
    },
    options: {
      auditAction: string;
      userId: string;
      message: string;
      approvedBy?: string;
    },
  ) {
    const updated = await emiApplicationRepository.approveForTesting(app.id, approvalData);

    let order = await orderRepository.findByApplicationId(app.id);
    if (!order) {
      const product = await emiApplicationRepository.findProductBrand(app.productId);
      const address = await emiApplicationRepository.findDefaultShippingAddress(app.userId);
      const orderNumber = await this.generateOrderNumber();

      order = await orderRepository.createOnApproval({
        orderNumber,
        applicationId: app.id,
        userId: app.userId,
        productId: app.productId,
        // productBrand: product?.brand ?? null,
        deliveryAddress: address ? formatShippingAddress(address) : 'Address on file',
      });
    }

    await auditLogService.log({
      userId: options.userId,
      action: options.auditAction,
      entity: 'emi_applications',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        applicationNumber: updated.id,
        actionUrl: `/orders/${order.orderNumber}`,
        status: updated.status,
        approvedBy: options.approvedBy ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      ...serializeApplication(updated),
      orderId: order.id,
      orderNumber: order.orderNumber,
      message: options.message,
      nextStep: 'ORDER_DETAILS' as const,
    };
  }

  private generateOrderNumber(): Promise<string> {
    return Promise.resolve(generateSequentialOrderNumber());
  }

  private async generateApplicationNumber(): Promise<string> {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `LX-EMI-${yyyy}${mm}${dd}-`;
    const maxSeq = await emiApplicationRepository.maxApplicationSequenceToday(prefix);
    const seq = String(maxSeq + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  /**
   * Persist selected EMI plan to Mongo (profiles.emiPlanDraft) so logout/new tab
   * / deep links can recover it. Not business-final until EMI submit.
   */
  async savePlanDraft(
    userId: string,
    plan: {
      productId: string;
      variantId?: string;
      productName: string;
      sellingPrice: number;
      requestedAmount: number;
      requestedDownPayment: number;
      requestedTenure: number;
      estimatedMonthlyEmi: number;
    },
  ) {
    if (!plan?.productId) {
      throw new BadRequestError('productId is required for EMI plan draft.');
    }
    await jsonDb.refreshCollection('profiles');
    const profile =
      jsonDb.findOne('profiles', { id: userId }) ||
      jsonDb.findOne('profiles', { userId });
    const draft = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };
    if (profile) {
      await jsonDb.updateAwaited('profiles', { id: profile.id }, { emiPlanDraft: draft });
    } else {
      await jsonDb.insertAwaited('profiles', {
        id: userId,
        userId,
        emiPlanDraft: draft,
      });
    }
    return { saved: true as const, plan: draft };
  }

  async getPlanDraft(userId: string) {
    await jsonDb.refreshCollection('profiles');
    const profile =
      jsonDb.findOne('profiles', { id: userId }) ||
      jsonDb.findOne('profiles', { userId });
    const draft = profile?.emiPlanDraft ?? null;
    if (draft?.productId) {
      return { plan: draft };
    }

    // Recover from an open/pending application when draft was cleared.
    const app =
      (await emiApplicationRepository.findActiveByUserId(userId)) ||
      (await emiApplicationRepository.findByUserId(userId));
    if (
      app?.productId &&
      app.requestedTenure != null &&
      app.requestedAmount != null
    ) {
      return {
        plan: {
          productId: app.productId,
          productName: app.productName ?? '',
          sellingPrice: Number(app.sellingPrice ?? 0),
          requestedAmount: Number(app.requestedAmount ?? 0),
          requestedDownPayment: Number(app.requestedDownPayment ?? 0),
          requestedTenure: Number(app.requestedTenure),
          estimatedMonthlyEmi: Number(app.estimatedMonthlyEmi ?? 0),
          recoveredFromApplicationId: app.id,
        },
      };
    }

    return { plan: null };
  }

  async clearPlanDraft(userId: string) {
    await jsonDb.refreshCollection('profiles');
    const profile =
      jsonDb.findOne('profiles', { id: userId }) ||
      jsonDb.findOne('profiles', { userId });
    if (profile) {
      await jsonDb.updateAwaited('profiles', { id: profile.id }, { emiPlanDraft: null });
    }
    return { cleared: true as const };
  }
}

export const emiApplicationService = new EmiApplicationService();
