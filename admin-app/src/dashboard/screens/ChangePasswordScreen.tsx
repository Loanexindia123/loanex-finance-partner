import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PasswordInput } from '../../authentication/components/PasswordInput';
import { SectionTitle } from '../../components/ui/SectionTitle';
import api from '../../services/api';
import { clearAuth } from '../../services/authService';
import { clearRbac, isDealer } from '../../auth/rbacStore';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

const SUCCESS_MESSAGE =
  'Password changed successfully. Please log in again with your new password.';

export function ChangePasswordScreen({ navigation, route }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const forced = Boolean(route.params?.forced);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoBack = useCallback(() => {
    if (forced) {
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (isDealer()) {
      navigation.navigate('DealerTabs');
      return;
    }
    navigation.navigate('Dashboard');
  }, [forced, navigation]);

  const resetToLogin = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      }),
    );
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleGoBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleGoBack]),
  );

  const clearError = () => {
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      // Forced first-login: always clear session and land on Login immediately.
      // Do not wait on Alert OK — Alert is unreliable on web and left dealers in-app.
      if (forced) {
        await clearAuth();
        clearRbac();
        resetToLogin();
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(SUCCESS_MESSAGE);
        } else {
          Alert.alert('Password Updated', SUCCESS_MESSAGE);
        }
        return;
      }

      await clearAuth();
      clearRbac();
      Alert.alert('Password Updated', SUCCESS_MESSAGE, [
        { text: 'OK', onPress: resetToLogin },
      ]);
    } catch (e: any) {
      setError(e.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        {forced ? (
          <View style={styles.backButton} />
        ) : (
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.card}>
            <SectionTitle title="Update Password" />
            <Text style={styles.description}>
              Enter your current password and choose a new one. You will be signed out
              and asked to log in again after the update.
            </Text>

            <PasswordInput
              label="Current Password"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                clearError();
              }}
              placeholder="Enter current password"
            />

            <PasswordInput
              label="New Password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                clearError();
              }}
              placeholder="Enter new password"
            />

            <PasswordInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearError();
              }}
              placeholder="Re-enter new password"
            />

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Button title="Update Password" onPress={handleSubmit} disabled={submitting} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
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
    card: {
      marginBottom: spacing.md,
    },
    description: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
      lineHeight: 20,
    },
    errorBanner: {
      ...typography.bodySmall,
      color: colors.danger,
      backgroundColor: colors.dangerLight,
      padding: spacing.md,
      borderRadius: radius.sm,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
  });
}
