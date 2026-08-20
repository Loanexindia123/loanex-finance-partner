import React, { useEffect } from 'react';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/useTheme';
import { onSessionExpired } from '../services/api';
import { SplashScreen } from '../authentication/screens/SplashScreen';
import { LoginScreen } from '../authentication/screens/LoginScreen';
import { DashboardScreen } from '../dashboard/screens/DashboardScreen';
import { ModulePlaceholderScreen } from '../dashboard/screens/ModulePlaceholderScreen';
import { NotificationsScreen } from '../dashboard/screens/NotificationsScreen';
import { MyProfileScreen } from '../dashboard/screens/MyProfileScreen';
import { ChangePasswordScreen } from '../dashboard/screens/ChangePasswordScreen';
import { ProductListScreen } from '../modules/products/screens/ProductListScreen';
import { AddProductScreen } from '../modules/products/screens/AddProductScreen';
import { ProductDetailsScreen } from '../modules/products/screens/ProductDetailsScreen';
import { CustomerListScreen } from '../customers/screens/CustomerListScreen';
import { CustomerDetailsScreen } from '../customers/screens/CustomerDetailsScreen';
import { OrderListScreen } from '../orders/screens/OrderListScreen';
import { OrderDetailsScreen } from '../orders/screens/OrderDetailsScreen';
import { EmiApplicationListScreen } from '../emi/screens/EmiApplicationListScreen';
import { EmiApplicationDetailsScreen } from '../emi/screens/EmiApplicationDetailsScreen';
import { CreditReviewDetailsScreen } from '../emi/screens/CreditReviewDetailsScreen';
import { LoanListScreen } from '../loans/screens/LoanListScreen';
import { LoanDetailsScreen } from '../loans/screens/LoanDetailsScreen';
import { FiCaseListScreen } from '../fi/screens/FiCaseListScreen';
import { FiCaseDetailsScreen } from '../fi/screens/FiCaseDetailsScreen';
import { ReportsHomeScreen } from '../reports/screens/ReportsHomeScreen';
import { UserListScreen } from '../users/screens/UserListScreen';
import { UserDetailsScreen } from '../users/screens/UserDetailsScreen';
import { AddUserScreen } from '../users/screens/AddUserScreen';
import { RoleListScreen } from '../roles/screens/RoleListScreen';
import { RoleFormScreen } from '../roles/screens/RoleFormScreen';
import { SettingsHomeScreen } from '../settings/screens/SettingsHomeScreen';
import { MastersHomeScreen } from '../settings/screens/MastersHomeScreen';
import { MasterListScreen } from '../settings/screens/MasterListScreen';
import { CategoriesMasterScreen } from '../settings/screens/CategoriesMasterScreen';
import { ProductTypesMasterScreen } from '../modules/masters/screens/ProductTypesMasterScreen';
import { BranchMasterScreen } from '../settings/screens/BranchMasterScreen';
import { PincodeMasterScreen } from '../settings/screens/PincodeMasterScreen';
import { CodSettingsScreen } from '../settings/screens/CodSettingsScreen';
import { DealerTabNavigator } from './DealerTabNavigator';
import { RootStackParamList } from './types';
import { isDealer } from '../auth/rbacStore';

const DEALER_ALLOWED_ROUTES = new Set<keyof RootStackParamList | string>([
  'Splash',
  'Login',
  'DealerTabs',
  'Dashboard',
  'Products',
  'Masters',
  'Profile',
  'ProductList',
  'AddProduct',
  'ProductDetails',
  'ChangePassword',
  'MyProfile',
  'CategoriesMaster',
  'MasterList',
  'ProductTypesMaster',
]);

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function AppNavigator() {
  const colors = useTheme();

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = navigationRef.addListener('state', () => {
      if (!navigationRef.isReady() || !isDealer()) return;
      const routeName = navigationRef.getCurrentRoute()?.name;
      if (routeName && !DEALER_ALLOWED_ROUTES.has(routeName)) {
        navigationRef.reset({ index: 0, routes: [{ name: 'DealerTabs' }] });
      }
    });
    return unsubscribe;
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="DealerTabs" component={DealerTabNavigator} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="MyProfile" component={MyProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="ModulePlaceholder" component={ModulePlaceholderScreen} />
        <Stack.Screen name="ProductList" component={ProductListScreen} />
        <Stack.Screen
          name="AddProduct"
          component={AddProductScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="CustomerList" component={CustomerListScreen} />
        <Stack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
        <Stack.Screen name="OrderList" component={OrderListScreen} />
        <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
        <Stack.Screen name="EmiApplicationList" component={EmiApplicationListScreen} />
        <Stack.Screen name="EmiApplicationDetails" component={EmiApplicationDetailsScreen} />
        <Stack.Screen name="CreditReviewDetails" component={CreditReviewDetailsScreen} />
        <Stack.Screen name="LoanList" component={LoanListScreen} />
        <Stack.Screen name="LoanDetails" component={LoanDetailsScreen} />
        <Stack.Screen name="FiCaseDetails" component={FiCaseDetailsScreen} />
        <Stack.Screen name="ReportsHome" component={ReportsHomeScreen} />
        <Stack.Screen name="UserList" component={UserListScreen} />
        <Stack.Screen name="UserDetails" component={UserDetailsScreen} />
        <Stack.Screen
          name="AddUser"
          component={AddUserScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="RoleList" component={RoleListScreen} />
        <Stack.Screen
          name="RoleForm"
          component={RoleFormScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="SettingsHome" component={SettingsHomeScreen} />
        <Stack.Screen name="CodSettings" component={CodSettingsScreen} />
        <Stack.Screen name="MastersHome" component={MastersHomeScreen} />
        <Stack.Screen name="MasterList" component={MasterListScreen} />
        <Stack.Screen name="CategoriesMaster" component={CategoriesMasterScreen} />
        <Stack.Screen name="ProductTypesMaster" component={ProductTypesMasterScreen} />
        <Stack.Screen name="BranchMaster" component={BranchMasterScreen} />
        <Stack.Screen name="PincodeMaster" component={PincodeMasterScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
