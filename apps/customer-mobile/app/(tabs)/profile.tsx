import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useKYC } from '../../hooks/useKYC';
import { updateProfile } from '../../services/authService';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';

const MENU = [
  { icon: 'receipt-long', label: 'My Orders', route: '/orders' },
  { icon: 'account-balance', label: 'My EMIs', route: '/(tabs)/emis' },
  { icon: 'favorite', label: 'My Wishlist', route: '/wishlist' },
  { icon: 'location-on', label: 'Delivery Addresses', route: '/addresses' },
  { icon: 'payment', label: 'Payment Methods', route: '/payment-methods' },
  { icon: 'notifications', label: 'Notifications', route: '/notifications' },
  { icon: 'help-outline', label: 'Help & Support', route: '/help' },
];

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const {
    kyc,
    kycLoading,
    isKYCComplete,
    aadhaarVerified,
    panVerified,
    bankVerified,
    faceVerified,
    refresh,
  } = useKYC();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      refresh();
    }, [refreshUser, refresh]),
  );
  const [kycModal, setKycModal] = useState(false);

  const maskAadhar = (aadhar: string) => {
    if (!aadhar || aadhar.length < 4) return 'XXXX XXXX XXXX';
    return `XXXX XXXX ${aadhar.slice(-4)}`;
  };

  const maskPan = (pan: string) => {
    if (!pan || pan.length < 4) return 'XXXXXXXXXX';
    return `${pan.slice(0, 2)}******${pan.slice(-2)}`;
  };

  const statusRows = [
    { label: 'Aadhaar Verification', verified: aadhaarVerified },
    { label: 'PAN Verification', verified: panVerified },
    { label: 'Bank Account Verification', verified: bankVerified },
    { label: 'Face Verification', verified: faceVerified },
  ];

  async function handleLogout() {
    await logout();
    router.replace('/auth/login');
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
        <MaterialIcons name="account-circle" size={80} color={Colors.border} />
        <Text style={{ fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, marginTop: Spacing.lg }}>Guest Profile</Text>
        <Text style={{ fontSize: Fonts.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl }}>
          Please login to view your orders, EMIs, and manage your account settings.
        </Text>
        <Pressable 
          style={{ backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: Radius.md }}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={{ color: '#fff', fontSize: Fonts.md, fontWeight: Fonts.bold }}>Login Now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}><Text style={styles.title}>Profile</Text></View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.userCard}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text></View>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{user?.name || 'User'}</Text>
            <Text style={styles.phone}>+91 {user?.phone}</Text>
            {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          </View>
          {kyc ? (
            <Pressable style={styles.editBtn} onPress={() => setKycModal(true)}>
              <MaterialIcons name="visibility" size={18} color={Colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {/* KYC Status Card */}
        <Pressable
          style={styles.kycCard}
          onPress={() => {
            if (!isKYCComplete) {
              router.push('/kyc-verification' as any);
            } else {
              setKycModal(true);
            }
          }}
        >
          {kycLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <View style={styles.kycTop}>
                {isKYCComplete ? (
                  <View style={styles.kycBadgeComplete}>
                    <MaterialIcons name="verified" size={16} color={Colors.success} />
                    <Text style={styles.kycBadgeTxt}>KYC Verified</Text>
                  </View>
                ) : (
                  <View style={styles.kycIncompleteHeader}>
                    <MaterialIcons name="verified-user" size={18} color={Colors.warning} />
                    <Text style={styles.kycIncompleteTitle}>KYC Not Completed</Text>
                  </View>
                )}
                {!isKYCComplete ? (
                  <MaterialIcons name="chevron-right" size={18} color={Colors.textTertiary} />
                ) : null}
              </View>

              <View style={styles.statusList}>
                {statusRows.map((row) => (
                  <View key={row.label} style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{row.label}</Text>
                    <View style={[styles.statusPill, row.verified ? styles.statusPillOk : styles.statusPillPending]}>
                      <MaterialIcons
                        name={row.verified ? 'check-circle' : 'schedule'}
                        size={14}
                        color={row.verified ? Colors.success : Colors.warning}
                      />
                      <Text style={[styles.statusPillTxt, { color: row.verified ? Colors.success : Colors.warning }]}>
                        {row.verified ? 'Verified' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {isKYCComplete && kyc ? (
                <View style={[styles.kycDetails, { marginTop: Spacing.md }]}>
                  <View style={styles.kycItem}>
                    <MaterialIcons name="trending-up" size={14} color={Colors.success} />
                    <Text style={styles.kycItemTxt}>CIBIL Score</Text>
                    <Text style={[styles.kycItemVal, { fontWeight: Fonts.bold, color: Colors.primary, fontSize: Fonts.md }]}>{kyc.cibilScore}</Text>
                  </View>
                </View>
              ) : !isKYCComplete ? (
                <Text style={styles.kycIncompleteSub}>Tap to continue identity verification</Text>
              ) : null}
            </>
          )}
        </Pressable>

        <View style={styles.menuCard}>
          {MENU.map((item, idx) => (
            <React.Fragment key={item.label}>
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: Colors.surfaceAlt }]}
                onPress={() => item.route && router.push(item.route as any)}
              >
                <View style={styles.menuIcon}><MaterialIcons name={item.icon as any} size={20} color={Colors.primary} /></View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textTertiary} />
              </Pressable>
              {idx < MENU.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutTxt}>Log Out</Text>
        </Pressable>
        <Text style={styles.version}>LoanEx v1.0.0 · Made with love in India</Text>
        <View style={{ height: Spacing.huge }} />
      </ScrollView>

        {/* KYC Info Modal */}
        <Modal visible={kycModal} transparent animationType="slide" onRequestClose={() => setKycModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
                <Text style={{ fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary }}>KYC Information</Text>
                <Pressable onPress={() => setKycModal(false)}><MaterialIcons name="close" size={24} color={Colors.textTertiary} /></Pressable>
              </View>
              
              {kyc ? (
                <View style={{ gap: Spacing.md }}>
                  <View>
                    <Text style={{ fontSize: Fonts.sm, color: Colors.textTertiary }}>Full Name</Text>
                    <Text style={{ fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium, marginTop: 4 }}>{kyc.fullName || user?.name}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: Fonts.sm, color: Colors.textTertiary }}>Aadhaar Number</Text>
                    <Text style={{ fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium, marginTop: 4 }}>{maskAadhar(kyc.aadharNumber)}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: Fonts.sm, color: Colors.textTertiary }}>PAN Card</Text>
                    <Text style={{ fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium, marginTop: 4 }}>{maskPan(kyc.panNumber)}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: Fonts.sm, color: Colors.textTertiary }}>CIBIL Score</Text>
                    <Text style={{ fontSize: Fonts.md, color: Colors.success, fontWeight: Fonts.bold, marginTop: 4 }}>{kyc.cibilScore}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: Fonts.sm, color: Colors.textTertiary }}>Date of Birth</Text>
                      <Text style={{ fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium, marginTop: 4 }}>{kyc.dob || 'N/A'}</Text>
                    </View>
                    <View style={{ paddingRight: Spacing.xl }}>
                      <Text style={{ fontSize: Fonts.sm, color: Colors.textTertiary }}>Gender</Text>
                      <Text style={{ fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium, marginTop: 4 }}>{kyc.gender || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={styles.modalStatusBlock}>
                    <Text style={styles.modalStatusTitle}>Verification Status</Text>
                    {statusRows.map((row) => (
                      <View key={row.label} style={styles.statusRow}>
                        <Text style={styles.statusLabel}>{row.label}</Text>
                        <View style={[styles.statusPill, row.verified ? styles.statusPillOk : styles.statusPillPending]}>
                          <MaterialIcons
                            name={row.verified ? 'check-circle' : 'schedule'}
                            size={14}
                            color={row.verified ? Colors.success : Colors.warning}
                          />
                          <Text style={[styles.statusPillTxt, { color: row.verified ? Colors.success : Colors.warning }]}>
                            {row.verified ? 'Verified' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>KYC information not available.</Text>
              )}
            </View>
          </View>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  title: { fontSize: Fonts.xxl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.lg, ...Shadow.sm },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: Fonts.xxl, fontWeight: Fonts.bold, color: '#fff' },
  userInfo: { flex: 1 },
  name: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: 3 },
  phone: { fontSize: Fonts.md, color: Colors.textSecondary },
  email: { fontSize: Fonts.sm, color: Colors.textTertiary, marginTop: 2 },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuCard: { backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, borderRadius: Radius.xl, marginBottom: Spacing.lg, ...Shadow.sm, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  menuIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.lg + 36 + Spacing.md },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.errorLight, marginHorizontal: Spacing.lg, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  logoutTxt: { fontSize: Fonts.md, fontWeight: Fonts.semiBold, color: Colors.error },
  version: { textAlign: 'center', fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: Spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  modalCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xxl, width: '100%', maxWidth: 340, ...Shadow.lg },
  modalTitle: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.lg },
  modalInput: { backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: Fonts.md, color: Colors.textPrimary, marginBottom: Spacing.lg },
  modalBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end' },
  modalCancel: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md },
  modalCancelTxt: { fontSize: Fonts.md, color: Colors.textSecondary, fontWeight: Fonts.medium },
  modalSave: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md },
  modalSaveTxt: { fontSize: Fonts.md, color: '#fff', fontWeight: Fonts.bold },

  // KYC Card
  kycCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, ...Shadow.sm },
  kycTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  kycBadgeComplete: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.successLight, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full },
  kycBadgeTxt: { fontSize: Fonts.xs, fontWeight: Fonts.semiBold, color: Colors.success },
  kycDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kycItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, minWidth: '45%' },
  kycItemTxt: { fontSize: Fonts.xs, color: Colors.textSecondary, flex: 1 },
  kycItemVal: { fontSize: Fonts.xs, color: Colors.textSecondary },
  kycIncomplete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  kycIncompleteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  kycIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.warningLight, alignItems: 'center', justifyContent: 'center' },
  kycIncompleteTitle: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary },
  kycIncompleteSub: { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: Spacing.sm },
  statusList: { gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  statusLabel: { fontSize: Fonts.sm, color: Colors.textPrimary, flex: 1, paddingRight: Spacing.sm },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusPillOk: { backgroundColor: Colors.successLight },
  statusPillPending: { backgroundColor: Colors.warningLight },
  statusPillTxt: { fontSize: Fonts.xs, fontWeight: Fonts.semiBold },
  modalStatusBlock: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight, gap: 8 },
  modalStatusTitle: { fontSize: Fonts.sm, fontWeight: Fonts.semiBold, color: Colors.textPrimary, marginBottom: 4 },
});
