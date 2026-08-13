import {
  EmiApplicationStatus,
  OrderStatus,
  PaymentStatus,
  PaymentType,
} from '@prisma/client';
import { jsonDb } from '../../../config/json-db';
import { decrementStockDurable } from '../../../common/utils/inventory';

const PAYABLE_STATUSES: EmiApplicationStatus[] = [
  EmiApplicationStatus.APPROVED,
  EmiApplicationStatus.OFFER_ACCEPTED,
  EmiApplicationStatus.DOWN_PAYMENT_PENDING,
];

export class PaymentRepository {
  findApplicationForUser(applicationId: string, userId: string) {
    const app = jsonDb.findOne('emi_applications', { id: applicationId, userId });
    if (!app) return null;
    const order = jsonDb.findOne('orders', { applicationId: app.id });
    return { ...app, order };
  }

  async findApplicationForUserFresh(applicationId: string, userId: string) {
    await Promise.all([
      jsonDb.refreshCollection('emi_applications'),
      jsonDb.refreshCollection('orders'),
      jsonDb.refreshCollection('paymentTransaction'),
    ]);
    return this.findApplicationForUser(applicationId, userId);
  }

  findLatestApplicationForUser(userId: string) {
    const apps = jsonDb.findMany('emi_applications', { userId })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!apps.length) return null;
    const app = apps[0];
    const order = jsonDb.findOne('orders', { applicationId: app.id });
    return { ...app, order };
  }

  findLatestOrderForUser(userId: string) {
    const orders = jsonDb.findMany('orders', { userId })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!orders.length) return null;
    const order = orders[0];
    const application = jsonDb.findOne('emi_applications', { id: order.applicationId });
    if (!application) return null;
    return { ...order, application };
  }

  findUserById(userId: string) {
    const user = jsonDb.findOne('users', { id: userId });
    if (!user) return null;
    const profile = jsonDb.findOne('profiles', { id: userId });
    return {
      id: user.id,
      fullName: profile?.fullName ?? user.fullName ?? '',
      email: profile?.email ?? user.email ?? '',
      mobile: user.phone ?? user.mobile ?? profile?.mobile_number ?? '',
    };
  }

  findSuccessDownPayment(applicationId: string) {
    const payments = jsonDb.findMany('paymentTransaction', {
      applicationId,
      paymentType: PaymentType.DOWN_PAYMENT,
      paymentStatus: PaymentStatus.SUCCESS,
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return payments.length > 0 ? payments[0] : null;
  }

  /**
   * Lifetime KYC fee — any prior SUCCESS KYC_VERIFICATION for this user.
   * Uses a targeted Mongo query instead of refreshing the whole payment table.
   */
  async findSuccessKycVerification(userId: string) {
    const primary = await jsonDb.findLatestFromMongo(
      'paymentTransaction',
      {
        userId,
        paymentType: PaymentType.KYC_VERIFICATION,
        paymentStatus: PaymentStatus.SUCCESS,
      },
      'paidAt',
    );
    if (primary) return primary;

    // Fallback: older rows may use purpose/status field names.
    const byPurpose = await jsonDb.findLatestFromMongo(
      'paymentTransaction',
      { userId, purpose: 'KYC_VERIFICATION' },
      'paidAt',
    );
    if (
      byPurpose &&
      (byPurpose.paymentStatus === PaymentStatus.SUCCESS || byPurpose.status === 'SUCCESS')
    ) {
      return byPurpose;
    }

    // Last resort: local memory scan (covers recent writes not yet queryable).
    const local = jsonDb
      .findMany('paymentTransaction', { userId })
      .filter(
        (p: any) =>
          (p.purpose === 'KYC_VERIFICATION' || p.paymentType === 'KYC_VERIFICATION' ||
            p.paymentType === PaymentType.KYC_VERIFICATION) &&
          (p.paymentStatus === PaymentStatus.SUCCESS || p.status === 'SUCCESS'),
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.paidAt ?? b.createdAt).getTime() -
          new Date(a.paidAt ?? a.createdAt).getTime(),
      );
    return local.length > 0 ? local[0] : null;
  }

  findByRazorpayOrderId(razorpayOrderId: string) {
    return jsonDb.findOne('paymentTransaction', { razorpayOrderId });
  }

  listByApplicationId(applicationId: string, userId: string) {
    return jsonDb.findMany('paymentTransaction', { applicationId, userId })
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createTransaction(data: {
    applicationId: string;
    userId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  }) {
    // Awaited insert: the payment-completion update later targets this row by
    // id, and a fire-and-forget insert could land AFTER that update — PostgREST
    // update on a missing row returns success with 0 rows affected, silently
    // leaving the transaction stuck on CREATED with no razorpayPaymentId.
    return jsonDb.insertAwaited('paymentTransaction', {
      applicationId: data.applicationId,
      userId: data.userId,
      razorpayOrderId: data.razorpayOrderId,
      amount: data.amount,
      currency: data.currency,
      paymentStatus: PaymentStatus.CREATED,
      paymentType: PaymentType.DOWN_PAYMENT,
    });
  }

  async createKycVerificationTransaction(data: {
    userId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  }) {
    return jsonDb.insertAwaited('paymentTransaction', {
      applicationId: null,
      userId: data.userId,
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: null,
      amount: data.amount,
      currency: data.currency,
      paymentStatus: PaymentStatus.CREATED,
      paymentType: PaymentType.KYC_VERIFICATION,
      purpose: 'KYC_VERIFICATION',
      status: PaymentStatus.CREATED,
      paidAt: null,
    });
  }

  async completeKycVerificationPayment(input: {
    transactionId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const paidAt = new Date().toISOString();
    await jsonDb.updateAwaited(
      'paymentTransaction',
      { id: input.transactionId },
      {
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        paymentStatus: PaymentStatus.SUCCESS,
        status: PaymentStatus.SUCCESS,
        purpose: 'KYC_VERIFICATION',
        paymentType: PaymentType.KYC_VERIFICATION,
        paidAt,
        updatedAt: paidAt,
      },
    );
    return jsonDb.findOne('paymentTransaction', { id: input.transactionId });
  }

  markPending(id: string) {
    jsonDb.update('paymentTransaction', { id }, { paymentStatus: PaymentStatus.PENDING });
    return jsonDb.findOne('paymentTransaction', { id });
  }

  markFailed(id: string) {
    jsonDb.update('paymentTransaction', { id }, { paymentStatus: PaymentStatus.FAILED });
    return jsonDb.findOne('paymentTransaction', { id });
  }

  markRefunded(
    id: string,
    data: { refundId: string; refundStatus: string; refundAmount: number },
  ) {
    jsonDb.update('paymentTransaction', { id }, {
      paymentStatus: PaymentStatus.REFUNDED,
      refundId: data.refundId,
      refundStatus: data.refundStatus,
      refundAmount: data.refundAmount,
      updatedAt: new Date().toISOString(),
    });
    return jsonDb.findOne('paymentTransaction', { id });
  }

  async completePaymentAndCreateOrder(input: {
    transactionId: string;
    applicationId: string;
    userId: string;
    productId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    orderNumber: string;
  }) {
    const estimatedDeliveryDate = new Date();
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);    // Orders may already exist from admin approval on another serverless
    // instance — refresh Mongo before deciding insert vs link.
    await jsonDb.refreshCollection('orders');

    // Awaited mirrors so the SUCCESS status + Razorpay payment id survive a
    // cold start — a fire-and-forget update could be lost when a serverless
    // instance freezes before the mirror lands, leaving the ledger row stuck
    // on CREATED while the customer's UI shows the payment succeeded.
    await jsonDb.updateAwaited('paymentTransaction', { id: input.transactionId }, {

      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
      paymentStatus: PaymentStatus.SUCCESS,
    });
    const payment = jsonDb.findOne('paymentTransaction', { id: input.transactionId });

    await jsonDb.updateAwaited('emi_applications', { id: input.applicationId }, { status: EmiApplicationStatus.ACTIVE_EMI });
    const application = jsonDb.findOne('emi_applications', { id: input.applicationId });

    let existing =
      jsonDb.findOne('orders', { applicationId: input.applicationId }) ??
      (input.orderNumber
        ? jsonDb.findOne('orders', { orderNumber: input.orderNumber })
        : null);
    let order = existing;
    let inventoryDecremented = Boolean(existing?.paymentTransactionId);

    // Reduce inventory exactly once per order — only when this payment is what
    // creates or links the order (a second success short-circuits earlier). The
    // durable variant writes stock to Supabase directly and awaits it, so the
    // decrement survives cold starts / the source-mode catalog refresh.
    const inventoryItems = (() => {
      const rows = Array.isArray(existing?.items) ? existing.items : [];
      if (rows.length > 0) {
        return rows.map((row: any) => ({
          productId: row.productId,
          quantity: row.quantity ?? 1,
          variantId: row.variantId ?? null,
        }));
      }
      return [{ productId: input.productId, quantity: 1, variantId: null }];
    })();

    if (!existing) {
      // Real fulfillment data: derive the delivery address from the customer's
      // saved address book. Courier/tracking/warehouse are intentionally left
      // unset here — they are entered by operations through the admin status
      // update (and persisted by OrderRepository.updateStatus), so receipts and
      // tracking never show fabricated placeholders.
      const defaultAddress =
        jsonDb.findOne('addresses', { userId: input.userId, is_default: true }) ??
        jsonDb.findMany('addresses', { userId: input.userId })[0] ??
        null;

      try {
        order = await jsonDb.insertAwaited('orders', {
          orderNumber: input.orderNumber,
          applicationId: input.applicationId,
          userId: input.userId,
          profileId: input.userId,
          productId: input.productId,
          quantity: 1,
          paymentTransactionId: payment.id,
          orderStatus: OrderStatus.ORDER_CONFIRMED,
          status: OrderStatus.ORDER_CONFIRMED,
          paymentMethod: 'EMI',
          payment_status: 'SUCCESS',
          estimatedDeliveryDate,
          deliveryAddress: defaultAddress?.fullAddress ?? null,
          items: [{ productId: input.productId, quantity: 1 }],
          totalAmount: application?.sellingPrice ?? application?.approvedLoanAmount ?? 0,
          subtotal: application?.sellingPrice ?? application?.approvedLoanAmount ?? 0,
          total: application?.sellingPrice ?? application?.approvedLoanAmount ?? 0,
        });
      } catch (err: any) {
        // Concurrent approve/verify or stale in-memory catalog can race on the
        // unique orderNumber index — recover by linking the existing Mongo row.
        const message = String(err?.message || err || '');
        const isDuplicate =
          err?.code === 11000 || /E11000|duplicate key/i.test(message);
        if (!isDuplicate) throw err;

        await jsonDb.refreshCollection('orders');
        order =
          jsonDb.findOne('orders', { applicationId: input.applicationId }) ??
          jsonDb.findOne('orders', { orderNumber: input.orderNumber });
        if (!order) throw err;

        existing = order;
      }

      if (!inventoryDecremented && order) {
        await decrementStockDurable(inventoryItems);
        inventoryDecremented = true;
      }
    }

    if (order && !order.paymentTransactionId) {
      await jsonDb.updateAwaited('orders', { id: order.id }, {
        paymentTransactionId: payment.id,
        orderStatus: OrderStatus.ORDER_CONFIRMED,
        status: OrderStatus.ORDER_CONFIRMED,
        payment_status: 'SUCCESS',
        estimatedDeliveryDate: order.estimatedDeliveryDate ?? estimatedDeliveryDate,
        applicationId: order.applicationId || input.applicationId,
        userId: order.userId || input.userId,
      });
      order = jsonDb.findOne('orders', { id: order.id });
      if (!inventoryDecremented) {
        await decrementStockDurable(inventoryItems);
        inventoryDecremented = true;
      }
    }

    const freshOrder = order?.id ? jsonDb.findOne('orders', { id: order.id }) : null;
    if (!freshOrder) throw new Error('Order not found');

    await jsonDb.refreshCollection('orderTracking');
    const hasTracking = jsonDb.findMany('orderTracking', { orderId: freshOrder.id }).length;
    if (hasTracking === 0) {
      jsonDb.insert('orderTracking', {
        orderId: freshOrder.id,
        status: 'ORDER_CONFIRMED',
        remarks: 'Order confirmed after successful down payment',
        updatedBy: 'system',
        location: freshOrder.warehouse ?? null,
      });
    }

    return { payment, application, order: freshOrder };
  }

  setApplicationDownPaymentPending(applicationId: string) {
    jsonDb.update('emi_applications', { id: applicationId }, { status: EmiApplicationStatus.DOWN_PAYMENT_PENDING });
    return jsonDb.findOne('emi_applications', { id: applicationId });
  }

  countOrdersToday(prefix: string) {
    const orders = jsonDb.findMany('orders', {});
    return orders.filter((o: any) => o.orderNumber && o.orderNumber.startsWith(prefix)).length;
  }

  findOrderByApplication(applicationId: string, userId: string) {
    const order = jsonDb.findOne('orders', { applicationId, userId });
    if (!order) return null;
    const application = jsonDb.findOne('emi_applications', { id: order.applicationId });
    return { ...order, application };
  }

  findOrderByNumber(orderNumber: string, userId: string) {
    const order = jsonDb.findOne('orders', { orderNumber, userId });
    if (!order) return null;
    const application = jsonDb.findOne('emi_applications', { id: order.applicationId });
    return { ...order, application };
  }

  isPayableStatus(status: EmiApplicationStatus): boolean {
    return PAYABLE_STATUSES.includes(status);
  }
}

export const paymentRepository = new PaymentRepository();

export type DecimalLike = any | number | null | undefined;
