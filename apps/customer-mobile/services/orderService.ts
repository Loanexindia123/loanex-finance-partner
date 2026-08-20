import { Order, OrderItem, OrderStatus, EMIDetails } from '../types';
import { api } from '../lib/apiClient';
import { resolveMediaUrl } from '../utils/mediaUrl';

// ─── Backend → mobile mappers ─────────────────────────────────────────────

function toOrderStatus(raw: string | null | undefined): OrderStatus {
  const s = String(raw ?? '').toUpperCase();
  if (s.includes('CANCELLED')) return 'cancelled';
  if (s.includes('DELIVERED')) return 'delivered';
  if (s.includes('SHIPPED') || s.includes('OUT_FOR_DELIVERY')) return 'shipped';
  if (s.includes('CONFIRMED')) return 'confirmed';
  return 'pending';
}

function toOrderItem(raw: any): OrderItem {
  const p = raw.product ?? raw;
  return {
    productId: p.id ?? raw.productId ?? '',
    productName: p.name ?? raw.productName ?? 'Product',
    image: resolveMediaUrl(p.imageUrl ?? p.image ?? raw.productImage ?? raw.image ?? ''),
    quantity: Number(raw.quantity ?? 1),
    price: Number(raw.unitPrice ?? raw.price ?? raw.orderAmount ?? 0),
  };
}

/** Derive a mobile EMI status from the loan ledger on the backend payload. */
function toEmiStatus(raw: any): EMIDetails['emiStatus'] {
  const loanStatus = String(raw.loanStatus ?? '').toUpperCase();
  if (loanStatus.includes('CLOSED')) return 'completed';
  if (loanStatus.includes('ACTIVE') || loanStatus.includes('OVERDUE')) return 'active';
  if (raw.downPaymentPaid) return 'downpayment_paid';
  if (String(raw.canPayDownPayment ?? '') === 'true' || raw.canPayDownPayment === true) {
    return 'accepted';
  }
  return 'proposal_sent';
}

function toEmiDetails(raw: any): EMIDetails | undefined {
  const emi = raw.emi ?? raw.emiDetails;
  if (!emi && !raw.emiTenureMonths && !raw.totalEmiCount) return undefined;
  // List payloads carry tenure on the order row; detail payloads nest it under emi.
  const tenure = Number(
    emi?.tenure ?? emi?.months ?? raw.emiTenureMonths ?? raw.totalEmiCount ?? 0,
  );
  const monthlyEmi = Number(emi?.monthlyEmi ?? emi?.monthlyAmount ?? emi?.regularEMIAmount ?? 0);
  return {
    id: emi?.loanAccountNumber ?? emi?.id ?? '',
    orderId: raw.id ?? '',
    tenure,
    firstPaymentRule: 'down_payment',
    downPaymentAmount: Number(emi?.downPayment ?? emi?.downPaymentAmount ?? 0),
    serviceCharge: Number(emi?.serviceCharge ?? 0),
    deliveryCharge: Number(emi?.deliveryCharge ?? 0),
    totalPayable: Number(emi?.totalPayable ?? raw.totalAmount ?? 0),
    balanceForEMI: Number(emi?.loanAmount ?? emi?.balanceForEMI ?? 0),
    regularEMIAmount: monthlyEmi,
    finalEMIAmount: monthlyEmi,
    months: tenure,
    monthlyAmount: monthlyEmi,
    totalAmount: Number(emi?.totalPayable ?? raw.totalAmount ?? 0),
    interestRate: Number(emi?.interestRate ?? 0),
    emiStatus: toEmiStatus(raw),
    paidInstallments: Number(emi?.paidEmiCount ?? raw.paidEmiCount ?? 0),
    nextDueDate: emi?.nextEmiDueDate ?? '',
    // Full loan schedule from the backend — paid rows carry PAID, upcoming
    // rows stay PENDING/OVERDUE with their due dates and amounts.
    schedule: Array.isArray(raw.emiSchedule)
      ? raw.emiSchedule.map((s: any) => {
          const status = String(s.paymentStatus ?? 'PENDING').toUpperCase();
          return {
            installmentNumber: Number(s.emiNumber ?? 0),
            amount: Number(s.amount ?? s.paidAmount ?? s.emiAmount ?? 0),
            dueDate: s.dueDate ?? '',
            paidAt: s.paidAt ?? '',
            status:
              status === 'PAID'
                ? 'paid'
                : status === 'OVERDUE'
                  ? 'overdue'
                  : 'upcoming',
          };
        })
      : [],
  };
}

/** Map a backend order (list or detail payload) to the mobile Order shape. */
function toOrder(raw: any): Order {
  const paymentType = String(raw.paymentType ?? raw.paymentMethod ?? '').toUpperCase();
  const isEmi = paymentType === 'EMI' || paymentType === 'EMI_APPLICATION';
  const isOnline =
    paymentType === 'FULL PAYMENT' ||
    paymentType === 'FULL_PAYMENT' ||
    paymentType === 'DIRECT' ||
    paymentType === 'ONLINE';
  const items: OrderItem[] = Array.isArray(raw.items)
    ? raw.items.map(toOrderItem)
    : raw.product
      ? [{
          productId: raw.product.id,
          productName: raw.product.name ?? 'Product',
          image: resolveMediaUrl(raw.product.imageUrl ?? raw.product.image ?? ''),
          quantity: 1,
          price: Number(raw.orderAmount ?? 0),
        }]
      : [];
  const computedTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // Prefer real line-item math over order-level fields: detail payloads carry
  // amountPaid: 0 for unpaid COD/EMI orders, which would otherwise overwrite
  // the actual order value via the ?? chain.
  const orderLevelTotal = Number(
    raw.totalAmount ?? raw.orderAmount ?? raw.total ?? 0,
  );
  const total =
    computedTotal > 0
      ? computedTotal
      : orderLevelTotal > 0
        ? orderLevelTotal
        : Number(raw.amountPaid ?? 0);
  return {
    id: raw.id,
    orderNumber: raw.orderNumber ?? '',
    userId: raw.userId ?? '',
    items,
    subtotal: computedTotal > 0 ? computedTotal : orderLevelTotal,
    total,
    status: toOrderStatus(raw.orderStatus ?? raw.status),
    paymentMethod: isEmi ? 'emi' : isOnline ? 'online' : 'cod',
    emiDetails: toEmiDetails(raw),
    address: raw.deliveryAddress ?? raw.shippingAddress ?? raw.address ?? '',
    phone: raw.phone ?? '',
    notes: raw.notes,
    createdAt: raw.orderDate ?? raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt,
  };
}

