import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AppImage } from '../components/ui/AppImage';
import { withMediaSize } from '../utils/mediaUrl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useOrders } from '../hooks/useOrders';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../constants/theme';
import { APP_CONFIG } from '../constants/config';
import { Order } from '../types';

const STATUS_CONF: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Order Placed', color: '#B45309',      bg: Colors.warningLight,  icon: 'receipt-long' },
  confirmed: { label: 'Confirmed',    color: '#2563EB',      bg: '#EFF6FF',            icon: 'inventory-2' },
  shipped:   { label: 'Shipped',      color: '#7C3AED',      bg: '#F5F3FF',            icon: 'local-shipping' },
  delivered: { label: 'Delivered',    color: Colors.success, bg: Colors.successLight,  icon: 'check-circle' },
  cancelled: { label: 'Cancelled',    color: Colors.error,   bg: Colors.errorLight,    icon: 'cancel' },
};

// Progress bar (0-100%) mapped from status
const STATUS_PROGRESS: Record<string, number> = {
  pending: 10, confirmed: 35, shipped: 65, delivered: 100, cancelled: 0,
};

function OrderCard({ order }: { order: Order }) {
  const router = useRouter();
  const s = STATUS_CONF[order.status] || STATUS_CONF['pending'];
  const progress = STATUS_PROGRESS[order.status] ?? 10;
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // Estimated delivery
  const etaDate = order.status === 'delivered'
    ? null
    : order.status === 'cancelled'
    ? null
    : new Date(new Date(order.createdAt).getTime() + 7 * 86_400_000).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
      });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.96, transform: [{ scale: 0.995 }] }]}
      onPress={() => router.push(`/order/${order.id}` as any)}
    >
      {/* Top: order number + date + status badge */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{order.orderNumber || order.id}</Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
          <MaterialIcons name={s.icon as any} size={12} color={s.color} />
          <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
        </View>
      </View>

      {/* Progress bar */}
      {order.status !== 'cancelled' && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: s.color }]} />
          </View>
          {etaDate && (
            <Text style={styles.etaTxt}>Est. delivery: {etaDate}</Text>
          )}
        </View>
      )}

      {/* Items preview */}
      {order.items.slice(0, 2).map(item => (
        <View key={item.productId} style={styles.itemRow}>
          <AppImage uri={withMediaSize(item.image, 'card')} style={styles.itemImg} contentFit="cover" transition={200} />
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
            <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
          </View>
          <Text style={styles.itemPrice}>{APP_CONFIG.currency}{(item.price * item.quantity).toLocaleString()}</Text>
        </View>
      ))}
      {order.items.length > 2 && (
        <Text style={styles.moreItems}>+{order.items.length - 2} more item{order.items.length - 2 > 1 ? 's' : ''}</Text>
      )}

      {/* Footer: payment method + total + track chevron */}
      <View style={styles.cardFooter}>
        <View style={styles.payTag}>
          <MaterialIcons
            name={order.paymentMethod === 'emi' ? 'account-balance' : 'money'}
            size={13}
            color={order.paymentMethod === 'emi' ? Colors.primary : Colors.success}
          />
          <Text style={styles.payTagTxt}>
            {order.paymentMethod === 'emi'
              ? (order.emiDetails?.months ? `EMI · ${order.emiDetails.months}mo` : 'EMI')
              : order.paymentMethod === 'online'
              ? 'Full Payment (Online)'
              : 'Cash on Delivery'}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.total}>{APP_CONFIG.currency}{order.total.toLocaleString()}</Text>
          <View style={styles.trackBtn}>
            <Text style={styles.trackTxt}>Track</Text>
            <MaterialIcons name="chevron-right" size={14} color={Colors.primary} />
          </View>
        </View>
      </View>

      {/* EMI status banner */}
      {order.paymentMethod === 'emi' && order.emiDetails && (
        <View style={[styles.emiBanner, {
          backgroundColor:
            ['active', 'accepted', 'downpayment_paid', 'completed'].includes(order.emiDetails.emiStatus) ? Colors.successLight :
            order.emiDetails.emiStatus === 'rejected' ? Colors.errorLight : Colors.warningLight,
        }]}>
          <MaterialIcons
            name={['active', 'accepted', 'downpayment_paid', 'completed'].includes(order.emiDetails.emiStatus) ? 'check-circle' : order.emiDetails.emiStatus === 'rejected' ? 'cancel' : 'hourglass-empty'}
            size={13}
            color={['active', 'accepted', 'downpayment_paid', 'completed'].includes(order.emiDetails.emiStatus) ? Colors.success : order.emiDetails.emiStatus === 'rejected' ? Colors.error : '#B45309'}
          />
          <Text style={[styles.emiTxt, {
            color:
              ['active', 'accepted', 'downpayment_paid', 'completed'].includes(order.emiDetails.emiStatus) ? Colors.success :
              order.emiDetails.emiStatus === 'rejected' ? Colors.error : '#B45309',
          }]}>
            {order.emiDetails.emiStatus === 'active'
              ? `EMI Active · ${order.emiDetails.paidInstallments}/${order.emiDetails.tenure} paid`
              : order.emiDetails.emiStatus === 'accepted'
              ? 'Proposal Accepted — Pay Downpayment'
              : order.emiDetails.emiStatus === 'downpayment_paid'
              ? 'Downpayment Paid — Order Confirmed'
              : order.emiDetails.emiStatus === 'rejected'
              ? 'EMI Rejected — contact support'
              : order.emiDetails.emiStatus === 'completed'
              ? 'EMI Fully Paid'
              : order.emiDetails.emiStatus === 'proposal_sent'
              ? 'Proposal from Admin — Review in EMIs tab'
              : 'Awaiting EMI Approval'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function OrdersScreen() {
  const { user }      = useAuth();
  const { userOrders } = useOrders();
  const router        = useRouter();
  const insets        = useSafeAreaInsets();
  const orders        = userOrders;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary bar */}
      {orders.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryTxt}>
            {orders.length} order{orders.length !== 1 ? 's' : ''} · tap any card to track
          </Text>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="receipt-long" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySub}>Your orders will show up here once you place them</Text>
            <Pressable style={styles.shopBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.shopBtnTxt}>Start Shopping</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title:        { flex: 1, fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, textAlign: 'center' },
  summaryBar:   { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F5D0B0' },
  summaryTxt:   { fontSize: Fonts.xs, color: Colors.primary, fontWeight: Fonts.semiBold },

  list:         { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 100 },

  // Card
  card:         { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.xl, paddingBottom: Spacing.md },
  orderId:      { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  orderDate:    { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 3 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full },
  statusTxt:    { fontSize: Fonts.xs, fontWeight: Fonts.semiBold },

  // Progress
  progressWrap: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  progressBg:   { height: 4, backgroundColor: Colors.borderLight, borderRadius: Radius.full, overflow: 'hidden', marginBottom: 5 },
  progressFill: { height: '100%', borderRadius: Radius.full },
  etaTxt:       { fontSize: Fonts.xs, color: Colors.textTertiary },

  // Items
  itemRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, gap: Spacing.md },
  itemImg:      { width: 46, height: 46, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt },
  itemName:     { fontSize: Fonts.sm, fontWeight: Fonts.medium, color: Colors.textPrimary },
  itemMeta:     { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 2 },
  itemPrice:    { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  moreItems:    { fontSize: Fonts.xs, color: Colors.textTertiary, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },

  // Footer
  cardFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.xs },
  payTag:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  payTagTxt:    { fontSize: Fonts.xs, color: Colors.textSecondary, fontWeight: Fonts.medium },
  totalRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  total:        { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  trackBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full, gap: 2 },
  trackTxt:     { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.primary },

  // EMI banner
  emiBanner:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  emiTxt:       { fontSize: Fonts.xs, fontWeight: Fonts.medium },

  // Empty state
  empty:        { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyTitle:   { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  emptySub:     { fontSize: Fonts.md, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xxl },
  shopBtn:      { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.sm },
  shopBtnTxt:   { color: '#fff', fontSize: Fonts.md, fontWeight: Fonts.semiBold },
});
