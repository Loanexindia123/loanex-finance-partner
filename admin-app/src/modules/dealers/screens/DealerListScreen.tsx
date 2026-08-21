import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { listDealers, type AppDealer } from '../../../services/dealerService';
import { can, isDealer } from '../../../auth/rbacStore';
import { SafeHeader } from '../../../components/layout/SafeHeader';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import type { DealerTabParamList, RootStackParamList } from '../../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DealerTabParamList, 'Dealers'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function DealerListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const canCreate = can('masters.create') && !isDealer();

  const [search, setSearch] = useState('');
  const [dealers, setDealers] = useState<AppDealer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDealers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listDealers();
      setDealers(data);
    } catch (error) {
      console.error('[Dealers] Failed to load:', error);
      setDealers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDealers();
    }, [fetchDealers]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(
      (d) =>
        d.dealerName.toLowerCase().includes(q) ||
        d.dealerCode.toLowerCase().includes(q) ||
        d.mobile.includes(q) ||
        d.email.toLowerCase().includes(q),
    );
  }, [dealers, search]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <SafeHeader style={styles.header}>
        <Text style={styles.title}>Dealers</Text>
        {canCreate ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddDealer', { mode: 'add' })}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </SafeHeader>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search dealers"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          numColumns={isTablet ? 2 : 1}
          ListEmptyComponent={
            <Text style={styles.empty}>No dealers found</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, shadow.sm, isTablet && styles.cardTablet]}
              onPress={() => navigation.navigate('DealerDetails', { dealerId: item.id })}
            >
              <Text style={styles.name} numberOfLines={1}>
                {item.dealerName || 'Unnamed Dealer'}
              </Text>
              <Text style={styles.meta}>{item.dealerCode}</Text>
              <Text style={styles.meta}>{item.mobile || item.email || '—'}</Text>
              <Text style={styles.status}>{item.formStatus || 'draft'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTablet: { flex: 1, marginHorizontal: 6 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  status: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 48 },
});
