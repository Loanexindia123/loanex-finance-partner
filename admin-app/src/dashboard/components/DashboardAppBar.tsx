import React, { useMemo, useSyncExternalStore } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getUnreadCount,
  subscribeNotifications,
} from '../data/notificationStore';
import { getMe, User } from '../../services/authService';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const logoSource = require('../../../assets/logo-loanex.jpg');

interface DashboardAppBarProps {
  onProfilePress?: () => void;
  onNotificationsPress?: () => void;
}

export function DashboardAppBar({
  onProfilePress,
  onNotificationsPress,
}: DashboardAppBarProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unreadCount = useSyncExternalStore(
    subscribeNotifications,
    getUnreadCount,
    getUnreadCount,
  );
  const [profile, setProfile] = React.useState<User | null>(null);

  React.useEffect(() => {
    getMe().then(setProfile).catch(() => {});
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.left}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        <View style={styles.welcomeBlock}>
          <Text style={styles.welcomeLabel}>Welcome,</Text>
          <Text style={styles.welcomeName}>{profile?.email || profile?.phone || 'Admin'}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {onNotificationsPress ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onNotificationsPress}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          {unreadCount > 0 ? <View style={styles.badge} /> : null}
        </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.avatar}
          onPress={onProfilePress}
          accessibilityLabel="Profile"
        >
          <Text style={styles.avatarText}>{profile?.email ? profile.email.charAt(0).toUpperCase() : 'A'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 3,
      borderBottomColor: colors.goldLine,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
    },
    logo: {
      width: 48,
      height: 34,
    },
    welcomeBlock: {
      flex: 1,
    },
    welcomeLabel: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    welcomeName: {
      ...typography.subtitle,
      color: colors.textHeading,
      fontSize: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...typography.caption,
      color: colors.textOnPrimary,
      fontWeight: '700',
    },
  });
}
