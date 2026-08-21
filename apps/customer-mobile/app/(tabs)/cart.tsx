import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AppImage } from '../../components/ui/AppImage';
import { withMediaSize } from '../../utils/mediaUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../hooks/useCart';
import { Button } from '../../components/ui/Button';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { CartItem } from '../../types';

export default function CartScreen() {
  const { cartItems, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (cartItems.length === 0) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <MaterialIcons name="shopping-cart" size={80} color={Colors.border} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add products to start shopping</Text>
        <Button title="Browse Products" onPress={() => router.replace('/(tabs)')} style={{ marginTop: Spacing.xl }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cart</Text>
        <Text style={styles.itemCount}>{totalItems} items</Text>
      </View>
      <FlatList
        data={cartItems}
        keyExtractor={i => `${i.product.id}::${i.variantId ?? ''}`}
        contentContainerStyle={{ paddingBottom: 220 }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        renderItem={({ item }: { item: CartItem }) => {
          const unitPrice = item.variantPrice ?? item.product.price;
          const variantLabel =
            item.variantId && item.product.productVariants?.length
              ? item.product.productVariants.find((v: any) => v.id === item.variantId)
              : null;
          // Show only selectable attribute values (skip display-only extras like colorHex).
          const selectableKeys = new Set(
            (item.product.attributeGroups ?? []).map((g: any) => g.key)
          );
          const variantText = variantLabel?.attributes
            ? Object.entries(variantLabel.attributes)
                .filter(([k]) => selectableKeys.size === 0 ? !/hex/i.test(k) : selectableKeys.has(k))
                .map(([, v]) => v)
                .join(' · ')
            : variantLabel?.sku;
          return (
            <View style={styles.item}>
              <AppImage uri={withMediaSize(item.product.image, 'card')} style={styles.img} contentFit="cover" transition={200} />
              <View style={styles.info}>
                <Text style={styles.brand}>{item.product.brand}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.product.name}</Text>
                {variantText ? <Text style={styles.variant}>{variantText}</Text> : null}
                <Text style={styles.price}>{APP_CONFIG.currency}{(unitPrice * item.quantity).toLocaleString()}</Text>
                {item.product.emiAvailable && <Text style={styles.emiNote}>EMI from {APP_CONFIG.currency}{Math.ceil(unitPrice / 12).toLocaleString()}/mo</Text>}
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => removeItem(item.product.id, item.variantId)} style={styles.removeBtn}>
                  <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
                </Pressable>
                <View style={styles.qtyControl}>
                  <Pressable onPress={() => updateQuantity(item.product.id, item.variantId, item.quantity - 1)} style={styles.qtyBtn}>
                    <MaterialIcons name="remove" size={16} color={Colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Pressable onPress={() => updateQuantity(item.product.id, item.variantId, item.quantity + 1)} style={styles.qtyBtn}>
                    <MaterialIcons name="add" size={16} color={Colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
      <View style={[styles.summary, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.summaryRow}><Text style={styles.sumLabel}>Subtotal ({totalItems} items)</Text><Text style={styles.sumVal}>{APP_CONFIG.currency}{totalPrice.toLocaleString()}</Text></View>
        <View style={styles.summaryRow}><Text style={styles.sumLabel}>Delivery</Text><Text style={[styles.sumVal, { color: Colors.success }]}>FREE</Text></View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>{APP_CONFIG.currency}{totalPrice.toLocaleString()}</Text>
        </View>
        <Button title="Proceed to Checkout" onPress={() => router.push('/checkout')} fullWidth size="lg" style={{ borderRadius: Radius.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  emptyTitle: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, marginTop: Spacing.lg },
  emptySub: { fontSize: Fonts.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  title: { fontSize: Fonts.xxl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  itemCount: { fontSize: Fonts.md, color: Colors.textSecondary },
  item: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  img: { width: 88, height: 88, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  info: { flex: 1, gap: 3 },
  brand: { fontSize: Fonts.xs, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary, lineHeight: 18 },
  variant: { fontSize: Fonts.xs, color: Colors.primary, fontWeight: Fonts.medium },
  price: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  emiNote: { fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.medium },
  actions: { alignItems: 'flex-end', justifyContent: 'space-between' },
  removeBtn: { padding: Spacing.xs },
  qtyControl: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, overflow: 'hidden' },
  qtyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },
  qty: { width: 30, textAlign: 'center', fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  summary: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.sm, ...Shadow.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { fontSize: Fonts.md, color: Colors.textSecondary },
  sumVal: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  totalRow: { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: Spacing.sm },
  totalLabel: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  totalVal: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.primary },
});
