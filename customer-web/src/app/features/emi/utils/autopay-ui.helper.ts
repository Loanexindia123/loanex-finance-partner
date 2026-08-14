import { AutopayStatus } from '../services/autopay.service';

/** Bounded poll: every 3s, up to ~60s. */
export const AUTO_EMI_POLL_INTERVAL_MS = 3000;
export const AUTO_EMI_POLL_MAX_ATTEMPTS = 20;

export type AutoEmiUiPhase =
  | 'setup'
  | 'opening'
  | 'confirming'
  | 'active'
  | 'incomplete'
  | 'pending_timeout';

/** Backend is the only source of truth for Active. */
export function isAutoEmiActive(status: AutopayStatus | null | undefined): boolean {
  if (!status) return false;
  return status.loan.autopayEnabled === true || status.mandate?.status === 'ACTIVE';
}

export function mandateStatusOf(status: AutopayStatus | null | undefined): string | null {
  return status?.mandate?.status ?? null;
}

/** Customer-facing copy from existing backend mandate statuses only. */
export function autoEmiStatusMessage(status: AutopayStatus | null | undefined): string {
  if (!status) return '';
  if (isAutoEmiActive(status)) return 'Auto EMI Active';

  switch (status.mandate?.status) {
    case 'PENDING':
      return 'Auto EMI setup is being confirmed.';
    case 'FAILED':
      return 'Auto EMI setup failed.';
    case 'CANCELLED':
      return 'Auto EMI setup was cancelled.';
    case 'EXPIRED':
      return 'Auto EMI setup expired.';
    case 'PAUSED':
      return 'Auto EMI is paused.';
    default:
      return status.autopayStatus === 'PENDING'
        ? 'Auto EMI setup is being confirmed.'
        : 'Set up Auto EMI to enable automatic monthly payments.';
  }
}

export function isTerminalMandateFailure(status: AutopayStatus | null | undefined): boolean {
  const s = status?.mandate?.status;
  return s === 'FAILED' || s === 'CANCELLED' || s === 'EXPIRED';
}

/**
 * Opens Razorpay hosted authorization URL (subscription.short_url).
 * Returns false if the browser blocked the popup.
 */
export function openApprovalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const win = window.open(trimmed, '_blank', 'noopener,noreferrer');
  return Boolean(win);
}

export function isEmiOrder(paymentType: string | null | undefined): boolean {
  return String(paymentType ?? '').toUpperCase() === 'EMI';
}