// ─── Orders ────────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  try {
    const res = await api.get(`/orders`);
    const list = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
    return list.map(toOrder);
  } catch {
    return [];
  }
}

/** The backend resolves the user from the auth token — userId is kept for signature compat. */
export async function getOrdersByUser(_userId: string): Promise<Order[]> {
  return getAllOrders();
}

export interface AddOrderInput {
  userId: string;
  items: Order['items'];
  subtotal: number;
  total: number;
  paymentMethod: 'cod' | 'emi';
  address: string;
  phone: string;
  addressId?: string;
  addressSnapshot?: any;
  notes?: string;
  emiDetails?: any;
}

/**
 * Place an order through the real backend.
 *  - COD → POST /checkout/place-order (paymentMethod 'COD')
 *  - EMI → POST /checkout/place-order with an emiApplication
 *          (admin approval creates the order later)
 *
 * Full-payment (DIRECT) orders are NOT created here — the backend rejects
 * unverified DIRECT placement. The app pays through the session flow
 * (POST /checkout → payment/order → verify) which creates the paid order.
 */
export async function addOrder(orderData: AddOrderInput): Promise<Order> {
  const items = orderData.items.map((i: any) => ({
    productId: i.productId,
    quantity: Number(i.quantity ?? 1),
    variantId: i.variantId ?? null,
  }));
  const first = orderData.items[0];
  const emi = orderData.emiDetails ?? {};
  const body: any = {
    items,
    addressId: orderData.addressId,
    addressSnapshot: orderData.addressSnapshot,
    notes: orderData.notes,
    paymentMethod: 'COD',
  };
  if (orderData.paymentMethod === 'emi') {
    const requestedAmount =
      Number(emi.balanceForEMI ?? emi.loanAmount ?? emi.totalAmount ?? orderData.total ?? 0);
    const requestedDownPayment = Number(emi.downPaymentAmount ?? 0);
    const requestedTenure = Number(emi.tenure ?? emi.months ?? 0);
    const estimatedMonthlyEmi = Number(
      emi.regularEMIAmount ?? emi.monthlyAmount ?? emi.finalEMIAmount ?? 0,
    );
    delete body.paymentMethod;
    delete body.razorpayPaymentId;
    body.emiApplication = {
      productName: first?.productName,
      requestedAmount,
      requestedDownPayment,
      requestedTenure,
      estimatedMonthlyEmi,
    };
  }
  const res = await api.post(`/checkout/place-order`, body);
  const data = res.data ?? {};
  if (data.kind === 'EMI_APPLICATION') {
    const app = data.application ?? {};
    const appItems: OrderItem[] = Array.isArray(data.items)
      ? data.items.map(toOrderItem)
      : orderData.items.map((i: any) => ({
          productId: i.productId,
          productName: i.productName ?? 'Product',
          image: resolveMediaUrl(i.image ?? ''),
          quantity: Number(i.quantity ?? 1),
          price: Number(i.price ?? 0),
        }));
    return {
      id: app.id,
      userId: orderData.userId,
      items: appItems,
      subtotal: orderData.subtotal,
      total: orderData.total,
      status: 'pending',
      paymentMethod: 'emi',
      address: orderData.address,
      phone: orderData.phone,
      notes: orderData.notes,
      createdAt: new Date().toISOString(),
    };
  }
  return toOrder(data.order ?? data);
}

/**
 * Customers can only cancel an unpaid (COD / pending) order — the backend
 * restores stock and records the audit trail.
 */
export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  if (status === 'cancelled') {
    await api.post(`/orders/${id}/cancel`, {});
    return;
  }
  throw new Error(
    'Only cancellation is available to customers — status updates are managed by the admin.',
  );
}

/** EMI approval is an admin action; there is no customer-facing approve/reject endpoint. */
export async function updateEMIStatus(_orderId: string, _status: 'approved' | 'rejected'): Promise<void> {
  throw new Error('EMI approval is performed by the admin. You can track status in My EMIs.');
}

/** Monthly EMI payments go through the Razorpay flow (POST /emi-payments). */
export async function markInstallmentPaid(_orderId: string): Promise<void> {
  throw new Error('Pay your EMI from the My EMIs screen — it is processed through Razorpay.');
}

/** Fetch a single order from the real backend API. */
export async function getOrderById(id: string): Promise<Order | null> {
  try {
    const res = await api.get(`/orders/${id}`);
    return toOrder(res.data);
  } catch {
    return null;
  }
}

export async function getOrder(id: string): Promise<Order | null> {
  return getOrderById(id);
}
