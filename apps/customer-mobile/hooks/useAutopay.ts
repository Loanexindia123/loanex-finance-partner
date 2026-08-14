import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  cancelMandate,
  createEmandate,
  extractAutopayError,
  getAutopayStatus,
} from '../services/autopayService';
import type { AutopayStatus } from '../types';
import {
  AUTO_EMI_POLL_INTERVAL_MS,
  AUTO_EMI_POLL_MAX_ATTEMPTS,
  autoEmiStatusMessage,
  isAutoEmiActive,
  isTerminalMandateFailure,
  openApprovalUrl,
  resolveAutoEmiPhase,
  shouldStopAutopayPolling,
  type AutoEmiUiPhase,
} from '../utils/autopayUi';

type UseAutopayOptions = {
  /** When false, no Autopay API calls are made (Full Payment safety). */
  enabled?: boolean;
  /** Load status on mount when enabled. Default true. */
  autoLoad?: boolean;
};

export function useAutopay(options: UseAutopayOptions = {}) {
  const enabled = options.enabled !== false;
  const autoLoad = options.autoLoad !== false;

  const [status, setStatus] = useState<AutopayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<AutopayStatus | null> => {
    if (!enabled) return null;
    setLoading(true);
    try {
      const data = await getAutopayStatus();
      if (!mountedRef.current) return data;
      setStatus(data);
      setApprovalUrl(data.mandate?.approvalUrl ?? null);
      setError(null);
      if (isAutoEmiActive(data)) {
        setConfirming(false);
        setPollTimedOut(false);
        stopPolling();
      } else if (shouldStopAutopayPolling(data) && data.mandate?.status !== 'PENDING') {
        setConfirming(false);
        stopPolling();
      }
      return data;
    } catch (err) {
      if (!mountedRef.current) return null;
      const httpErr = err as { status?: number };
      // No active loan yet (e.g. right after down payment) — keep UI in setup mode.
      if (httpErr?.status === 404) {
        setStatus(null);
        setError(null);
        return null;
      }
      const msg = extractAutopayError(err);
      setError(msg);
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollAttemptsRef.current = 0;
    setPollTimedOut(false);
    setConfirming(true);

    const tick = async () => {
      if (!mountedRef.current || !enabled) return;
      try {
        const data = await getAutopayStatus();
        if (!mountedRef.current) return;
        setStatus(data);
        setApprovalUrl(data.mandate?.approvalUrl ?? null);

        if (shouldStopAutopayPolling(data)) {
          setConfirming(false);
          setPollTimedOut(false);
          stopPolling();
          return;
        }

        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current >= AUTO_EMI_POLL_MAX_ATTEMPTS) {
          setConfirming(false);
          setPollTimedOut(data.mandate?.status === 'PENDING');
          stopPolling();
          return;
        }
        pollTimerRef.current = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
      } catch {
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current >= AUTO_EMI_POLL_MAX_ATTEMPTS) {
          setConfirming(false);
          setPollTimedOut(true);
          stopPolling();
          return;
        }
        pollTimerRef.current = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
      }
    };

    pollTimerRef.current = setTimeout(tick, AUTO_EMI_POLL_INTERVAL_MS);
  }, [enabled, stopPolling]);

  useEffect(() => {
    if (enabled && autoLoad) {
      void refresh();
    }
  }, [enabled, autoLoad, refresh]);

  // Refresh when user returns from Razorpay hosted auth.
  useEffect(() => {
    if (!enabled) return;

    const onChange = (next: AppStateStatus) => {
      if (next !== 'active') return;
      const pending = status?.mandate?.status === 'PENDING';
      if (confirming || pollTimedOut || pending) {
        void refresh().then((data) => {
          if (data && data.mandate?.status === 'PENDING' && !isAutoEmiActive(data)) {
            if (!pollTimerRef.current) startPolling();
          }
        });
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, confirming, pollTimedOut, status?.mandate?.status, refresh, startPolling]);

  const afterMandateCreated = useCallback(
    async (url: string | null | undefined) => {
      const trimmed = (url ?? '').trim();
      if (!trimmed) {
        setError('Authorization link was not returned. Please try again.');
        await refresh();
        return;
      }
      setApprovalUrl(trimmed);
      const result = await openApprovalUrl(trimmed);
      if (!result.opened) {
        setError('Could not open bank authorization. Please try again.');
        return;
      }
      setConfirming(true);
      startPolling();
    },
    [refresh, startPolling],
  );

  const setupEmandate = useCallback(async () => {
    if (!enabled || submitting) return;
    setSubmitting(true);
    setError(null);
    setPollTimedOut(false);
    try {
      const mandate = await createEmandate();
      if (!mountedRef.current) return;
      setStatus((prev) =>
        prev
          ? { ...prev, mandate, autopayStatus: 'PENDING', canEnable: false }
          : prev,
      );
      await afterMandateCreated(mandate.approvalUrl);
    } catch (err) {
      if (mountedRef.current) setError(extractAutopayError(err));
      await refresh();
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [enabled, submitting, afterMandateCreated, refresh]);

  /**
   * PENDING → cancel then create.
   * Terminal failure / canEnable → create only.
   * ACTIVE → do not cancel; no-op with message.
   */
  const retrySetup = useCallback(async () => {
    if (!enabled || submitting) return;
    setSubmitting(true);
    setError(null);
    setPollTimedOut(false);
    try {
      const current = await getAutopayStatus();
      if (!mountedRef.current) return;
      setStatus(current);
      setApprovalUrl(current.mandate?.approvalUrl ?? null);

      if (isAutoEmiActive(current)) {
        setConfirming(false);
        setError(null);
        return;
      }

      if (current.mandate?.status === 'PENDING') {
        await cancelMandate();
      } else if (
        !current.canEnable &&
        !isTerminalMandateFailure(current)
      ) {
        // Unexpected state — surface backend message via refresh
        setError('Auto EMI cannot be set up right now. Please try again later.');
        return;
      }

      const mandate = await createEmandate();
      if (!mountedRef.current) return;
      setStatus((prev) =>
        prev
          ? { ...prev, mandate, autopayStatus: 'PENDING', canEnable: false }
          : prev,
      );
      await afterMandateCreated(mandate.approvalUrl);
    } catch (err) {
      if (mountedRef.current) setError(extractAutopayError(err));
      await refresh();
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [enabled, submitting, afterMandateCreated, refresh]);

  const continueAuthorization = useCallback(async () => {
    if (!enabled || submitting) return;
    const url = (approvalUrl || status?.mandate?.approvalUrl || '').trim();
    if (!url) {
      setError('No authorization link available. Use Retry Auto EMI Setup.');
      return;
    }
    setError(null);
    const result = await openApprovalUrl(url);
    if (!result.opened) {
      setError('Could not open bank authorization. Please try again.');
      return;
    }
    setConfirming(true);
    startPolling();
  }, [enabled, submitting, approvalUrl, status?.mandate?.approvalUrl, startPolling]);

  const clearError = useCallback(() => setError(null), []);

  const isActive = isAutoEmiActive(status);
  const phase: AutoEmiUiPhase = resolveAutoEmiPhase({
    status,
    submitting,
    confirming,
    pollTimedOut,
  });
  const statusMessage = autoEmiStatusMessage(status);

  return {
    enabled,
    status,
    loading,
    submitting,
    error,
    confirming,
    pollTimedOut,
    approvalUrl,
    isActive,
    phase,
    statusMessage,
    refresh,
    setupEmandate,
    retrySetup,
    continueAuthorization,
    clearError,
  };
}
