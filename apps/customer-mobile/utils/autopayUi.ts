import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import type { AutopayStatus } from '../types';

/** Bounded poll: every 3s, up to ~60s (matches customer-web). */
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

/** Stop polling when mandate reaches a settled (non-PENDING) state. */
export function shouldStopAutopayPolling(status: AutopayStatus | null | undefined): boolean {
  if (!status) return false;
  if (isAutoEmiActive(status)) return true;
  const s = status.mandate?.status;
  return s === 'FAILED' || s === 'CANCELLED' || s === 'EXPIRED' || s === 'PAUSED';
}

export function isEmiPaymentMethod(paymentMethod: string | null | undefined): boolean {
  const v = String(paymentMethod ?? '').toUpperCase();
  return v === 'EMI' || v === 'EMI_APPLICATION';
}

export type OpenApprovalResult = {
  opened: boolean;
  /** User closed the in-app browser without completing (native only). */
  dismissed?: boolean;
};

/**
 * Opens Razorpay hosted authorization URL (subscription.short_url).
 * Prefer expo-web-browser; fall back to Linking.openURL.
 * Do NOT use PaymentWebView / Checkout.js for eMandate.
 */
export async function openApprovalUrl(url: string): Promise<OpenApprovalResult> {
  const trimmed = url.trim();
  if (!trimmed) return { opened: false };

  if (Platform.OS === 'web') {
    try {
      const win = typeof window !== 'undefined'
        ? window.open(trimmed, '_blank', 'noopener,noreferrer')
        : null;
      return { opened: Boolean(win) };
    } catch {
      return { opened: false };
    }
  }

  try {
    const result = await WebBrowser.openBrowserAsync(trimmed, {
      enableDefaultShareMenuItem: false,
      showTitle: true,
    });
    return {
      opened: true,
      dismissed: result.type === 'cancel' || result.type === 'dismiss',
    };
  } catch {
    try {
      const can = await Linking.canOpenURL(trimmed);
      if (!can) return { opened: false };
      await Linking.openURL(trimmed);
      return { opened: true };
    } catch {
      return { opened: false };
    }
  }
}

export function resolveAutoEmiPhase(opts: {
  status: AutopayStatus | null | undefined;
  submitting: boolean;
  confirming: boolean;
  pollTimedOut: boolean;
}): AutoEmiUiPhase {
  if (isAutoEmiActive(opts.status)) return 'active';
  if (opts.submitting) return 'opening';
  if (opts.pollTimedOut && opts.status?.mandate?.status === 'PENDING') return 'pending_timeout';
  if (opts.confirming || opts.status?.mandate?.status === 'PENDING') return 'confirming';
  if (isTerminalMandateFailure(opts.status)) return 'incomplete';
  return 'setup';
}
