/** Mirrors mapNotification() in backend/src/modules/notifications/service/notification.service.ts exactly. */
export type NotificationType =
  | 'EMI_REQUEST_RECEIVED'
  | 'EMI_REQUEST_ACCEPTED'
  | 'EMI_REQUEST_REJECTED'
  | string; // other backend types (KYC_APPROVED, ORDER_PLACED, etc.) fall back to a default icon/tone

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  description: string;
  type: NotificationType;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  isRead: boolean;
  readStatus: 'READ' | 'UNREAD';
  readAt: string | null;
  metadata: { applicationId?: string; applicationNumber?: string | null; [key: string]: unknown } | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  unreadCount: number;
  total: number;
  items: AppNotification[];
}