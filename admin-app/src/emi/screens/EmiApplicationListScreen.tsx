import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmiApplication } from '../../types/emiApplication';
import { getAllEmiApplications } from '../../services/emiService';
import { EmiApplicationCard } from '../../components/emi/EmiApplicationCard';
import { Chip } from '../../components/ui/Chip';
import { colors } from '../../theme/colors';
import { radius, shadow, spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmiApplicationList'>;

type SortOption = 'date' | 'amount' | 'customer';
type FilterStatus = 'all' | EmiApplication['status'];

export function EmiApplicationListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 2 : 1;

  const [applications, setApplications] = useState<EmiApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllEmiApplications();
      setApplications(data);
    } catch (error) {
      console.error('Failed to fetch EMI applications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchApplications();
    }, [fetchApplications]),
  );

  const totalApplications = applications.length;

  const filteredApplications = useMemo(() => {
    let result = [...applications];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.customerName.toLowerCase().includes(q) ||
          a.mobile.toLowerCase().includes(q),
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter((a) => a.status === filterStatus);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.requestedLoanAmount - a.requestedLoanAmount;
        case 'customer':
          return a.customerName.localeCompare(b.customerName);
        default:
          return b.applicationDate.localeCompare(a.applicationDate);
      }
    });

    return result;
  }, [applications, search, sortBy, filterStatus]);

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
        if (navigation.canGoBack()) {
          return false;
        }
        navigation.navigate('Dashboard');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
      return () => subscription.remove();
    }, [navigation]),
  );

  const hasActiveFilters = filterStatus !== 'all' || sortBy !== 'date';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleGoBack}
              accessibilityLabel="Go back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>EMI Applications</Text>
              <Text style={styles.subtitle}>
                {totalApplications.toLocaleString('en-IN')} Applications
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
              placeholder="Search by Application ID, Customer Name or Mobile Number"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlBtn, filterStatus !== 'all' && styles.controlBtnActive]}
              onPress={() => setShowFilter(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text
                style={[styles.controlText, filterStatus !== 'all' && styles.controlTextActive]}
              >
                Filter
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, sortBy !== 'date' && styles.controlBtnActive]}
              onPress={() => setShowSort(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
              <Text style={[styles.controlText, sortBy !== 'date' && styles.controlTextActive]}>
                Sort
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasActiveFilters && (
          <View style={styles.activeFilters}>
            {filterStatus !== 'all' && (
              <Chip
                label={`Status: ${filterStatus.replace('_', ' ')}`}
                selected
                onRemove={() => setFilterStatus('all')}
              />
            )}
            {sortBy !== 'date' && (
              <Chip label={`Sort: ${sortBy}`} selected onRemove={() => setSortBy('date')} />
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading EMI Applications...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredApplications}
            key={numColumns}
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.list,
              filteredApplications.length === 0 && styles.listEmpty,
            ]}
            columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIllustration}>
                  <Ionicons name="card-outline" size={48} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No EMI Applications Found</Text>
                <Text style={styles.emptyDesc}>Try adjusting your search or filters</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={isTablet ? styles.cardWrap : undefined}>
                <EmiApplicationCard
                  application={item}
                  onView={() =>
                    navigation.navigate('EmiApplicationDetails', { applicationId: item.id })
                  }
                />
              </View>
            )}
          />
        )}

        <FilterModal
          visible={showFilter}
          current={filterStatus}
          onSelect={(v) => {
            setFilterStatus(v);
            setShowFilter(false);
          }}
          onClose={() => setShowFilter(false)}
        />

        <SortModal
          visible={showSort}
          current={sortBy}
          onSelect={(v) => {
            setSortBy(v);
            setShowSort(false);
          }}
          onClose={() => setShowSort(false)}
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
    { label: 'All Applications', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Under Review', value: 'under_review' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Hold', value: 'hold' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Filter Applications</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, current === opt.value && styles.modalOptionActive]}
              onPress={() => onSelect(opt.value)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  current === opt.value && styles.modalOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function SortModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: SortOption;
  onSelect: (v: SortOption) => void;
  onClose: () => void;
}) {
  const options: { label: string; value: SortOption }[] = [
    { label: 'Application Date (Newest)', value: 'date' },
    { label: 'Loan Amount: High to Low', value: 'amount' },
    { label: 'Customer Name (A-Z)', value: 'customer' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Sort Applications</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, current === opt.value && styles.modalOptionActive]}
              onPress={() => onSelect(opt.value)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  current === opt.value && styles.modalOptionTextActive,
                ]}
              >
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerSpacer: {
    width: 32,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textHeading,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlBtn: {
    flex: 1,
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
  controlBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  controlIcon: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  controlText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  controlTextActive: {
    color: colors.primary,
  },
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  listEmpty: {
    flexGrow: 1,
  },
  columnWrapper: { gap: spacing.lg },
  cardWrap: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xxl,
  },
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  modalOption: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalOptionActive: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  modalOptionText: { fontSize: 16, color: colors.text },
  modalOptionTextActive: { color: colors.primary, fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textSecondary },
});
