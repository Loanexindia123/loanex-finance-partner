import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getAllLoans, Loan } from '../../services/emiService';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { colors } from '../../theme/colors';
import { radius, shadow, spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LoanList'>;

type FilterStatus = 'all' | 'ACTIVE' | 'CLOSED';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#059669',
  CLOSED: '#6B7280',
};

function formatMoney(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function LoanListScreen({ navigation }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showFilter, setShowFilter] = useState(false);

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllLoans();
      setLoans(data);
    } catch (e) {
      console.warn('Failed to fetch loans', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLoans();
    }, [fetchLoans]),
  );

  const filteredLoans = useMemo(() => {
    let result = [...loans];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.loanAccountNumber.toLowerCase().includes(q) ||
          l.applicationNumber.toLowerCase().includes(q) ||
          String(l.customer?.fullName ?? '').toLowerCase().includes(q) ||
          String(l.customer?.mobile ?? '').includes(q),
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter((l) => l.loanStatus === filterStatus);
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [loans, search, filterStatus]);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Dashboard');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBackPress = () => {
        if (navigation.canGoBack()) return false;
        navigation.navigate('Dashboard');
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
      return () => subscription.remove();
    }, [navigation]),
  );

  const activeCount = loans.filter((l) => l.loanStatus === 'ACTIVE').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={handleGoBack} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Loans</Text>
              <Text style={styles.subtitle}>
                {loans.length} loan accounts · {activeCount} active
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by Loan Account, Application or Customer"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.controlBtn, filterStatus !== 'all' && styles.controlBtnActive]}
            onPress={() => setShowFilter(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={16} color={colors.primary} />
            <Text style={[styles.controlText, filterStatus !== 'all' && styles.controlTextActive]}>
              Filter
            </Text>
          </TouchableOpacity>
        </View>

        {filterStatus !== 'all' && (
          <View style={styles.activeFilters}>
            <Chip
              label={`Status: ${STATUS_LABEL[filterStatus]}`}
              selected
              onRemove={() => setFilterStatus('all')}
            />
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredLoans}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, filteredLoans.length === 0 && styles.listEmpty]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIllustration}>
                  <Ionicons name="cash-outline" size={48} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No Loans Found</Text>
                <Text style={styles.emptyDesc}>
                  Loans are created automatically after a successful down payment.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('LoanDetails', { loanId: item.id })}
              >
                <Card style={styles.loanCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardAccountBlock}>
                      <Text style={styles.cardAccount}>{item.loanAccountNumber}</Text>
                      <Text style={styles.cardApplication}>
                        App: {item.applicationNumber || item.applicationId}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: STATUS_COLOR[item.loanStatus] + '1A' },
                      ]}
                    >
                      <View
                        style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.loanStatus] }]}
                      />
                      <Text style={[styles.statusText, { color: STATUS_COLOR[item.loanStatus] }]}>
                        {STATUS_LABEL[item.loanStatus] ?? item.loanStatus}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Loan Amount</Text>
                      <Text style={styles.metricValue}>{formatMoney(item.loanAmount)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Outstanding</Text>
                      <Text style={[styles.metricValue, styles.metricValueGold]}>
                        {formatMoney(item.outstandingAmount)}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>EMI</Text>
                      <Text style={styles.metricValue}>{formatMoney(item.emiAmount)}/mo</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>
                      {item.customer?.fullName || 'Customer'} ·{' '}
                      {item.customer?.mobile || '—'}
                    </Text>
                    <Text style={styles.footerText}>
                      Next EMI: {formatDate(item.nextEmiDueDate)}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            )}
          />
        )}

        <FilterModal
          visible={showFilter}
          current={filterStatus}
          onSelect={setFilterStatus}
          onClose={() => setShowFilter(false)}
        />
      </View>
    </SafeAreaView>
  );
}

function FilterModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: FilterStatus;
  onSelect: (v: FilterStatus) => void;
  onClose: () => void;
}) {
  const options: { label: string; value: FilterStatus }[] = [
    { label: 'All Loans', value: 'all' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Closed', value: 'CLOSED' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Filter Loans</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, current === opt.value && styles.modalOptionActive]}
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}
            >
              <Text style={[styles.modalOptionText, current === opt.value && styles.modalOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  backBtn: { padding: spacing.xs },
  headerSpacer: { width: 32 },
  titleBlock: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textHeading, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.sm },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  controlText: { fontSize: 14, fontWeight: '700', color: colors.text },
  controlTextActive: { color: colors.primary },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  listEmpty: { flexGrow: 1 },
  loanCard: { marginBottom: spacing.md },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  cardAccountBlock: { flex: 1 },
  cardAccount: { fontSize: 16, fontWeight: '800', color: colors.textHeading },
  cardApplication: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  metric: { flex: 1 },
  metricLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  metricValueGold: { color: colors.accentDark },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  footerText: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: spacing.xxl },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  modalOption: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  modalOptionActive: { backgroundColor: colors.primaryLight, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  modalOptionText: { fontSize: 16, color: colors.text },
  modalOptionTextActive: { color: colors.primary, fontWeight: '600' },
});
