import {
  BadRequestError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { jsonDb } from '../../../config/json-db';
import { auditLogService } from '../../verification/service/audit-log.service';
import { loanService } from '../../loan/service/loan.service';
import {
  OrderStatus,
  orderRepository,
  STATUS_FLOW,
  type OrderStatusType,
} from '../repository/order.repository';
import {
  buildOrderPayload,
  buildTrackingPayload,
  effectiveEmiPaymentStatus,
  emiRowAmount,
  generateOrderInvoicePdf,
  generateOrderReceiptPdf,
} from './receipt.service';
import {
  resolveProductBrand,
  resolveProductImage,
} from '../../../common/utils/product-assets';

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export class OrderService {
  async list(userId: string) {
    const orders = await orderRepository.listForUser(userId);
    const items = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      applicationId: order.applicationId ?? null,
      orderDate: order.createdAt,
      orderAmount: toNumber(order.application?.sellingPrice ?? order.totalAmount),
      paymentType: order.paymentMethod ?? 'FULL PAYMENT',
      orderStatus: order.orderStatus ?? 'CONFIRMED',
      loanStatus: order.loan?.loanStatus ?? null,
      outstandingAmount: order.loan ? toNumber(order.loan.outstandingAmount ?? 0) : null,
      paidEmiCount: (order.emiSchedules ?? []).filter(
        (s: any) => String(s.paymentStatus ?? '').toUpperCase() === 'PAID',
      ).length,
      totalEmiCount: (order.emiSchedules ?? []).length,
      // EMI tenure from the real loan ledger (drives the mobile "EMI · 6mo" label).
      emiTenureMonths:
        toNumber(
          order.loan?.loanTenure ??
            order.application?.approvedTenure ??
            order.application?.tenure ??
            order.application?.months ??
            order.application?.requestedTenure ??
            0,
        ) || null,
      product: {
        id: order.productId,
        // Prefer the real product (resolved from the order items) over the
        // application's denormalized copy, which can hold stale placeholders.
        name: order.items?.[0]?.product?.name ?? order.application?.productName ?? 'Product',
        brand: resolveProductBrand(order.productId, order.productBrand),
        imageUrl:
          order.items?.[0]?.product?.imageUrl ||
          order.application?.productImage ||
          resolveProductImage(order.productId),
      },
    }));

    return { items, totalItems: items.length };
  }

  async adminList() {
    const orders = await orderRepository.adminListAll();
    const items = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      orderAmount: toNumber(order.application?.sellingPrice || order.totalAmount),
      paymentType: order.paymentMethod || 'EMI',
      orderStatus: order.orderStatus || order.status,
      paymentStatus: order.payment_status ?? order.paymentTransaction?.paymentStatus ?? null,
      loanStatus: order.loan?.loanStatus ?? null,
      outstandingAmount: toNumber(order.loan?.outstandingAmount) || null,
      paidEmiCount: (order.emiSchedules ?? []).filter(
        (s: any) => String(s.paymentStatus ?? '').toUpperCase() === 'PAID',
      ).length,
      totalEmiCount: (order.emiSchedules ?? []).length,
      customerName: order.user?.fullName || 'Unknown',
      customerMobile: order.user?.mobile || 'Unknown',
      product: order.items && order.items.length > 0 ? {
        id: order.items[0].productId,
        name: order.items[0].product?.name || order.application?.productName || order.items[0].productId,
        brand: resolveProductBrand(order.items[0].productId, order.items[0].product?.brand),
        imageUrl: order.items[0].product?.imageUrl || order.application?.productImage || resolveProductImage(order.items[0].productId),
      } : (order.application ? {
        id: order.productId,
        name: order.application.productName ?? order.productId,
        brand: resolveProductBrand(order.productId, order.productBrand),
        imageUrl: order.application.productImage || resolveProductImage(order.productId),
      } : null),
      items: order.items && order.items.length > 0 ? order.items.map((i: any) => ({
        product: {
          id: i.productId,
          name: i.product?.name || i.productId,
          brand: resolveProductBrand(i.productId, i.product?.brand),
          imageUrl: i.product?.imageUrl || resolveProductImage(i.productId),
        },
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        variantId: i.variantId ?? null,
      })) : undefined,
    }));

    return { items, totalItems: items.length };
  }

  async adminGetById(orderId: string) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      orderAmount: toNumber(order.application?.sellingPrice || order.totalAmount),
      paymentType: order.paymentMethod || 'EMI',
      orderStatus: order.orderStatus || order.status,
      paymentStatus: order.payment_status ?? order.paymentTransaction?.paymentStatus ?? null,
      transactionDate: order.paymentTransaction?.createdAt
        ? new Date(order.paymentTransaction.createdAt).toISOString()
        : order.createdAt ?? null,
      customerName: order.user?.fullName || 'Unknown',
      customerMobile: order.user?.mobile || 'Unknown',
      customerId: order.user?.id || order.userId,
      productId: order.productId,
      productName: order.application?.productName ?? order.productId,
      sellingPrice: toNumber(order.application?.sellingPrice),
      totalAmount: toNumber(order.totalAmount ?? order.application?.sellingPrice),
      quantity: order.quantity ?? 1,
      productImageUrl: order.application?.productImage || resolveProductImage(order.productId),
      // Real EMI terms from the approved loan (fall back to the application's
      // requested/estimated values only when no loan row exists yet).
      emiPlan:
        order.loan?.loanTenure || order.application?.tenure || order.application?.approvedTenure
          ? `${toNumber(order.loan?.loanTenure ?? order.application?.tenure ?? order.application?.approvedTenure)} Months EMI`
          : null,
      emiAmount:
        toNumber(
          order.loan?.emiAmount ??
            order.application?.monthlyEmi ??
            order.application?.estimatedMonthlyEmi ??
            order.application?.emiAmount,
        ) || null,
      emiDuration:
        order.loan?.loanTenure || order.application?.tenure || order.application?.approvedTenure
          ? `${toNumber(order.loan?.loanTenure ?? order.application?.tenure ?? order.application?.approvedTenure)} Months`
          : null,
      downPayment:
        toNumber(
          order.application?.approvedDownPayment ??
            order.application?.requestedDownPayment ??
            order.application?.downPayment,
        ) || null,
      loanAmount:
        toNumber(
          order.loan?.loanAmount ??
            order.application?.approvedAmount ??
            order.application?.loanAmount ??
            order.application?.requestedAmount,
        ) || null,
      interestRate:
        toNumber(order.loan?.interestRate ?? order.application?.interestRate) || null,
      processingFee:
        toNumber(
          order.loan?.processingFee ??
            order.application?.processingFee ??
            order.application?.service_charge,
        ) || null,
      loanStatus: order.loan?.loanStatus ?? null,
      loanAccountNumber: order.loan?.loanAccountNumber ?? null,
      outstandingAmount: order.loan
        ? toNumber(order.loan.outstandingAmount ?? 0)
        : null,
      paidEmiCount: (order.emiSchedules ?? []).filter(
        (s: any) => String(s.paymentStatus ?? '').toUpperCase() === 'PAID',
      ).length,
      totalEmiCount: (order.emiSchedules ?? []).length,
      // Real fulfillment fields (set via adminUpdateStatus) — never fabricate
      // courier/tracking placeholders here.
      courierPartner: order.courierPartner ?? null,
      trackingNumber: order.trackingNumber ?? null,
      estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
      warehouse: order.warehouse ?? null,
      // ── Live loan ledger (same source as the customer payload) ───────────
      downPaymentCollected:
        Boolean(order.applicationId) &&
        order.paymentTransaction &&
        String(order.paymentTransaction.paymentStatus ?? '').toUpperCase() === 'SUCCESS'
          ? toNumber(order.paymentTransaction.amount)
          : 0,
      amountPaid: (() => {
        const schedules = Array.isArray(order.emiSchedules) ? order.emiSchedules : [];
        const emiCollected = schedules
          .filter((s: any) => String(s.paymentStatus ?? '').toUpperCase() === 'PAID')
          .reduce((sum: number, s: any) => sum + emiRowAmount(s), 0);
        const dpCollected =
          order.paymentTransaction &&
          String(order.paymentTransaction.paymentStatus ?? '').toUpperCase() === 'SUCCESS'
            ? toNumber(order.paymentTransaction.amount)
            : 0;
        const rawMethod = String(
          order.paymentMethod ?? order.payment_method ?? '',
        ).toUpperCase();
        const isEmi =
          Boolean(order.applicationId) || rawMethod === 'EMI';
        const isCod = !order.applicationId && rawMethod === 'COD';
        if (isEmi) return Math.round((dpCollected + emiCollected) * 100) / 100;
        // COD cash is only collected at delivery — ₹0 until then.
        if (isCod) return dpCollected;
        return dpCollected > 0
          ? dpCollected
          : toNumber(
              order.totalAmount ?? order.total_amount ?? order.total ?? order.application?.sellingPrice,
            );
      })(),
      paidAtDelivery:
        order.paymentTransaction &&
        String(order.paymentTransaction.paymentStatus ?? '').toUpperCase() === 'SUCCESS' &&
        !order.applicationId &&
        String(order.paymentMethod ?? order.payment_method ?? '').toUpperCase() === 'COD'
          ? order.paymentTransaction.paidAt ?? order.paymentTransaction.createdAt ?? null
          : null,
      nextEmiDueDate:
        order.loan?.nextEmiDueDate ??
        (Array.isArray(order.emiSchedules)
          ? order.emiSchedules.find(
              (s: any) => String(s.paymentStatus ?? '').toUpperCase() !== 'PAID',
            )?.dueDate ?? null
          : null),
      emiPayments: (Array.isArray(order.emiSchedules) ? order.emiSchedules : [])
        .filter((s: any) => String(s.paymentStatus ?? '').toUpperCase() === 'PAID')
        .map((s: any) => ({
          emiNumber: s.emiNumber,
          dueDate: s.dueDate ?? null,
          paidAt: s.paidAt ?? null,
          principalAmount: toNumber(s.principalAmount),
          interestAmount: toNumber(s.interestAmount),
          amount: emiRowAmount(s),
        })),
      // Full loan schedule — paid rows carry paidAt/PAID, upcoming rows stay
      // PENDING/OVERDUE so admins see the remaining installments with due
      // dates and amounts next to the paid history.
      emiSchedule: (Array.isArray(order.emiSchedules) ? order.emiSchedules : []).map(
        (s: any) => ({
          emiNumber: s.emiNumber,
          dueDate: s.dueDate ?? null,
          paidAt: s.paidAt ?? null,
          principalAmount: toNumber(s.principalAmount),
          interestAmount: toNumber(s.interestAmount),
          amount: emiRowAmount(s),
          paymentStatus: effectiveEmiPaymentStatus(s),
        }),
      ),
    };
  }

  async getCurrent(userId: string) {
    const order = await orderRepository.findLatestForUser(userId);
    if (!order) {
      throw new NotFoundError('No order found for this account.');
    }

    await auditLogService.log({
      userId,
      action: 'ORDER_VIEWED',
      entity: 'orders',
      metadata: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        timestamp: new Date().toISOString(),
      },
    });

    return buildOrderPayload(order);
  }

  async getById(orderId: string, userId: string) {
    const order = await orderRepository.findByIdForUser(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found for this account.');
    }

    await auditLogService.log({
      userId,
      action: 'ORDER_VIEWED',
      entity: 'orders',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        timestamp: new Date().toISOString(),
      },
    });

    return buildOrderPayload(order);
  }

  async getTracking(orderId: string, userId: string) {
    const order = await orderRepository.findByIdForUser(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found for this account.');
    }

    await auditLogService.log({
      userId,
      action: 'ORDER_VIEWED',
      entity: 'orders',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        view: 'tracking',
        orderStatus: order.orderStatus,
        timestamp: new Date().toISOString(),
      },
    });

    return buildTrackingPayload(order);
  }

  async getReceipt(orderId: string, userId: string) {
    const order = await orderRepository.findByIdForUser(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found for this account.');
    }

    const generated = await generateOrderReceiptPdf(order);
    await orderRepository.updateReceiptPath(order.id, generated.relativePath);

    await auditLogService.log({
      userId,
      action: 'RECEIPT_DOWNLOADED',
      entity: 'orders',
      metadata: {
        orderNumber: order.orderNumber,
        receiptPath: generated.relativePath,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      buffer: generated.buffer,
      fileName: `${order.orderNumber}-receipt.pdf`,
      orderNumber: order.orderNumber,
    };
  }

  /**
   * Customer-initiated cancellation. Only unpaid (COD / pending-payment)
   * orders that have not shipped can be cancelled — a paid or delivered order
   * is handled through admin support instead. Stock is restored on cancel.
   */
  async cancelOrder(userId: string, orderId: string) {
    const order = await orderRepository.findByIdForUser(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found for this account.');
    }
    const rawStatus = String(order.orderStatus ?? order.status ?? '').toUpperCase();
    const isPaid = String(order.payment_status ?? '').toUpperCase() === 'SUCCESS';
    if (isPaid) {
      throw new BadRequestError(
        'This order is already paid. Contact support to request a cancellation.',
      );
    }
    const cancellable =
      rawStatus === OrderStatus.PENDING || rawStatus === OrderStatus.ORDER_CONFIRMED;
    if (!cancellable) {
      throw new BadRequestError('This order can no longer be cancelled.');
    }

    const updated = await orderRepository.updateStatus({
      orderId: order.id,
      status: OrderStatus.CANCELLED,
      remarks: 'Cancelled by customer',
      updatedBy: userId,
    });

    // Return the reserved stock to inventory (durable across stores).
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length > 0) {
      try {
        const { restoreStockDurable } = await import('../../../common/utils/inventory');
        await restoreStockDurable(
          items.map((i: any) => ({
            productId: i.productId,
            quantity: Number(i.quantity ?? 1),
            variantId: i.variantId ?? null,
          })),
        );
      } catch (e) {
        console.error('[Order] failed to restore stock on cancel:', e);
      }
    }

    await auditLogService.log({
      userId,
      action: 'ORDER_CANCELLED',
      entity: 'orders',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      id: updated?.id ?? order.id,
      orderNumber: updated?.orderNumber ?? order.orderNumber,
      status: OrderStatus.CANCELLED,
    };
  }

  async getInvoice(orderId: string, userId: string) {
    const order = await orderRepository.findByIdForUser(orderId, userId);
    if (!order) {
      throw new NotFoundError('Order not found for this account.');
    }

    const generated = await generateOrderInvoicePdf(order);
    await orderRepository.updateInvoicePath(order.id, generated.relativePath);

    await auditLogService.log({
      userId,
      action: 'INVOICE_DOWNLOADED',
      entity: 'orders',
      metadata: {
        orderNumber: order.orderNumber,
        invoicePath: generated.relativePath,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      buffer: generated.buffer,
      fileName: `${order.orderNumber}-invoice.pdf`,
      orderNumber: order.orderNumber,
    };
  }

  async adminUpdateStatus(
    orderId: string,
    input: {
      status: string;
      remarks?: string;
      location?: string;
      courierPartner?: string;
      trackingNumber?: string;
      warehouse?: string;
      deliveryAddress?: string;
      updatedBy?: string;
    },
  ) {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found.');
    }

    const normalized =
      input.status.toUpperCase() === 'CONFIRMED'
        ? OrderStatus.ORDER_CONFIRMED
        : (input.status.toUpperCase() as OrderStatusType);
    const nextStatus = normalized;
    if (!STATUS_FLOW.includes(nextStatus) && nextStatus !== OrderStatus.CANCELLED) {
      throw new BadRequestError('Invalid order status.', { status: input.status });
    }

    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestError('Cancelled orders cannot be updated.');
    }

    if (order.orderStatus === OrderStatus.DELIVERED) {
      throw new BadRequestError('Delivered orders cannot be updated further.');
    }

    if (!orderRepository.isValidTransition(order.orderStatus, nextStatus)) {
      throw new BadRequestError('Invalid status transition.', {
        from: order.orderStatus,
        to: nextStatus,
        allowedNext: orderRepository.nextAllowedStatus(order.orderStatus),
      });
    }

    const updated = await orderRepository.updateStatus({
      // The repository matches the raw `id` column — resolve the real UUID
      // (findById accepts the human-readable order number too).
      orderId: order.id,
      status: nextStatus,
      remarks: input.remarks,
      updatedBy: input.updatedBy,
      location: input.location,
      courierPartner: input.courierPartner,
      trackingNumber: input.trackingNumber,
      warehouse: input.warehouse,
      deliveryAddress: input.deliveryAddress,
    });

    await auditLogService.log({
      userId: order.userId,
      action: 'ORDER_STATUS_UPDATED',
      entity: 'orders',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        from: order.orderStatus,
        to: nextStatus,
        updatedBy: input.updatedBy ?? 'admin',
        timestamp: new Date().toISOString(),
      },
    });

    if (nextStatus === OrderStatus.DELIVERED) {
      // EMI orders: delivery is what activates the loan. Guard on applicationId
      // — COD/DIRECT orders have none, and activateFromApplication would throw.
      if (order.applicationId) {
        const loan = await loanService.activateFromApplication(
          order.applicationId,
          order.userId,
        );

        await auditLogService.log({
          userId: order.userId,
          action: 'LOAN_ACTIVATED',
          entity: 'loan_accounts',
          metadata: {
            applicationNumber: order.application.id,
            loanAccountNumber: loan.loanAccountNumber,
            status: 'ACTIVE',
            orderNumber: order.orderNumber,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // COD orders: delivery is when cash is collected — record the collection
      // so receipts show 'Paid at delivery' and the admin ledger tracks the
      // collection date. Only write it once (skip if already collected).
      const isCod = !order.applicationId &&
        String(order.paymentMethod ?? '').toUpperCase() === 'COD';
      const alreadyCollected = order.paymentTransactionId
        ? jsonDb.findOne('paymentTransaction', {
            id: order.paymentTransactionId,
            paymentStatus: PaymentStatus.SUCCESS,
          })
        : null;
      if (isCod && !alreadyCollected) {
        const collectedAt = new Date().toISOString();
        const totalAmount = toNumber(
          order.totalAmount ?? order.total_amount ?? order.total ?? 0,
        );
        const txn = await jsonDb.insertAwaited('paymentTransaction', {
          userId: order.userId,
          orderId: order.id,
          applicationId: null,
          amount: totalAmount,
          currency: 'INR',
          paymentStatus: PaymentStatus.SUCCESS,
          status: PaymentStatus.SUCCESS,
          paymentType: PaymentType.COD,
          purpose: 'COD_COLLECTION',
          paidAt: collectedAt,
          createdAt: collectedAt,
        });
        await jsonDb.updateAwaited(
          'orders',
          { id: order.id },
          {
            paymentTransactionId: txn.id,
            payment_status: PaymentStatus.SUCCESS,
            codCollectedAt: collectedAt,
            updatedAt: collectedAt,
          },
        );

        await auditLogService.log({
          userId: order.userId,
          action: 'COD_COLLECTED',
          entity: 'paymentTransaction',
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            transactionId: txn.id,
            amount: totalAmount,
            collectedAt,
            updatedBy: input.updatedBy ?? 'admin',
            timestamp: collectedAt,
          },
        });
      }
    }

    if (!updated) {
      throw new NotFoundError('Order not found for status update.');
    }
    return buildTrackingPayload(updated);
  }
}

export const orderService = new OrderService();

