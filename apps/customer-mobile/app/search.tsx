import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ScrollView, Modal, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../constants/theme';
import { ProductCard } from '../components/feature/ProductCard';
import {
  applyProductFilters,
  brandsFromProducts,
  getProducts,
  priceRangeFromProducts,
  SortOption,
  FilterOptions,
} from '../services/productService';
import { getCategories } from '../services/categoryService';
import { Product, Category } from '../types';

const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'relevance', label: 'Relevance', icon: 'auto-awesome' },
  { key: 'price_asc', label: 'Price: Low to High', icon: 'arrow-upward' },
  { key: 'price_desc', label: 'Price: High to Low', icon: 'arrow-downward' },
  { key: 'rating', label: 'Highest Rated', icon: 'star' },
  { key: 'newest', label: 'Newest First', icon: 'fiber-new' },
  { key: 'discount', label: 'Best Discount', icon: 'local-offer' },
];

const PRICE_PRESETS = [
  { label: 'Under ₹10K', min: 0, max: 10000 },
  { label: '₹10K–₹50K', min: 10000, max: 50000 },
  { label: '₹50K–₹1L', min: 50000, max: 100000 },
  { label: 'Above ₹1L', min: 100000, max: 999999 },
];

const RATING_OPTIONS = [
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { q: initialQ = '', category: initialCat = '' } = useLocalSearchParams<{ q?: string; category?: string }>();

  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [showFilters, setShowFilters] = useState(false);
  const [activeSort, setActiveSort] = useState<SortOption>('relevance');

  // Filter state
  const [selectedCats, setSelectedCats] = useState<string[]>(initialCat ? [initialCat] : []);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [pricePreset, setPricePreset] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [emiOnly, setEmiOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 999999 });
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  const inputRef = useRef<TextInput>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  // Single GET /products for brands, price range, and results (was 2–3 identical calls).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getProducts().catch(() => [] as Product[]),
      getCategories().catch(() => [] as Category[]),
    ]).then(([products, cats]) => {
      if (cancelled) return;
      setAllProducts(products);
      setAllBrands(brandsFromProducts(products));
      setPriceRange(priceRangeFromProducts(products));
      setCategories(cats);
    });
    return () => { cancelled = true; };
  }, []);

  // Debounce search text so typing does not re-filter on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (selectedCats.length) c++;
    if (selectedBrands.length) c++;
    if (pricePreset !== null || minPrice || maxPrice) c++;
    if (emiOnly) c++;
    if (minRating !== null) c++;
    return c;
  }, [selectedCats, selectedBrands, pricePreset, minPrice, maxPrice, emiOnly, minRating]);

  const filterOpts: FilterOptions = useMemo(() => {
    const preset = pricePreset !== null ? PRICE_PRESETS[pricePreset] : null;
    return {
      query: debouncedQuery,
      categoryIds: selectedCats.length ? selectedCats : undefined,
      brands: selectedBrands.length ? selectedBrands : undefined,
      minPrice: preset ? preset.min : (minPrice ? parseInt(minPrice) : undefined),
      maxPrice: preset ? preset.max : (maxPrice ? parseInt(maxPrice) : undefined),
      emiOnly: emiOnly || undefined,
      minRating: minRating ?? undefined,
      sort: activeSort,
    };
  }, [debouncedQuery, selectedCats, selectedBrands, pricePreset, minPrice, maxPrice, emiOnly, minRating, activeSort]);

  useEffect(() => {
    setSearching(true);
    const next = applyProductFilters(allProducts, filterOpts);
    setResults(next);
    setSearching(false);
  }, [allProducts, filterOpts]);

  const activeSortLabel = SORT_OPTIONS.find(s => s.key === activeSort)?.label ?? 'Sort';

  function clearAllFilters() {
    setSelectedCats([]);
    setSelectedBrands([]);
    setPricePreset(null);
    setMinPrice('');
    setMaxPrice('');
    setEmiOnly(false);
    setMinRating(null);
  }

  function toggleCat(id: string) {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  function toggleBrand(b: string) {
    setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  }

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} horizontal />
  ), []);

  const sortBar = (
    <View style={styles.sortBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
        {SORT_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[styles.sortChip, activeSort === opt.key && styles.sortChipActive]}
            onPress={() => setActiveSort(opt.key)}
          >
            <MaterialIcons
              name={opt.icon as any}
              size={13}
              color={activeSort === opt.key ? '#fff' : Colors.textSecondary}
            />
            <Text style={[styles.sortChipTxt, activeSort === opt.key && styles.sortChipTxtActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search products, brands..."
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>
        <Pressable style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]} onPress={() => setShowFilters(true)}>
          <MaterialIcons name="tune" size={20} color={activeFilterCount > 0 ? '#fff' : Colors.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeTxt}>{activeFilterCount}</Text></View>
          )}
        </Pressable>
      </View>

      {/* Sort bar */}
      {sortBar}

      {/* Results count */}
      <View style={styles.countRow}>
        <Text style={styles.countTxt}>
          {results.length === 0 ? 'No results' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
          {query ? ` for "${query}"` : ''}
        </Text>
        {activeFilterCount > 0 && (
          <Pressable onPress={clearAllFilters}>
            <Text style={styles.clearTxt}>Clear filters</Text>
          </Pressable>
        )}
      </View>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll} contentContainerStyle={styles.pillsContainer}>
          {selectedCats.map(cid => {
            const cat = categories.find(c => c.name === cid);
            return cat ? (
              <View key={cid} style={styles.pill}>
                <Text style={styles.pillTxt}>{cat.name}</Text>
                <Pressable onPress={() => toggleCat(cid)} hitSlop={4}>
                  <MaterialIcons name="close" size={12} color={Colors.primary} />
                </Pressable>
              </View>
            ) : null;
          })}
          {selectedBrands.map(b => (
            <View key={b} style={styles.pill}>
              <Text style={styles.pillTxt}>{b}</Text>
              <Pressable onPress={() => toggleBrand(b)} hitSlop={4}>
                <MaterialIcons name="close" size={12} color={Colors.primary} />
              </Pressable>
            </View>
          ))}
          {(pricePreset !== null) && (
            <View style={styles.pill}>
              <Text style={styles.pillTxt}>{PRICE_PRESETS[pricePreset].label}</Text>
              <Pressable onPress={() => setPricePreset(null)} hitSlop={4}>
                <MaterialIcons name="close" size={12} color={Colors.primary} />
              </Pressable>
            </View>
          )}
          {(minPrice || maxPrice) && pricePreset === null && (
            <View style={styles.pill}>
              <Text style={styles.pillTxt}>
                {minPrice ? `₹${parseInt(minPrice).toLocaleString()}` : '₹0'} – {maxPrice ? `₹${parseInt(maxPrice).toLocaleString()}` : 'any'}
              </Text>
              <Pressable onPress={() => { setMinPrice(''); setMaxPrice(''); }} hitSlop={4}>
                <MaterialIcons name="close" size={12} color={Colors.primary} />
              </Pressable>
            </View>
          )}
          {emiOnly && (
            <View style={styles.pill}>
              <Text style={styles.pillTxt}>EMI Only</Text>
              <Pressable onPress={() => setEmiOnly(false)} hitSlop={4}>
                <MaterialIcons name="close" size={12} color={Colors.primary} />
              </Pressable>
            </View>
          )}
          {minRating !== null && (
            <View style={styles.pill}>
              <Text style={styles.pillTxt}>{minRating}★ & above</Text>
              <Pressable onPress={() => setMinRating(null)} hitSlop={4}>
                <MaterialIcons name="close" size={12} color={Colors.primary} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* Results list */}
      {searching ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="search-off" size={72} color={Colors.border} />
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptySub}>Try adjusting your filters or search terms</Text>
          <Pressable style={styles.emptyBtn} onPress={clearAllFilters}>
            <Text style={styles.emptyBtnTxt}>Clear all filters</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        />
      )}

      {/* Filter Bottom Sheet */}
      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowFilters(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Pressable onPress={clearAllFilters}>
                <Text style={styles.clearTxt}>Clear all</Text>
              </Pressable>
              <Pressable style={styles.sheetClose} onPress={() => setShowFilters(false)}>
                <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Categories */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {categories.map(cat => (
                    <Pressable
                      key={cat.id}
                      style={[styles.chip, selectedCats.includes(cat.name) && styles.chipSelected]}
                      onPress={() => toggleCat(cat.name)}
                    >
                      <Text style={[styles.chipTxt, selectedCats.includes(cat.name) && styles.chipTxtSelected]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Price Range</Text>
                <View style={styles.chipRow}>
                  {PRICE_PRESETS.map((p, i) => (
                    <Pressable
                      key={p.label}
                      style={[styles.chip, pricePreset === i && styles.chipSelected]}
                      onPress={() => {
                        setPricePreset(pricePreset === i ? null : i);
                        setMinPrice('');
                        setMaxPrice('');
                      }}
                    >
                      <Text style={[styles.chipTxt, pricePreset === i && styles.chipTxtSelected]}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.orDivider}>— or enter custom range —</Text>
                <View style={styles.priceInputRow}>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceInputLabel}>Min ₹</Text>
                    <TextInput
                      style={styles.priceInputField}
                      placeholder={`${priceRange.min.toLocaleString()}`}
                      placeholderTextColor={Colors.textTertiary}
                      value={minPrice}
                      onChangeText={t => { setMinPrice(t.replace(/\D/g, '')); setPricePreset(null); }}
                      keyboardType="number-pad"
                    />
                  </View>
                  <Text style={styles.rangeSep}>–</Text>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceInputLabel}>Max ₹</Text>
                    <TextInput
                      style={styles.priceInputField}
                      placeholder={`${priceRange.max.toLocaleString()}`}
                      placeholderTextColor={Colors.textTertiary}
                      value={maxPrice}
                      onChangeText={t => { setMaxPrice(t.replace(/\D/g, '')); setPricePreset(null); }}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Brands */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Brand</Text>
                <View style={styles.chipRow}>
                  {allBrands.map(brand => (
                    <Pressable
                      key={brand}
                      style={[styles.chip, selectedBrands.includes(brand) && styles.chipSelected]}
                      onPress={() => toggleBrand(brand)}
                    >
                      <Text style={[styles.chipTxt, selectedBrands.includes(brand) && styles.chipTxtSelected]}>
                        {brand}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Rating */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Minimum Rating</Text>
                <View style={styles.chipRow}>
                  {RATING_OPTIONS.map(r => (
                    <Pressable
                      key={r.value}
                      style={[styles.chip, minRating === r.value && styles.chipSelected]}
                      onPress={() => setMinRating(minRating === r.value ? null : r.value)}
                    >
                      <Text style={[styles.chipTxt, minRating === r.value && styles.chipTxtSelected]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* EMI Only */}
              <View style={styles.filterSection}>
                <Pressable style={styles.toggleRow} onPress={() => setEmiOnly(v => !v)}>
                  <View>
                    <Text style={styles.filterLabel}>EMI Available Only</Text>
                    <Text style={styles.toggleSub}>Show products with 0% EMI options</Text>
                  </View>
                  <View style={[styles.toggle, emiOnly && styles.toggleOn]}>
                    <View style={[styles.toggleThumb, emiOnly && styles.toggleThumbOn]} />
                  </View>
                </Pressable>
              </View>

              <View style={{ height: Spacing.lg }} />
            </ScrollView>

            {/* Apply button */}
            <Pressable style={styles.applyBtn} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyBtnTxt}>
                Show {results.length} result{results.length !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 10 : Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: Fonts.md, color: Colors.textPrimary, padding: 0 },
  filterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.background },
  filterBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: Fonts.bold },

  // Sort bar
  sortBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sortChips: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipTxt: { fontSize: Fonts.xs, fontWeight: Fonts.medium, color: Colors.textSecondary },
  sortChipTxtActive: { color: '#fff', fontWeight: Fonts.semiBold },

  // Count row
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  countTxt: { fontSize: Fonts.sm, color: Colors.textSecondary },
  clearTxt: { fontSize: Fonts.sm, color: Colors.primary, fontWeight: Fonts.semiBold },

  // Active pills
  pillsScroll: { maxHeight: 44 },
  pillsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: '#F5D0B0' },
  pillTxt: { fontSize: Fonts.xs, color: Colors.primary, fontWeight: Fonts.semiBold },

  // List
  list: { paddingHorizontal: 0, paddingTop: Spacing.xs, paddingBottom: 100 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.huge, gap: Spacing.md },
  emptyTitle: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: Fonts.md, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full, marginTop: Spacing.sm },
  emptyBtnTxt: { color: Colors.primary, fontWeight: Fonts.semiBold, fontSize: Fonts.md },

  // Filter Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, maxHeight: '90%', paddingTop: Spacing.lg },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetTitle: { flex: 1, fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.sm },

  filterSection: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  filterLabel: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary, marginBottom: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border },
  chipSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipTxt: { fontSize: Fonts.sm, fontWeight: Fonts.medium, color: Colors.textSecondary },
  chipTxtSelected: { color: Colors.primary, fontWeight: Fonts.semiBold },

  orDivider: { textAlign: 'center', fontSize: Fonts.xs, color: Colors.textTertiary, marginVertical: Spacing.md },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  priceInput: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: Colors.surfaceAlt },
  priceInputLabel: { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: 4 },
  priceInputField: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary, padding: 0 },
  rangeSep: { fontSize: Fonts.xl, color: Colors.textTertiary, fontWeight: Fonts.bold, paddingBottom: Spacing.sm },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleSub: { fontSize: Fonts.sm, color: Colors.textSecondary, marginTop: 3 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.border, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', ...Shadow.sm },
  toggleThumbOn: { alignSelf: 'flex-end' },

  applyBtn: { marginHorizontal: Spacing.xl, marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center' },
  applyBtnTxt: { color: '#fff', fontSize: Fonts.lg, fontWeight: Fonts.bold },
});
