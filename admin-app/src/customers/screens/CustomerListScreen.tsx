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
import { Customer } from '../../types/customer';
import { getCustomers } from '../../services/customerService';
import { CustomerCard } from '../../components/customer/CustomerCard';
import { Chip } from '../../components/ui/Chip';
import { colors } from '../../theme/colors';
import { radius, shadow, spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerList'>;

type SortOption = 'name' | 'city' | 'emi_status';
type FilterStatus = 'all' | Customer['status'];
type FilterEmi = 'all' | Customer['emiStatus'];

export function CustomerListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 2 : 1;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterEmi, setFilterEmi] = useState<FilterEmi>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCustomers();
    }, [fetchCustomers])
  );

  const totalCustomers = customers.length;

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.mobile.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }

    if (filterEmi !== 'all') {
      result = result.filter((c) => c.emiStatus === filterEmi);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'city':
          return a.city.localeCompare(b.city);
        case 'emi_status':
          return a.emiStatus.localeCompare(b.emiStatus);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [customers, search, sortBy, filterStatus, filterEmi]);

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

  const hasActiveFilters = filterStatus !== 'all' || filterEmi !== 'all' || sortBy !== 'name';

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
              <Text style={styles.title}>Customers</Text>
              <Text style={styles.subtitle}>
                {totalCustomers.toLocaleString('en-IN')} Customers
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
              placeholder="Search by Customer Name, Mobile Number or Customer ID"
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
              style={[
                styles.controlBtn,
                (filterStatus !== 'all' || filterEmi !== 'all') && styles.controlBtnActive,
              ]}
              onPress={() => setShowFilter(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text
                style={[
                  styles.controlText,
                  (filterStatus !== 'all' || filterEmi !== 'all') && styles.controlTextActive,
                ]}
              >
                Filter
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, sortBy !== 'name' && styles.controlBtnActive]}
              onPress={() => setShowSort(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
              <Text style={[styles.controlText, sortBy !== 'name' && styles.controlTextActive]}>
                Sort
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasActiveFilters && (
          <View style={styles.activeFilters}>
            {filterStatus !== 'all' && (
              <Chip
                label={`Status: ${filterStatus}`}
                selected
                onRemove={() => setFilterStatus('all')}
              />
            )}
            {filterEmi !== 'all' && (
              <Chip label={`EMI: ${filterEmi}`} selected onRemove={() => setFilterEmi('all')} />
            )}
            {sortBy !== 'name' && (
              <Chip
                label={`Sort: ${sortBy.replace('_', ' ')}`}
                selected
                onRemove={() => setSortBy('name')}
              />
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading Customers...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCustomers}
            key={numColumns}
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.list,
              filteredCustomers.length === 0 && styles.listEmpty,
            ]}
            columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIllustration}>
                  <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No Customers Found</Text>
                <Text style={styles.emptyDesc}>Try adjusting your search or filters</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={isTablet ? styles.cardWrap : undefined}>
                <CustomerCard
                  customer={item}
                  onView={() =>
                    navigation.navigate('CustomerDetails', { customerId: item.id })
                  }
                />
              </View>
            )}
          />
        )}

        <FilterModal
          visible={showFilter}
          status={filterStatus}
          emi={filterEmi}
          onSelectStatus={setFilterStatus}
          onSelectEmi={setFilterEmi}
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
  status,
  emi,
  onSelectStatus,
  onSelectEmi,
  onClose,
}: {
  visible: boolean;
  status: FilterStatus;
  emi: FilterEmi;
  onSelectStatus: (v: FilterStatus) => void;
  onSelectEmi: (v: FilterEmi) => void;
  onClose: () => void;
}) {
  const statusOptions: { label: string; value: FilterStatus }[] = [
    { label: 'All Customers', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  const emiOptions: { label: string; value: FilterEmi }[] = [
    { label: 'All EMI Status', value: 'all' },
    { label: 'Running', value: 'running' },
    { label: 'Pending', value: 'pending' },
    { label: 'Completed', value: 'completed' },
    { label: 'Rejected', value: 'rejected' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Filter Customers</Text>

          <Text style={styles.modalSectionLabel}>Customer Status</Text>
          {statusOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, status === opt.value && styles.modalOptionActive]}
              onPress={() => onSelectStatus(opt.value)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  status === opt.value && styles.modalOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.modalSectionLabel, styles.modalSectionSpaced]}>EMI Status</Text>
          {emiOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, emi === opt.value && styles.modalOptionActive]}
              onPress={() => onSelectEmi(opt.value)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  emi === opt.value && styles.modalOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.modalDoneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
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
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'City (A-Z)', value: 'city' },
    { label: 'EMI Status', value: 'emi_status' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Sort Customers</Text>
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
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  modalSectionSpaced: {
    marginTop: spacing.lg,
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
  modalDoneBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
