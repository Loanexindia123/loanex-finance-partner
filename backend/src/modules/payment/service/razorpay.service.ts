import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../../../config/env';
import { BadRequestError } from '../../../common/errors/app-error';

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

/** Shared Razorpay client for the autopay provider (mandate payment links). */
export function getRazorpayClient(): Razorpay {
  return getClient();
}

export function isPaymentDevBypass(): boolean {
  return Boolean(env.PAYMENT_DEV_BYPASS) && env.NODE_ENV !== 'production';
}

export async function createRazorpayOrder(input: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const amountPaise = Math.round(input.amountInr * 100);

  if (isPaymentDevBypass()) {
    return {
      id: `order_dev_${crypto.randomBytes(8).toString('hex')}`,
      amount: amountPaise,
      currency: env.RAZORPAY_CURRENCY,
    };
  }

  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: env.RAZORPAY_CURRENCY,
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
  });

  return {
    id: String(order.id),
    amount: Number(order.amount),
    currency: String(order.currency),
  };
}

export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (isPaymentDevBypass()) {
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return expected === input.signature || input.signature === 'dev_bypass_signature';
  }

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(String(input.signature || ''), 'utf8'),
    );
  } catch {
    return false;
  }
}

/** Validate Razorpay webhook signature (X-Razorpay-Signature). */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(String(signature || ''), 'utf8'),
    );
  } catch {
    return false;
  }
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  orderId: string | null;
  amount: number;
  currency: string;
  method: string | null;
}> {
  if (isPaymentDevBypass()) {
    return {
      id: paymentId,
      status: 'captured',
      orderId: null,
      amount: 0,
      currency: env.RAZORPAY_CURRENCY,
      method: 'dev',
    };
  }

  const payment = await getClient().payments.fetch(paymentId);
  return {
    id: String(payment.id),
    status: String(payment.status),
    orderId: payment.order_id ? String(payment.order_id) : null,
    amount: Number(payment.amount ?? 0),
    currency: String(payment.currency ?? env.RAZORPAY_CURRENCY),
    method: payment.method ? String(payment.method) : null,
  };
}

export async function fetchRazorpayOrder(orderId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  currency: string;
}> {
  if (isPaymentDevBypass()) {
    return {
      id: orderId,
      status: 'paid',
      amount: 0,
      currency: env.RAZORPAY_CURRENCY,
    };
  }

  const order = await getClient().orders.fetch(orderId);
  return {
    id: String(order.id),
    status: String(order.status),
    amount: Number(order.amount ?? 0),
    currency: String(order.currency ?? env.RAZORPAY_CURRENCY),
  };
}

/** Payments attached to a Razorpay order (used to reconcile stuck CREATED KYC rows). */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<
  Array<{
    id: string;
    status: string;
    orderId: string | null;
    amount: number;
    currency: string;
  }>
> {
  if (isPaymentDevBypass()) {
    return [
      {
        id: `pay_dev_${crypto.randomBytes(6).toString('hex')}`,
        status: 'captured',
        orderId,
        amount: 0,
        currency: env.RAZORPAY_CURRENCY,
      },
    ];
  }

  const result = await getClient().orders.fetchPayments(orderId);
  const items = Array.isArray((result as any)?.items) ? (result as any).items : [];
  return items.map((payment: any) => ({
    id: String(payment.id),
    status: String(payment.status ?? ''),
    orderId: payment.order_id ? String(payment.order_id) : orderId,
    amount: Number(payment.amount ?? 0),
    currency: String(payment.currency ?? env.RAZORPAY_CURRENCY),
  }));
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountPaise?: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string; amount: number }> {
  if (isPaymentDevBypass()) {
    return {
      id: `rfnd_dev_${crypto.randomBytes(6).toString('hex')}`,
      status: 'processed',
      amount: input.amountPaise ?? 0,
    };
  }

  if (!input.paymentId) {
    throw new BadRequestError('paymentId is required for refund');
  }

  const refund = await getClient().payments.refund(input.paymentId, {
    ...(input.amountPaise ? { amount: input.amountPaise } : {}),
    notes: input.notes,
  });

  return {
    id: String(refund.id),
    status: String(refund.status ?? 'processed'),
    amount: Number(refund.amount ?? input.amountPaise ?? 0),
  };
}

export function getRazorpayKeyId(): string {
  return env.RAZORPAY_KEY_ID;
}

export function signDevPayment(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}
