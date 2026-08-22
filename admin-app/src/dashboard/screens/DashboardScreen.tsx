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
import { getDashboardStats, getDealerDashboardStats, getEmployeeDashboardStats, DashboardStats } from '../../services/dashboardService';
import { loadNotifications } from '../data/notificationStore';
import { useTheme } from '../../theme/useTheme';
import { authCardStyle, spacing } from '../../theme/spacing';
import { useRbac, can, clearRbac, isEmployee, isFieldActor } from '../../auth/rbacStore';
import { logout as apiLogout } from '../../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useRbac();
  const dealerMode = isFieldActor();
  const employeeMode = isEmployee();
  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = isFieldActor()
          ? await getDealerDashboardStats()
          : isEmployee()
            ? await getEmployeeDashboardStats()
            : await getDashboardStats();
        setStats(data);
      } catch (err) {
        console.warn('Dashboard fetch error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    // Field actors / employees have no notifications UI — skip admin notifications fetch.
    if (!isFieldActor() && !isEmployee()) {
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
    // Top inset lives on DashboardAppBar so the header clears the status bar.
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <DashboardAppBar
        onNotificationsPress={
          dealerMode || employeeMode ? undefined : () => navigation.navigate('Notifications')
        }
        onProfilePress={() => setProfileMenuVisible(true)}
      />

      <View style={styles.body}>
        {!dealerMode && !employeeMode ? (
        <View style={styles.searchWrap}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        ) : null}

        {isSearching && !dealerMode && !employeeMode ? (
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
              {employeeMode ? (
                <>
                  <SummaryCard title="Total Products" value={String(stats?.totalProducts || 0)} icon="cube-outline" />
                  <SummaryCard title="Total Dealers" value={String(stats?.totalDealers || 0)} icon="storefront-outline" />
                  <SummaryCard title="Total Employees" value={String(stats?.totalEmployees || 0)} icon="badge-outline" />
                  <SummaryCard title="Total Agents" value={String(stats?.totalAgents || 0)} icon="people-outline" />
                </>
              ) : dealerMode ? (
                <>
                  <SummaryCard title="Total Products" value={String(stats?.totalProducts || 0)} icon="cube-outline" />
                  <SummaryCard title="Total Agents" value={String(stats?.totalAgents || 0)} icon="people-outline" />
                  <SummaryCard title="Total Dealers" value={String(stats?.totalDealers || 0)} icon="storefront-outline" />
                  <SummaryCard title="Total Leads" value={String(stats?.totalLeads || 0)} icon="clipboard-outline" />
                  <SummaryCard title="Draft" value={String(stats?.draftProducts || 0)} icon="document-outline" />
                  <SummaryCard title="Pending Approval" value={String(stats?.pendingApprovalProducts || 0)} icon="time-outline" />
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
                  .filter((action) => {
                    if (!can(action.permission)) return false;
                    // Employee shell: hide Admin-only modules even if permission keys overlap.
                    if (
                      employeeMode &&
                      ['Orders', 'Customers', 'EMI', 'Loans', 'Reports', 'Users', 'Roles', 'Settings'].includes(
                        action.title,
                      )
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map((action) => (
                    <QuickActionButton
                      key={action.id}
                      title={action.title}
                      icon={action.icon}
                      onPress={() => {
                        if (action.title === 'Products') {
                          if (dealerMode || employeeMode) {
                            navigation.navigate('Products' as never);
                          } else {
                            navigation.navigate('ProductList');
                          }
                          return;
                        }
                        if (action.title === 'Agents') {
                          if (dealerMode || employeeMode) {
                            navigation.navigate('Agents' as never);
                          } else {
                            navigation.navigate('AgentList');
                          }
                          return;
                        }
                        if (action.title === 'Employees') {
                          if (employeeMode) {
                            navigation.navigate('Employees' as never);
                          } else {
                            navigation.navigate('EmployeeList');
                          }
                          return;
                        }
                        if (action.title === 'Dealers') {
                          if (dealerMode || employeeMode) {
                            navigation.navigate('Dealers' as never);
                          } else {
                            navigation.navigate('DealerList');
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
                          if (dealerMode || employeeMode) {
                            navigation.navigate('Masters' as never);
                          } else {
                            navigation.navigate('MastersHome');
                          }
                          return;
                        }
                        navigation.navigate('ModulePlaceholder', { title: action.title });
                      }}
                    />
                  ))}
              </View>
            </View>

            {dealerMode || employeeMode ? null : (
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
          if (dealerMode || employeeMode) {
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
