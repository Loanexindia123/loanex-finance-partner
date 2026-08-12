import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { useOrders } from '../hooks/useOrders';
import { useKYC } from '../hooks/useKYC';
import { getAddresses, addAddress } from '../services/addressService';
import PaymentWebView from '../components/feature/PaymentWebView';
import FaceVerificationModal from '../components/feature/FaceVerificationModal';
import { createNotification } from '../services/notificationService';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../constants/theme';
import { APP_CONFIG } from '../constants/config';
import { calculateEMI, generateSchedule } from '../services/emiService';
import { EMICalcResult, Address } from '../types';
import { generateCheckoutHTML } from '../services/razorpayService';
import { getProductById } from '../services/productService';
import {
  createCheckoutSession,
  createCheckoutPaymentOrder,
  createCheckoutDevBypassSignature,
  verifyCheckoutPayment,
  getCodRules,
} from '../services/checkoutService';
import {
  getKycFeeStatus,
  createKycFeeOrder,
  createPaymentDevBypassSignature,
  verifyKycFeePayment,
} from '../services/kycPaymentService';

const showAlert = (title: string, msg: string, onOk?: () => void) => {
  if (Platform.OS === 'web') { window.alert(`${title}\n${msg}`); onOk?.(); }
  else Alert.alert(title, msg, onOk ? [{ text: 'OK', onPress: onOk }] : undefined);
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cartItems, reduceQuantities } = useCart();
  const { user } = useAuth();
  const { addOrder } = useOrders();
  const { isKYCComplete, kycLoading } = useKYC();

  useEffect(() => {
    if (!user) {
      router.replace({ pathname: '/auth/login', params: { returnTo: '/checkout' } });
    }
  }, [user]);

  const { buyNowId, tenure, variantId } = useLocalSearchParams<{ buyNowId?: string; tenure?: string; variantId?: string }>();
  const [buyNowProduct, setBuyNowProduct] = useState<any>(null);

  useEffect(() => {
    if (buyNowId) {
      getProductById(buyNowId).then(p => {
        if (p) setBuyNowProduct(p);
      });
    }
  }, [buyNowId]);

  const displayItems = useMemo(() => {
    if (buyNowId) {
      if (!buyNowProduct) return [];
      // Resolve the variant the customer picked on the product page so
      // inventory decrements hit the right variant stock.
      const variants =
        buyNowProduct.productVariants || buyNowProduct.product_variants || buyNowProduct.variants || [];
      const variant = variantId
        ? variants.find((v: any) => v.id === variantId)
        : null;
      return [{
        product: buyNowProduct,
        quantity: 1,
        selectedTenure: tenure ? parseInt(tenure, 10) : undefined,
        variantId: variant?.id,
        variantPrice: variant?.sellingPrice,
      }];
    }
    // Disable EMI for multiple items by stripping selectedTenure
    if (cartItems.length > 1) {
      return cartItems.map(item => ({ ...item, selectedTenure: undefined }));
    }
    return cartItems;
  }, [buyNowId, buyNowProduct, cartItems, tenure, variantId]);

  const [name, setName] = useState(user?.name && !user.name.startsWith('User') ? user.name : '');
  const [loading, setLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addressText, setAddressText] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPincode, setAddressPincode] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  // Payment method: 'cod' (Cash on Delivery) or 'razorpay' (Pay Online via Razorpay)
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod');
  // COD cap from the backend (env COD_MAX_AMOUNT) — same codRules as the web summary.
  const [codRules, setCodRules] = useState<{ maxAmount: number; codAllowed: boolean } | null>(null);
  // Real backend DIRECT session flow — session → payment order → verify.
  const [checkoutSession, setCheckoutSession] = useState<{
    sessionId: string;
    amount: number;
  } | null>(null);
  const [payingOnline, setPayingOnline] = useState(false);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [paymentCheckoutOrder, setPaymentCheckoutOrder] = useState<{
    keyId: string;
    orderId: string;
    amountPaise: number;
    currency: string;
    prefill: { name: string; email: string; contact: string };
  } | null>(null);
  // Face verification — required on every EMI application (whether KYC is
  // done or not), to confirm the account holder is still the KYC'd person.
  const [showFaceVerify, setShowFaceVerify] = useState(false);
  // KYC verification fee (₹299, one-time) — charged before EMI application,
  // exactly like the web verification-summary flow.
  const [showKycFeeModal, setShowKycFeeModal] = useState(false);
  const [kycFeeOrder, setKycFeeOrder] = useState<{
    keyId: string;
    orderId: string;
    amountPaise: number;
    currency: string;
    prefill: { name: string; email: string; contact: string };
  } | null>(null);
  const [kycFeePaying, setKycFeePaying] = useState(false);

  // Load saved addresses
  useFocusEffect(useCallback(() => {
    if (user) {
      getAddresses(user.id).then(addrs => {
        setSavedAddresses(addrs);
        const def = addrs.find(a => a.isDefault);
        if (def && !selectedAddress) {
          setSelectedAddress(def);
        }
      });
    }
  }, [user]));

  // Find EMI item
  const emiItem = displayItems.find(ci => ci.selectedTenure && ci.product.emiAvailable);
  const emiCalc = useMemo<EMICalcResult | null>(() => {
    if (!emiItem) return null;
    const p = emiItem.product;
    return calculateEMI({
      sellingPrice: emiItem.variantPrice ?? p.price, downPayment: p.downPayment, downPaymentType: p.downPaymentType,
      firstPaymentRule: p.firstPaymentRule, serviceCharge: p.serviceCharge,
      deliveryCharge: p.deliveryCharge, tenure: emiItem.selectedTenure!,
    });
  }, [emiItem]);

  const subtotal = displayItems.reduce((s, ci) => s + (ci.variantPrice ?? ci.product.price) * ci.quantity, 0);
  const isEMIOrder = !!emiCalc;
  const codRestricted = !!codRules && codRules.maxAmount > 0 && !codRules.codAllowed;

  // Fetch the backend's COD rules for the current cart total.
  useEffect(() => {
    if (isEMIOrder || subtotal <= 0) return;
    let cancelled = false;
    getCodRules(subtotal)
      .then(r => { if (!cancelled) setCodRules(r); })
      .catch(() => { if (!cancelled) setCodRules(null); });
    return () => { cancelled = true; };
  }, [subtotal, isEMIOrder]);

  // COD above the cap → force the Razorpay option.
  useEffect(() => {
    if (codRestricted && paymentMethod === 'cod') setPaymentMethod('razorpay');
  }, [codRestricted, paymentMethod]);

  const currentAddress = selectedAddress
    ? `${selectedAddress.fullAddress}, ${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}`
    : [
        addressText,
        addressCity,
        addressState ? `${addressState} - ${addressPincode}` : addressPincode,
      ]
        .map(part => part.trim())
        .filter(Boolean)
        .join(', ');

  // ─── Prepare order payload (shared between COD and Razorpay) ────────────
  function buildOrderPayload() {
    const items = displayItems.map(ci => ({
      productId: ci.product.id, productName: ci.product.name,
      image: ci.product.image, quantity: ci.quantity, price: ci.variantPrice ?? ci.product.price,
      variantId: ci.variantId ?? null,
    }));
    const schedule = emiCalc ? generateSchedule(emiCalc) : [];
    const firstDealer = emiItem?.product.dealers[0];
    const dealerSnapshot = firstDealer ? {
      dealerCode: firstDealer.dealerCode, dealerName: firstDealer.dealerName,
      dealerAddress: firstDealer.dealerAddress, dealerMobile: firstDealer.dealerMobile,
      purchasePrice: firstDealer.purchasePrice,
      grossMargin: emiItem!.product.price - firstDealer.purchasePrice,
    } : undefined;
    const emiDetails = emiCalc ? {
      tenure: emiCalc.tenure, firstPaymentRule: emiItem!.product.firstPaymentRule,
      downPaymentAmount: emiCalc.downPaymentAmount, serviceCharge: emiItem!.product.serviceCharge,
      deliveryCharge: emiItem!.product.deliveryCharge, totalPayable: emiCalc.totalPayable,
      balanceForEMI: emiCalc.balanceForEMI, regularEMIAmount: emiCalc.regularEMIAmount,
      finalEMIAmount: emiCalc.finalEMIAmount, months: emiCalc.tenure,
      monthlyAmount: emiCalc.regularEMIAmount, totalAmount: emiCalc.totalPayable,
      interestRate: 0, schedule, dealerId: firstDealer?.id, dealerSnapshot,
    } : undefined;
    const addressSnapshot = selectedAddress ? {
      label: selectedAddress.label, fullAddress: selectedAddress.fullAddress,
      city: selectedAddress.city, state: selectedAddress.state, pincode: selectedAddress.pincode,
    } : undefined;
    return {
      userId: user?.id ?? 'guest', items, subtotal,
      total: isEMIOrder ? emiCalc!.totalPayable : subtotal,
      paymentMethod: (isEMIOrder ? 'emi' : 'cod') as 'cod' | 'emi',
      address: currentAddress.trim(), phone: user?.phone ?? '',
      addressId: selectedAddress?.id, addressSnapshot, emiDetails,
    };
  }

  // ─── Submit the order to the real backend ───────────────────────────────
  // COD  → POST /checkout/place-order (paymentMethod 'COD')
  // EMI  → POST /checkout/place-order with emiApplication (admin approves later)
  // DIRECT is paid through the session flow first, then this only handles the
  // post-payment success UX — the order itself is created by verify.
  async function submitOrder(payload: {
    userId: string; items: any; subtotal: number; total: number;
    paymentMethod: 'cod' | 'emi'; address: string; phone: string;
    addressId?: string; addressSnapshot?: any; emiDetails?: any;
  }) {
    await addOrder(payload as any);
    // Take only the ordered quantities out of the cart — a partial order
    // (fewer units than the line holds) reduces the line instead of wiping it.
    if (!buyNowId) reduceQuantities(payload.items);

    // ── Fire activity-driven notification ──
    const itemNames = (payload.items || []).slice(0, 2).map((i: any) => i.productName).filter(Boolean).join(', ');
    if (isEMIOrder) {
      createNotification({
        userId: payload.userId,
        title: 'EMI Application Submitted',
        message: `Your EMI application for ${itemNames || 'your order'} is submitted. Awaiting admin review.`,
        type: 'emi',
        route: '/(tabs)/emis',
      });
    } else {
      createNotification({
        userId: payload.userId,
        title: 'Order Placed',
        message: `Order for ${itemNames || 'your items'} placed successfully. Payment via Cash on Delivery.`,
        type: 'order',
        route: '/orders',
      });
    }

    setLoading(false);
    showAlert('Order Placed!', isEMIOrder
      ? `EMI application submitted successfully! Please wait for admin review. You'll pay the downpayment of ₹${emiCalc!.downPaymentAmount.toLocaleString('en-IN')} after approval.`
      : 'Your order has been placed successfully! Payment will be collected on delivery.',
      () => router.replace('/(tabs)' as any)
    );
  }

  // ─── KYC guard ───────────────────────────────────────────────────────
  const requireKYC = () => {
    if (kycLoading) return false;
    if (!isKYCComplete) {
      Alert.alert(
        'Verification Required',
        'Please complete your KYC (identity verification) before placing an order. This includes name, address, Aadhar, PAN, and CIBIL check.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Now', onPress: () => router.push('/kyc-verification' as any) },
        ]
      );
      return false;
    }
    return true;
  };

  // ─── One-time KYC verification fee (₹299) — mirrors the web flow ────────
  const ensureKycFeePaid = async (): Promise<boolean> => {
    try {
      const status = await getKycFeeStatus();
      if (status.paid) return true;
      const order = await createKycFeeOrder();
      if (order.paymentDevBypass) {
        const signed = await createPaymentDevBypassSignature(order.razorpayOrderId);
        await verifyKycFeePayment({
          razorpayOrderId: signed.razorpayOrderId,
          razorpayPaymentId: signed.razorpayPaymentId,
          razorpaySignature: signed.razorpaySignature,
        });
        return true;
      }
      setKycFeeOrder({
        keyId: order.keyId,
        orderId: order.razorpayOrderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        prefill: order.prefill,
      });
      setShowKycFeeModal(true);
      return false; // async — completion resumes via handleKycFeeWebViewSuccess
    } catch (e: any) {
      if (String(e?.message ?? '').includes('KYC_FEE_ALREADY_PAID')) return true;
      showAlert('KYC Fee Error', e?.message || 'Unable to start KYC verification payment.');
      return false;
    }
  };

  // ─── Save a freshly-typed address so it's there next time ───────────────
  // The backend stores shipping addresses in the address book (used by the
  // session flow for DIRECT orders and by future checkouts).
  const ensureAddress = async (): Promise<boolean> => {
    // A saved address was picked → nothing to persist. A NEW address was
    // typed in the inline form (selectedAddress cleared) → save it first so
    // the order uses it and it's there for next time.
    if (selectedAddress) return true;
    if (!showAddForm && savedAddresses.length > 0) {
      showAlert('Address Required', 'Select a saved address or enter a new one.');
      return false;
    }
    if (
      !addressText.trim() ||
      !addressCity.trim() ||
      !addressState.trim() ||
      !addressPincode.trim()
    ) {
      showAlert(
        'Address Required',
        'Enter your full delivery address (address, city, state and pincode) — it will be saved for next time.',
      );
      return false;
    }
    if (!user) return false;
    setSavingAddress(true);
    try {
      const created = await addAddress(user.id, {
        label: 'Home',
        fullAddress: addressText.trim(),
        city: addressCity.trim(),
        state: addressState.trim(),
        pincode: addressPincode.trim(),
        isDefault: savedAddresses.length === 0,
      });
      setSelectedAddress(created);
      setSavedAddresses(prev =>
        prev.some(a => a.id === created.id) ? prev : [...prev, created],
      );
      return true;
    } catch (e: any) {
      showAlert('Address Error', e?.message || 'Unable to save your address. Please try again.');
      return false;
    } finally {
      setSavingAddress(false);
    }
  };

  // ─── Place Order (COD / EMI application) ────────────────────────────────
  const handlePlaceOrderCOD = async () => {
    if (displayItems.length === 0) { showAlert('Empty Cart', 'No items in cart.'); return; }
    if (codRestricted) {
      showAlert(
        'COD Unavailable',
        `Cash on Delivery is not available for orders above ₹${(codRules?.maxAmount ?? 0).toLocaleString('en-IN')}. Please pay online instead.`,
      );
      return;
    }
    if (!(await ensureAddress())) return;
    if (isEMIOrder && !requireKYC()) return;
    if (isEMIOrder) {
      // Face verification on EVERY EMI application — the modal resumes via
      // handleFaceVerified → completeEmiOrder.
      setShowFaceVerify(true);
      return;
    }
    await completeEmiOrder();
  };

  /** COD path for non-EMI orders, and the EMI continuation after face verify. */
  const completeEmiOrder = async () => {
    if (isEMIOrder) {
      setKycFeePaying(true);
      const feeOk = await ensureKycFeePaid();
      setKycFeePaying(false);
      if (!feeOk) return; // waiting on the KYC fee WebView
    }
    setLoading(true);
    try {
      const payload = buildOrderPayload();
      await submitOrder(payload);
    } catch (e: any) {
      setLoading(false);
      showAlert('Error', e.message || 'Failed to place order.');
    }
  };

  const handleFaceVerified = () => {
    setShowFaceVerify(false);
    void completeEmiOrder();
  };

  // ─── Place Order (Razorpay DIRECT — real backend session flow) ─────────
  const handlePlaceOrderOnline = async () => {
    if (displayItems.length === 0) { showAlert('Empty Cart', 'No items in cart.'); return; }
    if (!(await ensureAddress())) return;
    if (isEMIOrder && !requireKYC()) return;
    setPayingOnline(true);
    try {
      const payload = buildOrderPayload();
      // 1) Server-side checkout session (price + stock validated by backend)
      const session = await createCheckoutSession({
        items: payload.items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
          variantId: i.variantId ?? null,
        })),
        addressId: payload.addressId,
        addressSnapshot: payload.addressSnapshot,
        paymentMethod: 'DIRECT',
      });
      setCheckoutSession({ sessionId: session.sessionId, amount: session.amount });
      // 2) Backend-created Razorpay order
      const order = await createCheckoutPaymentOrder(session.sessionId);
      if (order.paymentDevBypass) {
        const signed = await createCheckoutDevBypassSignature(session.sessionId);
        await handleCheckoutPaymentVerified(
          session.sessionId,
          signed.razorpayOrderId,
          signed.razorpayPaymentId,
          signed.razorpaySignature,
        );
        return;
      }
      setPaymentCheckoutOrder({
        keyId: order.keyId,
        orderId: order.razorpayOrderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        prefill: order.prefill,
      });
      setShowPaymentWebView(true);
    } catch (e: any) {
      showAlert('Payment Error', e?.message || 'Unable to start payment.');
    } finally {
      setPayingOnline(false);
    }
  };

  // ─── DIRECT payment verified → order is complete server-side ────────────
  const handleCheckoutPaymentVerified = async (
    sessionId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) => {
    setLoading(true);
    try {
      const result = await verifyCheckoutPayment(sessionId, {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      setShowPaymentWebView(false);
      setPaymentCheckoutOrder(null);
      setCheckoutSession(null);
      // Same quantity-aware reduction as the backend's cart removeProducts.
      if (!buyNowId) {
        reduceQuantities(
          displayItems.map(ci => ({
            productId: ci.product.id,
            quantity: ci.quantity,
            variantId: ci.variantId ?? undefined,
          })),
        );
      }
      const itemNames = (displayItems || []).slice(0, 2).map((i: any) => i.product?.name || i.productName).filter(Boolean).join(', ');
      createNotification({
        userId: user?.id ?? '',
        title: 'Order Placed',
        message: `Order for ${itemNames || 'your items'} placed successfully. Payment received via Razorpay.`,
        type: 'payment',
        route: '/orders',
      });
      const orderId = result.orderId;
      showAlert(
        'Payment Successful!',
        `Your order ${result.orderNumber ? result.orderNumber + ' ' : ''}has been placed. Payment ID: ${result.paymentId ?? '—'}`,
        () => {
          if (orderId) router.replace(`/order/${orderId}` as any);
          else router.replace('/orders' as any);
        },
      );
    } catch (e: any) {
      setShowPaymentWebView(false);
      setPaymentCheckoutOrder(null);
      showAlert('Verification Failed', e?.message || 'Payment succeeded but verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // ─── DIRECT checkout WebView messages ───────────────────────────────────
  const handlePaymentWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    let data: any;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.event === 'payment.success') {
      const sessionId = checkoutSession?.sessionId;
      if (!sessionId) return;
      setShowPaymentWebView(false);
      await handleCheckoutPaymentVerified(
        sessionId,
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature,
      );
    } else if (data.event === 'payment.cancelled') {
      setShowPaymentWebView(false);
      setPaymentCheckoutOrder(null);
      showAlert('Payment Cancelled', 'Your items are still in your cart. You can try again when ready.');
    } else if (data.event === 'payment.failed' || data.event === 'payment.error') {
      setShowPaymentWebView(false);
      setPaymentCheckoutOrder(null);
      showAlert('Payment Failed', data.error_description || data.message || 'Payment could not be completed. Your items are still in your cart.');
    }
  }, [checkoutSession]);

  // ─── KYC fee WebView messages → resume EMI submission on success ────────
  const handleKycFeeWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    let data: any;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.event === 'payment.success') {
      setShowKycFeeModal(false);
      setKycFeeOrder(null);
      try {
        await verifyKycFeePayment({
          razorpayOrderId: data.razorpay_order_id,
          razorpayPaymentId: data.razorpay_payment_id,
          razorpaySignature: data.razorpay_signature,
        });
        setLoading(true);
        const payload = buildOrderPayload();
        await submitOrder(payload);
      } catch (e: any) {
        setLoading(false);
        showAlert('KYC Fee Error', e?.message || 'Fee paid but EMI application failed. Please try again.');
      }
    } else if (data.event === 'payment.cancelled' || data.event === 'payment.failed' || data.event === 'payment.error') {
      setShowKycFeeModal(false);
      setKycFeeOrder(null);
      showAlert('KYC Fee', 'The KYC verification fee was not paid. Your EMI application was not submitted.');
    }
  }, [buildOrderPayload]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (buyNowId && !buyNowProduct) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (displayItems.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, paddingTop: insets.top }}>
        <MaterialIcons name="shopping-cart" size={64} color={Colors.border} />
        <Text style={{ fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, marginTop: 16 }}>Cart is Empty</Text>
        <Pressable style={{ marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.xl }} onPress={() => router.replace('/(tabs)' as any)}>
          <Text style={{ color: '#fff', fontWeight: Fonts.bold }}>Browse Products</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* Order Items */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Order Items ({displayItems.length})</Text>
          {displayItems.map(ci => (
            <View key={ci.product.id} style={s.itemRow}>
              <Image source={{ uri: ci.product.image }} style={s.itemImg} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={s.itemName} numberOfLines={2}>{ci.product.name}</Text>
                <Text style={s.itemQty}>Qty: {ci.quantity}</Text>
                {ci.selectedTenure && <Text style={s.itemEMI}>{ci.selectedTenure}-month EMI plan selected</Text>}
                {ci.variantId && <Text style={s.itemQty}>Variant: {ci.variantId}</Text>}
              </View>
              <Text style={s.itemPrice}>₹{((ci.variantPrice ?? ci.product.price) * ci.quantity).toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>

        {/* EMI Plan Summary */}
        {isEMIOrder && emiCalc && emiItem && (
          <View style={s.card}>
            <Text style={s.cardTitle}>EMI Plan Summary</Text>
            <View style={s.emiPlanHeader}>
              <MaterialIcons name="account-balance" size={22} color={Colors.primary} />
              <Text style={s.emiPlanTitle}>{emiCalc.tenure}-Month EMI Plan</Text>
            </View>
            {[
              { label: 'Down Payment (After Approval)', value: `₹${emiCalc.downPaymentAmount.toLocaleString('en-IN')}`, bold: false, accent: false },
              ...(emiItem.product.serviceCharge > 0 ? [{ label: 'Service Charge', value: `₹${emiItem.product.serviceCharge.toLocaleString('en-IN')}`, bold: false, accent: false }] : []),
              ...(emiItem.product.deliveryCharge > 0 ? [{ label: 'Delivery Charge', value: `₹${emiItem.product.deliveryCharge.toLocaleString('en-IN')}`, bold: false, accent: false }] : []),
              { label: 'Balance for EMI', value: `₹${emiCalc.balanceForEMI.toLocaleString('en-IN')}`, bold: false, accent: true },
              { label: `Monthly EMI (${emiCalc.futureEMICount} installments)`, value: `₹${emiCalc.regularEMIAmount.toLocaleString('en-IN')}/mo`, bold: false, accent: false },
              ...(emiCalc.isRounded ? [{ label: 'Last EMI (adjusted)', value: `₹${emiCalc.finalEMIAmount.toLocaleString('en-IN')}`, bold: false, accent: false }] : []),
              { label: 'Total Payable (All Inclusive)', value: `₹${emiCalc.totalPayable.toLocaleString('en-IN')}`, bold: true, accent: false },
            ].map((r, i) => (
              <View key={i} style={s.summRow}>
                <Text style={[s.summKey, r.bold && s.summKeyBold]}>{r.label}</Text>
                <Text style={[s.summVal, r.accent && { color: Colors.primary, fontSize: Fonts.md }, r.bold && { fontSize: Fonts.xl, fontWeight: Fonts.bold }]}>{r.value}</Text>
              </View>
            ))}
            <View style={s.dueDateBox}>
              <MaterialIcons name="calendar-today" size={14} color={Colors.success} />
              <Text style={s.dueDateTxt}>
                First EMI due on {emiCalc.firstDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View style={s.noteBox}>
              <MaterialIcons name="info-outline" size={14} color={Colors.textTertiary} />
              <Text style={s.noteTxt}>EMI plan is subject to approval. You will be notified once approved.</Text>
            </View>
          </View>
        )}

        {/* Order Items Summary */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
            <Text style={s.cardTitle}>Order Summary</Text>
            <Pressable onPress={() => router.back()}><Text style={{ color: Colors.primary, fontWeight: Fonts.bold }}>Edit Cart</Text></Pressable>
          </View>
          {displayItems.map((item, idx) => (
            <View key={item.product.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: idx === displayItems.length - 1 ? 0 : Spacing.md }}>
              <Image source={{ uri: item.product.image }} style={{ width: 50, height: 50, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt }} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={{ fontSize: Fonts.sm, fontWeight: Fonts.medium, color: Colors.textPrimary }} numberOfLines={2}>{item.product.name}</Text>
                <Text style={{ fontSize: Fonts.xs, color: Colors.textTertiary }}>Qty: {item.quantity}</Text>
              </View>
              <Text style={{ fontSize: Fonts.sm, fontWeight: Fonts.bold }}>₹{((item.variantPrice ?? item.product.price) * item.quantity).toLocaleString('en-IN')}</Text>
            </View>
          ))}
        </View>

        {/* Payment & Order Totals (for non-EMI orders) */}
        {!isEMIOrder && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Payment Method</Text>

            {/* Payment method selector */}
            <Pressable
              style={[s.payOption, paymentMethod === 'cod' && s.payOptionSelected, codRestricted && s.payOptionDisabled]}
              onPress={() => { if (!codRestricted) setPaymentMethod('cod'); }}
            >
              <MaterialIcons
                name={paymentMethod === 'cod' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20} color={paymentMethod === 'cod' ? Colors.primary : Colors.textTertiary}
              />
              <View style={[s.payOptionIcon, { backgroundColor: Colors.successLight }]}>
                <MaterialIcons name="money" size={20} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.payOptionLabel}>Cash on Delivery</Text>
                <Text style={s.payOptionDesc}>Pay when your order arrives</Text>
              </View>
            </Pressable>

            <Pressable
              style={[s.payOption, paymentMethod === 'razorpay' && s.payOptionSelected]}
              onPress={() => setPaymentMethod('razorpay')}
            >
              <MaterialIcons
                name={paymentMethod === 'razorpay' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20} color={paymentMethod === 'razorpay' ? Colors.primary : Colors.textTertiary}
              />
              <View style={[s.payOptionIcon, { backgroundColor: Colors.primaryLight }]}>
                <MaterialIcons name="payment" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.payOptionLabel}>Pay Online (Razorpay)</Text>
                <Text style={s.payOptionDesc}>Credit/Debit Card · UPI · Net Banking · Wallet</Text>
              </View>
            </Pressable>

            {codRestricted && codRules && (
              <View style={s.codBanner}>
                <MaterialIcons name="error-outline" size={16} color={Colors.warning} />
                <Text style={s.codBannerTxt}>
                  Cash on Delivery is not available for orders above ₹{codRules.maxAmount.toLocaleString('en-IN')}.
                  Please use full payment or EMI instead.
                </Text>
              </View>
            )}

            {/* Order total */}
            <View style={[s.summRow, { marginTop: Spacing.md }]}>
              <Text style={s.summKey}>Subtotal</Text>
              <Text style={s.summVal}>₹{subtotal.toLocaleString('en-IN')}</Text>
            </View>
            <View style={s.summRow}>
              <Text style={s.summKey}>Delivery</Text>
              <Text style={[s.summVal, { color: Colors.success }]}>FREE</Text>
            </View>
            <View style={[s.summRow, { borderBottomWidth: 0, paddingTop: 8 }]}>
              <Text style={s.summKeyBold}>Total</Text>
              <Text style={[s.summVal, { fontSize: Fonts.xxl, fontWeight: Fonts.bold }]}>₹{subtotal.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        )}

        {/* Delivery Address */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Delivery Details</Text>
          <Text style={s.inputLabel}>Full Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={Colors.textTertiary} />

          <Text style={s.inputLabel}>Delivery Address *</Text>
          {savedAddresses.length > 0 ? (
            <>
              <Pressable style={s.addressPickerBtn} onPress={() => setShowAddressPicker(true)}>
                {selectedAddress ? (
                  <View style={{ flex: 1 }}>
                    <View style={s.addressLabelRow}>
                      <View style={s.labelBadge}><Text style={s.labelBadgeTxt}>{selectedAddress.label}</Text></View>
                      {selectedAddress.isDefault && <View style={s.defaultBadge}><Text style={s.defaultBadgeTxt}>Default</Text></View>}
                    </View>
                    <Text style={s.addressPickerText} numberOfLines={2}>
                      {selectedAddress.fullAddress}, {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.addressPickerText, { color: Colors.textTertiary }]}>Select a saved address</Text>
                )}
                <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
              </Pressable>
              <Pressable style={s.addAddrLink} onPress={() => { setSelectedAddress(null); setShowAddForm(true); }}>
                <MaterialIcons name="add" size={16} color={Colors.primary} />
                <Text style={s.addAddrLinkTxt}>Or enter a new address</Text>
              </Pressable>
            </>
          ) : null}

          {/* Show text input when no saved addresses or "add new" is toggled */}
          {(savedAddresses.length === 0 || showAddForm) && (
            <>
              <TextInput style={[s.input, s.inputMulti]} value={addressText} onChangeText={setAddressText}
                placeholder="House/Flat No., Street, Area" placeholderTextColor={Colors.textTertiary}
                multiline numberOfLines={3} textAlignVertical="top" />
              <View style={s.addrRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>City *</Text>
                  <TextInput style={s.input} value={addressCity} onChangeText={setAddressCity}
                    placeholder="City" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>State *</Text>
                  <TextInput style={s.input} value={addressState} onChangeText={setAddressState}
                    placeholder="State" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>
              <Text style={s.inputLabel}>Pincode *</Text>
              <TextInput style={s.input} value={addressPincode} onChangeText={t => setAddressPincode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit pincode" placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad" maxLength={6} />
              <Text style={s.saveHint}>
                <MaterialIcons name="check-circle" size={12} color={Colors.success} /> This address will be saved for your next order.
              </Text>
              {showAddForm && (
                <Pressable style={s.useExistingLink} onPress={() => setShowAddForm(false)}>
                  <Text style={s.addAddrLinkTxt}>Choose from saved addresses</Text>
                </Pressable>
              )}
            </>
          )}

          <Text style={s.inputLabel}>Mobile</Text>
          <View style={s.mobileRow}>
            <View style={s.mobilePrefix}><Text style={{ color: Colors.textSecondary, fontWeight: Fonts.medium }}>+91</Text></View>
            <Text style={s.mobileVal}>{user?.phone ?? '—'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar — action changes based on payment method */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.payToday}>
            {isEMIOrder ? 'Awaiting Approval' : `Total: ₹${subtotal.toLocaleString('en-IN')}`}
          </Text>
          <Text style={s.paySubtext}>
            {isEMIOrder
              ? `Admin reviews then you pay ₹${emiCalc!.downPaymentAmount.toLocaleString('en-IN')}`
              : paymentMethod === 'razorpay'
              ? 'Pay via Razorpay (Test Mode)'
              : 'Cash on Delivery'}
          </Text>
        </View>

        {isEMIOrder ? (
          <Pressable style={[s.placeBtn, (loading || savingAddress) && s.placeBtnDisabled]} onPress={handlePlaceOrderCOD} disabled={loading || savingAddress}>
            <MaterialIcons name="account-balance" size={18} color="#fff" />
            <Text style={s.placeBtnTxt}>{savingAddress ? 'Saving address...' : loading ? 'Placing...' : 'Buy on EMI'}</Text>
          </Pressable>
        ) : paymentMethod === 'razorpay' ? (
          <Pressable style={[s.placeBtn, (loading || payingOnline || savingAddress) && s.placeBtnDisabled]} onPress={handlePlaceOrderOnline} disabled={loading || payingOnline || savingAddress}>
            <MaterialIcons name="payment" size={18} color="#fff" />
            <Text style={s.placeBtnTxt}>{savingAddress ? 'Saving address...' : loading || payingOnline ? 'Starting payment...' : 'Pay with Razorpay'}</Text>
          </Pressable>
        ) : (
          <Pressable style={[s.placeBtn, (loading || savingAddress) && s.placeBtnDisabled]} onPress={handlePlaceOrderCOD} disabled={loading || savingAddress}>
            <MaterialIcons name="shopping-bag" size={18} color="#fff" />
            <Text style={s.placeBtnTxt}>{savingAddress ? 'Saving address...' : loading ? 'Placing...' : 'Place Order (COD)'}</Text>
          </Pressable>
        )}
      </View>

      {/* Address Picker Modal */}
      <Modal visible={showAddressPicker} animationType="slide" transparent onRequestClose={() => setShowAddressPicker(false)}>
        <View style={s.modalOverlay}>
          <Pressable style={s.modalDismiss} onPress={() => setShowAddressPicker(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Address</Text>
              <Pressable onPress={() => setShowAddressPicker(false)}>
                <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>
            <FlatList
              data={savedAddresses}
              keyExtractor={a => a.id}
              contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.addressCard, selectedAddress?.id === item.id && s.addressCardSelected]}
                  onPress={() => { setSelectedAddress(item); setShowAddressPicker(false); setShowAddForm(false); }}
                >
                  <View style={s.addressLabelRow}>
                    <View style={s.labelBadge}><Text style={s.labelBadgeTxt}>{item.label}</Text></View>
                    {item.isDefault && <View style={s.defaultBadge}><Text style={s.defaultBadgeTxt}>Default</Text></View>}
                  </View>
                  <Text style={s.addressCardText}>{item.fullAddress}, {item.city}, {item.state} - {item.pincode}</Text>
                </Pressable>
              )}
            />
            <Pressable style={s.newAddrBtn} onPress={() => { setShowAddressPicker(false); router.push('/add-address' as any); }}>
              <MaterialIcons name="add" size={18} color="#fff" />
              <Text style={s.newAddrBtnTxt}>Add New Address</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* DIRECT payment WebView — backend-created Razorpay order */}
      <Modal visible={showPaymentWebView && !!paymentCheckoutOrder} animationType="slide" onRequestClose={() => setShowPaymentWebView(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={[s.payHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Text style={s.payHeaderTitle}>Secure Payment</Text>
            <Text style={s.payHeaderAmount}>
              {APP_CONFIG.currency}{checkoutSession?.amount?.toLocaleString('en-IN') ?? subtotal.toLocaleString('en-IN')}
            </Text>
            <Pressable style={s.payHeaderClose} onPress={() => { setShowPaymentWebView(false); setPaymentCheckoutOrder(null); }}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </Pressable>
          </View>
          {paymentCheckoutOrder && (
            <PaymentWebView
              html={generateCheckoutHTML({
                key_id: paymentCheckoutOrder.keyId,
                order_id: paymentCheckoutOrder.orderId,
                amount: paymentCheckoutOrder.amountPaise,
                currency: paymentCheckoutOrder.currency,
                name: 'LoanEx',
                description: 'Full payment for your order',
                prefill_email: paymentCheckoutOrder.prefill?.email ?? '',
                prefill_contact: paymentCheckoutOrder.prefill?.contact ?? '',
                theme_color: Colors.primary,
              })}
              style={{ flex: 1 }}
              onMessage={handlePaymentWebViewMessage}
            />
          )}
        </View>
      </Modal>

      {/* Face verification — required on every EMI application */}
      <FaceVerificationModal
        visible={showFaceVerify}
        onClose={() => setShowFaceVerify(false)}
        onSuccess={handleFaceVerified}
      />

      {/* KYC verification fee WebView (EMI application) */}
      <Modal visible={showKycFeeModal && !!kycFeeOrder} animationType="slide" onRequestClose={() => setShowKycFeeModal(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={[s.payHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Text style={s.payHeaderTitle}>KYC Verification Fee</Text>
            <Text style={s.payHeaderAmount}>{APP_CONFIG.currency}399</Text>
            <Pressable style={s.payHeaderClose} onPress={() => { setShowKycFeeModal(false); setKycFeeOrder(null); }}>
              <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
            </Pressable>
          </View>
          {kycFeeOrder && (
            <PaymentWebView
              html={generateCheckoutHTML({
                key_id: kycFeeOrder.keyId,
                order_id: kycFeeOrder.orderId,
                amount: kycFeeOrder.amountPaise,
                currency: kycFeeOrder.currency,
                name: 'LoanEx',
                description: 'KYC Verification Fee (one-time)',
                prefill_email: kycFeeOrder.prefill?.email ?? '',
                prefill_contact: kycFeeOrder.prefill?.contact ?? '',
                theme_color: Colors.primary,
              })}
              style={{ flex: 1 }}
              onMessage={handleKycFeeWebViewMessage}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  card: { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: Radius.xl, padding: Spacing.xl, ...Shadow.sm as object },
  cardTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  itemImg: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt },
  itemName: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  itemQty: { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 2 },
  itemEMI: { fontSize: Fonts.xs, color: Colors.primary, fontWeight: Fonts.medium, marginTop: 2 },
  itemPrice: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  emiPlanHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primaryLight, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  emiPlanTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.primary },
  summRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  summKey: { fontSize: Fonts.sm, color: Colors.textSecondary, flex: 1 },
  summKeyBold: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  summVal: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  dueDateBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, backgroundColor: Colors.successLight, padding: Spacing.md, borderRadius: Radius.md },
  dueDateTxt: { fontSize: Fonts.sm, color: Colors.success, fontWeight: Fonts.medium, flex: 1 },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: Colors.surfaceAlt, padding: Spacing.md, borderRadius: Radius.md },
  noteTxt: { fontSize: Fonts.xs, color: Colors.textTertiary, flex: 1, lineHeight: 17 },
  payMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, backgroundColor: Colors.successLight, padding: Spacing.md, borderRadius: Radius.md },
  payMethodTxt: { fontSize: Fonts.md, color: Colors.success, fontWeight: Fonts.medium },
  inputLabel: { fontSize: Fonts.sm, fontWeight: Fonts.medium, color: Colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Fonts.md, color: Colors.textPrimary },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  mobileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md },
  mobilePrefix: { paddingRight: 8, borderRightWidth: 1, borderRightColor: Colors.border },
  mobileVal: { fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, ...Shadow.lg as object },
  payToday: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  paySubtext: { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 2 },
  placeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderRadius: Radius.xl },
  placeBtnDisabled: { opacity: 0.6 },
  placeBtnTxt: { color: '#fff', fontSize: Fonts.md, fontWeight: Fonts.bold },

  // Address picker
  addressPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, minHeight: 60 },
  addressPickerText: { flex: 1, fontSize: Fonts.md, color: Colors.textPrimary, lineHeight: 20 },
  addressLabelRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: 4 },
  labelBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  labelBadgeTxt: { fontSize: Fonts.xs, fontWeight: Fonts.semiBold, color: Colors.primary },
  defaultBadge: { backgroundColor: Colors.successLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  defaultBadgeTxt: { fontSize: Fonts.xs, fontWeight: Fonts.semiBold, color: Colors.success },
  addAddrLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm, marginTop: 4 },
  addAddrLinkTxt: { fontSize: Fonts.sm, color: Colors.primary, fontWeight: Fonts.medium },
  useExistingLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm },

  // Address picker modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, maxHeight: '80%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetTitle: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  addressCard: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 2, borderColor: Colors.borderLight },
  addressCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  addressCardText: { fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  newAddrBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: Radius.xl },
  newAddrBtnTxt: { color: '#fff', fontSize: Fonts.md, fontWeight: Fonts.bold },

  addrRow: { flexDirection: 'row', gap: Spacing.md },
  saveHint: { flexDirection: 'row', alignItems: 'center', gap: 4, fontSize: Fonts.xs, color: Colors.success, marginTop: 6 },

  // Payment method selector
  payOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 2, borderColor: Colors.borderLight },
  payOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  payOptionDisabled: { opacity: 0.45 },
  payOptionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  payOptionLabel: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  payOptionDesc: { fontSize: Fonts.sm, color: Colors.textSecondary, marginTop: 2 },
  codBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.warningLight, borderWidth: 1, borderColor: Colors.warning, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  codBannerTxt: { flex: 1, fontSize: Fonts.sm, color: '#92400E', lineHeight: 18 },

  // Secure payment / KYC fee WebView headers
  payHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.surface },
  payHeaderTitle: { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  payHeaderAmount: { fontSize: Fonts.xl, fontWeight: Fonts.extraBold, color: Colors.primary },
  payHeaderClose: { marginLeft: Spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
});
