import { Platform } from 'react-native';

export const APP_CONFIG = { name: 'LoanEx', currency: '₹' };

// Default server URL for development - override via EXPO_PUBLIC_SERVER_URL
const defaultServerUrl = __DEV__
  ? Platform.select({
      android: 'http://10.0.2.2:4000',   // Android emulator → host machine
      ios: 'http://localhost:4000',         // iOS simulator → host machine
      default: 'http://localhost:4000',
    }) || 'http://localhost:4000'
  : 'https://loanex-api.vercel.app';       // Release APK / production builds

// Backend server (Express) that proxies Razorpay + IDSPay KYC
// Set EXPO_PUBLIC_SERVER_URL in .env to override (e.g. http://192.168.1.100:4000 for physical devices)
let resolvedServerUrl = process.env.EXPO_PUBLIC_SERVER_URL || process.env.EXPO_PUBLIC_RAZORPAY_SERVER_URL || defaultServerUrl;
if (Platform.OS === 'android' && resolvedServerUrl.includes('localhost')) {
  resolvedServerUrl = resolvedServerUrl.replace('localhost', '10.0.2.2');
}

export const SERVER_URL = resolvedServerUrl;

export const RAZORPAY_CONFIG = {
  keyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_TK9j8iOxo6qUvs',
  serverUrl: SERVER_URL,
};

export const KYC_CONFIG = {
  // When true, uses the real IDSPay DigiLocker API for Aadhaar verification.
  // When false (or API fails), falls back to demo format-check verification.
  useRealAadhar: true,
};

export const EMI_RATES = [
  { months: 3, annualRate: 12.5 },
  { months: 6, annualRate: 12.5 },
  { months: 9, annualRate: 12.5 },
  { months: 12, annualRate: 12.5 },
];

export const CATEGORIES = [
  { id: '1', name: 'Electronics', icon: 'devices' as const, color: '#3B82F6', bg: '#EFF6FF' },
  { id: '2', name: 'Fashion', icon: 'checkroom' as const, color: '#EC4899', bg: '#FDF2F8' },
  { id: '3', name: 'Home & Living', icon: 'home' as const, color: '#10B981', bg: '#ECFDF5' },
  { id: '4', name: 'Sports', icon: 'sports-soccer' as const, color: '#F59E0B', bg: '#FFFBEB' },
  { id: '5', name: 'Books', icon: 'menu-book' as const, color: '#8B5CF6', bg: '#F5F3FF' },
  { id: '6', name: 'Beauty', icon: 'face' as const, color: '#EF4444', bg: '#FEF2F2' },
];

export const ADMIN_PHONES = ['9876543210', '9999999999'];

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Reducing-balance EMI (paise rounding) — matches backend calculator. */
export function calculateEMI(principal: number, annualRate: number, months: number) {
  if (months <= 0 || principal <= 0) {
    return { monthlyAmount: 0, totalAmount: 0, processingFee: 0, interest: 0 };
  }
  const r = annualRate / 12 / 100;
  if (r === 0) {
    const monthlyAmount = roundMoney(principal / months);
    return { monthlyAmount, totalAmount: principal, processingFee: 0, interest: 0 };
  }
  const factor = Math.pow(1 + r, months);
  const monthlyAmount = roundMoney((principal * r * factor) / (factor - 1));
  const totalAmount = roundMoney(monthlyAmount * months);
  return {
    monthlyAmount,
    totalAmount,
    processingFee: 0,
    interest: roundMoney(Math.max(0, totalAmount - principal)),
  };
}
