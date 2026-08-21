import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AppImage } from '../components/ui/AppImage';
import { withMediaSize } from '../utils/mediaUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { getWishlist, removeFromWishlist } from '../services/wishlistService';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../constants/theme';
import { WishlistItem } from '../types';

export default function WishlistScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getWishlist(user.id);
    setItems(data);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRemove(productId: string) {
    if (!user) return;
    await removeFromWishlist(user.id, productId);
    setItems(prev => prev.filter(i => i.productId !== productId));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>My Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="favorite-border" size={72} color={Colors.border} />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySub}>Save items you love to buy later</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.shopBtnTxt}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              onPress={() => router.push(`/product/${item.productId}`)}
            >
              <AppImage uri={withMediaSize(item.product?.image, 'card')} style={styles.img} contentFit="cover" />
              <View style={styles.info}>
                <Text style={styles.brand}>{item.product?.brand}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.product?.name}</Text>
                <Text style={styles.price}>₹{item.product?.price?.toLocaleString('en-IN')}</Text>
                {item.product?.emiAvailable && (
                  <Text style={styles.emiTag}>EMI Available</Text>
                )}
              </View>
              <Pressable style={styles.removeBtn} onPress={() => handleRemove(item.productId)}>
                <MaterialIcons name="close" size={18} color={Colors.error} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  emptySub: { fontSize: Fonts.md, color: Colors.textSecondary },
  shopBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.full, marginTop: Spacing.md },
  shopBtnTxt: { color: '#fff', fontWeight: Fonts.bold, fontSize: Fonts.md },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
  item: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  img: { width: 80, height: 80, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  info: { flex: 1, gap: 2 },
  brand: { fontSize: Fonts.xs, color: Colors.textTertiary, textTransform: 'uppercase' },
  name: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  price: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary, marginTop: 2 },
  emiTag: { fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.medium, marginTop: 2 },
  removeBtn: { padding: Spacing.xs },
});
