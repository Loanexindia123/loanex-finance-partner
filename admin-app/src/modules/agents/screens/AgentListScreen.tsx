import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { deleteAgent, listAgents } from '../../../services/agentService';
import type { Agent } from '../../../types/agent';
import { AgentCard } from '../components/AgentCard';
import { can } from '../../../auth/rbacStore';
import { SafeHeader } from '../../../components/layout/SafeHeader';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import type { DealerTabParamList, RootStackParamList } from '../../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DealerTabParamList, 'Agents'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Alert.alert button callbacks are unreliable on web — use window.confirm there. */
function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function AgentListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 2 : 1;

  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAgents();
      setAgents(data);
    } catch (error) {
      console.error('[Agents] Failed to load:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAgents();
    }, [fetchAgents]),
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.fullName.toLowerCase().includes(q) ||
        agent.mobile.toLowerCase().includes(q) ||
        agent.email.toLowerCase().includes(q) ||
        agent.agentId.toLowerCase().includes(q) ||
        agent.city.toLowerCase().includes(q) ||
        agent.state.toLowerCase().includes(q),
    );
  }, [agents, search]);

  const handleDelete = async (agent: Agent) => {
    const ok = await confirmAction(
      'Delete agent',
      `Delete ${agent.fullName || 'this agent'}? This cannot be undone.`,
    );
    if (!ok) return;

    try {
      setDeletingId(agent.id);
      await deleteAgent(agent.id);
      setAgents((prev) => prev.filter((row) => row.id !== agent.id));
    } catch (error: any) {
      showMessage(
        'Delete failed',
        String(error?.message || error?.response?.data?.message || 'Could not delete agent.'),
      );
    } finally {
      setDeletingId(null);
    }
  };

  const renderItem = ({ item }: { item: Agent }) => {
    const formStatus = String(item.formStatus || '').toLowerCase();
    const canEditRow =
      can('freelancers.edit') &&
      (formStatus === 'draft' || formStatus === 'rejected' || !formStatus);
    const canDeleteRow = can('freelancers.delete') && deletingId !== item.id;

    return (
      <AgentCard
        agent={item}
        onView={() => navigation.navigate('AgentDetails', { agentId: item.id })}
        onEdit={
          canEditRow
            ? () => navigation.navigate('AddAgent', { mode: 'edit', agentId: item.id })
            : undefined
        }
        onDelete={canDeleteRow ? () => handleDelete(item) : undefined}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <SafeHeader style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Agents</Text>
          <Text style={styles.headerCount}>{agents.length} Agents</Text>
        </View>
        {can('freelancers.create') ? (
          <TouchableOpacity
            style={[styles.addBtn, shadow.sm]}
            onPress={() => navigation.navigate('AddAgent', { mode: 'add' })}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>Add Agent</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addBtnSpacer} />
        )}
      </SafeHeader>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, mobile, email, city…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          key={numColumns}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No agents yet</Text>
              <Text style={styles.emptyHint}>Add your first agent to get started.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textHeading },
  headerCount: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  addBtnSpacer: { width: 40 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 4 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textHeading },
  emptyHint: { fontSize: 13, color: colors.textSecondary },
});
