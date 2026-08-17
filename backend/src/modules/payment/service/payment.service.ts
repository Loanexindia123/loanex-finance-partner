import { EmiApplicationStatus, PaymentStatus, PaymentType } from '@prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../../common/errors/app-error';
import { env } from '../../../config/env';
import { resolveProductImage } from '../../../common/utils/product-assets';
import { auditLogService } from '../../verification/service/audit-log.service';
import { loanService } from '../../loan/service/loan.service';
import { cartRepository } from '../../cart/repository/cart.repository';
import { emiPaymentService } from '../../emi-payment/service/emi-payment.service';
import { autopayService } from '../../autopay/service/autopay.service';
import { KYC_FEE_AMOUNT_INR, KYC_VERIFICATION_PURPOSE } from '../kyc-fee.constants';
import { paymentRepository } from '../repository/payment.repository';
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  isPaymentDevBypass,
  signDevPayment,
  verifyRazorpaySignature,
  verifyWebhookSignature,
} from './razorpay.service';

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildSummary(app: any) {
  const productPrice = toNumber(app.sellingPrice || app.productPrice || app.price || 0);
  const loanAmount = toNumber(
    app.approvedAmount || app.loanAmount || app.requestedAmount || productPrice,
  );
  const downPayment = toNumber(
    app.approvedDownPayment || app.downPayment || app.requestedDownPayment || 0,
  );
  const processingFee = toNumber(app.processingFee || app.service_charge || 0);
  const gst =
    processingFee > 0 ? roundMoney((processingFee * env.GST_PERCENT) / 100) : 0;
  const totalPayableToday = roundMoney(downPayment + processingFee + gst);
  const remainingFinancedAmount = roundMoney(Math.max(0, productPrice - downPayment));

  return {
    productPrice,
    loanAmount,
    downPayment,
    processingFee,
    gst,
    gstPercent: env.GST_PERCENT,
    totalPayableToday,
    remainingFinancedAmount,
  };
}

const COMPLETED_DOWN_PAYMENT_STATUSES: EmiApplicationStatus[] = [
  EmiApplicationStatus.DOWN_PAYMENT_COMPLETED,
  EmiApplicationStatus.ORDER_CONFIRMED,
  EmiApplicationStatus.ACTIVE_EMI,
];

function isDownPaymentCompleted(
  app: { status: EmiApplicationStatus; order?: { paymentTransactionId: string | null } | null },
  successPayment: boolean,
): boolean {
  return (
    successPayment ||
    COMPLETED_DOWN_PAYMENT_STATUSES.includes(app.status) ||
    Boolean(app.order?.paymentTransactionId)
  );
}

