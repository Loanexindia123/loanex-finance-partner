import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  /** When false, skip top inset (parent already pads). Default true. */
  includeTopInset?: boolean;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
}

/**
 * Global app header — always clears the Android status bar when includeTopInset
 * is true so actions (e.g. Add Product) never sit under battery/time.
 */
export function AppHeader({
  title,
  subtitle,
  left,
  right,
  children,
  includeTopInset = true,
  style,
  borderColor = colors.accent,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: borderColor, paddingTop: (includeTopInset ? insets.top : 0) + spacing.lg },
        style,
      ]}
    >
      {children ?? (
        <View style={styles.row}>
          {left ?? <View style={styles.side} />}
          <View style={styles.titleBlock}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right ?? <View style={styles.side} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  side: {
    minWidth: 24,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textHeading,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
