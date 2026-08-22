import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getDealerById, type AppDealer } from '../../../services/dealerService';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DealerDetails'>;

export function DealerDetailsScreen({ route }: Props) {
  const { dealerId } = route.params;
  const [dealer, setDealer] = useState<AppDealer | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      getDealerById(dealerId)
        .then((d) => {
          if (alive) setDealer(d);
        })
        .catch(() => {
          if (alive) setDealer(null);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [dealerId]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Dealer Details</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !dealer ? (
        <Text style={styles.empty}>Dealer not found</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Row label="Name" value={dealer.dealerName} />
          <Row label="Code" value={dealer.dealerCode} />
          <Row label="Owner" value={dealer.ownerName} />
          <Row label="Mobile" value={dealer.mobile} />
          <Row label="Email" value={dealer.email} />
          <Row label="Form Status" value={dealer.formStatus} />
          <Row label="Verification" value={dealer.verificationStatus} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  body: { padding: spacing.lg, gap: spacing.md },
  row: { gap: 4 },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  value: { fontSize: 16, color: colors.text },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
