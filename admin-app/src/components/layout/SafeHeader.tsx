import React, { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeHeaderProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Extra padding below the status-bar inset (default 0 — use your existing paddingVertical). */
  extraTop?: number;
}

/**
 * Wraps any existing screen header so it clears the Android status bar.
 * Prefer this (or AppHeader) over relying solely on SafeAreaView edges,
 * which is inconsistent on some Android / edge-to-edge builds.
 */
export function SafeHeader({ children, style, extraTop = 0 }: SafeHeaderProps) {
  const insets = useSafeAreaInsets();
  return <View style={[{ paddingTop: insets.top + extraTop }, style]}>{children}</View>;
}
