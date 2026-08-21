import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme/spacing';

/**
 * Extra top padding for custom headers so they clear the Android status bar.
 * Use when the screen shell does not already apply the top safe-area edge
 * (e.g. Screen edges="none" + header owns the inset).
 */
export function useHeaderTopInset(extra: number = spacing.lg): number {
  const insets = useSafeAreaInsets();
  return useMemo(() => insets.top + extra, [insets.top, extra]);
}

/**
 * Bottom padding for scroll/list content above the tab bar on gesture /
 * 3-button Android navigation. Prefer fixing tabBarStyle globally; use this
 * only for absolutely positioned footers/FABs.
 */
export function useTabBarBottomInset(extra: number = 0): number {
  const insets = useSafeAreaInsets();
  return useMemo(() => Math.max(insets.bottom, 8) + extra, [insets.bottom, extra]);
}
