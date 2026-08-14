import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useKYC } from '../../hooks/useKYC';
import { getLoanDashboard, LoanDashboard } from '../../services/emiPaymentService';
import { Colors, Fonts, Spacing, Radius } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

const formatInr = (n: number | null | undefined) =>
  n == null ? '—' : `${APP_CONFIG.currency}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function statusColor(status: string) {
  switch (status) {
    case 'PAID': return Colors.success;
    case 'OVERDUE': return Colors.error;
    case 'PENDING': return Colors.warning;
    default: return Colors.textSecondary;
  }
}

export default function EMIsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isKYCComplete, kycLoading } = useKYC();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<LoanDashboard | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getLoanDashboard();
      setDashboard(data);
      setError('');
    } catch (e: any) {
      setDashboard(null);
      const msg = String(e?.message ?? '');
      setError(
        e?.code === 'SESSION_EXPIRED'
          ? 'SESSION_EXPIRED'
          : msg.includes('No active loans') || /\b404\b/.test(msg)
            ? 'No active loans found for user'
            : msg || 'Failed to load your loans',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load])
  );

  if (!user) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <MaterialIcons name="account-balance" size={80} color={Colors.border} />
        <Text style={styles.emptyTitle}>Login Required</Text>
        <Text style={styles.emptySub}>Please login to view your EMI applications</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginBtnTxt}>Login</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || kycLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My EMIs</Text>
        </View>
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptySub}>Loading your loans...</Text>
        </View>
      </View>
    );
  }

  // No KYC → nothing to show. EMI eligibility only exists for verified users.
  if (!isKYCComplete) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My EMIs</Text>
        </View>
        <View style={styles.empty}>
          <MaterialIcons name="verified-user" size={80} color={Colors.border} />
          <Text style={styles.emptyTitle}>Complete KYC to see EMIs</Text>
          <Text style={styles.emptySub}>
            Your identity must be verified (Aadhaar, PAN & credit check) before you can
            apply for EMI or view loans.
          </Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/kyc-verification' as any)}>
            <Text style={styles.loginBtnTxt}>Verify Now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!dashboard || error) {
    const sessionExpired = error === 'SESSION_EXPIRED';
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My EMIs</Text>
        </View>
        <View style={styles.empty}>
          <MaterialIcons
            name={sessionExpired ? 'lock-clock' : 'account-balance-wallet'}
            size={80}
            color={Colors.border}
          />
          <Text style={styles.emptyTitle}>
            {sessionExpired ? 'Session expired' : 'No EMIs yet'}
          </Text>
          <Text style={styles.emptySub}>
            {sessionExpired
              ? 'Please log in again to view your EMI loans.'
              : error === 'No active loans found for user' || !error
                ? "You haven't taken any EMI loans yet."
                : error}
          </Text>
          <Pressable
            style={styles.loginBtn}
            onPress={() =>
              sessionExpired ? router.push('/auth/login') : router.push('/(tabs)')
            }
          >
            <Text style={styles.loginBtnTxt}>
              {sessionExpired ? 'Login' : 'Browse Products'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { loan, summary, nextEmi, schedule, recentPayments } = dashboard;
  const payableEmi = schedule.find((s) => s.paymentStatus === 'PENDING' || s.paymentStatus === 'OVERDUE');
  const nextEmiId = nextEmi?.id ?? payableEmi?.id;

  const sections: Array<{ key: string; component: React.ReactElement }> = [
    {
      key: 'summary',
      component: (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Loan Summary</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(loan.loanStatus) + '20' }]}>
              <Text style={[styles.statusTxt, { color: statusColor(loan.loanStatus) }]}>{loan.loanStatus}</Text>
            </View>
          </View>
          <Text style={styles.loanAccount}>Loan Account: {loan.loanAccountNumber}</Text>
          <Text style={styles.productName}>{loan.productName}</Text>
          <View style={styles.grid}>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Monthly EMI</Text>
              <Text style={styles.detailValue}>{formatInr(loan.emiAmount)}</Text>
            </View>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Tenure</Text>
              <Text style={styles.detailValue}>{loan.loanTenure} Months</Text>
            </View>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>EMIs Paid</Text>
              <Text style={styles.detailValue}>{summary.emisPaid} / {summary.remainingEmis + summary.emisPaid}</Text>
            </View>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Outstanding</Text>
              <Text style={[styles.detailValue, { color: Colors.error }]}>{formatInr(summary.outstandingBalance)}</Text>
            </View>
          </View>
          {summary.remainingEmis > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      100,
                      (summary.emisPaid / Math.max(1, summary.emisPaid + summary.remainingEmis)) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
          )}
          {nextEmi && summary.remainingEmis > 0 && (
            <Pressable
              style={[styles.payBtn, !dashboard.canPayEmi && { opacity: 0.5 }]}
              onPress={() => nextEmiId && router.push({ pathname: '/emi-pay', params: { emiId: nextEmiId } })}
              disabled={!dashboard.canPayEmi}
            >
              <MaterialIcons name="payment" size={18} color="#fff" />
              <Text style={styles.payBtnTxt}>
                {dashboard.canPayEmi
                  ? `Pay EMI #${nextEmi.emiNumber} · ${formatInr(nextEmi.amount)}`
                  : 'No EMI due'}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={styles.autopayBtn}
            onPress={() => router.push('/autopay' as any)}
          >
            <MaterialIcons name="autorenew" size={18} color={Colors.primary} />
            <Text style={styles.autopayBtnTxt}>Auto EMI / Autopay</Text>
          </Pressable>
        </View>
      ),
    },
    {
      key: 'schedule',
      component: (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EMI Schedule</Text>
          {schedule.length === 0 ? (
            <Text style={styles.emptySub}>No schedule available for this loan.</Text>
          ) : (
            schedule.map((row) => {
              const isPayable = row.id === nextEmiId && (row.paymentStatus === 'PENDING' || row.paymentStatus === 'OVERDUE');
              const color = statusColor(row.paymentStatus);
              return (
                <View key={row.id} style={styles.emiRow}>
                  <View style={[styles.emiNum, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.emiNumTxt, { color }]}>{row.emiNumber}</Text>
                  </View>
                  <View style={styles.emiInfo}>
                    <Text style={styles.emiMeta}>
                      Due {formatDate(row.dueDate)}{row.paidAt ? ` · Paid ${formatDate(row.paidAt)}` : ''}
                    </Text>
                    <Text style={styles.emiAmt}>{formatInr(row.emiAmount)}</Text>
                  </View>
                  {row.paymentStatus === 'PAID' ? (
                    <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                      <Text style={[styles.statusTxt, { color: Colors.success }]}>PAID</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.miniPayBtn, !isPayable && { opacity: 0.4 }]}
                      onPress={() => isPayable && router.push({ pathname: '/emi-pay', params: { emiId: row.id } })}
                      disabled={!isPayable}
                    >
                      <Text style={styles.miniPayTxt}>{isPayable ? 'Pay' : row.paymentStatus}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>
      ),
    },
  ];

  if (recentPayments.length > 0) {
    sections.push({
      key: 'history',
      component: (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment History</Text>
          {recentPayments.map((p) => (
            <View key={p.emiId} style={styles.emiRow}>
              <View style={[styles.emiNum, { backgroundColor: Colors.success + '18' }]}>
                <MaterialIcons name="check" size={14} color={Colors.success} />
              </View>
              <View style={styles.emiInfo}>
                <Text style={styles.emiMeta}>EMI #{p.emiNumber} · {formatDate(p.paidDate)}</Text>
                <Text style={styles.emiAmt}>{formatInr(p.amount)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                <Text style={[styles.statusTxt, { color: Colors.success }]}>{p.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My EMIs</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.appsBtn} onPress={() => router.push('/emi-applications')}>
            <MaterialIcons name="description" size={16} color={Colors.primary} />
            <Text style={styles.appsBtnTxt}>Applications</Text>
          </Pressable>
          <Pressable style={styles.refreshBtn} onPress={() => { setRefreshing(true); load(); }}>
            <MaterialIcons name="refresh" size={22} color={Colors.primary} />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        renderItem={({ item }) => item.component}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  title: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  refreshBtn: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  appsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full },
  appsBtnTxt: { color: Colors.primary, fontSize: Fonts.xs, fontWeight: Fonts.bold },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textSecondary, marginTop: Spacing.md },
  emptySub: { fontSize: Fonts.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.sm },
  loginBtn: { marginTop: Spacing.xl, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full },
  loginBtnTxt: { color: '#fff', fontWeight: Fonts.bold, fontSize: Fonts.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  cardTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  loanAccount: { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: 2 },
  productName: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  detailBox: { flexBasis: '47%', flexGrow: 1, backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.md },
  detailLabel: { fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase' },
  detailValue: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.primary, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: Radius.full, backgroundColor: Colors.borderLight, overflow: 'hidden', marginBottom: Spacing.md },
  progressFill: { height: 8, borderRadius: Radius.full, backgroundColor: Colors.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  statusTxt: { fontSize: 10, fontWeight: Fonts.bold },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.lg, gap: Spacing.sm },
  payBtnTxt: { color: '#fff', fontWeight: Fonts.bold, fontSize: Fonts.md },
  autopayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  autopayBtnTxt: { color: Colors.primary, fontWeight: Fonts.bold, fontSize: Fonts.md },
  emiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  emiNum: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  emiNumTxt: { fontSize: Fonts.sm, fontWeight: Fonts.bold },
  emiInfo: { flex: 1 },
  emiMeta: { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: 2 },
  emiAmt: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  miniPayBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  miniPayTxt: { color: '#fff', fontSize: Fonts.xs, fontWeight: Fonts.bold },
});
