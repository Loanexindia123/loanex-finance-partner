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
import { createLead, getLeadById, updateLead } from '../../../services/leadService';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddLead'>;

export function AddLeadScreen({ navigation, route }: Props) {
  const isEdit = route.params?.mode === 'edit';
  const leadId = route.params?.leadId;

  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [interestedProduct, setInterestedProduct] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(isEdit && leadId));

  React.useEffect(() => {
    if (!isEdit || !leadId) return;
    getLeadById(leadId)
      .then((l) => {
        setCustomerName(l.customerName);
        setCustomerMobile(l.customerMobile);
        setInterestedProduct(l.interestedProduct);
        setNotes(l.notes);
      })
      .catch(() => Alert.alert('Error', 'Failed to load lead'))
      .finally(() => setLoading(false));
  }, [isEdit, leadId]);

  const save = async () => {
    if (!customerName.trim() || !customerMobile.trim()) {
      Alert.alert('Required', 'Customer Name and Mobile are required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        interestedProduct: interestedProduct.trim(),
        notes: notes.trim(),
        status: 'New',
      };
      if (isEdit && leadId) {
        await updateLead(leadId, payload);
      } else {
        await createLead(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not save lead');
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
          <Text style={styles.title}>{isEdit ? 'Edit Lead' : 'Add Lead'}</Text>
        </View>
        {loading ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Input label="Customer Name *" value={customerName} onChangeText={setCustomerName} />
            <Input
              label="Customer Mobile *"
              value={customerMobile}
              onChangeText={setCustomerMobile}
              keyboardType="phone-pad"
            />
            <Input
              label="Interested Product"
              value={interestedProduct}
              onChangeText={setInterestedProduct}
            />
            <Input label="Notes" value={notes} onChangeText={setNotes} multiline />
            <Button title="Save Lead" onPress={save} loading={saving} />
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
  loading: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
