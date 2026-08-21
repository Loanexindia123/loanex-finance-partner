import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { API_CONFIG } from './config';

export interface User {
  id: string;
  phone: string;
  email?: string;
  role: 'customer' | 'admin' | 'dealer' | 'agent';
  roleId?: string | null;
  roleName?: string | null;
  permissions?: string[];
  mustChangePassword?: boolean;
  dealerId?: string;
  agentId?: string;
  created_at: string;
  updated_at: string;
}

function isDealerPayload(raw: any): boolean {
  const roleName = String(raw?.roleName ?? '').trim().toLowerCase();
  const role = String(raw?.role ?? '').trim().toLowerCase();
  return roleName === 'dealer' || role === 'dealer';
}

function isAgentPayload(raw: any): boolean {
  const roleName = String(raw?.roleName ?? '').trim().toLowerCase();
  const role = String(raw?.role ?? '').trim().toLowerCase();
  return roleName === 'agent' || role === 'agent';
}

function normalizeUser(raw: any, stored?: User | null): User {
  const permissions = Array.isArray(raw?.permissions)
    ? raw.permissions
    : stored?.permissions ?? [];
  const dealer = isDealerPayload(raw) || isDealerPayload(stored);
  const agent = isAgentPayload(raw) || isAgentPayload(stored);
  const role: User['role'] = agent
    ? 'agent'
    : dealer
      ? 'dealer'
      : raw?.role === 'customer' || raw?.role === 'admin'
        ? raw.role
        : stored?.role ?? 'admin';

  return {
    id: String(raw?.id ?? stored?.id ?? ''),
    phone: String(raw?.phone ?? raw?.mobile ?? stored?.phone ?? ''),
    email: raw?.email ?? stored?.email,
    role,
    roleId: raw?.roleId ?? stored?.roleId ?? null,
    roleName:
      raw?.roleName ??
      stored?.roleName ??
      (agent ? 'Agent' : dealer ? 'Dealer' : null),
    permissions,
    mustChangePassword: Boolean(
      raw?.mustChangePassword ?? raw?.mustChangePassword ?? stored?.mustChangePassword,
    ),
    dealerId: raw?.dealerId != null ? String(raw.dealerId) : stored?.dealerId,
    agentId: raw?.agentId != null ? String(raw.agentId) : stored?.agentId,
    created_at: String(
      raw?.created_at ?? raw?.createdAt ?? stored?.created_at ?? new Date().toISOString(),
    ),
    updated_at: String(
      raw?.updated_at ?? raw?.updatedAt ?? stored?.updated_at ?? new Date().toISOString(),
    ),
  };
}

export const logout = async (): Promise<void> => {
  await clearAuth();
};

export const storeToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
};

export const storeRefreshToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, token);
};

export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(API_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
};

export const storeUser = async (user: User): Promise<void> => {
  await AsyncStorage.setItem(API_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
};

export const getStoredUser = async (): Promise<User | null> => {
  const userData = await AsyncStorage.getItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
  return userData ? JSON.parse(userData) : null;
};

export const persistSession = async (
  accessToken: string,
  user: User,
  refreshToken?: string,
): Promise<void> => {
  await storeToken(accessToken);
  await storeUser(user);
  if (refreshToken) {
    await storeRefreshToken(refreshToken);
  } else {
    await AsyncStorage.removeItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
  }
};

export const clearAuth = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    API_CONFIG.STORAGE_KEYS.AUTH_TOKEN,
    API_CONFIG.STORAGE_KEYS.USER_DATA,
    API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
  ]);
};

export const getMe = async (): Promise<User> => {
  const response = await api.get('/auth/me');
  const data = response.data?.data;
  const raw = data?.user ?? data ?? {};
  const stored = await getStoredUser();
  return normalizeUser(raw, stored);
};

export const loginAsAdmin = async (emailOrPhone: string, password: string): Promise<User> => {
  const response = await api.post('/auth/admin-login', { email: emailOrPhone, password });
  const { token, user } = response.data.data;
  const normalized = normalizeUser(user);

  if (normalized.role !== 'admin') {
    throw new Error('Access Denied: Only admin users can log in to this app.');
  }

  await persistSession(token, normalized);
  return normalized;
};

export const loginAsDealer = async (identifier: string, password: string): Promise<User> => {
  const response = await api.post('/auth/dealer-login', { identifier, password });
  const payload = response.data?.data ?? {};
  const accessToken = payload.accessToken ?? payload.token;
  if (!accessToken) {
    throw new Error('Dealer login did not return an access token.');
  }
  const normalized = normalizeUser(payload.user ?? {});
  if (normalized.role !== 'dealer') {
    throw new Error('Access Denied: This login is for dealer accounts only.');
  }
  await persistSession(accessToken, normalized, payload.refreshToken);
  return normalized;
};

export const loginAsAgent = async (identifier: string, password: string): Promise<User> => {
  const response = await api.post('/auth/agent-login', { identifier, password });
  const payload = response.data?.data ?? {};
  const accessToken = payload.accessToken ?? payload.token;
  if (!accessToken) {
    throw new Error('Agent login did not return an access token.');
  }
  const normalized = normalizeUser(payload.user ?? {});
  if (normalized.role !== 'agent') {
    throw new Error('Access Denied: This login is for agent accounts only.');
  }
  await persistSession(accessToken, normalized, payload.refreshToken);
  return normalized;
};

/**
 * Unified staff/dealer/agent login for the existing admin-app.
 * Admin/Employee use admin-login; Dealer then Agent fall back on 403.
 */
export const loginAsStaff = async (identifier: string, password: string): Promise<User> => {
  try {
    return await loginAsAdmin(identifier, password);
  } catch (err: any) {
    if (err?.status !== 403) throw err;
    try {
      return await loginAsDealer(identifier, password);
    } catch (dealerErr: any) {
      if (dealerErr?.status === 403 || dealerErr?.status === 401) {
        return await loginAsAgent(identifier, password);
      }
      throw dealerErr;
    }
  }
};
