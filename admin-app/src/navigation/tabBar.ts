import { ViewStyle, TextStyle } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

/** Base tab bar chrome height (icons + label), excluding system inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/**
 * Bottom tab style that respects Android gesture / 3-button navigation.
 * Do not set a fixed height without adding insets.bottom — that is what
 * caused the tab bar to cover page content.
 */
export function getTabBarStyle(insets: EdgeInsets): ViewStyle {
  const bottom = Math.max(insets.bottom, 8);
  return {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: TAB_BAR_CONTENT_HEIGHT + bottom,
    paddingBottom: bottom,
    paddingTop: 4,
  };
}

export const tabBarLabelStyle: TextStyle = {
  fontSize: 10,
  fontWeight: '600',
};
