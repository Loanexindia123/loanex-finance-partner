import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

type ScreenEdges = 'top' | 'tab' | 'full' | 'none';

interface ScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * - top: status bar only (default) — use inside bottom tabs or stack screens
   * - tab: top only; tab bar owns the bottom inset
   * - full: top + bottom (auth / no tab bar)
   * - none: no insets (header already applied top inset)
   */
  edges?: ScreenEdges;
  backgroundColor?: string;
}

function resolveEdges(mode: ScreenEdges): readonly Edge[] {
  switch (mode) {
    case 'none':
      return [];
    case 'full':
      return ['top', 'bottom'];
    case 'tab':
    case 'top':
    default:
      return ['top'];
  }
}

/**
 * Global screen shell. Prefer this (or SafeAreaView from
 * react-native-safe-area-context) over React Native's SafeAreaView,
 * which does not reliably clear the Android status bar.
 */
export function Screen({
  children,
  style,
  edges = 'top',
  backgroundColor = colors.background,
}: ScreenProps) {
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor }, style]}
      edges={resolveEdges(edges)}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
