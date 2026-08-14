import {
  NotificationCategory,
  NotificationPriority,
  NotificationType,
} from '../repository/notification.repository';

export function categoryForType(type: NotificationType): NotificationCategory {
  switch (type) {
    case NotificationType.APPLICATION_SUBMITTED:
    case NotificationType.APPLICATION_APPROVED:
    case NotificationType.APPLICATION_REJECTED:
    case NotificationType.EMI_DUE_REMINDER:
    case NotificationType.EMI_OVERDUE:
    // case NotificationType.LOAN_CLOSED:
    //   return NotificationCategory.LOAN;
    case NotificationType.LOAN_CLOSED:
    case NotificationType.EMI_REQUEST_RECEIVED:
    case NotificationType.EMI_REQUEST_ACCEPTED:
    case NotificationType.EMI_REQUEST_REJECTED:
      return NotificationCategory.LOAN;
    case NotificationType.OFFER_RECEIVED:
    case NotificationType.OFFER_ACCEPTED:
      return NotificationCategory.OFFERS;
    case NotificationType.ORDER_CONFIRMED:
    case NotificationType.ORDER_SHIPPED:
    case NotificationType.ORDER_DELIVERED:
      return NotificationCategory.ORDERS;
    case NotificationType.DOWN_PAYMENT_SUCCESS:
    case NotificationType.EMI_PAID:
    case NotificationType.EMI_FAILED:
    case NotificationType.AUTOPAY_SUCCESS:
    case NotificationType.AUTOPAY_FAILED:
      return NotificationCategory.PAYMENTS;
    default:
      return NotificationCategory.SYSTEM;
  }
}

export function defaultPriority(type: NotificationType): NotificationPriority {
  switch (type) {
    case NotificationType.APPLICATION_REJECTED:
    case NotificationType.EMI_FAILED:
    case NotificationType.AUTOPAY_FAILED:
    // case NotificationType.EMI_OVERDUE:
    //   return NotificationPriority.HIGH;
    case NotificationType.EMI_OVERDUE:
    case NotificationType.EMI_REQUEST_REJECTED:
      return NotificationPriority.HIGH;
    case NotificationType.EMI_DUE_REMINDER:
    case NotificationType.ORDER_DELIVERED:
    case NotificationType.LOAN_CLOSED:
      return NotificationPriority.MEDIUM;
    case NotificationType.DOWN_PAYMENT_SUCCESS:
    case NotificationType.EMI_PAID:
    // case NotificationType.APPLICATION_APPROVED:
    //   return NotificationPriority.MEDIUM;
    case NotificationType.APPLICATION_APPROVED:
    case NotificationType.EMI_REQUEST_RECEIVED:
    case NotificationType.EMI_REQUEST_ACCEPTED:
      return NotificationPriority.MEDIUM;
    default:
      return NotificationPriority.LOW;
  }
}

/** Map audit-log actions → in-app notification types (event bridge). */
export function mapAuditActionToNotification(
  action: string,
  metadata?: Record<string, unknown>,
): {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
} | null {
  const upper = action.toUpperCase();

  if (upper === 'APPLICATION_SUBMITTED') {
    return {
      type: NotificationType.APPLICATION_SUBMITTED,
      title: 'Application submitted',
      message: 'Your EMI application was submitted successfully.',
    };
  }
  if (upper.includes('APPLICATION_APPROVED') || upper === 'APPLICATION_APPROVED_DEV') {
    return {
      type: NotificationType.APPLICATION_APPROVED,
      title: 'Application approved',
      message: 'Congratulations! Your EMI application has been approved.',
      priority: NotificationPriority.HIGH,
    };
  }
  if (upper.includes('APPLICATION_REJECTED') || upper === 'APPLICATION_REJECTED') {
    return {
      type: NotificationType.APPLICATION_REJECTED,
      title: 'Application rejected',
      message: 'Your EMI application was not approved. Please contact support.',
      priority: NotificationPriority.HIGH,
    };
  }
  if (upper === 'OFFER_ACCEPTED') {
    return {
      type: NotificationType.OFFER_ACCEPTED,
      title: 'Offer accepted',
      message: 'You accepted your loan offer. Continue to down payment.',
    };
  }
  if (upper.includes('OFFER') && upper.includes('APPROVED')) {
    return {
      type: NotificationType.OFFER_RECEIVED,
      title: 'Loan offer ready',
      message: 'Your approved loan offer is ready to review.',
    };
  }
  if (upper === 'PAYMENT_SUCCESS' || upper === 'DOWN_PAYMENT_SUCCESS') {
    return {
      type: NotificationType.DOWN_PAYMENT_SUCCESS,
      title: 'Down payment successful',
      message: 'Your down payment was received successfully.',
      priority: NotificationPriority.HIGH,
    };
  }
  if (upper === 'PAYMENT_FAILED') {
    return {
      type: NotificationType.EMI_FAILED,
      title: 'Payment failed',
      message: 'Your payment could not be completed. Please try again.',
      priority: NotificationPriority.HIGH,
    };
  }
  if (upper === 'ORDER_CONFIRMED' || upper === 'ORDER_CREATED') {
    return {
      type: NotificationType.ORDER_CONFIRMED,
      title: 'Order confirmed',
      message: 'Your financed order has been confirmed.',
    };
  }
  if (upper === 'ORDER_STATUS_UPDATED') {
    const to = String(metadata?.to ?? '').toUpperCase();
    if (to === 'SHIPPED') {
      return {
        type: NotificationType.ORDER_SHIPPED,
        title: 'Order shipped',
        message: 'Your order is on the way.',
        priority: NotificationPriority.MEDIUM,
      };
    }
    if (to === 'DELIVERED') {
      return {
        type: NotificationType.ORDER_DELIVERED,
        title: 'Order delivered',
        message: 'Your order was delivered. Your loan is now active.',
        priority: NotificationPriority.HIGH,
      };
    }
    return null;
  }
  if (upper === 'EMI_PAYMENT_SUCCESS') {
    return {
      type: NotificationType.EMI_PAID,
      title: 'EMI paid',
      message: `EMI payment successful${metadata?.emiNumber ? ` for EMI #${metadata.emiNumber}` : ''}.`,
      priority: NotificationPriority.MEDIUM,
    };
  }
  if (upper === 'EMI_PAYMENT_FAILED') {
    return {
      type: NotificationType.EMI_FAILED,
      title: 'EMI payment failed',
      message: 'Your EMI payment failed. Please retry from My EMI.',
      priority: NotificationPriority.HIGH,
    };
  }
  // AutoPay emits notifications directly via notifyLegacy — skip audit bridge to avoid duplicates.
  if (upper === 'LOAN_STATUS_UPDATED' && String(metadata?.to ?? '').toUpperCase() === 'CLOSED') {
    return {
      type: NotificationType.LOAN_CLOSED,
      title: 'Loan closed',
      message: 'Your loan account has been closed.',
      priority: NotificationPriority.MEDIUM,
    };
  }

  return null;
}