export class PaymentService {
  async getDownPaymentContext(userId: string, applicationId?: string) {
    const app = applicationId
      ? await paymentRepository.findApplicationForUserFresh(applicationId, userId)
      : await paymentRepository.findLatestApplicationForUser(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    this.assertAccessRedirect(app);

    const success = await paymentRepository.findSuccessDownPayment(app.id);
    if (isDownPaymentCompleted(app, Boolean(success))) {
      throw new ConflictError('Down payment already completed for this application.', {
        code: 'PAYMENT_ALREADY_COMPLETED',
        status: app.status,
        orderNumber: app.order?.orderNumber ?? null,
        nextStep: 'ORDER_CONFIRMATION',
      });
    }

    const summary = buildSummary(app);

    return {
      applicationId: app.id,
      applicationNumber: app.applicationNumber ?? app.id,
      orderNumber: app.order?.orderNumber ?? null,
      orderId: app.order?.id ?? null,
      status: app.status,
      productId: app.productId,
      productName: app.productName,
      productImage: resolveProductImage(app.productId, app.productImage),
      productPrice: summary.productPrice,
      approvedLoanAmount: summary.loanAmount,
      approvedDownPayment: summary.downPayment,
      remainingFinancedAmount: summary.remainingFinancedAmount,
      paymentSummary: summary,
      razorpayKeyId: getRazorpayKeyId(),
      paymentDevBypass: isPaymentDevBypass(),
      currency: env.RAZORPAY_CURRENCY,
      // Reaching this point means assertAccessRedirect passed — the customer
      // is allowed to pay, so the UI can enable the Pay button.
      canPay: true as const,
    };
  }

  async createOrder(
    userId: string,
    meta?: { ipAddress?: string | null; userAgent?: string | null; applicationId?: string },
  ) {
    const app = meta?.applicationId
      ? await paymentRepository.findApplicationForUserFresh(meta.applicationId, userId)
      : await paymentRepository.findLatestApplicationForUser(userId);
    if (!app) {
      throw new NotFoundError('No EMI application found for this account.');
    }

    this.assertCanPay(app.status);

    const existingSuccess = await paymentRepository.findSuccessDownPayment(app.id);
    if (isDownPaymentCompleted(app, Boolean(existingSuccess))) {
      throw new ConflictError('Down payment already completed.', {
        code: 'PAYMENT_ALREADY_COMPLETED',
        nextStep: 'ORDER_CONFIRMATION',
        orderNumber: app.order?.orderNumber ?? null,
        orderId: app.order?.id ?? null,
      });
    }

    const user = await paymentRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const summary = buildSummary(app);
    if (summary.totalPayableToday <= 0) {
      throw new BadRequestError('Invalid down payment amount.');
    }

    const razorpayOrder = await createRazorpayOrder({
      amountInr: summary.totalPayableToday,
      receipt: app.id,
      notes: {
        applicationId: app.id,
        userId,
        paymentType: 'DOWN_PAYMENT',
      },
    });

    const transaction = await paymentRepository.createTransaction({
      applicationId: app.id,
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount: summary.totalPayableToday,
      currency: razorpayOrder.currency,
    });

    if (
      app.status === EmiApplicationStatus.OFFER_ACCEPTED ||
      app.status === EmiApplicationStatus.APPROVED
    ) {
      await paymentRepository.setApplicationDownPaymentPending(app.id);
    }

    await auditLogService.log({
      userId,
      action: 'PAYMENT_ORDER_CREATED',
      entity: 'payment_transactions',
      metadata: {
        applicationNumber: app.applicationNumber ?? app.id,
        razorpayOrderId: razorpayOrder.id,
        amount: summary.totalPayableToday,
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    return {
      applicationId: app.id,
      applicationNumber: app.applicationNumber ?? app.id,
      transactionId: transaction.id,
      razorpayOrderId: razorpayOrder.id,
      amount: summary.totalPayableToday,
      amountPaise: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      paymentDevBypass: isPaymentDevBypass(),
      customer: {
        name: user.fullName,
        email: user.email,
        contact: user.mobile,
      },
      prefill: {
        name: user.fullName,
        email: user.email,
        contact: user.mobile,
      },
      notes: {
        applicationNumber: app.applicationNumber ?? app.id,
        productName: app.productName ?? app.productId,
      },
    };
  }

  async verifyPayment(
    userId: string,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const transaction = await paymentRepository.findByRazorpayOrderId(
      input.razorpayOrderId,
    );
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Payment order not found for this account.');
    }

    if (transaction.paymentStatus === PaymentStatus.SUCCESS) {
      // Prior verify may have marked SUCCESS then crashed (e.g. duplicate order
      // insert). Finish loan/order side-effects so the customer is not stuck.
      const loan = await loanService.ensureLoanAfterDownPayment(transaction.applicationId);
      const order = await paymentRepository.findOrderByApplication(
        transaction.applicationId,
        userId,
      );
      return {
        paymentStatus: 'SUCCESS' as const,
        alreadyProcessed: true,
        orderNumber: order?.orderNumber ?? null,
        orderId: order?.id ?? null,
        loanAccountNumber: loan?.loanAccountNumber ?? null,
        nextStep: 'ORDER_CONFIRMATION' as const,
      };
    }

    const valid = verifyRazorpaySignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });

    if (!valid) {
      await paymentRepository.markFailed(transaction.id);
      await auditLogService.log({
        userId,
        action: 'PAYMENT_SIGNATURE_FAILED',
        entity: 'payment_transactions',
        metadata: {
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          timestamp: new Date().toISOString(),
          ipAddress: meta?.ipAddress ?? null,
        },
      });
      throw new BadRequestError('Payment signature verification failed.', {
        code: 'SIGNATURE_FAILED',
      });
    }

    // Server-side confirmation — never trust frontend callback alone.
    if (!isPaymentDevBypass()) {
      const remote = await fetchRazorpayPayment(input.razorpayPaymentId);
      const okStatus = ['captured', 'authorized'].includes(String(remote.status).toLowerCase());
      if (!okStatus) {
        await paymentRepository.markFailed(transaction.id);
        throw new BadRequestError('Payment not captured at Razorpay.', {
          code: 'PAYMENT_NOT_CAPTURED',
          status: remote.status,
        });
      }
      if (remote.orderId && remote.orderId !== input.razorpayOrderId) {
        await paymentRepository.markFailed(transaction.id);
        throw new BadRequestError('Payment order mismatch.', {
          code: 'ORDER_MISMATCH',
        });
      }
      const expectedPaise = Math.round(toNumber(transaction.amount) * 100);
      if (remote.amount != null && expectedPaise > 0 && Number(remote.amount) !== expectedPaise) {
        await paymentRepository.markFailed(transaction.id);
        throw new BadRequestError('Payment amount mismatch.', {
          code: 'AMOUNT_MISMATCH',
          expectedPaise,
          actualPaise: remote.amount,
        });
      }
    }

    const app = await paymentRepository.findApplicationForUserFresh(
      transaction.applicationId,
      userId,
    );
    if (!app) {
      throw new NotFoundError('EMI application not found.');
    }

    const orderNumber =
      app.order?.orderNumber ?? (await this.generateOrderNumber());
    const result = await paymentRepository.completePaymentAndCreateOrder({
      transactionId: transaction.id,
      applicationId: app.id,
      userId,
      productId: app.productId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
      orderNumber,
    });

    const loan = await loanService.ensureLoanAfterDownPayment(app.id);

    // Down payment succeeded — the purchased product leaves the cart. The cart
    // is kept until this point so abandoned EMI flows don't empty it.
    await cartRepository.removeProducts(userId, [app.productId]);

    await auditLogService.log({
      userId,
      action: 'PAYMENT_SUCCESS',
      entity: 'payment_transactions',
      metadata: {
        applicationNumber: app.applicationNumber ?? app.id,
        orderNumber: result.order.orderNumber,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amount: toNumber(transaction.amount),
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    await auditLogService.log({
      userId,
      action: 'ORDER_CREATED',
      entity: 'orders',
      metadata: {
        orderNumber: result.order.orderNumber,
        applicationNumber: app.applicationNumber ?? app.id,
        paymentTransactionId: result.payment.id,
        productId: app.productId,
        timestamp: new Date().toISOString(),
      },
    });

    await auditLogService.log({
      userId,
      action: 'ORDER_CONFIRMED',
      entity: 'orders',
      metadata: {
        orderNumber: result.order.orderNumber,
        orderStatus: result.order.orderStatus,
        estimatedDeliveryDate: result.order.estimatedDeliveryDate instanceof Date
          ? result.order.estimatedDeliveryDate.toISOString()
          : String(result.order.estimatedDeliveryDate ?? ''),
        timestamp: new Date().toISOString(),
      },
    });

    return {
      paymentStatus: 'SUCCESS' as const,
      alreadyProcessed: false,
      transactionId: result.payment.id,
      applicationId: app.id,
      applicationNumber: app.applicationNumber ?? app.id,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      orderStatus: result.order.orderStatus,
      loanAccountNumber: loan.loanAccountNumber,
      amount: toNumber(result.payment.amount),
      currency: result.payment.currency,
      nextStep: 'ORDER_CONFIRMATION' as const,
    };
  }

  /** Dev-only helper to complete checkout without Razorpay UI. */
  async createDevBypassSignature(userId: string, razorpayOrderId: string) {
    if (!isPaymentDevBypass()) {
      throw new ForbiddenError('Dev payment bypass is disabled.');
    }

    const transaction = await paymentRepository.findByRazorpayOrderId(razorpayOrderId);
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Payment order not found for this account.');
    }

    const paymentId = `pay_dev_${Date.now()}`;
    return {
      razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signDevPayment(razorpayOrderId, paymentId),
    };
  }

  async getByApplicationId(applicationId: string, userId: string) {
    const app = await paymentRepository.findApplicationForUser(applicationId, userId);
    if (!app) {
      throw new NotFoundError('EMI application not found for this account.');
    }

    const payments = await paymentRepository.listByApplicationId(applicationId, userId);
    const order = app.order;

    return {
      applicationId: app.id,
      applicationNumber: app.applicationNumber ?? app.id,
      status: app.status,
      order: order
        ? {
            id: order.id,
            orderNumber: order.orderNumber,
            orderStatus: order.orderStatus,
            productId: order.productId,
            createdAt: order.createdAt,
          }
        : null,
      payments: payments.map((p) => ({
        id: p.id,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: toNumber(p.amount),
        currency: p.currency,
        paymentStatus: p.paymentStatus,
        paymentType: p.paymentType,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  async getOrderConfirmation(userId: string, orderNumber?: string) {
    const order = orderNumber
      ? await paymentRepository.findOrderByNumber(orderNumber, userId)
      : await (async () => {
    const app = await paymentRepository.findLatestApplicationForUser(userId);
    if (!app?.order) return null;
          return paymentRepository.findOrderByApplication(app.id, userId);
        })();

    const latestOrder = order ?? (await paymentRepository.findLatestOrderForUser(userId));

    if (!latestOrder) {
      throw new NotFoundError('Order not found for this account.');
    }

    const summary = buildSummary(latestOrder.application);

    return {
      orderNumber: latestOrder.orderNumber,
      orderStatus: latestOrder.orderStatus,
      applicationNumber:
        latestOrder.application.applicationNumber ?? latestOrder.application.id,
      productId: latestOrder.productId,
      productName: latestOrder.application.productName,
      productImage: resolveProductImage(latestOrder.productId),
      productPrice: summary.productPrice,
      approvedLoanAmount: summary.loanAmount,
      approvedDownPayment: summary.downPayment,
      amountPaidToday: summary.totalPayableToday,
      createdAt: latestOrder.createdAt,
    };
  }

  private assertCanPay(status: EmiApplicationStatus) {
    if (!paymentRepository.isPayableStatus(status)) {
      throw new BadRequestError('Down payment is not available for this application.', {
        code: 'PAYMENT_NOT_AVAILABLE',
        status,
      });
    }
  }

  private assertAccessRedirect(app: {
    status: EmiApplicationStatus;
    order?: { orderNumber?: string | null; id?: string | null } | null;
  }) {
    const status = app.status;
    if (
      status === EmiApplicationStatus.DOWN_PAYMENT_COMPLETED ||
      status === EmiApplicationStatus.ORDER_CONFIRMED ||
      status === EmiApplicationStatus.ACTIVE_EMI
    ) {
      throw new ConflictError('Down payment already completed.', {
        code: 'PAYMENT_ALREADY_COMPLETED',
        status,
        orderNumber: app.order?.orderNumber ?? null,
        orderId: app.order?.id ?? null,
        nextStep: 'ORDER_CONFIRMATION',
      });
    }

    if (!paymentRepository.isPayableStatus(status)) {
      throw new BadRequestError('Down payment is not available for this application.', {
        code: 'PAYMENT_NOT_AVAILABLE',
        status,
      });
    }
  }

  async fetchPayment(userId: string, paymentId: string) {
    const remote = await fetchRazorpayPayment(paymentId);
    const transaction = remote.orderId
      ? await paymentRepository.findByRazorpayOrderId(remote.orderId)
      : null;

    // Do not act as a Razorpay oracle for payments with no local ownership.
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Payment not found for this account.');
    }

    return {
      paymentId: remote.id,
      status: remote.status,
      orderId: remote.orderId,
      amountPaise: remote.amount,
      currency: remote.currency,
      method: remote.method,
      localStatus: transaction.paymentStatus ?? null,
      transactionId: transaction.id ?? null,
    };
  }

  async refundPayment(
    userId: string,
    input: { razorpayPaymentId: string; amountInr?: number; reason?: string },
  ) {
    const remote = await fetchRazorpayPayment(input.razorpayPaymentId);
    const transaction = remote.orderId
      ? await paymentRepository.findByRazorpayOrderId(remote.orderId)
      : null;

    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Payment not found for this account.');
    }

    if (transaction.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new BadRequestError('Only successful payments can be refunded.');
    }

    const amountPaise =
      input.amountInr != null
        ? Math.round(input.amountInr * 100)
        : undefined;

    const refund = await createRazorpayRefund({
      paymentId: input.razorpayPaymentId,
      amountPaise,
      notes: {
        userId,
        reason: input.reason ?? 'customer_refund',
        transactionId: transaction.id,
      },
    });

    await paymentRepository.markRefunded(transaction.id, {
      refundId: refund.id,
      refundStatus: refund.status,
      refundAmount: refund.amount,
    });

    await auditLogService.log({
      userId,
      action: 'PAYMENT_REFUND_CREATED',
      entity: 'payment_transactions',
      metadata: {
        transactionId: transaction.id,
        razorpayPaymentId: input.razorpayPaymentId,
        refundId: refund.id,
        amount: refund.amount,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      refundId: refund.id,
      status: refund.status,
      amountPaise: refund.amount,
      transactionId: transaction.id,
    };
  }

  /**
   * Razorpay webhook — success (payment.captured) and failure (payment.failed).
   * Signature validated before any state change.
   */
  async handleWebhook(
    rawBody: string | Buffer,
    signature: string | undefined,
    parsed?: any,
  ) {
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestError('Invalid webhook signature.', {
        code: 'WEBHOOK_SIGNATURE_FAILED',
      });
    }

    const event = parsed ?? JSON.parse(
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'),
    );
    const eventName = String(event?.event ?? '');

    // AutoDebit events (subscription lifecycle + recurring invoice collection)
    // carry no order id — route them to AutopayService before the order lookup.
    // Razorpay collects the recurring EMI automatically; these events mark the
    // EMI paid (invoice.paid) or record the failure (invoice.payment_failed).
    if (eventName.startsWith('subscription.') || eventName.startsWith('invoice.')) {
      return autopayService.handleRazorpayWebhook(eventName, event);
    }

    const paymentEntity =
      event?.payload?.payment?.entity ?? event?.payload?.payment ?? null;
    const orderEntity = event?.payload?.order?.entity ?? null;

    const paymentId = paymentEntity?.id ? String(paymentEntity.id) : null;
    const orderId =
      (paymentEntity?.order_id ? String(paymentEntity.order_id) : null) ??
      (orderEntity?.id ? String(orderEntity.id) : null);

    if (!orderId) {
      return { handled: false, reason: 'NO_ORDER_ID', event: eventName };
    }

    const transaction = await paymentRepository.findByRazorpayOrderId(orderId);
    if (!transaction) {
      return { handled: false, reason: 'UNKNOWN_ORDER', event: eventName, orderId };
    }

    // This webhook completes EMI down-payments, monthly EMI instalments, and
    // KYC fee captures. DIRECT (FULL_PAYMENT) transactions live in the same
    // collection but are completed by the checkout module's verify flow —
    // without this guard a DIRECT payment would fall through to the user's
    // latest EMI application and complete (and now decrement stock for) the
    // wrong order.
    const isEmiInstalment = transaction.paymentType === 'EMI';
    const isKycVerification = transaction.paymentType === PaymentType.KYC_VERIFICATION;
    if (
      !isEmiInstalment &&
      !isKycVerification &&
      (!transaction.applicationId || transaction.paymentType !== 'DOWN_PAYMENT')
    ) {
      return {
        handled: false,
        reason: 'UNSUPPORTED_PAYMENT_TYPE',
        event: eventName,
        orderId,
      };
    }

    if (
      eventName === 'payment.captured' ||
      eventName === 'order.paid' ||
      String(paymentEntity?.status).toLowerCase() === 'captured'
    ) {
      if (transaction.paymentStatus === PaymentStatus.SUCCESS) {
        return { handled: true, alreadyProcessed: true, event: eventName };
      }

      // Amount must match for KYC, EMI, and DOWN_PAYMENT before any completion.
      const expectedPaise = Math.round(toNumber(transaction.amount) * 100);
      const remoteAmount = paymentEntity?.amount != null ? Number(paymentEntity.amount) : null;
      if (remoteAmount != null && expectedPaise > 0 && remoteAmount !== expectedPaise) {
        await auditLogService.log({
          userId: transaction.userId,
          action: 'PAYMENT_WEBHOOK_AMOUNT_MISMATCH',
          entity: 'payment_transactions',
          metadata: {
            event: eventName,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            paymentType: transaction.paymentType,
            expectedPaise,
            actualPaise: remoteAmount,
            timestamp: new Date().toISOString(),
          },
        });
        return {
          handled: false,
          reason: 'AMOUNT_MISMATCH',
          event: eventName,
          orderId,
          expectedPaise,
          actualPaise: remoteAmount,
        };
      }

      // Lifetime KYC fee — mark SUCCESS only; do not create EMI order/loan.
      if (isKycVerification) {
        await paymentRepository.completeKycVerificationPayment({
          transactionId: transaction.id,
          razorpayPaymentId: paymentId ?? `wh_${Date.now()}`,
          razorpaySignature: signature,
        });

        await auditLogService.log({
          userId: transaction.userId,
          action: 'KYC_FEE_WEBHOOK_SUCCESS',
          entity: 'payment_transactions',
          metadata: {
            event: eventName,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            purpose: KYC_VERIFICATION_PURPOSE,
            timestamp: new Date().toISOString(),
          },
        });

        return {
          handled: true,
          paymentStatus: 'SUCCESS',
          event: eventName,
          purpose: KYC_VERIFICATION_PURPOSE,
        };
      }

      // Monthly EMI instalment captured — complete it server-side so the
      // schedule updates even if the customer's tab closed before /verify.
      if (isEmiInstalment) {
        const completed = await emiPaymentService.completeEmiFromWebhook(
          transaction,
          paymentId ?? `wh_${Date.now()}`,
          eventName,
        );
        return {
          handled: completed.handled,
          alreadyProcessed: completed.alreadyProcessed,
          reason: completed.reason,
          event: eventName,
          emiId: completed.emiId,
          orderId,
        };
      }

      // Never fall back to "latest application" — wrong loan/order side effects.
      if (!transaction.applicationId) {
        return { handled: false, reason: 'APPLICATION_ID_MISSING', event: eventName, orderId };
      }
      const application = await paymentRepository.findApplicationForUser(
        transaction.applicationId,
        transaction.userId,
      );

      if (!application) {
        return { handled: false, reason: 'APPLICATION_MISSING', event: eventName };
      }

      const orderNumber =
        application.order?.orderNumber ?? (await this.generateOrderNumber());

      await paymentRepository.completePaymentAndCreateOrder({
        transactionId: transaction.id,
        applicationId: application.id,
        userId: transaction.userId,
        productId: application.productId,
        razorpayPaymentId: paymentId ?? `wh_${Date.now()}`,
        razorpaySignature: signature,
        orderNumber,
      });

      await loanService.ensureLoanAfterDownPayment(application.id);
      await cartRepository.removeProducts(transaction.userId, [application.productId]);

      await auditLogService.log({
        userId: transaction.userId,
        action: 'PAYMENT_WEBHOOK_SUCCESS',
        entity: 'payment_transactions',
        metadata: {
          event: eventName,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          timestamp: new Date().toISOString(),
        },
      });

      return { handled: true, paymentStatus: 'SUCCESS', event: eventName };
    }

    if (
      eventName === 'payment.failed' ||
      String(paymentEntity?.status).toLowerCase() === 'failed'
    ) {
      if (transaction.paymentStatus !== PaymentStatus.SUCCESS) {
        await paymentRepository.markFailed(transaction.id);
      }

      await auditLogService.log({
        userId: transaction.userId,
        action: 'PAYMENT_WEBHOOK_FAILED',
        entity: 'payment_transactions',
        metadata: {
          event: eventName,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          timestamp: new Date().toISOString(),
        },
      });

      return { handled: true, paymentStatus: 'FAILED', event: eventName };
    }

    return { handled: false, reason: 'UNHANDLED_EVENT', event: eventName };
  }

  // ── Lifetime one-time KYC verification fee (₹399) ─────────────────────────

  async getKycFeeStatus(userId: string) {
    const existing = await paymentRepository.findSuccessKycVerification(userId);
    if (existing) {
      return {
        paid: true as const,
        amount: KYC_FEE_AMOUNT_INR,
        purpose: KYC_VERIFICATION_PURPOSE,
        paymentId: existing.id,
        razorpayOrderId: existing.razorpayOrderId ?? null,
        razorpayPaymentId: existing.razorpayPaymentId ?? null,
        paidAt: existing.paidAt ?? existing.updatedAt ?? existing.createdAt ?? null,
      };
    }
    return {
      paid: false as const,
      amount: KYC_FEE_AMOUNT_INR,
      purpose: KYC_VERIFICATION_PURPOSE,
      paymentId: null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      paidAt: null,
    };
  }

  async createKycFeeOrder(
    userId: string,
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const alreadyPaid = await paymentRepository.findSuccessKycVerification(userId);
    if (alreadyPaid) {
      throw new ConflictError('KYC verification fee already paid for this account.', {
        code: 'KYC_FEE_ALREADY_PAID',
        paid: true,
        amount: KYC_FEE_AMOUNT_INR,
        purpose: KYC_VERIFICATION_PURPOSE,
        paymentId: alreadyPaid.id,
        paidAt: alreadyPaid.paidAt ?? alreadyPaid.updatedAt ?? null,
      });
    }

    const user = await paymentRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const amountInr = KYC_FEE_AMOUNT_INR;
    const razorpayOrder = await createRazorpayOrder({
      amountInr,
      receipt: `kyc_${userId}`.slice(0, 40),
      notes: {
        userId,
        purpose: KYC_VERIFICATION_PURPOSE,
        paymentType: PaymentType.KYC_VERIFICATION,
      },
    });

    const transaction = await paymentRepository.createKycVerificationTransaction({
      userId,
      razorpayOrderId: razorpayOrder.id,
      amount: amountInr,
      currency: razorpayOrder.currency,
    });

    await auditLogService.log({
      userId,
      action: 'KYC_FEE_ORDER_CREATED',
      entity: 'payment_transactions',
      metadata: {
        razorpayOrderId: razorpayOrder.id,
        amount: amountInr,
        purpose: KYC_VERIFICATION_PURPOSE,
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    return {
      transactionId: transaction.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountInr,
      amountPaise: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      paymentDevBypass: isPaymentDevBypass(),
      purpose: KYC_VERIFICATION_PURPOSE,
      customer: {
        name: user.fullName,
        email: user.email,
        contact: user.mobile,
      },
      prefill: {
        name: user.fullName,
        email: user.email,
        contact: user.mobile,
      },
      notes: {
        purpose: KYC_VERIFICATION_PURPOSE,
      },
    };
  }

  async verifyKycFeePayment(
    userId: string,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
    meta?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    // Lifetime check first — never double-charge / double-mark.
    const alreadyPaid = await paymentRepository.findSuccessKycVerification(userId);
    if (alreadyPaid) {
      return {
        paymentStatus: 'SUCCESS' as const,
        alreadyProcessed: true,
        purpose: KYC_VERIFICATION_PURPOSE,
        amount: KYC_FEE_AMOUNT_INR,
        transactionId: alreadyPaid.id,
        razorpayOrderId: alreadyPaid.razorpayOrderId ?? input.razorpayOrderId,
        razorpayPaymentId: alreadyPaid.razorpayPaymentId ?? input.razorpayPaymentId,
        paidAt: alreadyPaid.paidAt ?? alreadyPaid.updatedAt ?? null,
      };
    }

    const transaction = await paymentRepository.findByRazorpayOrderId(input.razorpayOrderId);
    if (
      !transaction ||
      transaction.userId !== userId ||
      transaction.paymentType !== PaymentType.KYC_VERIFICATION
    ) {
      throw new NotFoundError('KYC verification payment order not found for this account.');
    }

    if (transaction.paymentStatus === PaymentStatus.SUCCESS) {
      return {
        paymentStatus: 'SUCCESS' as const,
        alreadyProcessed: true,
        purpose: KYC_VERIFICATION_PURPOSE,
        amount: KYC_FEE_AMOUNT_INR,
        transactionId: transaction.id,
        razorpayOrderId: transaction.razorpayOrderId,
        razorpayPaymentId: transaction.razorpayPaymentId ?? input.razorpayPaymentId,
        paidAt: transaction.paidAt ?? transaction.updatedAt ?? null,
      };
    }

    // Backend-enforced amount — never trust client.
    if (Number(transaction.amount) !== KYC_FEE_AMOUNT_INR) {
      await paymentRepository.markFailed(transaction.id);
      throw new BadRequestError('Invalid KYC fee amount on payment order.', {
        code: 'KYC_FEE_AMOUNT_MISMATCH',
        expected: KYC_FEE_AMOUNT_INR,
        actual: Number(transaction.amount),
      });
    }

    const valid = verifyRazorpaySignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });

    if (!valid) {
      await paymentRepository.markFailed(transaction.id);
      await auditLogService.log({
        userId,
        action: 'KYC_FEE_SIGNATURE_FAILED',
        entity: 'payment_transactions',
        metadata: {
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          timestamp: new Date().toISOString(),
          ipAddress: meta?.ipAddress ?? null,
        },
      });
      throw new BadRequestError('Payment signature verification failed.', {
        code: 'SIGNATURE_FAILED',
      });
    }

    if (!isPaymentDevBypass()) {
      const remote = await fetchRazorpayPayment(input.razorpayPaymentId);
      const okStatus = ['captured', 'authorized'].includes(String(remote.status).toLowerCase());
      if (!okStatus) {
        await paymentRepository.markFailed(transaction.id);
        throw new BadRequestError('Payment not captured at Razorpay.', {
          code: 'PAYMENT_NOT_CAPTURED',
          status: remote.status,
        });
      }
      if (remote.orderId && remote.orderId !== input.razorpayOrderId) {
        await paymentRepository.markFailed(transaction.id);
        throw new BadRequestError('Payment order mismatch.', {
          code: 'ORDER_MISMATCH',
        });
      }
      // Razorpay amount is in paise
      if (remote.amount && remote.amount !== KYC_FEE_AMOUNT_INR * 100) {
        await paymentRepository.markFailed(transaction.id);
        throw new BadRequestError('Razorpay amount does not match KYC fee.', {
          code: 'KYC_FEE_AMOUNT_MISMATCH',
          expectedPaise: KYC_FEE_AMOUNT_INR * 100,
          actualPaise: remote.amount,
        });
      }
    }

    const payment = await paymentRepository.completeKycVerificationPayment({
      transactionId: transaction.id,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
    });

    await auditLogService.log({
      userId,
      action: 'KYC_FEE_PAYMENT_SUCCESS',
      entity: 'payment_transactions',
      metadata: {
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amount: KYC_FEE_AMOUNT_INR,
        purpose: KYC_VERIFICATION_PURPOSE,
        timestamp: new Date().toISOString(),
        ipAddress: meta?.ipAddress ?? null,
        device: meta?.userAgent ?? null,
      },
    });

    return {
      paymentStatus: 'SUCCESS' as const,
      alreadyProcessed: false,
      purpose: KYC_VERIFICATION_PURPOSE,
      amount: KYC_FEE_AMOUNT_INR,
      transactionId: payment?.id ?? transaction.id,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      paidAt: payment?.paidAt ?? new Date().toISOString(),
    };
  }

  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `LX-ORD-${yyyy}${mm}${dd}-`;
    const count = await paymentRepository.countOrdersToday(prefix);
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

export const paymentService = new PaymentService();
