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
import { Order, PAYMENT_TYPE_LABEL } from '../../types/order';
import { OrderCard } from '../../components/order/OrderCard';
import { Chip } from '../../components/ui/Chip';
import { colors } from '../../theme/colors';
import { radius, shadow, spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';

import { getAllOrders } from '../../services/orderService';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderList'>;

type SortOption = 'date' | 'amount' | 'customer';
type FilterStatus = 'all' | Order['status'];
type FilterPayment = 'all' | Order['paymentType'];

export function OrderListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 2 : 1;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPayment, setFilterPayment] = useState<FilterPayment>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getAllOrders();
      setOrders(data);
    } catch (e) {
      console.warn('Failed to fetch orders', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const totalOrders = orders.length;

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerMobile.toLowerCase().includes(q),
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter((o) => o.status === filterStatus);
    }

    if (filterPayment !== 'all') {
      result = result.filter((o) => o.paymentType === filterPayment);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.orderAmount - a.orderAmount;
        case 'customer':
          return a.customerName.localeCompare(b.customerName);
        default:
          return b.orderDate.localeCompare(a.orderDate);
      }
    });

    return result;
  }, [orders, search, sortBy, filterStatus, filterPayment]);

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

  const hasActiveFilters =
    filterStatus !== 'all' || filterPayment !== 'all' || sortBy !== 'date';

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
              <Text style={styles.title}>Orders</Text>
              <Text style={styles.subtitle}>
                {totalOrders.toLocaleString('en-IN')} Orders
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
              placeholder="Search by Order ID, Customer Name or Mobile Number"
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
                (filterStatus !== 'all' || filterPayment !== 'all') && styles.controlBtnActive,
              ]}
              onPress={() => setShowFilter(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text
                style={[
                  styles.controlText,
                  (filterStatus !== 'all' || filterPayment !== 'all') && styles.controlTextActive,
                ]}
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
                label={`Status: ${filterStatus}`}
                selected
                onRemove={() => setFilterStatus('all')}
              />
            )}
            {filterPayment !== 'all' && (
              <Chip
                label={`Payment: ${PAYMENT_TYPE_LABEL[filterPayment] ?? filterPayment}`}
                selected
                onRemove={() => setFilterPayment('all')}
              />
            )}
            {sortBy !== 'date' && (
              <Chip
                label={`Sort: ${sortBy}`}
                selected
                onRemove={() => setSortBy('date')}
              />
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredOrders}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            filteredOrders.length === 0 && styles.listEmpty,
          ]}
          columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIllustration}>
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Orders Found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search or filters</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={isTablet ? styles.cardWrap : undefined}>
              <OrderCard
                order={item}
                onView={() => navigation.navigate('OrderDetails', { orderId: item.id })}
              />
            </View>
          )}
        />
        )}

        <FilterModal
          visible={showFilter}
          status={filterStatus}
          payment={filterPayment}
          onSelectStatus={setFilterStatus}
          onSelectPayment={setFilterPayment}
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
  payment,
  onSelectStatus,
  onSelectPayment,
  onClose,
}: {
  visible: boolean;
  status: FilterStatus;
  payment: FilterPayment;
  onSelectStatus: (v: FilterStatus) => void;
  onSelectPayment: (v: FilterPayment) => void;
  onClose: () => void;
}) {
  const statusOptions: { label: string; value: FilterStatus }[] = [
    { label: 'All Orders', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Approved', value: 'approved' },
    { label: 'Processing', value: 'processing' },
    { label: 'Packed', value: 'packed' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Out for Delivery', value: 'out_for_delivery' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  const paymentOptions: { label: string; value: FilterPayment }[] = [
    { label: 'All Payment Types', value: 'all' },
    { label: PAYMENT_TYPE_LABEL.online, value: 'online' },
    { label: PAYMENT_TYPE_LABEL.cash, value: 'cash' },
    { label: PAYMENT_TYPE_LABEL.emi, value: 'emi' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Filter Orders</Text>

          <Text style={styles.modalSectionLabel}>Order Status</Text>
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

          <Text style={[styles.modalSectionLabel, styles.modalSectionSpaced]}>Payment Type</Text>
          {paymentOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, payment === opt.value && styles.modalOptionActive]}
              onPress={() => onSelectPayment(opt.value)}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  payment === opt.value && styles.modalOptionTextActive,
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
    { label: 'Order Date (Newest)', value: 'date' },
    { label: 'Amount: High to Low', value: 'amount' },
    { label: 'Customer Name (A-Z)', value: 'customer' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Sort Orders</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});
