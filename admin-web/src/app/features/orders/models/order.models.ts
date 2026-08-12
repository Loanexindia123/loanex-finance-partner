export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
  productImageUrl?: string;
  productBrand?: string;
}

export interface EmiScheduleEntry {
  emiNumber: number;
  dueDate?: string | null;
  paidAt?: string | null;
  principalAmount: number;
  interestAmount: number;
  amount: number;
  paymentStatus: string;
}

export interface EmiPaymentEntry {
  emiNumber: number;
  dueDate?: string | null;
  paidAt?: string | null;
  principalAmount: number;
  interestAmount: number;
  amount: number;
}

/** Normalized order shape — backend has returned several field-name variants historically. */
export interface Order {
  id: string;
  orderNumber?: string;
  userId?: string;
  customerId?: string;
  addressId?: string;
  totalAmount: number;
  sellingPrice?: number;
  quantity?: number;
  paymentMethod?: 'FULL_PAYMENT' | 'EMI' | string;
  paymentStatus: string;
  status: string;
  items: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
  transactionDate?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  productId?: string;
  productName?: string;
  productImageUrl?: string;
  /** EMI / loan ledger fields from admin order detail. */
  emiPlan?: string;
  emiAmount?: number | null;
  emiDuration?: string;
  downPayment?: number | null;
  loanAmount?: number | null;
  interestRate?: number | null;
  processingFee?: number | null;
  loanStatus?: string | null;
  loanAccountNumber?: string | null;
  outstandingAmount?: number | null;
  paidEmiCount?: number | null;
  totalEmiCount?: number | null;
  downPaymentCollected?: number | null;
  amountPaid?: number | null;
  paidAtDelivery?: number | null;
  nextEmiDueDate?: string | null;
  emiPayments: EmiPaymentEntry[];
  emiSchedule: EmiScheduleEntry[];
  /** Fulfillment / dispatch fields set via the order status update. */
  courierPartner?: string | null;
  trackingNumber?: string | null;
  estimatedDeliveryDate?: string | null;
  warehouse?: string | null;
}

export interface UpdateOrderStatusPayload {
  status: string;
  remarks?: string;
  location?: string;
  courierPartner?: string;
  trackingNumber?: string;
  warehouse?: string;
  deliveryAddress?: string;
}

export const ORDER_STATUSES = [
  'PENDING',
  'ORDER_CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;

export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;

export function orderDisplayId(order: Pick<Order, 'id' | 'orderNumber'>): string {
  if (order.orderNumber?.trim()) return order.orderNumber.trim();
  const id = order.id ?? '';
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function paymentMethodLabel(method?: string | null): string {
  const value = (method ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  if (value.includes('EMI')) return 'EMI';
  if (value.includes('FULL')) return 'Full payment';
  return method?.trim() || '—';
}

export function isEmiOrder(order: Pick<Order, 'paymentMethod' | 'emiSchedule' | 'loanAccountNumber'>): boolean {
  const method = paymentMethodLabel(order.paymentMethod);
  return (
    method === 'EMI' ||
    !!order.loanAccountNumber ||
    (order.emiSchedule?.length ?? 0) > 0
  );
}
