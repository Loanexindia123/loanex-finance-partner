import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { Product } from '../../types';
import { APP_CONFIG } from '../../constants/config';
import { AppImage } from '../ui/AppImage';
import { withMediaSize } from '../../utils/mediaUrl';

export const ProductCard = memo(({ product, horizontal }: { product: Product; horizontal?: boolean }) => {
  const router = useRouter();
  const disc = Math.round((1 - product.price / product.originalPrice) * 100);
  const imageUri = withMediaSize(product.image, 'card');
  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.card, horizontal ? styles.cardH : styles.cardV, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      <View style={horizontal ? styles.imgH : styles.imgV}>
        <AppImage uri={imageUri} style={styles.img} contentFit="cover" transition={200} />
        {disc > 0 && <View style={styles.discBadge}><Text style={styles.discText}>{disc}% OFF</Text></View>}
        {product.emiAvailable && <View style={styles.emiBadge}><Text style={styles.emiText}>EMI</Text></View>}
      </View>
      <View style={[styles.info, horizontal && styles.infoH]}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.star}>★ {product.rating}</Text>
          <Text style={styles.reviews}>({product.reviews.toLocaleString()})</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{APP_CONFIG.currency}{product.price.toLocaleString()}</Text>
          <Text style={styles.origPrice}>{APP_CONFIG.currency}{product.originalPrice.toLocaleString()}</Text>
        </View>
        {product.emiAvailable && (
          <Text style={styles.emiInfo}>EMI from {APP_CONFIG.currency}{Math.ceil(product.price / 12).toLocaleString()}/mo</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.sm },
  cardV: { width: 175, margin: Spacing.xs },
  cardH: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginVertical: Spacing.xs },
  imgV: { height: 170, backgroundColor: Colors.surfaceAlt },
  imgH: { width: 95, height: 95, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, overflow: 'hidden', flexShrink: 0 },
  img: { width: '100%', height: '100%' },
  discBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: Colors.error, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  discText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emiBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: Colors.success, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  emiText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  info: { padding: Spacing.md },
  infoH: { flex: 1 },
  brand: { fontSize: Fonts.xs, color: Colors.textTertiary, fontWeight: Fonts.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary, lineHeight: 17, marginVertical: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  star: { fontSize: Fonts.xs, color: Colors.star, fontWeight: Fonts.semiBold },
  reviews: { fontSize: Fonts.xs, color: Colors.textTertiary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  price: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  origPrice: { fontSize: Fonts.xs, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  emiInfo: { fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.medium, marginTop: 2 },
});
