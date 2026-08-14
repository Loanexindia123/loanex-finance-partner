import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';
import { useAutopay } from '../../hooks/useAutopay';
import { isTerminalMandateFailure } from '../../utils/autopayUi';

type AutoEmiCardProps = {
  /**
   * When false, renders nothing and makes no Autopay API calls.
   * Use for Full Payment / non-EMI orders.
   */
  enabled?: boolean;
  /** Compact post–down-payment prompt vs manage card. */
  variant?: 'setup' | 'manage';
  /** Optional link row to full Autopay screen. */
  onManagePress?: () => void;
  /** Hide the card while first load is in progress (setup variant still shows CTA shell). */
  hideWhileLoading?: boolean;
};

/**
 * Shared Auto EMI status / setup UI.
 * Active only when backend reports ACTIVE or autopayEnabled.
 */
export default function AutoEmiCard({
  enabled = true,
  variant = 'manage',
  onManagePress,
  hideWhileLoading = false,
}: AutoEmiCardProps) {
  const {
    status,
    loading,
    submitting,
    error,
    confirming,
    pollTimedOut,
    isActive,
    statusMessage,
    approvalUrl,
    refresh,
    setupEmandate,
    retrySetup,
    continueAuthorization,
  } = useAutopay({ enabled });

  if (!enabled) return null;

  if (loading && !status && hideWhileLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.sub}>Checking Auto EMI status…</Text>
      </View>
    );
  }

  const mandateStatus = status?.mandate?.status ?? null;
  const canSetup =
    !isActive &&
    (status?.canEnable === true ||
      !status ||
      isTerminalMandateFailure(status) ||
      mandateStatus === 'CANCELLED' ||
      mandateStatus === 'FAILED' ||
      mandateStatus === 'EXPIRED');
  const isPending = mandateStatus === 'PENDING' || confirming;
  const showContinue = Boolean(
    (approvalUrl || status?.mandate?.approvalUrl) &&
      !isActive &&
      (isPending || pollTimedOut),
  );
  const showRetry =
    !isActive &&
    (isTerminalMandateFailure(status) ||
      (mandateStatus === 'PENDING' && pollTimedOut) ||
      (variant === 'manage' && status?.canEnable));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
          <MaterialIcons
            name={isActive ? 'autorenew' : 'account-balance'}
            size={22}
            color={isActive ? Colors.success : Colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {isActive
              ? 'Auto EMI Active'
              : variant === 'setup'
                ? 'Set Up Auto EMI Payment'
                : 'Auto EMI'}
          </Text>
          <Text style={styles.sub}>
            {isActive
              ? 'Monthly EMIs can be collected automatically.'
              : variant === 'setup' && !isPending && !pollTimedOut
                ? 'Your down payment was successful. Complete bank authorization to enable automatic monthly EMI payments.'
                : pollTimedOut && mandateStatus === 'PENDING'
                  ? 'Auto EMI setup is still being confirmed.'
                  : statusMessage ||
                    'Set up Auto EMI to enable automatic monthly payments.'}
          </Text>
        </View>
      </View>

      {status?.loan?.loanAccountNumber ? (
        <Text style={styles.meta}>Loan: {status.loan.loanAccountNumber}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isActive ? (
        onManagePress ? (
          <Pressable style={styles.outlineBtn} onPress={onManagePress}>
            <Text style={styles.outlineBtnTxt}>Manage Auto EMI</Text>
          </Pressable>
        ) : null
      ) : (
        <View style={styles.actions}>
          {isPending && !pollTimedOut ? (
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.pendingTxt}>Confirming bank authorization…</Text>
            </View>
          ) : null}

          {showContinue ? (
            <Pressable
              style={[styles.outlineBtn, submitting && styles.disabled]}
              onPress={continueAuthorization}
              disabled={submitting}
            >
              <Text style={styles.outlineBtnTxt}>Continue Bank Authorization</Text>
            </Pressable>
          ) : null}

          {canSetup && !isPending && !showRetry ? (
            <Pressable
              style={[styles.primaryBtn, submitting && styles.disabled]}
              onPress={setupEmandate}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnTxt}>Set Up Auto EMI</Text>
              )}
            </Pressable>
          ) : null}

          {(showRetry || (pollTimedOut && mandateStatus === 'PENDING')) && !isActive ? (
            <Pressable
              style={[styles.primaryBtn, submitting && styles.disabled]}
              onPress={retrySetup}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnTxt}>Retry Auto EMI Setup</Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            style={styles.linkBtn}
            onPress={() => {
              void refresh();
            }}
            disabled={loading || submitting}
          >
            <MaterialIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.linkTxt}>Refresh status</Text>
          </Pressable>

          {onManagePress ? (
            <Pressable style={styles.linkBtn} onPress={onManagePress}>
              <Text style={styles.linkTxt}>Open Auto EMI details</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  headerRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: Colors.successLight },
  title: {
    fontSize: Fonts.lg,
    fontWeight: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sub: {
    fontSize: Fonts.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  meta: {
    fontSize: Fonts.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  error: {
    color: Colors.error,
    fontSize: Fonts.sm,
    marginBottom: Spacing.sm,
    fontWeight: Fonts.semiBold,
  },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pendingTxt: { fontSize: Fonts.sm, color: Colors.textSecondary, flex: 1 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnTxt: { color: '#fff', fontWeight: Fonts.bold, fontSize: Fonts.md },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  outlineBtnTxt: { color: Colors.primary, fontWeight: Fonts.bold, fontSize: Fonts.md },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  linkTxt: { color: Colors.primary, fontSize: Fonts.sm, fontWeight: Fonts.semiBold },
  disabled: { opacity: 0.55 },
});
