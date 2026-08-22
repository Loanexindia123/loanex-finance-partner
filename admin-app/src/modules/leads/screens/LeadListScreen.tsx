import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { listLeads, type Lead } from '../../../services/leadService';
import { can } from '../../../auth/rbacStore';
import { SafeHeader } from '../../../components/layout/SafeHeader';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import type { DealerTabParamList, RootStackParamList } from '../../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DealerTabParamList, 'Leads'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function LeadListScreen({ navigation }: Props) {
  const canCreate = can('leads.create');
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setLeads(await listLeads());
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeads();
    }, [fetchLeads]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.customerName.toLowerCase().includes(q) ||
        l.customerMobile.includes(q) ||
        l.interestedProduct.toLowerCase().includes(q),
    );
  }, [leads, search]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <SafeHeader style={styles.header}>
        <Text style={styles.title}>Leads</Text>
        {canCreate ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddLead', { mode: 'add' })}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </SafeHeader>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No leads found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, shadow.sm]}
              onPress={() => navigation.navigate('LeadDetails', { leadId: item.id })}
            >
              <Text style={styles.name}>{item.customerName}</Text>
              <Text style={styles.meta}>{item.customerMobile}</Text>
              {item.interestedProduct ? (
                <Text style={styles.meta}>{item.interestedProduct}</Text>
              ) : null}
              <Text style={styles.status}>{item.status}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  status: { marginTop: 8, fontSize: 12, fontWeight: '600', color: colors.primary },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 48 },
});
