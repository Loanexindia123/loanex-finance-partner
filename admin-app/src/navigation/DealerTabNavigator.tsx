import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DashboardScreen } from '../dashboard/screens/DashboardScreen';
import { ProductListScreen } from '../modules/products/screens/ProductListScreen';
import { MyProfileScreen } from '../dashboard/screens/MyProfileScreen';
import { DealerMastersHomeScreen } from '../modules/masters/screens/DealerMastersHomeScreen';
import { DealerTabParamList } from './types';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator<DealerTabParamList>();

export function DealerTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === 'Dashboard'
              ? 'grid-outline'
              : route.name === 'Products'
                ? 'cube-outline'
                : route.name === 'Masters'
                  ? 'layers-outline'
                  : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen as React.ComponentType<any>} />
      <Tab.Screen name="Products" component={ProductListScreen as React.ComponentType<any>} />
      <Tab.Screen name="Masters" component={DealerMastersHomeScreen} />
      <Tab.Screen name="Profile" component={MyProfileScreen as React.ComponentType<any>} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
