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
  SafeAreaView,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Product } from '../types/product';
import { ProductCard } from '../components/ProductCard';
import { Chip } from '../../../components/ui/Chip';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import { RootStackParamList } from '../../../navigation/types';
import { getProducts, deleteProduct } from '../../../services/productService';
import { useRbac, can } from '../../../auth/rbacStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductList'>;

type SortOption = 'name' | 'price_asc' | 'price_desc' | 'stock';
type FilterStatus = 'all' | Product['status'];

export function ProductListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 2 : 1;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const rbac = useRbac();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const apiProducts = await getProducts({ limit: 1000, status: 'all' });
      // Map backend product to frontend Product type
      const mappedProducts = apiProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        category: p.category || p.categoryId || 'Uncategorized',
        brand: p.brand || 'No Brand',
        sellingPrice: Number(p.price) || 0,
        mrp: Number(p.mrp) || Number(p.price) || 0,
        stock: p.stock || 0,
        status: p.status || 'active',
        imageUrl: p.image || null,
      }));
      setProducts(mappedProducts);
    } catch (e) {
      console.warn('Failed to fetch products', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      result = result.filter((p) => p.status === filterStatus);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.sellingPrice - b.sellingPrice;
        case 'price_desc':
          return b.sellingPrice - a.sellingPrice;
        case 'stock':
          return b.stock - a.stock;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [products, search, sortBy, filterStatus]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(id);
            setProducts((prev) => prev.filter((p) => p.id !== id));
          } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to delete product. Please try again.');
          }
        },
      },
    ]);
  };

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

  return (
    <SafeAreaView style={styles.safe}>
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
              <Text style={styles.title}>Products</Text>
              <Text style={styles.subtitle}>{filteredProducts.length} products in catalog</Text>
            </View>
            {can('products.create') ? (
              <TouchableOpacity
                style={[styles.addBtn, shadow.sm]}
                onPress={() => navigation.navigate('AddProduct')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.addBtnText}>Add Product</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, SKU, brand..."
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

          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.controlBtn, filterStatus !== 'all' && styles.controlBtnActive]}
              onPress={() => setShowFilter(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text style={[styles.controlText, filterStatus !== 'all' && styles.controlTextActive]}>Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, sortBy !== 'name' && styles.controlBtnActive]}
              onPress={() => setShowSort(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-vertical-outline" size={16} color={colors.primary} />
              <Text style={[styles.controlText, sortBy !== 'name' && styles.controlTextActive]}>Sort</Text>
            </TouchableOpacity>
          </View>
        </View>

        {(filterStatus !== 'all' || sortBy !== 'name') && (
          <View style={styles.activeFilters}>
            {filterStatus !== 'all' && (
              <Chip label={`Status: ${filterStatus}`} selected onRemove={() => setFilterStatus('all')} />
            )}
            {sortBy !== 'name' && (
              <Chip label={`Sort: ${sortBy.replace('_', ' ')}`} selected onRemove={() => setSortBy('name')} />
            )}
          </View>
        )}

        <FlatList
          data={filteredProducts}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              {loading ? (
                <>
                  <Text style={styles.emptyTitle}>Loading products...</Text>
                </>
              ) : (
                <>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
                  </View>
                  <Text style={styles.emptyTitle}>No products found</Text>
                  <Text style={styles.emptyDesc}>Try adjusting your search or filters</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={isTablet ? styles.cardWrap : undefined}>
              <ProductCard
                product={item}
                onView={() => navigation.navigate('ProductDetails', { productId: item.id })}
                onEdit={
                  can('products.edit')
                    ? () =>
                        navigation.navigate('AddProduct', {
                          mode: 'edit',
                          productId: item.id,
                        })
                    : undefined
                }
                onDelete={
                  can('products.delete') ? () => handleDelete(item.id) : undefined
                }
              />
            </View>
          )}
        />

        <FilterModal
          visible={showFilter}
          current={filterStatus}
          onSelect={(v) => { setFilterStatus(v); setShowFilter(false); }}
          onClose={() => setShowFilter(false)}
        />

        <SortModal
          visible={showSort}
          current={sortBy}
          onSelect={(v) => { setSortBy(v); setShowSort(false); }}
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
    { label: 'All Products', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Out of Stock', value: 'out_of_stock' },
    { label: 'Archived', value: 'archived' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Filter by Status</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, current === opt.value && styles.modalOptionActive]}
              onPress={() => onSelect(opt.value)}
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
    { label: 'Price: Low to High', value: 'price_asc' },
    { label: 'Price: High to Low', value: 'price_desc' },
    { label: 'Stock: High to Low', value: 'stock' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.modalSheet, shadow.lg]}>
          <Text style={styles.modalTitle}>Sort Products</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.modalOption, current === opt.value && styles.modalOptionActive]}
              onPress={() => onSelect(opt.value)}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
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
  columnWrapper: { gap: spacing.lg },
  cardWrap: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
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
});
