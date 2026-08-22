import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { MasterDataProvider } from './src/settings/context/MasterDataContext';

/**
 * SafeAreaProvider at the root supplies insets to AppHeader, DashboardAppBar,
 * Screen shells, and bottom tab bars. Do not use React Native's SafeAreaView —
 * it does not reliably clear the Android status bar.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <MasterDataProvider>
        <AppNavigator />
        <StatusBar style="dark" />
      </MasterDataProvider>
    </SafeAreaProvider>
  );
}
