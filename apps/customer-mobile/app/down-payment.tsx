import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, Platform } from 'react-native';
import { WebViewMessageEvent } from 'react-native-webview';
import PaymentWebView from '../components/feature/PaymentWebView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { Colors, Fonts, Spacing, Radius } from '../constants/theme';
import { APP_CONFIG } from '../constants/config';
import { generateCheckoutHTML } from '../services/razorpayService';
import {
  getDownPaymentContext,
  createDownPaymentOrder,
  createDownPaymentDevBypassSignature,
  verifyDownPayment,
  DownPaymentContext,
  VerifyDownPaymentResponse,
} from '../services/downPaymentService';
import AutoEmiCard from '../components/feature/AutoEmiCard';

const showAlert = (title: string, msg: string, onOk?: () => void) => {
  if (Platform.OS === 'web') { window.alert(`${title}\n${msg}`); onOk?.(); }
};

const formatInr = (n: number | null | undefined) =>
  n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function DownPaymentScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [context, setContext] = useState<DownPaymentContext | null>(null);
  const [paying, setPaying] = useState(false);
  const [checkout, setCheckout] = useState<{
    keyId: string;
    orderId: string;
    amountPaise: number;
    currency: string;
    prefill: { name: string; email: string; contact: string };
  } | null>(null);
  const [success, setSuccess] = useState<
    (Partial<VerifyDownPaymentResponse> & { message?: string }) | null
  >(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getDownPaymentContext(applicationId)
      .then((ctx) => {
        setContext(ctx);
        if (ctx.orderId && ctx.status === 'DOWN_PAYMENT_COMPLETED') {
          setSuccess({
            message: 'Down payment already completed.',
            orderId: ctx.orderId,
            orderNumber: ctx.orderNumber ?? undefined,
          });
        }
      })
      .catch((e: any) => setError(e.message || 'Unable to load down-payment details.'))
      .finally(() => setLoading(false));
  }, [applicationId]);

  React.useEffect(() => { if (user) load(); }, [load, user]);

  async function payNow() {
    if (paying || !context?.canPay) return;
    setPaying(true);
    setError('');
    try {
      const order = await createDownPaymentOrder(context.applicationId);
      if (order.paymentDevBypass) {
        const signed = await createDownPaymentDevBypassSignature(order.razorpayOrderId);
        await doVerify({
          razorpayOrderId: signed.razorpayOrderId,
          razorpayPaymentId: signed.razorpayPaymentId,
          razorpaySignature: signed.razorpaySignature,
        });
      } else {
        setCheckout({
          keyId: order.keyId,
          orderId: order.razorpayOrderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          prefill: order.prefill,
        });
      }
    } catch (e: any) {
      setError(e.message || 'Unable to start down-payment.');
    } finally {
      setPaying(false);
    }
  }

  async function doVerify(payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    try {
      const result = await verifyDownPayment(payload);
      setCheckout(null);
      setSuccess(result);
    } catch (e: any) {
      setCheckout(null);
      setError(e.message || 'Down-payment verification failed.');
    }
  }

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    let data: any;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    switch (data.event) {
      case 'payment.success':
        await doVerify({
          razorpayOrderId: data.razorpay_order_id,
          razorpayPaymentId: data.razorpay_payment_id,
          razorpaySignature: data.razorpay_signature,
        });
        break;
      case 'payment.cancelled':
        setCheckout(null);
        setError('Payment was cancelled. Your application is still open — you can pay the down payment anytime.');
        break;
      case 'payment.failed':
      case 'payment.error':
        setCheckout(null);
        setError(data.error_description || data.message || 'Payment failed. Your application is still open.');
        break;
    }
  }, []);

  const checkoutHtml = checkout
    ? generateCheckoutHTML({
        key_id: checkout.keyId,
        order_id: checkout.orderId,
        amount: checkout.amountPaise,
        currency: checkout.currency,
        name: 'LoanEx',
        description: 'EMI Down Payment',
        prefill_email: checkout.prefill?.email ?? '',
        prefill_contact: checkout.prefill?.contact ?? '',
        theme_color: Colors.primary,
      })
    : '';

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.centerSub}>Loading down-payment details...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Pay Down Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>⚠️ {error}</Text>
            <Pressable style={styles.primaryBtn} onPress={() => { setError(''); load(); }}>
              <Text style={styles.primaryBtnTxt}>Try Again</Text>
            </Pressable>
          </View>
        ) : success ? (
          <>
            <View style={styles.card}>
              <MaterialIcons name="check-circle" size={56} color={Colors.success} style={{ alignSelf: 'center', marginBottom: Spacing.md }} />
              <Text style={styles.successTitle}>{success.message || 'Down payment successful!'}</Text>
              {success.orderNumber && (
                <Text style={styles.successSub}>Order: {success.orderNumber}</Text>
              )}
              {success.loanAccountNumber && (
                <Text style={styles.successSub}>Loan Account: {success.loanAccountNumber}</Text>
              )}
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  success.orderId
                    ? router.replace(`/order/${success.orderId}` as any)
                    : router.replace('/(tabs)/emis' as any)
                }
              >
                <Text style={styles.primaryBtnTxt}>View Order</Text>
              </Pressable>
            </View>
            {/* Down-payment screen is EMI-only; Full Payment never reaches here. */}
            <AutoEmiCard
              enabled
              variant="setup"
              onManagePress={() => router.push('/autopay' as any)}
            />
          </>
        ) : context ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Application</Text>
              <View style={styles.row}><Text style={styles.k}>Application No.</Text><Text style={styles.v}>{context.applicationNumber}</Text></View>
              <View style={styles.row}><Text style={styles.k}>Product</Text><Text style={styles.v}>{context.productName}</Text></View>
              <View style={styles.row}><Text style={styles.k}>Status</Text><Text style={styles.v}>{context.status}</Text></View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment Summary</Text>
              <View style={styles.row}><Text style={styles.k}>Product Price</Text><Text style={styles.v}>{formatInr(context.productPrice)}</Text></View>
              <View style={styles.row}><Text style={styles.k}>Down Payment</Text><Text style={styles.v}>{formatInr(context.paymentSummary.downPayment)}</Text></View>
              {context.paymentSummary.processingFee > 0 && (
                <View style={styles.row}><Text style={styles.k}>Processing Fee</Text><Text style={styles.v}>{formatInr(context.paymentSummary.processingFee)}</Text></View>
              )}
              {context.paymentSummary.gst > 0 && (
                <View style={styles.row}><Text style={styles.k}>GST</Text><Text style={styles.v}>{formatInr(context.paymentSummary.gst)}</Text></View>
              )}
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalK}>Payable Today</Text>
                <Text style={styles.totalV}>{formatInr(context.paymentSummary.totalPayableToday)}</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <MaterialIcons name="info-outline" size={16} color={Colors.primary} />
              <Text style={styles.infoText}>
                Pay the down payment to confirm your order. Your EMI schedule and loan account
                will be created right after — monthly EMIs become payable on their due dates.
              </Text>
            </View>

            <Pressable
              style={[styles.primaryBtn, (!context.canPay || paying) && { opacity: 0.5 }]}
              onPress={payNow}
              disabled={!context.canPay || paying}
            >
              {paying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnTxt}>
                  {context.canPay ? `Pay Now · ${formatInr(context.paymentSummary.totalPayableToday)}` : 'Not Payable'}
                </Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {checkout && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setCheckout(null)}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Secure Payment · {formatInr(context?.paymentSummary.totalPayableToday)}</Text>
              <Pressable onPress={() => setCheckout(null)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <PaymentWebView
              html={checkoutHtml}
              style={styles.webview}
              onMessage={handleWebViewMessage}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
              )}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, textAlign: 'center' },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  centerSub: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: Fonts.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight },
  cardTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  k: { color: Colors.textSecondary, fontSize: Fonts.md },
  v: { color: Colors.textPrimary, fontSize: Fonts.md, fontWeight: Fonts.medium, flex: 1, textAlign: 'right', marginLeft: 16 },
  totalRow: { borderBottomWidth: 0, paddingTop: Spacing.md },
  totalK: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  totalV: { fontSize: Fonts.lg, fontWeight: Fonts.extraBold, color: Colors.primary },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  infoText: { flex: 1, fontSize: Fonts.sm, color: Colors.textSecondary, lineHeight: 19 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.md, gap: Spacing.sm },
  primaryBtnTxt: { color: '#fff', fontWeight: Fonts.bold, fontSize: Fonts.md },
  errorTitle: { color: Colors.error, fontSize: Fonts.md, fontWeight: Fonts.semiBold, marginBottom: Spacing.md, textAlign: 'center' },
  successTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.success, textAlign: 'center', marginBottom: Spacing.sm },
  successSub: { color: Colors.textSecondary, fontSize: Fonts.sm, textAlign: 'center', marginBottom: 4 },
  modalWrap: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.surface },
  modalTitle: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  closeBtn: { padding: 4 },
  webview: { flex: 1 },
});
