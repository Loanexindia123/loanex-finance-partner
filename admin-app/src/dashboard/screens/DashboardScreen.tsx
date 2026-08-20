import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Keyboard, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { DashboardAppBar } from '../components/DashboardAppBar';
import { SearchBar } from '../components/SearchBar';
import { SummaryCard } from '../components/SummaryCard';
import { QuickActionButton } from '../components/QuickActionButton';
import { SectionHeader } from '../components/SectionHeader';
import { ActivityItem } from '../components/ActivityItem';
import {
  GlobalSearchResults,
  SearchResultItem,
} from '../components/GlobalSearchResults';
import { ProfileMenu } from '../components/ProfileMenu';
import { quickActions } from '../data/quickActions';
import { getDashboardStats, getDealerDashboardStats, DashboardStats } from '../../services/dashboardService';
import { loadNotifications } from '../data/notificationStore';
import { useTheme } from '../../theme/useTheme';
import { authCardStyle, spacing } from '../../theme/spacing';
import { useRbac, can, clearRbac, isDealer } from '../../auth/rbacStore';
import { logout as apiLogout } from '../../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useRbac();
  const dealerMode = isDealer();
  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = isDealer() ? await getDealerDashboardStats() : await getDashboardStats();
        setStats(data);
      } catch (err) {
        console.warn('Dashboard fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    // Dealers have no notifications UI/permission — skip admin notifications fetch (avoids 403).
    if (!isDealer()) {
      loadNotifications();
    }
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  const handleSearchSelect = (item: SearchResultItem) => {
    Keyboard.dismiss();
    setSearchQuery('');

    if (item.type === 'product') {
      navigation.navigate('ProductDetails', { productId: item.id });
      return;
    }
    if (item.type === 'order') {
      navigation.navigate('OrderDetails', { orderId: item.id });
      return;
    }
    if (item.type === 'customer') {
      navigation.navigate('CustomerDetails', { customerId: item.id });
      return;
    }
    navigation.navigate('EmiApplicationDetails', { applicationId: item.id });
  };

  const doLogout = () => {
    apiLogout().catch(() => undefined);
    clearRbac();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      }),
    );
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to logout?');
      if (confirm) doLogout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <DashboardAppBar
        onNotificationsPress={dealerMode ? undefined : () => navigation.navigate('Notifications')}
        onProfilePress={() => setProfileMenuVisible(true)}
      />

      <View style={styles.body}>
        {!dealerMode ? (
        <View style={styles.searchWrap}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        ) : null}

        {isSearching && !dealerMode ? (
          <View style={styles.searchResults}>
            <GlobalSearchResults query={searchQuery} onSelect={handleSearchSelect} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.summaryGrid}>
              {dealerMode ? (
                <>
                  <SummaryCard title="Total Products" value={String(stats?.totalProducts || 0)} icon="cube-outline" />
                  <SummaryCard title="Draft" value={String(stats?.draftProducts || 0)} icon="document-outline" />
                  <SummaryCard title="Pending Approval" value={String(stats?.pendingApprovalProducts || 0)} icon="time-outline" />
                  <SummaryCard title="Approved" value={String(stats?.approvedProducts || 0)} icon="checkmark-circle-outline" />
                  <SummaryCard title="Rejected" value={String(stats?.rejectedProducts || 0)} icon="close-circle-outline" />
                </>
              ) : (
                <>
                  <SummaryCard title="Total Revenue" value={`₹${stats?.totalRevenue?.toLocaleString('en-IN') || 0}`} icon="cash-outline" />
                  <SummaryCard title="Pending Orders" value={String(stats?.pendingOrders || 0)} icon="cart-outline" />
                  <SummaryCard title="Pending EMI" value={String(stats?.pendingEmiApplications || 0)} icon="document-text-outline" />
                  <SummaryCard title="Total Products" value={String(stats?.totalProducts || 0)} icon="cube-outline" />
                </>
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Quick Actions" />
              <View style={styles.actionsGrid}>
                {quickActions
                  .filter((action) => can(action.permission))
                  .map((action) => (
                    <QuickActionButton
                      key={action.id}
                      title={action.title}
                      icon={action.icon}
                      onPress={() => {
                        if (action.title === 'Products') {
                          if (dealerMode) {
                            navigation.navigate('Products' as never);
                          } else {
                            navigation.navigate('ProductList');
                          }
                          return;
                        }
                        if (action.title === 'Customers') {
                          navigation.navigate('CustomerList');
                          return;
                        }
                        if (action.title === 'Orders') {
                          navigation.navigate('OrderList');
                          return;
                        }
                        if (action.title === 'EMI') {
                          navigation.navigate('EmiApplicationList');
                          return;
                        }
                        if (action.title === 'Loans') {
                          navigation.navigate('LoanList');
                          return;
                        }
                        if (action.title === 'Reports') {
                          navigation.navigate('ReportsHome');
                          return;
                        }
                        if (action.title === 'Users') {
                          navigation.navigate('UserList');
                          return;
                        }
                        if (action.title === 'Roles') {
                          navigation.navigate('RoleList');
                          return;
                        }
                        if (action.title === 'Settings') {
                          navigation.navigate('SettingsHome');
                          return;
                        }
                        if (action.title === 'Masters') {
                          navigation.navigate('MastersHome');
                          return;
                        }
                        navigation.navigate('ModulePlaceholder', { title: action.title });
                      }}
                    />
                  ))}
              </View>
            </View>

            {dealerMode ? null : (
            <View style={styles.sectionCard}>
              <SectionHeader title="Recent Activity" />
              {stats?.recentOrders?.length ? (
                stats.recentOrders.slice(0, 5).map((order, index) => (
                  <ActivityItem
                    key={order.id}
                    title={`New Order: ${order.productName || order.id}`}
                    description={`Order placed by ${order.customerName || 'Customer'}`}
                    time={new Date(order.orderDate || new Date()).toLocaleDateString()}
                    icon="cart-outline"
                    isLast={index === Math.min(stats.recentOrders.length, 5) - 1}
                  />
                ))
              ) : (
                <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>No recent activity.</Text>
              )}
            </View>
            )}
          </ScrollView>
        )}
      </View>

      <ProfileMenu
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
        onMyProfile={() => {
          if (dealerMode) {
            navigation.navigate('Profile' as never);
          } else {
            navigation.navigate('MyProfile');
          }
        }}
        onChangePassword={() => navigation.navigate('ChangePassword')}
        onLogout={handleLogout}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    body: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    searchWrap: {
      marginBottom: spacing.lg,
    },
    searchResults: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xxl,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    section: {
      marginBottom: spacing.xl,
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      gap: 16,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      ...authCardStyle,
    },
  });
}
