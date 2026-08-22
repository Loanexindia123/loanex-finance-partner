import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DashboardScreen } from '../dashboard/screens/DashboardScreen';
import { ProductListScreen } from '../modules/products/screens/ProductListScreen';
import { AgentListScreen } from '../modules/agents/screens/AgentListScreen';
import { DealerListScreen } from '../modules/dealers/screens/DealerListScreen';
import { LeadListScreen } from '../modules/leads/screens/LeadListScreen';
import { MyProfileScreen } from '../dashboard/screens/MyProfileScreen';
import { DealerMastersHomeScreen } from '../modules/masters/screens/DealerMastersHomeScreen';
import { DealerTabParamList } from './types';
import { colors } from '../theme/colors';
import { getTabBarStyle, tabBarLabelStyle } from './tabBar';

const Tab = createBottomTabNavigator<DealerTabParamList>();

function tabIcon(routeName: keyof DealerTabParamList): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'Dashboard':
      return 'grid-outline';
    case 'Products':
      return 'cube-outline';
    case 'Dealers':
      return 'storefront-outline';
    case 'Agents':
      return 'people-outline';
    case 'Leads':
      return 'clipboard-outline';
    case 'Masters':
      return 'layers-outline';
    case 'Profile':
    default:
      return 'person-outline';
  }
}

export function DealerTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = getTabBarStyle(insets);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle,
        tabBarLabelStyle,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcon(route.name)} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen as React.ComponentType<any>} />
      <Tab.Screen name="Products" component={ProductListScreen as React.ComponentType<any>} />
      <Tab.Screen name="Dealers" component={DealerListScreen as React.ComponentType<any>} />
      <Tab.Screen name="Agents" component={AgentListScreen as React.ComponentType<any>} />
      <Tab.Screen name="Leads" component={LeadListScreen as React.ComponentType<any>} />
      <Tab.Screen name="Masters" component={DealerMastersHomeScreen} />
      <Tab.Screen name="Profile" component={MyProfileScreen as React.ComponentType<any>} />
    </Tab.Navigator>
  );
}
