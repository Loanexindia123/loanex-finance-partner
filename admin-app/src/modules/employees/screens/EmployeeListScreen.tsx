import React, { useCallback, useMemo, useState } from 'react';
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
import { deleteEmployee, listEmployees } from '../../../services/employeeService';
import type { AppEmployee } from '../../../types/employee';
import { can } from '../../../auth/rbacStore';
import { SafeHeader } from '../../../components/layout/SafeHeader';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import type { EmployeeTabParamList, RootStackParamList } from '../../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<EmployeeTabParamList, 'Employees'>,
  NativeStackScreenProps<RootStackParamList>
>;

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

export function EmployeeListScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const canCreate = can('users.create');

  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<AppEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('[Employees] Failed to load:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEmployees();
    }, [fetchEmployees]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        e.mobile.includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const handleDelete = async (employee: AppEmployee) => {
    if (!can('users.delete')) {
      showMessage('Not allowed', 'You cannot delete employees.');
      return;
    }
    const ok = await confirmAction(
      'Delete employee',
      `Delete ${employee.fullName || 'this employee'}? This cannot be undone.`,
    );
    if (!ok) return;
    try {
      await deleteEmployee(employee.id);
      setEmployees((prev) => prev.filter((row) => row.id !== employee.id));
    } catch (error: any) {
      showMessage(
        'Delete failed',
        String(error?.message || error?.response?.data?.message || 'Could not delete employee.'),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <SafeHeader style={styles.header}>
        <Text style={styles.title}>Employees</Text>
        {canCreate ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddEmployee', { mode: 'add' })}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </SafeHeader>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search employees"
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
          numColumns={isTablet ? 2 : 1}
          ListEmptyComponent={<Text style={styles.empty}>No employees found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, shadow.sm, isTablet && styles.cardTablet]}
              onPress={() => navigation.navigate('EmployeeDetails', { employeeId: item.id })}
              onLongPress={() => handleDelete(item)}
            >
              <Text style={styles.name} numberOfLines={1}>
                {item.fullName || 'Unnamed Employee'}
              </Text>
              <Text style={styles.meta}>{item.employeeId || '—'}</Text>
              <Text style={styles.meta}>
                {[item.designation, item.department].filter(Boolean).join(' · ') || '—'}
              </Text>
              <Text style={styles.status}>{item.formStatus || 'draft'}</Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTablet: { marginHorizontal: spacing.xs },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  status: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
});
