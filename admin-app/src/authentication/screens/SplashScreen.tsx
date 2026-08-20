import React, { useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { LogoHeader } from '../components/LogoHeader';
import { authColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { getToken, getStoredUser, getMe, clearAuth } from '../../services/authService';
import { setRbacUser, isDealer } from '../../auth/rbacStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const styles = useMemo(() => createStyles(), []);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const [token, storedUser] = await Promise.all([getToken(), getStoredUser()]);
      if (cancelled) return;

      if (token && storedUser) {
        // Validate the token against the API so an expired session lands on
        // Login instead of a broken Dashboard.
        try {
          const fresh = await getMe();
          if (cancelled) return;
          setRbacUser({
            ...storedUser,
            ...fresh,
            permissions:
              fresh.permissions && fresh.permissions.length > 0
                ? fresh.permissions
                : storedUser.permissions ?? [],
          });
          if (fresh.mustChangePassword) {
            navigation.replace('ChangePassword', { forced: true });
          } else if (isDealer()) {
            navigation.replace('DealerTabs');
          } else {
            navigation.replace('Dashboard');
          }
          return;
        } catch {
          if (cancelled) return;
          await clearAuth();
          navigation.replace('Login');
          return;
        }
      }

      navigation.replace('Login');
    };

    // Keep a brief splash for a stable launch feel.
    const timer = setTimeout(restore, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <LogoHeader subtitle="Enterprise Lending Platform" size="splash" onDark />
      <ActivityIndicator size="large" color={authColors.accent} style={styles.loader} />
      <Text style={styles.loadingText}>Loading secure console…</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: authColors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    loader: {
      marginTop: spacing.xxl,
    },
    loadingText: {
      ...typography.bodySmall,
      color: authColors.textOnDarkMuted,
      marginTop: spacing.lg,
      letterSpacing: 0.4,
    },
  });
}
