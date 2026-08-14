import { jsonDb } from '../../../config/json-db';

export enum NotificationCategory {
  EMI = 'EMI',
  ORDER = 'ORDER',
  KYC = 'KYC',
  PROMOTION = 'PROMOTION',
  SYSTEM = 'SYSTEM',
  LOAN = 'LOAN',
  OFFERS = 'OFFERS',
  ORDERS = 'ORDERS',
  PAYMENTS = 'PAYMENTS',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationType {
  EMI_DUE_REMINDER = 'EMI_DUE_REMINDER',
  EMI_OVERDUE = 'EMI_OVERDUE',
  EMI_PAID = 'EMI_PAID',
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  KYC_APPROVED = 'KYC_APPROVED',
  KYC_REJECTED = 'KYC_REJECTED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  APPLICATION_APPROVED = 'APPLICATION_APPROVED',
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  AUTOPAY_FAILED = 'AUTOPAY_FAILED',
  AUTOPAY_SUCCESS = 'AUTOPAY_SUCCESS',
  DOWN_PAYMENT_SUCCESS = 'DOWN_PAYMENT_SUCCESS',
  EMI_FAILED = 'EMI_FAILED',
  LOAN_CLOSED = 'LOAN_CLOSED',
  OFFER_ACCEPTED = 'OFFER_ACCEPTED',
  OFFER_RECEIVED = 'OFFER_RECEIVED',
  // ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  // SYSTEM = 'SYSTEM',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  SYSTEM = 'SYSTEM',
  // FI/admin-facing EMI application lifecycle events (broadcast to FI-permission
  // admins — see notifications/service/fi-recipients.helper.ts). Distinct from the
  // existing APPLICATION_* types above, which are the customer-facing equivalents.
  EMI_REQUEST_RECEIVED = 'EMI_REQUEST_RECEIVED',
  EMI_REQUEST_ACCEPTED = 'EMI_REQUEST_ACCEPTED',
  EMI_REQUEST_REJECTED = 'EMI_REQUEST_REJECTED',
}

export type NotificationListFilters = {
  userId: string;
  category?: NotificationCategory;
  type?: NotificationType;
  unreadOnly?: boolean;
  includeArchived?: boolean;
};

export class NotificationRepository {
  create(data: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    priority: NotificationPriority;
    metadata?: Record<string, unknown>;
  }) {
    return jsonDb.insert('notification', {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      category: data.category,
      priority: data.priority,
      metadata: data.metadata ?? undefined,
      isRead: false,
      archived: false,
    });
  }

  findByIdForUser(id: string, userId: string) {
    const notifications = jsonDb.findMany('notification', { id, userId, archived: false });
    return notifications.length > 0 ? notifications[0] : null;
  }

  findById(id: string) {
    return jsonDb.findOne('notification', { id });
  }

  list(filters: NotificationListFilters) {
    const conditions: any = { userId: filters.userId };
    if (!filters.includeArchived) conditions.archived = false;
    if (filters.unreadOnly) conditions.isRead = false;
    if (filters.category) conditions.category = filters.category;
    if (filters.type) conditions.type = filters.type;

    return jsonDb.findMany('notification', conditions)
      .sort((a: any, b: any) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  countUnread(userId: string) {
    return jsonDb.findMany('notification', { userId, isRead: false, archived: false }).length;
  }

  markRead(id: string, userId: string) {
    jsonDb.update('notification', { id, userId }, { isRead: true, readAt: new Date() });
    return jsonDb.findOne('notification', { id, userId });
  }

  markAllRead(userId: string) {
    const toUpdate = jsonDb.findMany('notification', { userId, isRead: false });
    for (const notif of toUpdate) {
      jsonDb.update('notification', { id: notif.id }, { isRead: true, readAt: new Date() });
    }
    return { count: toUpdate.length };
  }

  softDelete(id: string, userId: string) {
    jsonDb.update('notification', { id, userId }, { archived: true });
    return jsonDb.findOne('notification', { id, userId });
  }

  hardDelete(id: string) {
    return jsonDb.delete('notification', { id });
  }

  listForAdmin(limit = 100) {
    const items = jsonDb.findMany('notification', {})
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items.slice(0, limit);
  }

  adminMarkAllRead() {
    const toUpdate = jsonDb.findMany('notification', { isRead: false });
    for (const notif of toUpdate) {
      jsonDb.update('notification', { id: notif.id }, { isRead: true, readAt: new Date() });
    }
    return { count: toUpdate.length };
  }

  findReminderDuplicate(userId: string, reminderKey: string) {
    const items = jsonDb.findMany('notification', { userId });
    return items.find((item: any) => item.metadata?.reminderKey === reminderKey) || null;
  }
}

export const notificationRepository = new NotificationRepository();
export type Notification = any;
