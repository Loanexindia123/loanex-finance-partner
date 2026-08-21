import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getEmployeeById } from '../../../services/employeeService';
import type { AppEmployee } from '../../../types/employee';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EmployeeDetails'>;

export function EmployeeDetailsScreen({ route }: Props) {
  const { employeeId } = route.params;
  const [employee, setEmployee] = useState<AppEmployee | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      getEmployeeById(employeeId)
        .then((row) => {
          if (alive) setEmployee(row);
        })
        .catch(() => {
          if (alive) setEmployee(null);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [employeeId]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Employee Details</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !employee ? (
        <Text style={styles.empty}>Employee not found</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Row label="Name" value={employee.fullName} />
          <Row label="Employee ID" value={employee.employeeId} />
          <Row label="Mobile" value={employee.mobile} />
          <Row label="Email" value={employee.email} />
          <Row label="Department" value={employee.department} />
          <Row label="Designation" value={employee.designation} />
          <Row label="Branch" value={employee.branch} />
          <Row label="Reporting Person" value={employee.reportingPerson} />
          <Row label="Form Status" value={employee.formStatus} />
          <Row label="Onboarded By" value={employee.onboardedBy} />
          <Row label="Login Linked" value={employee.userId ? 'Yes' : 'No (pending approval)'} />
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
