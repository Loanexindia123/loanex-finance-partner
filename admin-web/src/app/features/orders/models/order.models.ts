export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
}

/** Normalized order shape — backend has returned several field-name variants historically. */
export interface Order {
  id: string;
  orderNumber?: string;
  userId?: string;
  addressId?: string;
  totalAmount: number;
  paymentMethod?: 'FULL_PAYMENT' | 'EMI' | string;
  paymentStatus: string;
  status: string;
  items: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
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
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
