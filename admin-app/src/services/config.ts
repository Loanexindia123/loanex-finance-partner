// LoanEx Admin App - API Configuration
import { Platform } from 'react-native';

const PROD_API = 'https://loanex-api.vercel.app/api/v1';
const LOCAL_API =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1';

export const API_CONFIG = {
  // Prefer EXPO_PUBLIC_API_URL for production builds; fall back to local in __DEV__.
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? LOCAL_API : PROD_API),

  // Request timeout in milliseconds
  TIMEOUT: 15000,

  // AsyncStorage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'adminToken',
    USER_DATA: 'adminUser',
    REFRESH_TOKEN: 'adminRefreshToken',
  },

  // Development OTP (always 111111 in dev mode)
  DEV_OTP: '111111',
};

export default API_CONFIG;
