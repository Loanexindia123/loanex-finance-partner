import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';
import { getOrderById } from '../../services/orderService';
import { Order, OrderStatus } from '../../types';
import AutoEmiCard from '../../components/feature/AutoEmiCard';
import { isEmiPaymentMethod } from '../../utils/autopayUi';

// ─── Timeline Config ──────────────────────────────────────────────────────────
const STEPS = [
  { key: 'placed',           label: 'Order Placed',      sub: 'We have received your order',         icon: 'receipt-long' },
  { key: 'confirmed',        label: 'Order Confirmed',   sub: 'Seller confirmed & preparing',         icon: 'inventory-2' },
  { key: 'shipped',          label: 'Shipped',           sub: 'Package picked up by courier',         icon: 'local-shipping' },
  { key: 'out_for_delivery', label: 'Out for Delivery',  sub: 'Delivery agent is en route to you',    icon: 'delivery-dining' },
  { key: 'delivered',        label: 'Delivered',         sub: 'Package delivered successfully',       icon: 'home' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Order Placed', color: '#B45309',     bg: Colors.warningLight },
  confirmed: { label: 'Confirmed',    color: '#2563EB',     bg: '#EFF6FF' },
  shipped:   { label: 'Shipped',      color: '#7C3AED',     bg: '#F5F3FF' },
  delivered: { label: 'Delivered',    color: Colors.success, bg: Colors.successLight },
  cancelled: { label: 'Cancelled',    color: Colors.error,  bg: Colors.errorLight },
};

function completedSteps(status: OrderStatus): number {
  return ({ pending: 1, confirmed: 2, shipped: 3, delivered: 5, cancelled: 0 } as Record<string, number>)[status] ?? 1;
}

function stepDate(createdAt: string, idx: number): Date {
  const offsets = [0, 3, 36, 96, 120]; // hours after order creation
  return new Date(new Date(createdAt).getTime() + offsets[idx] * 3_600_000);
}

function getETA(order: Order): string {
  if (order.status === 'delivered') {
    return stepDate(order.createdAt, 4).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  if (order.status === 'cancelled') return 'Cancelled';
  const eta = new Date(new Date(order.createdAt).getTime() + 7 * 86_400_000);
  return eta.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Map Placeholder ──────────────────────────────────────────────────────────
function MapPlaceholder({ status }: { status: OrderStatus }) {
  const done = status === 'delivered';
  const moving = status === 'shipped';

  return (
    <View style={mp.wrap}>
      <View style={mp.map}>
        {/* Horizontal roads */}
        <View style={[mp.road, { top: '36%', left: 0, right: 0, height: 11 }]} />
        <View style={[mp.road, { top: '68%', left: 0, right: 0, height: 7 }]} />
        {/* Vertical roads */}
        <View style={[mp.road, { left: '22%', top: 0, bottom: 0, width: 9 }]} />
        <View style={[mp.road, { left: '58%', top: 0, bottom: 0, width: 9 }]} />
        {/* City blocks */}
        {([
          ['3%','3%','17%','30%'], ['3%','27%','28%','30%'], ['3%','63%','16%','30%'],
          ['43%','3%','17%','22%'],['43%','27%','28%','22%'],
          ['75%','3%','17%','22%'],['75%','63%','16%','22%'],
          ['43%','66%','31%','54%'],
        ] as [any,any,any,any][]).map(([t,l,w,h], i) => (
          <View key={i} style={[mp.block, { top: t, left: l, width: w, height: h }]} />
        ))}

        {/* Route line along the horizontal road */}
        <View style={mp.routeLine} />
        {/* Dashed segment effect */}
        <View style={mp.routeDash1} />
        <View style={mp.routeDash2} />

        {/* Source pin — Warehouse (left side) */}
        <View style={[mp.pin, mp.pinSrc]}>
          <MaterialIcons name="storefront" size={12} color="#fff" />
        </View>

        {/* Destination pin — Home (right side) */}
        <View style={[mp.pin, mp.pinDst, done && mp.pinDone]}>
          <MaterialIcons name={done ? 'check' : 'home'} size={12} color="#fff" />
        </View>

        {/* Moving truck for "shipped" */}
        {moving && (
          <View style={mp.truck}>
            <MaterialIcons name="local-shipping" size={15} color={Colors.primary} />
          </View>
        )}

        {/* Subtle green tint overlay when delivered */}
        {done && <View style={mp.doneOverlay} />}
      </View>

      {/* Info strip */}
      <View style={mp.strip}>
        <View style={[mp.stripIcon, { backgroundColor: done ? Colors.successLight : Colors.primaryLight }]}>
          <MaterialIcons
            name={done ? 'check-circle' : moving ? 'local-shipping' : 'inventory-2'}
            size={18}
            color={done ? Colors.success : Colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mp.stripTitle}>
            {done
              ? 'Package delivered to your address'
              : moving
              ? 'Your package is on the move'
              : status === 'confirmed'
              ? 'Being prepared for dispatch'
              : 'Order received at our facility'}
          </Text>
          <Text style={mp.stripSub}>
            {done ? 'Thank you for shopping with us!' : 'Live tracking coming soon'}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
      </View>
    </View>
  );
}

// ─── Timeline Component ────────────────────────────────────────────────────────
function Timeline({ order }: { order: Order }) {
  const done = completedSteps(order.status);

  if (order.status === 'cancelled') {
    return (
      <View style={tl.card}>
        <Text style={tl.title}>Order Status</Text>
        <View style={tl.cancelBox}>
          <View style={tl.cancelIconWrap}>
            <MaterialIcons name="cancel" size={32} color={Colors.error} />
          </View>
          <Text style={tl.cancelTxt}>Order Cancelled</Text>
          <Text style={tl.cancelSub}>
            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={tl.card}>
      <Text style={tl.title}>Order Timeline</Text>
      {STEPS.map((step, i) => {
        const isComplete = i < done;
        const isActive   = i === done - 1;
        const isLast     = i === STEPS.length - 1;
        const date       = isComplete ? stepDate(order.createdAt, i) : null;
        const connDone   = isComplete && i < done - 1;

        return (
          <View key={step.key} style={tl.row}>
            {/* Dot + connector column */}
            <View style={tl.left}>
              <View style={[tl.dot, isComplete && tl.dotDone, isActive && tl.dotActive]}>
                {isComplete
                  ? <MaterialIcons name={(isActive ? step.icon : 'check') as any} size={isActive ? 13 : 11} color="#fff" />
                  : <View style={tl.dotInner} />}
              </View>
              {!isLast && <View style={[tl.line, connDone && tl.lineDone]} />}
            </View>

            {/* Content */}
            <View style={[tl.content, isLast && { paddingBottom: 0 }]}>
              <Text style={[tl.stepLabel, !isComplete && tl.stepPending, isActive && tl.stepActive]}>
                {step.label}
              </Text>
              <Text style={[tl.stepSub, !isComplete && { color: Colors.border }]}>
                {isComplete ? step.sub : 'Awaiting...'}
              </Text>
              {date && (
                <View style={tl.datePill}>
                  <MaterialIcons name="access-time" size={10} color={Colors.textTertiary} />
                  <Text style={tl.dateTxt}>
                    {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getOrderById(id).then(o => {
        setOrder(o || null);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }}>
        <MaterialIcons name="receipt-long" size={64} color={Colors.border} />
        <Text style={{ fontSize: Fonts.lg, color: Colors.textSecondary }}>Order not found</Text>
        <Pressable onPress={() => router.back()} style={{ padding: Spacing.md }}>
          <Text style={{ color: Colors.primary, fontWeight: Fonts.semiBold }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const meta  = STATUS_META[order.status] || STATUS_META['pending'];
  const eta   = getETA(order);
  const isLive = !['delivered', 'cancelled'].includes(order.status);
  const isEmiOrder =
    order.paymentMethod === 'emi' || isEmiPaymentMethod(order.paymentMethod);

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <Pressable style={st.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Order Details</Text>
          <Text style={st.headerId}>{order.id}</Text>
        </View>
        <Pressable style={st.iconBtn}>
          <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}>

        {/* ── Status Hero ─────────────────────────────── */}
        <View style={[st.statusCard, { borderLeftColor: meta.color }]}>
          <View style={st.statusTop}>
            <View style={[st.statusBadge, { backgroundColor: meta.bg }]}>
              <View style={[st.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[st.statusLabel, { color: meta.color }]}>{meta.label}</Text>
            </View>
            {isLive && (
              <View style={st.liveTag}>
                <View style={st.livePulse} />
                <Text style={st.liveTxt}>TRACKING</Text>
              </View>
            )}
          </View>

          {order.status !== 'cancelled' && (
            <View style={st.etaBox}>
              <View style={[st.etaIconWrap, { backgroundColor: order.status === 'delivered' ? Colors.successLight : Colors.primaryLight }]}>
                <MaterialIcons
                  name={order.status === 'delivered' ? 'check-circle' : 'schedule'}
                  size={22}
                  color={order.status === 'delivered' ? Colors.success : Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.etaLabel}>
                  {order.status === 'delivered' ? 'Delivered on' : 'Estimated Delivery'}
                </Text>
                <Text style={[st.etaDate, { color: order.status === 'delivered' ? Colors.success : Colors.textPrimary }]}>
                  {eta}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Map Placeholder ────────────────────────── */}
        {order.status !== 'cancelled' && (
          <View style={st.sec}>
            <MapPlaceholder status={order.status} />
          </View>
        )}

        {/* ── Timeline ───────────────────────────────── */}
        <View style={st.sec}>
          <Timeline order={order} />
        </View>

        {/* ── Items ──────────────────────────────────── */}
        <View style={st.sec}>
          <View style={st.card}>
            <Text style={st.cardTitle}>Order Items ({order.items.length})</Text>
            {order.items.map((item, idx) => (
              <View key={item.productId} style={[st.itemRow, idx > 0 && st.itemBorder]}>
                <Image source={{ uri: item.image }} style={st.itemImg} contentFit="cover" transition={200} />
                <View style={{ flex: 1 }}>
                  <Text style={st.itemName} numberOfLines={2}>{item.productName}</Text>
                  <Text style={st.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={st.itemPrice}>{APP_CONFIG.currency}{(item.price * item.quantity).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Payment Summary ─────────────────────────── */}
        <View style={st.sec}>
          <View style={st.card}>
            <Text style={st.cardTitle}>Payment Summary</Text>
            <View style={st.summRow}>
              <Text style={st.summKey}>Subtotal</Text>
              <Text style={st.summVal}>{APP_CONFIG.currency}{order.subtotal.toLocaleString()}</Text>
            </View>
            <View style={st.summRow}>
              <Text style={st.summKey}>Delivery</Text>
              <Text style={[st.summVal, { color: Colors.success }]}>FREE</Text>
            </View>
            <View style={[st.summRow, { borderBottomWidth: 0, paddingTop: Spacing.md }]}>
              <Text style={[st.summKey, { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary }]}>Total Paid</Text>
              <Text style={{ fontSize: Fonts.xxl, fontWeight: Fonts.extraBold, color: Colors.textPrimary }}>
                {APP_CONFIG.currency}{order.total.toLocaleString()}
              </Text>
            </View>
            <View style={st.payTag}>
              <MaterialIcons
                name={order.paymentMethod === 'emi' ? 'account-balance' : 'money'}
                size={15}
                color={order.paymentMethod === 'emi' ? Colors.primary : Colors.success}
              />
              <Text style={st.payTagTxt}>
                {order.paymentMethod === 'emi'
                  ? `EMI · ${order.emiDetails?.months} months · ${APP_CONFIG.currency}${order.emiDetails?.monthlyAmount?.toLocaleString()}/month`
                  : order.paymentMethod === 'online'
                  ? 'Full Payment (Online)'
                  : 'Cash on Delivery'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Auto EMI (EMI orders only; Full Payment never loads Autopay) ── */}
        {isEmiOrder && (
          <View style={st.sec}>
            <AutoEmiCard
              enabled
              variant="manage"
              hideWhileLoading
              onManagePress={() => router.push('/autopay' as any)}
            />
          </View>
        )}

        {/* ── EMI Details ────────────────────────────── */}
        {order.paymentMethod === 'emi' && order.emiDetails && (
          <View style={st.sec}>
            <View style={st.card}>
              <Text style={st.cardTitle}>EMI Details</Text>
              <View style={st.emiStatusRow}>
                <View style={[st.emiDot, {
                  backgroundColor:
                    ['active','accepted','downpayment_paid','completed'].includes(order.emiDetails.emiStatus) ? Colors.success :
                    order.emiDetails.emiStatus === 'rejected' ? Colors.error :
                    Colors.warning,
                }]} />
                <Text style={st.emiStatusTxt}>
                  {order.emiDetails.emiStatus === 'active'  ? 'EMI Active' :
                   order.emiDetails.emiStatus === 'accepted'  ? 'Proposal Accepted' :
                   order.emiDetails.emiStatus === 'downpayment_paid'  ? 'Downpayment Paid' :
                   order.emiDetails.emiStatus === 'proposal_sent'  ? 'Proposal from Admin' :
                   order.emiDetails.emiStatus === 'rejected'  ? 'EMI Rejected' :
                   order.emiDetails.emiStatus === 'completed' ? 'Fully Paid' :
                   'Awaiting Approval'}
                </Text>
              </View>
              {(order.emiDetails.emiStatus === 'active' || order.emiDetails.emiStatus === 'completed') && (
                <>
                  <View style={st.progressBar}>
                    <View style={[st.progressFill, {
                      width: `${Math.round((order.emiDetails.paidInstallments / order.emiDetails.tenure) * 100)}%`
                    }]} />
                  </View>
                  <Text style={st.progressTxt}>
                    {order.emiDetails.paidInstallments}/{order.emiDetails.tenure} installments paid
                  </Text>
                </>
              )}
              <View style={st.emiGrid}>
                {[
                  { label: 'Monthly EMI',  val: `${APP_CONFIG.currency}${order.emiDetails.regularEMIAmount.toLocaleString()}`, hi: false },
                  { label: 'Down Payment', val: `${APP_CONFIG.currency}${order.emiDetails.downPaymentAmount.toLocaleString()}`, hi: false },
                  { label: 'Tenure', val: `${order.emiDetails.tenure} months`, hi: false },
                  ...(order.emiDetails.nextDueDate ? [{
                    label: 'Next Due',
                    val: new Date(order.emiDetails.nextDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                    hi: true,
                  }] : []),
                ].map(g => (
                  <View key={g.label} style={st.emiGridItem}>
                    <Text style={st.emiGridLabel}>{g.label}</Text>
                    <Text style={[st.emiGridVal, g.hi && { color: Colors.primary }]}>{g.val}</Text>
                  </View>
                ))}
              </View>
              {order.emiDetails.adminProposal && (
                <View style={{ marginTop: Spacing.md, backgroundColor: Colors.primaryLight, padding: Spacing.md, borderRadius: Radius.md }}>
                  <Text style={{ fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.primary, marginBottom: 4 }}>Admin Proposal Notes</Text>
                  <Text style={{ fontSize: Fonts.sm, color: Colors.textSecondary }}>{order.emiDetails.adminProposal.notes || 'No notes'}</Text>
                </View>
              )}

              {/* ── Payment History (paid EMIs, live from the loan ledger) ── */}
              {order.emiDetails.schedule.filter((s) => s.status === 'paid').length > 0 && (
                <View style={{ marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md }}>
                  <Text style={st.cardTitle}>Payment History</Text>
                  {order.emiDetails.schedule
                    .filter((s) => s.status === 'paid')
                    .map((row) => (
                      <View
                        key={`paid-${row.installmentNumber}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: Spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: Colors.borderLight,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: Fonts.sm, fontWeight: Fonts.bold, color: Colors.textPrimary }}>
                            EMI #{row.installmentNumber}
                          </Text>
                          <Text style={{ fontSize: Fonts.xs, color: Colors.textSecondary, marginTop: 2 }}>
                            Paid{' '}
                            {new Date(row.paidAt || row.dueDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                        <Text style={{ fontSize: Fonts.sm, fontWeight: Fonts.bold, color: Colors.success }}>
                          {APP_CONFIG.currency}{row.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                </View>
              )}

              {/* ── Upcoming Installments ────────────── */}
              {order.emiDetails.schedule.filter((s) => s.status !== 'paid').length > 0 && (
                <View style={{ marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md }}>
                  <Text style={st.cardTitle}>Upcoming Installments</Text>
                  {order.emiDetails.schedule
                    .filter((s) => s.status !== 'paid')
                    .map((row) => (
                      <View
                        key={row.installmentNumber}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: Spacing.sm,
                          borderBottomWidth: 1,
                          borderBottomColor: Colors.borderLight,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: Fonts.sm, fontWeight: Fonts.bold, color: Colors.textPrimary }}>
                            EMI #{row.installmentNumber}
                          </Text>
                          <Text style={{ fontSize: Fonts.xs, color: Colors.textSecondary, marginTop: 2 }}>
                            Due {row.dueDate
                              ? new Date(row.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}{' '}
                            ·{' '}
                            <Text style={{ color: row.status === 'overdue' ? Colors.error : Colors.textTertiary }}>
                              {row.status === 'overdue' ? 'Overdue' : 'Pending'}
                            </Text>
                          </Text>
                        </View>
                        <Text style={{ fontSize: Fonts.sm, fontWeight: Fonts.bold, color: Colors.textPrimary }}>
                          {APP_CONFIG.currency}{row.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Delivery Address ────────────────────────── */}
        <View style={st.sec}>
          <View style={st.card}>
            <Text style={st.cardTitle}>Delivery Address</Text>
            <View style={st.addressRow}>
              <View style={st.addressIconWrap}>
                <MaterialIcons name="location-on" size={18} color={Colors.primary} />
              </View>
              <Text style={st.addressTxt}>{order.address}</Text>
            </View>
            <Text style={st.phoneTxt}>📞 +91 {order.phone}</Text>
          </View>
        </View>

        {/* ── Order Info ──────────────────────────────── */}
        <View style={st.sec}>
          <View style={st.card}>
            <Text style={st.cardTitle}>Order Information</Text>
            {[
              { k: 'Order ID',   v: order.id },
              { k: 'Placed On',  v: new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
              { k: 'Contact',    v: `+91 ${order.phone}` },
            ].map(r => (
              <View key={r.k} style={st.infoRow}>
                <Text style={st.infoKey}>{r.k}</Text>
                <Text style={st.infoVal}>{r.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Help ────────────────────────────────────── */}
        {order.status !== 'cancelled' && (
          <Pressable style={[st.sec, st.helpBtn]}>
            <View style={st.helpIconWrap}>
              <MaterialIcons name="headset-mic" size={18} color={Colors.primary} />
            </View>
            <Text style={st.helpTxt}>Need help with this order?</Text>
            <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Main Styles ─────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  headerId:      { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 1 },

  statusCard:    { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, borderRadius: Radius.xl, padding: Spacing.xl, borderLeftWidth: 4, ...Shadow.sm },
  statusTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, gap: Spacing.xs },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusLabel:   { fontSize: Fonts.sm, fontWeight: Fonts.bold },
  liveTag:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.errorLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  livePulse:     { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.error },
  liveTxt:       { fontSize: 9, fontWeight: Fonts.bold, color: Colors.error, letterSpacing: 0.8 },
  etaBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  etaIconWrap:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  etaLabel:      { fontSize: Fonts.xs, color: Colors.textTertiary, fontWeight: Fonts.medium, marginBottom: 3 },
  etaDate:       { fontSize: Fonts.xl, fontWeight: Fonts.bold },

  sec:           { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  card:          { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.sm },
  cardTitle:     { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },

  itemRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  itemBorder:    { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  itemImg:       { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  itemName:      { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary, lineHeight: 18 },
  itemQty:       { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 3 },
  itemPrice:     { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },

  summRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  summKey:       { fontSize: Fonts.sm, color: Colors.textSecondary },
  summVal:       { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  payTag:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.md },
  payTagTxt:     { fontSize: Fonts.sm, color: Colors.textSecondary, fontWeight: Fonts.medium },

  emiStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  emiDot:        { width: 10, height: 10, borderRadius: 5 },
  emiStatusTxt:  { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  progressBar:   { height: 8, backgroundColor: Colors.borderLight, borderRadius: Radius.full, marginBottom: Spacing.sm, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressTxt:   { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: Spacing.lg },
  emiGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  emiGridItem:   { width: '47%', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md },
  emiGridLabel:  { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: 3 },
  emiGridVal:    { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },

  addressRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  addressIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  addressTxt:    { flex: 1, fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 22 },
  phoneTxt:      { fontSize: Fonts.sm, color: Colors.textTertiary, marginLeft: 42 },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoKey:       { fontSize: Fonts.sm, color: Colors.textTertiary },
  infoVal:       { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },

  helpBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, ...Shadow.sm },
  helpIconWrap:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  helpTxt:       { flex: 1, fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textPrimary },
});

// ─── Map Styles ───────────────────────────────────────────────────────────────
const mp = StyleSheet.create({
  wrap:       { borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.sm, backgroundColor: Colors.surface },
  map:        { height: 165, backgroundColor: '#E8EFE5', position: 'relative' },
  road:       { position: 'absolute', backgroundColor: '#fff' },
  block:      { position: 'absolute', backgroundColor: '#C9D8C5', borderRadius: 3 },
  routeLine:  { position: 'absolute', top: '41%', left: '12%', right: '20%', height: 3, backgroundColor: Colors.primary, opacity: 0.9 },
  routeDash1: { position: 'absolute', top: '34%', left: '22%', width: 2, height: 11, backgroundColor: Colors.primary, opacity: 0.7 },
  routeDash2: { position: 'absolute', top: '34%', left: '58%', width: 2, height: 11, backgroundColor: Colors.primary, opacity: 0.7 },
  pin:        { position: 'absolute', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  pinSrc:     { top: '14%', left: '8%',  backgroundColor: '#6B7280' },
  pinDst:     { top: '14%', right: '8%', backgroundColor: Colors.primary },
  pinDone:    { backgroundColor: Colors.success },
  truck:      { position: 'absolute', top: '28%', left: '44%', width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary, ...Shadow.sm },
  doneOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(45, 106, 79, 0.07)' },
  strip:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  stripIcon:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stripTitle: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  stripSub:   { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 2 },
});

// ─── Timeline Styles ──────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  card:        { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.sm },
  title:       { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  row:         { flexDirection: 'row', gap: Spacing.md },
  left:        { alignItems: 'center', width: 28 },
  dot:         { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotDone:     { backgroundColor: Colors.textTertiary },
  dotActive:   { backgroundColor: Colors.primary, ...Shadow.sm },
  dotInner:    { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  line:        { width: 2, flex: 1, backgroundColor: Colors.borderLight, marginVertical: 2 },
  lineDone:    { backgroundColor: Colors.success },
  content:     { flex: 1, paddingBottom: Spacing.xl },
  stepLabel:   { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  stepPending: { color: Colors.textTertiary, fontWeight: Fonts.regular },
  stepActive:  { color: Colors.primary, fontWeight: Fonts.bold },
  stepSub:     { fontSize: Fonts.xs, color: Colors.textSecondary, marginTop: 2 },
  datePill:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: Colors.surfaceAlt, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  dateTxt:     { fontSize: Fonts.xs, color: Colors.textTertiary, fontWeight: Fonts.medium },
  cancelBox:   { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  cancelIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  cancelTxt:   { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.error },
  cancelSub:   { fontSize: Fonts.sm, color: Colors.textSecondary },
});
