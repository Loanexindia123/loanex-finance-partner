import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../../components/ui/Card';
import { DetailRow } from '../../components/ui/DetailRow';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { SafeHeader } from '../../components/layout/SafeHeader';
import { getMe, User } from '../../services/authService';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { isFieldActor } from '../../auth/rbacStore';

type Props = NativeStackScreenProps<RootStackParamList, 'MyProfile'>;

export function MyProfileScreen({ navigation }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const dealerTabRoot = isFieldActor() && !navigation.canGoBack();

  useFocusEffect(
    useCallback(() => {
      async function loadProfile() {
        try {
          const user = await getMe();
          setProfile(user);
        } catch (e) {
          console.warn('Failed to load profile', e);
        } finally {
          setLoading(false);
        }
      }
      loadProfile();
    }, [])
  );

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (isFieldActor()) {
      navigation.navigate('DealerTabs', { screen: 'Dashboard' });
      return;
    }
    navigation.navigate('Dashboard');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (dealerTabRoot) return true;
        handleGoBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleGoBack, dealerTabRoot]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <SafeHeader style={styles.header}>
        {dealerTabRoot ? (
          <View style={styles.backButton} />
        ) : (
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.backButton} />
      </SafeHeader>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading Profile...</Text>
        ) : profile ? (
          <>
            <View style={styles.avatarBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.email ? profile.email.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <Text style={styles.name}>{profile.email || profile.phone || 'Admin'}</Text>
              <Text style={styles.role}>{(profile.role || 'admin').toUpperCase()}</Text>
            </View>

            <Card style={styles.section}>
              <SectionTitle title="Profile Details" />
              <DetailRow label="Phone" value={profile.phone || 'N/A'} />
              <DetailRow label="Email" value={profile.email || 'N/A'} />
              <DetailRow label="Role" value={profile.role || 'admin'} />
              <DetailRow
                label="Created At"
                value={
                  profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : 'N/A'
                }
                isLast
              />
            </Card>
          </>
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>Failed to load profile</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 3,
      borderBottomColor: colors.accent,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...typography.label,
      fontSize: 16,
      color: colors.textHeading,
    },
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    avatarBlock: {
      alignItems: 'center',
      marginBottom: spacing.xl,
      paddingVertical: spacing.lg,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatarText: {
      ...typography.h2,
      color: colors.textOnPrimary,
      fontSize: 24,
    },
    name: {
      ...typography.h3,
      color: colors.textHeading,
      marginBottom: spacing.xs,
    },
    role: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: spacing.md,
    },
  });
}
