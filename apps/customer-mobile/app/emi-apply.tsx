import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebViewMessageEvent } from 'react-native-webview';
import PaymentWebView from '../components/feature/PaymentWebView';
import FaceVerificationModal from '../components/feature/FaceVerificationModal';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useKYC } from '../hooks/useKYC';
import { api } from '../lib/apiClient';
import { generateCheckoutHTML } from '../services/razorpayService';
import { getAddresses, addAddress } from '../services/addressService';
import { Address } from '../types';
import {
  getKycFeeStatus,
  createKycFeeOrder,
  createPaymentDevBypassSignature,
  verifyKycFeePayment,
} from '../services/kycPaymentService';

export default function EmiApplyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isKYCComplete, kycLoading } = useKYC();

  const params = useLocalSearchParams<{
    productId: string;
    productName: string;
    productImage: string;
    price: string;
    variantId: string;
    planMonths: string;
    downPaymentAmount: string;
    monthlyEmi: string;
  }>();

  const price = Number(params.price || 0);
  const downPayment = Number(params.downPaymentAmount || 0);
  const monthlyEmi = Number(params.monthlyEmi || 0);
  const months = Number(params.planMonths || 0);
  const processingFee = Math.max(0, Number((params as { processingFee?: string }).processingFee || 0));
  const totalPayable = price + processingFee;

  // Delivery address — always persisted to the address book so future
  // checkouts (and the approved order's delivery address) reuse it.
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [address, setAddress] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPincode, setAddressPincode] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [appNumber, setAppNumber] = useState('');
  // Face verification triggers on EVERY EMI application (whether KYC is done
  // or not) — confirms the person using the account still matches the Aadhaar.
  const [showFaceVerify, setShowFaceVerify] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  // Declaration consent — mirrors the web verification-summary.
  const [accepted, setAccepted] = useState(false);
  const [acceptedOneTimePayment, setAcceptedOneTimePayment] = useState(false);
  // One-time KYC verification fee (₹399) — charged before the application is
  // submitted, exactly like the web verification-summary flow.
  const [showKycFeeModal, setShowKycFeeModal] = useState(false);
  const [kycFeeOrder, setKycFeeOrder] = useState<{
    keyId: string;
    orderId: string;
    amount: number;
    amountPaise: number;
    currency: string;
    prefill: { name: string; email: string; contact: string };
  } | null>(null);

  React.useEffect(() => {
    if (user) {
      getAddresses(user.id)
        .then(addrs => {
          setSavedAddresses(addrs);
          const def = addrs.find(a => a.isDefault);
          if (def && !selectedAddress) setSelectedAddress(def);
        })
        .catch(() => {});
    }
  }, [user]);

  /** Save a freshly-typed address so it's there next time (like checkout). */
  const ensureAddress = async (): Promise<boolean> => {
    if (selectedAddress) return true;
    if (
      !address.trim() ||
      !addressCity.trim() ||
      !addressState.trim() ||
      !addressPincode.trim()
    ) {
      Alert.alert(
        'Address Required',
        'Enter your full delivery address (address, city, state and pincode) — it will be saved for next time.',
      );
      return false;
    }
    if (!user) return false;
    try {
      const created = await addAddress(user.id, {
        label: 'Home',
        fullAddress: address.trim(),
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
      Alert.alert('Address Error', e?.message || 'Unable to save your address. Please try again.');
      return false;
    }
  };

  const submitApplication = async () => {
    // Hard guard — never post the application without a successful face scan.
    if (!faceVerified) {
      throw new Error('Face verification is required before submitting an EMI application.');
    }
    const res = await api.post('/emi/applications', {
      productId: params.productId,
      productName: params.productName,
      sellingPrice: price,
      requestedAmount: Math.max(0, price - downPayment),
      requestedDownPayment: downPayment,
      requestedTenure: months,
      estimatedMonthlyEmi: monthlyEmi,
    });
    setAppNumber(res.data.applicationNumber ?? res.data.id);
    setSubmitted(true);
  };

  /** Submit is only interactive after face success + both declarations. */
  const canSubmit =
    faceVerified &&
    accepted &&
    acceptedOneTimePayment &&
    !submitting &&
    !kycLoading;

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in first.');
      return;
    }
    if (!(await ensureAddress())) return;
    if (kycLoading) return;
    if (!isKYCComplete) {
      Alert.alert(
        'KYC Required',
        'Please complete your identity verification (Aadhaar, PAN, CIBIL) before applying for EMI.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Now', onPress: () => router.push('/kyc-verification' as any) },
        ],
      );
      return;
    }
    // Face verification runs on EVERY EMI application — we don't assume the
    // KYC'd person is still the one using the account.
    if (!faceVerified) {
      Alert.alert(
        'Face Verification Required',
        'Please complete Face Verification before submitting your EMI application.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Now', onPress: () => setShowFaceVerify(true) },
        ],
      );
      return;
    }
    if (!accepted || !acceptedOneTimePayment) {
      Alert.alert(
        'Declaration Required',
        'Please accept the declaration and the one-time payment consent before submitting.',
      );
      return;
    }
    await doSubmit();
  };

  /** Face success only unlocks submit — does not auto-submit the application. */
  const handleFaceVerified = () => {
    setShowFaceVerify(false);
    setFaceVerified(true);
  };

  const doSubmit = async () => {
    if (!user) return;
    if (!faceVerified) {
      Alert.alert(
        'Face Verification Required',
        'Please complete Face Verification before submitting your EMI application.',
      );
      return;
    }
    if (!accepted || !acceptedOneTimePayment) {
      Alert.alert(
        'Declaration Required',
        'Please accept the declaration and the one-time payment consent before submitting.',
      );
      return;
    }
    setSubmitting(true);
    try {
      // Lifetime one-time KYC verification fee (₹399) — mirror of the web.
      const status = await getKycFeeStatus();
      if (!status.paid) {
        const order = await createKycFeeOrder();
        if (order.paymentDevBypass) {
          const signed = await createPaymentDevBypassSignature(order.razorpayOrderId);
          await verifyKycFeePayment({
            razorpayOrderId: signed.razorpayOrderId,
            razorpayPaymentId: signed.razorpayPaymentId,
            razorpaySignature: signed.razorpaySignature,
          });
          await submitApplication();
          return;
        }
        setKycFeeOrder({
          keyId: order.keyId,
          orderId: order.razorpayOrderId,
          amount: order.amount,
          amountPaise: order.amountPaise,
          currency: order.currency,
          prefill: order.prefill,
        });
        setShowKycFeeModal(true);
        setSubmitting(false);
        return; // resumes via handleKycFeeWebViewMessage
      }
      await submitApplication();
    } catch (err: any) {
      if (String(err?.message ?? '').includes('KYC_FEE_ALREADY_PAID')) {
        try {
          await submitApplication();
          return;
        } catch (e2: any) {
          Alert.alert('Error', e2?.message || 'Failed to submit application.');
        }
      } else {
        Alert.alert('Error', err?.message || 'Failed to submit application.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
        setSubmitting(true);
        await submitApplication();
      } catch (e: any) {
        Alert.alert('KYC Fee Error', e?.message || 'Fee paid but application submission failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    } else if (data.event === 'payment.cancelled' || data.event === 'payment.failed' || data.event === 'payment.error') {
      setShowKycFeeModal(false);
      setKycFeeOrder(null);
      Alert.alert('KYC Fee', 'The KYC verification fee was not paid. Your EMI application was not submitted.');
    }
  }, []);

  if (submitted) {
    return (
      <View style={[s.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
        <View style={s.successIcon}>
          <MaterialIcons name="check" size={48} color="#fff" />
        </View>
        <Text style={s.successTitle}>Application Submitted!</Text>
        <Text style={s.successSub}>
          Your EMI application has been submitted successfully. Our team will review it and get back to you within 24–48 hours.
        </Text>
        <View style={s.appNumBox}>
          <Text style={s.appNumLabel}>Application Number</Text>
          <Text style={s.appNum}>{appNumber}</Text>
        </View>

        <View style={s.stepList}>
          {[
            { icon: 'hourglass-empty', label: 'Admin reviews your application', done: false },
            { icon: 'check-circle', label: 'Get approval notification', done: false },
            { icon: 'account-balance', label: 'Pay down payment to confirm', done: false },
            { icon: 'receipt-long', label: 'Monthly EMIs start', done: false },
          ].map((step, i) => (
            <View key={i} style={s.step}>
              <View style={[s.stepIcon, { backgroundColor: Colors.primaryLight }]}>
                <MaterialIcons name={step.icon as any} size={18} color={Colors.primary} />
              </View>
              <Text style={s.stepLabel}>{step.label}</Text>
            </View>
          ))}
        </View>

        <Pressable style={s.doneBtn} onPress={() => router.push('/(tabs)/' as any)}>
          <Text style={s.doneBtnTxt}>Go to Home</Text>
        </Pressable>
        <Pressable style={{ marginTop: 12 }} onPress={() => router.push('/emis' as any)}>
          <Text style={{ color: Colors.primary, fontSize: Fonts.sm, fontWeight: Fonts.medium }}>
            View My Applications →
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Apply for EMI</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 100 }}>

        {/* Product Summary */}
        <View style={s.productCard}>
          {params.productImage ? (
            <Image source={{ uri: params.productImage }} style={s.productImg} contentFit="cover" />
          ) : (
            <View style={[s.productImg, { backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialIcons name="inventory-2" size={32} color={Colors.border} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.productName} numberOfLines={2}>{params.productName}</Text>
            <Text style={s.productPrice}>₹{price.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* EMI Summary */}
        <View style={s.planBox}>
          <Text style={s.planTitle}>Selected EMI Plan</Text>
          <View style={s.planRow}>
            <View style={s.planStat}>
              <Text style={s.planStatVal}>{months}</Text>
              <Text style={s.planStatLabel}>Months</Text>
            </View>
            <View style={s.planDivider} />
            <View style={s.planStat}>
              <Text style={s.planStatVal}>₹{downPayment.toLocaleString('en-IN')}</Text>
              <Text style={s.planStatLabel}>Down Payment</Text>
            </View>
            <View style={s.planDivider} />
            <View style={s.planStat}>
              <Text style={s.planStatVal}>₹{monthlyEmi.toLocaleString('en-IN')}</Text>
              <Text style={s.planStatLabel}>Monthly EMI</Text>
            </View>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total Payable</Text>
            <Text style={s.totalVal}>₹{totalPayable.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Application Flow Info */}
        <View style={s.infoBox}>
          <MaterialIcons name="info-outline" size={16} color={Colors.primary} />
          <Text style={s.infoText}>
            After submitting, admin will review your application. Once approved, you'll pay the down payment of{' '}
            <Text style={{ fontWeight: Fonts.bold }}>₹{downPayment.toLocaleString('en-IN')}</Text> to confirm your order.
            Then monthly EMIs of{' '}
            <Text style={{ fontWeight: Fonts.bold }}>₹{monthlyEmi.toLocaleString('en-IN')}</Text> start from next month.
          </Text>
        </View>

        {/* Delivery Address — saved + auto-persisted */}
        <View style={s.section}>
          <Text style={s.label}>Delivery Address <Text style={{ color: Colors.error }}>*</Text></Text>
          {savedAddresses.length > 0 && !showAddForm ? (
            <>
              {savedAddresses.map(a => (
                <Pressable
                  key={a.id}
                  style={[s.addrCard, selectedAddress?.id === a.id && s.addrCardOn]}
                  onPress={() => setSelectedAddress(a)}
                >
                  <MaterialIcons
                    name={selectedAddress?.id === a.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={18}
                    color={selectedAddress?.id === a.id ? Colors.primary : Colors.textTertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.addrCardText} numberOfLines={2}>
                      {a.fullAddress}, {a.city}, {a.state} - {a.pincode}
                    </Text>
                    {a.isDefault && <Text style={s.addrDefault}>Default</Text>}
                  </View>
                </Pressable>
              ))}
              <Pressable style={s.addLink} onPress={() => { setShowAddForm(true); setSelectedAddress(null); }}>
                <MaterialIcons name="add" size={16} color={Colors.primary} />
                <Text style={s.addLinkTxt}>Enter a new address</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={s.textarea}
                placeholder="House/Flat No., Street, Area"
                placeholderTextColor={Colors.textTertiary}
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={s.addrRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>City *</Text>
                  <TextInput style={s.input} value={addressCity} onChangeText={setAddressCity} placeholder="City" placeholderTextColor={Colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>State *</Text>
                  <TextInput style={s.input} value={addressState} onChangeText={setAddressState} placeholder="State" placeholderTextColor={Colors.textTertiary} />
                </View>
              </View>
              <Text style={s.subLabel}>Pincode *</Text>
              <TextInput
                style={s.input}
                value={addressPincode}
                onChangeText={t => setAddressPincode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit pincode"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Text style={s.saveHint}>This address will be saved for your next order.</Text>
              {savedAddresses.length > 0 && (
                <Pressable style={s.addLink} onPress={() => setShowAddForm(false)}>
                  <Text style={s.addLinkTxt}>Choose from saved addresses</Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Notes */}
        <View style={s.section}>
          <Text style={s.label}>Additional Notes (Optional)</Text>
          <TextInput
            style={s.textarea}
            placeholder="Any special instructions or questions..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Face Verification — required on every EMI application */}
        <View style={s.section}>
          <Text style={s.label}>Face Verification <Text style={{ color: Colors.error }}>*</Text></Text>
          <Pressable
            style={[s.faceRow, faceVerified && { backgroundColor: Colors.successLight, borderColor: Colors.success }]}
            onPress={() => { setFaceVerified(false); setShowFaceVerify(true); }}
          >
            <MaterialIcons name={faceVerified ? 'check-circle' : 'face-retouching-natural'} size={22} color={faceVerified ? Colors.success : Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.faceRowTitle}>{faceVerified ? 'Face Verified' : 'Verify your identity with a face scan'}</Text>
              <Text style={s.faceRowSub}>
                {faceVerified
                  ? 'Face match confirmed. You can submit once declarations are accepted.'
                  : 'Required for every EMI application — complete this before Submit becomes available. We match your face against the Aadhaar photo on your account.'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Declaration — mirrors the web verification-summary */}
        <View style={s.section}>
          <Text style={s.label}>Declaration</Text>
          <Pressable style={s.consentRow} onPress={() => setAccepted(!accepted)}>
            <MaterialIcons
              name={accepted ? 'check-box' : 'check-box-outline-blank'}
              size={22}
              color={accepted ? Colors.primary : Colors.textTertiary}
            />
            <Text style={s.consentTxt}>
              I confirm that all the information provided is accurate and I agree to the Terms & Conditions.
            </Text>
          </Pressable>
          <Pressable style={s.consentRow} onPress={() => setAcceptedOneTimePayment(!acceptedOneTimePayment)}>
            <MaterialIcons
              name={acceptedOneTimePayment ? 'check-box' : 'check-box-outline-blank'}
              size={22}
              color={acceptedOneTimePayment ? Colors.primary : Colors.textTertiary}
            />
            <Text style={s.consentTxt}>
              I understand and agree to pay the one-time payment (KYC / verification fee and any applicable down payment) required to process this EMI application.
            </Text>
          </Pressable>
        </View>

        {/* T&C */}
        <Text style={s.tnc}>
          By submitting, you agree that the admin may contact you for verification.
          EMI approval is subject to KYC and credit evaluation.
        </Text>
      </ScrollView>

      {/* Submit Button — disabled until face verified + declarations */}
      <View style={[s.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
        {!faceVerified ? (
          <Text style={s.submitHint}>Complete Face Verification above to enable submit.</Text>
        ) : (!accepted || !acceptedOneTimePayment) ? (
          <Text style={s.submitHint}>Accept both declarations above to enable submit.</Text>
        ) : null}
        <Pressable
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <>
              <MaterialIcons name="send" size={18} color="#fff" />
              <Text style={s.submitTxt}>Submit EMI Application</Text>
            </>
          }
        </Pressable>
      </View>

      {/* Face verification — required on EVERY EMI application */}
      <FaceVerificationModal
        visible={showFaceVerify}
        onClose={() => setShowFaceVerify(false)}
        onSuccess={handleFaceVerified}
      />

      {/* KYC verification fee WebView (one-time ₹399, mirrors the web) */}
      <Modal visible={showKycFeeModal && !!kycFeeOrder} animationType="slide" onRequestClose={() => setShowKycFeeModal(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <View style={[s.payHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Text style={s.payHeaderTitle}>KYC Verification Fee</Text>
            <Text style={s.payHeaderAmount}>
              {`₹${(kycFeeOrder?.amount ?? Math.round((kycFeeOrder?.amountPaise ?? 0) / 100)).toLocaleString('en-IN')}`}
            </Text>
            <Pressable style={s.iconBtn} onPress={() => { setShowKycFeeModal(false); setKycFeeOrder(null); }}>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  productCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadow.sm },
  productImg: { width: 72, height: 72, borderRadius: Radius.md },
  productName: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary, lineHeight: 20 },
  productPrice: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.primary, marginTop: 6 },
  planBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1.5, borderColor: Colors.primary + '40', ...Shadow.sm },
  planTitle: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  addrCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  addrCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  addrCardText: { fontSize: Fonts.sm, color: Colors.textPrimary, lineHeight: 19, flex: 1 },
  addrDefault: { fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.semiBold, marginTop: 2 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm, marginTop: 4 },
  addLinkTxt: { fontSize: Fonts.sm, color: Colors.primary, fontWeight: Fonts.medium },
  addrRow: { flexDirection: 'row', gap: Spacing.md },
  subLabel: { fontSize: Fonts.xs, color: Colors.textSecondary, marginBottom: 4, marginTop: 6 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Fonts.md, color: Colors.textPrimary },
  saveHint: { fontSize: Fonts.xs, color: Colors.success, marginTop: 6 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: Spacing.md },
  planStat: { alignItems: 'center', flex: 1 },
  planStatVal: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.primary },
  planStatLabel: { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 3 },
  planDivider: { width: 1, height: 36, backgroundColor: Colors.borderLight },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: Fonts.sm, color: Colors.textSecondary },
  totalVal: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  infoText: { flex: 1, fontSize: Fonts.sm, color: Colors.textSecondary, lineHeight: 19 },
  section: { marginBottom: Spacing.lg },
  label: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary, marginBottom: 8 },
  textarea: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Fonts.md, color: Colors.textPrimary, minHeight: 80 },
  tnc: { fontSize: Fonts.xs, color: Colors.textTertiary, lineHeight: 17, textAlign: 'center', marginBottom: Spacing.md },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: Colors.primary + '40', borderRadius: Radius.md, padding: Spacing.md },
  faceRowTitle: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  faceRowSub: { fontSize: Fonts.xs, color: Colors.textSecondary, marginTop: 3, lineHeight: 16 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm },
  consentTxt: { flex: 1, fontSize: Fonts.sm, color: Colors.textSecondary, lineHeight: 19 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, ...Shadow.lg as object },
  payHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.surface },
  payHeaderTitle: { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  payHeaderAmount: { fontSize: Fonts.xl, fontWeight: Fonts.extraBold, color: Colors.primary },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: 16, padding: 16 },
  submitBtnDisabled: { opacity: 0.45 },
  submitHint: { fontSize: Fonts.xs, color: Colors.textTertiary, textAlign: 'center', marginBottom: Spacing.sm, lineHeight: 16 },
  submitTxt: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: '#fff' },
  // Success state
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  successTitle: { fontSize: 24, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  successSub: { fontSize: Fonts.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  appNumBox: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl, width: '100%' },
  appNumLabel: { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: 4 },
  appNum: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.primary },
  stepList: { width: '100%', gap: Spacing.md, marginBottom: Spacing.xl },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepLabel: { fontSize: Fonts.sm, color: Colors.textSecondary, flex: 1 },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnTxt: { color: '#fff', fontSize: Fonts.lg, fontWeight: Fonts.bold },
});
