import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { radius, shadow, spacing } from '../../theme/spacing';

interface FABProps {
  onPress: () => void;
  label?: string;
}

export function FloatingActionButton({ onPress, label = 'Add Product' }: FABProps) {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[styles.fab, shadow.lg, { bottom: spacing.xxxl + Math.max(insets.bottom, 0) }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.icon}>+</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  icon: { fontSize: 22, color: '#FFF', fontWeight: '300' },
  label: { fontSize: 15, color: '#FFF', fontWeight: '700' },
});
