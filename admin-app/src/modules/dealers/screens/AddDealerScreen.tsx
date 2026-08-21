import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { createDealer, updateDealer, getDealerById } from '../../../services/dealerService';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddDealer'>;

export function AddDealerScreen({ navigation, route }: Props) {
  const isEdit = route.params?.mode === 'edit';
  const dealerId = route.params?.dealerId;

  const [dealerCode, setDealerCode] = useState('');
  const [dealerName, setDealerName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(isEdit && dealerId));

  React.useEffect(() => {
    if (!isEdit || !dealerId) return;
    getDealerById(dealerId)
      .then((d) => {
        setDealerCode(d.dealerCode);
        setDealerName(d.dealerName);
        setOwnerName(d.ownerName);
        setMobile(d.mobile);
        setEmail(d.email);
      })
      .catch(() => Alert.alert('Error', 'Failed to load dealer'))
      .finally(() => setLoading(false));
  }, [isEdit, dealerId]);

  const save = async (formStatus: 'draft' | 'pending') => {
    if (!dealerCode.trim() || !dealerName.trim()) {
      Alert.alert('Required', 'Dealer Code and Dealer Name are required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        dealerCode: dealerCode.trim(),
        dealerName: dealerName.trim(),
        ownerName: ownerName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        shopAddress: shopAddress.trim(),
        pincode: pincode.trim(),
        formStatus,
      };
      if (isEdit && dealerId) {
        await updateDealer(dealerId, payload);
      } else {
        await createDealer(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not save dealer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{isEdit ? 'Edit Dealer' : 'Add Dealer'}</Text>
        </View>
        {loading ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Input label="Dealer Code *" value={dealerCode} onChangeText={setDealerCode} />
            <Input label="Dealer Name *" value={dealerName} onChangeText={setDealerName} />
            <Input label="Owner Name" value={ownerName} onChangeText={setOwnerName} />
            <Input
              label="Mobile"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input label="Shop Address" value={shopAddress} onChangeText={setShopAddress} />
            <Input label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />

            <View style={styles.actions}>
              <Button title="Save Draft" onPress={() => save('draft')} loading={saving} variant="secondary" />
              <Button title="Save for Approval" onPress={() => save('pending')} loading={saving} />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  loading: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
