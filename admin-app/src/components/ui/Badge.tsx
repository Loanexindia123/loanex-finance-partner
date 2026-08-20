import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProductStatus } from '../../modules/products/types/product';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

const STATUS_CONFIG: Record<ProductStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: colors.successLight, text: colors.success },
  draft: { label: 'Draft', bg: colors.warningLight, text: colors.warning },
  pending_approval: { label: 'Pending Approval', bg: colors.warningLight, text: colors.warning },
  rejected: { label: 'Rejected', bg: colors.dangerLight, text: colors.danger },
  out_of_stock: { label: 'Out of Stock', bg: colors.dangerLight, text: colors.danger },
  archived: { label: 'Archived', bg: colors.borderLight, text: colors.textSecondary },
};

interface BadgeProps {
  status: ProductStatus;
  label?: string;
}

export function Badge({ status, label }: BadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{label || config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
