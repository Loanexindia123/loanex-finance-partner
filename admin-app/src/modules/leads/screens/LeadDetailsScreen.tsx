import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getLeadById, type Lead } from '../../../services/leadService';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LeadDetails'>;

export function LeadDetailsScreen({ navigation, route }: Props) {
  const { leadId } = route.params;
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      getLeadById(leadId)
        .then((l) => {
          if (alive) setLead(l);
        })
        .catch(() => {
          if (alive) setLead(null);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [leadId]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lead Details</Text>
        {lead ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('AddLead', { mode: 'edit', leadId: lead.id })}
          >
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !lead ? (
        <Text style={styles.empty}>Lead not found</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Row label="Customer Name" value={lead.customerName} />
          <Row label="Mobile" value={lead.customerMobile} />
          <Row label="Interested Product" value={lead.interestedProduct} />
          <Row label="Notes" value={lead.notes} />
          <Row label="Status" value={lead.status} />
          <Row label="Created" value={lead.createdAt} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  edit: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  body: { padding: spacing.lg, gap: spacing.md },
  row: { gap: 4 },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  value: { fontSize: 16, color: colors.text },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
