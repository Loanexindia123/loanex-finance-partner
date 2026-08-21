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
import { AgentListScreen } from '../modules/agents/screens/AgentListScreen';
import { AddAgentScreen } from '../modules/agents/screens/AddAgentScreen';
import { AgentDetailsScreen } from '../modules/agents/screens/AgentDetailsScreen';
import { DealerListScreen } from '../modules/dealers/screens/DealerListScreen';
import { AddDealerScreen } from '../modules/dealers/screens/AddDealerScreen';
import { DealerDetailsScreen } from '../modules/dealers/screens/DealerDetailsScreen';
import { EmployeeListScreen } from '../modules/employees/screens/EmployeeListScreen';
import { AddEmployeeScreen } from '../modules/employees/screens/AddEmployeeScreen';
import { EmployeeDetailsScreen } from '../modules/employees/screens/EmployeeDetailsScreen';
import { LeadListScreen } from '../modules/leads/screens/LeadListScreen';
import { AddLeadScreen } from '../modules/leads/screens/AddLeadScreen';
import { LeadDetailsScreen } from '../modules/leads/screens/LeadDetailsScreen';
import { DealerTabNavigator } from './DealerTabNavigator';
import { EmployeeTabNavigator } from './EmployeeTabNavigator';
import { RootStackParamList } from './types';
import { isEmployee, isFieldActor } from '../auth/rbacStore';

const FIELD_ALLOWED_ROUTES = new Set<keyof RootStackParamList | string>([
  'Splash',
  'Login',
  'DealerTabs',
  'Dashboard',
  'Products',
  'Dealers',
  'Agents',
  'Leads',
  'Masters',
  'Profile',
  'ProductList',
  'AddProduct',
  'ProductDetails',
  'AgentList',
  'AddAgent',
  'AgentDetails',
  'DealerList',
  'AddDealer',
  'DealerDetails',
  'LeadList',
  'AddLead',
  'LeadDetails',
  'ChangePassword',
  'MyProfile',
  'CategoriesMaster',
  'MasterList',
  'ProductTypesMaster',
]);

const EMPLOYEE_ALLOWED_ROUTES = new Set<keyof RootStackParamList | string>([
  'Splash',
  'Login',
  'EmployeeTabs',
  'Dashboard',
  'Products',
  'Dealers',
  'Employees',
  'Agents',
  'Masters',
  'Profile',
  'ProductList',
  'AddProduct',
  'ProductDetails',
  'AgentList',
  'AddAgent',
  'AgentDetails',
  'DealerList',
  'AddDealer',
  'DealerDetails',
  'EmployeeList',
  'AddEmployee',
  'EmployeeDetails',
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
      if (!navigationRef.isReady()) return;
      const routeName = navigationRef.getCurrentRoute()?.name;
      if (!routeName) return;

      if (isFieldActor() && !FIELD_ALLOWED_ROUTES.has(routeName)) {
        navigationRef.reset({ index: 0, routes: [{ name: 'DealerTabs' }] });
        return;
      }
      if (isEmployee() && !EMPLOYEE_ALLOWED_ROUTES.has(routeName)) {
        navigationRef.reset({ index: 0, routes: [{ name: 'EmployeeTabs' }] });
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
        <Stack.Screen name="EmployeeTabs" component={EmployeeTabNavigator} />
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
        <Stack.Screen name="AgentList" component={AgentListScreen as React.ComponentType<any>} />
        <Stack.Screen
          name="AddAgent"
          component={AddAgentScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="AgentDetails" component={AgentDetailsScreen} />
        <Stack.Screen name="DealerList" component={DealerListScreen as React.ComponentType<any>} />
        <Stack.Screen
          name="AddDealer"
          component={AddDealerScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="DealerDetails" component={DealerDetailsScreen} />
        <Stack.Screen
          name="EmployeeList"
          component={EmployeeListScreen as React.ComponentType<any>}
        />
        <Stack.Screen
          name="AddEmployee"
          component={AddEmployeeScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="EmployeeDetails" component={EmployeeDetailsScreen} />
        <Stack.Screen name="LeadList" component={LeadListScreen as React.ComponentType<any>} />
        <Stack.Screen
          name="AddLead"
          component={AddLeadScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="LeadDetails" component={LeadDetailsScreen} />
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

