import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { getCategories } from '../../services/categoryService';
import { Category } from '../../types';

/** Skip focus refetch when categories were loaded recently (pull-to-refresh always fetches). */
const CATEGORIES_FOCUS_TTL_MS = 60_000;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchedAt = useRef(0);

  const fetchCats = useCallback(async () => {
    try {
      const cats = await getCategories();
      setCategories(cats || []);
      lastFetchedAt.current = Date.now();
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const stale = Date.now() - lastFetchedAt.current > CATEGORIES_FOCUS_TTL_MS;
      if (categories.length === 0 || stale) {
        fetchCats();
      }
    }, [fetchCats, categories.length])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCats();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>Explore products by category</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: Spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const count = (item as any).productCount ?? (item as any).product_count ?? (item as any).itemCount ?? 0;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                onPress={() => router.push({ pathname: '/search', params: { category: item.name } })}
              >
                <View style={[styles.iconBox, { backgroundColor: item.bgColor || Colors.surfaceAlt }]}>
                  <MaterialIcons name={(item.icon as any) || 'category'} size={36} color={item.color || Colors.primary} />
                </View>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.count}>{count} {count === 1 ? 'product' : 'products'}</Text>
                <View style={[styles.arrowBtn, { backgroundColor: item.bgColor || Colors.surfaceAlt }]}>
                  <MaterialIcons name="arrow-forward" size={16} color={item.color || Colors.primary} />
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  title: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  subtitle: { fontSize: Fonts.xs, color: Colors.textSecondary, marginTop: 2 },
  grid: { padding: Spacing.lg, paddingBottom: 100 },
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, minHeight: 160, ...Shadow.sm, position: 'relative' },
  iconBox: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  name: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: 2 },
  count: { fontSize: Fonts.xs, color: Colors.textTertiary, fontWeight: Fonts.medium },
  arrowBtn: { position: 'absolute', bottom: Spacing.md, right: Spacing.md, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
