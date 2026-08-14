import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useAutopay } from '../hooks/useAutopay';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';
import { APP_CONFIG } from '../constants/config';
import { isTerminalMandateFailure } from '../utils/autopayUi';

const formatInr = (n: number | null | undefined) =>
  n == null
    ? '—'
    : `${APP_CONFIG.currency}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AutopayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

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
  } = useAutopay({ enabled: Boolean(user) });

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="lock" size={64} color={Colors.border} />
        <Text style={styles.emptyTitle}>Login required</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.primaryBtnTxt}>Login</Text>
        </Pressable>
      </View>
    );
  }

  const mandateStatus = status?.mandate?.status ?? null;
  const isPending = mandateStatus === 'PENDING' || confirming;
  const canSetup =
    !isActive &&
    (status?.canEnable === true || isTerminalMandateFailure(status) || !status?.mandate);
  const showContinue = Boolean(
    (approvalUrl || status?.mandate?.approvalUrl) && !isActive && (isPending || pollTimedOut),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Auto EMI</Text>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            void refresh();
          }}
        >
          <MaterialIcons name="refresh" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!status}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {loading && !status ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.sub}>Loading Auto EMI status…</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={[styles.badge, isActive ? styles.badgeOk : styles.badgeMuted]}>
                <MaterialIcons
                  name={isActive ? 'check-circle' : 'autorenew'}
                  size={18}
                  color={isActive ? Colors.success : Colors.primary}
                />
                <Text
                  style={[
                    styles.badgeTxt,
                    { color: isActive ? Colors.success : Colors.textPrimary },
                  ]}
                >
                  {isActive
                    ? 'Auto EMI Active'
                    : pollTimedOut && mandateStatus === 'PENDING'
                      ? 'Auto EMI setup is still being confirmed.'
                      : statusMessage || 'Set Up Auto EMI Payment'}
                </Text>
              </View>

              <Text style={styles.body}>
                {isActive
                  ? 'Your bank authorization is confirmed. Future EMIs can be collected automatically.'
                  : 'Complete bank authorization so monthly EMIs can be collected automatically. Status is confirmed by the server after Razorpay approval — not by this screen alone.'}
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {status?.loan ? (
                <View style={styles.loanBox}>
                  <View style={styles.row}>
                    <Text style={styles.k}>Loan account</Text>
                    <Text style={styles.v}>{status.loan.loanAccountNumber}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.k}>Monthly EMI</Text>
                    <Text style={styles.v}>{formatInr(status.loan.emiAmount)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.k}>Loan status</Text>
                    <Text style={styles.v}>{status.loan.loanStatus}</Text>
                  </View>
                  <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <Text style={styles.k}>Mandate</Text>
                    <Text style={styles.v}>{mandateStatus ?? 'None'}</Text>
                  </View>
                </View>
              ) : null}

              {isPending && !pollTimedOut ? (
                <View style={styles.pendingRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.sub}>Waiting for bank confirmation…</Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                {showContinue ? (
                  <Pressable
                    style={[styles.outlineBtn, submitting && styles.disabled]}
                    onPress={continueAuthorization}
                    disabled={submitting}
                  >
                    <Text style={styles.outlineBtnTxt}>Continue Bank Authorization</Text>
                  </Pressable>
                ) : null}

                {canSetup && !isActive && !isPending ? (
                  <Pressable
                    style={[styles.primaryBtn, submitting && styles.disabled]}
                    onPress={setupEmandate}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnTxt}>Set Up Auto EMI</Text>
                    )}
                  </Pressable>
                ) : null}

                {!isActive &&
                (isTerminalMandateFailure(status) ||
                  (mandateStatus === 'PENDING' && pollTimedOut) ||
                  (mandateStatus === 'PENDING' && !showContinue)) ? (
                  <Pressable
                    style={[styles.primaryBtn, submitting && styles.disabled]}
                    onPress={retrySetup}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnTxt}>Retry Auto EMI Setup</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.infoBox}>
              <MaterialIcons name="info-outline" size={16} color={Colors.primary} />
              <Text style={styles.infoText}>
                Down payment success alone does not activate Auto EMI. Authorization must be
                confirmed by the backend after you approve the mandate with your bank.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: Fonts.xl,
    fontWeight: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  centerCard: { padding: Spacing.xxl, alignItems: 'center' },
  emptyTitle: {
    fontSize: Fonts.lg,
    fontWeight: Fonts.bold,
    color: Colors.textSecondary,
    marginVertical: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  badgeOk: { backgroundColor: Colors.successLight },
  badgeMuted: { backgroundColor: Colors.primaryLight },
  badgeTxt: { flex: 1, fontSize: Fonts.md, fontWeight: Fonts.bold },
  body: {
    fontSize: Fonts.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  sub: { fontSize: Fonts.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  error: {
    color: Colors.error,
    fontSize: Fonts.sm,
    fontWeight: Fonts.semiBold,
    marginBottom: Spacing.sm,
  },
  loanBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  k: { color: Colors.textSecondary, fontSize: Fonts.sm },
  v: {
    color: Colors.textPrimary,
    fontSize: Fonts.sm,
    fontWeight: Fonts.semiBold,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actions: { gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
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
  disabled: { opacity: 0.55 },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: Fonts.sm, color: Colors.textSecondary, lineHeight: 19 },
});
