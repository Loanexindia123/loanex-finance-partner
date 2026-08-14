import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '../constants/config';

const ACCESS_TOKEN_KEY = '@loanex_access_token';
export const REFRESH_TOKEN_KEY = '@loanex_refresh_token';

async function getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Exchange the stored refresh token for a fresh access-token pair.
 * Single-flight: concurrent 401s share one refresh call.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return false;
        const res = await fetch(`${SERVER_URL}/api/v1/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const json = await res.json();
        if (!json.success || !json.data?.accessToken) return false;
        await AsyncStorage.setItem(ACCESS_TOKEN_KEY, json.data.accessToken);
        if (json.data.refreshToken) {
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, json.data.refreshToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request(method: string, endpoint: string, body?: any) {
  const doFetch = (headers: Record<string, string>) =>
    fetch(`${SERVER_URL}/api/v1${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(await getHeaders());

  // Access token expired (15m TTL) — refresh silently and retry once.
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await doFetch(await getHeaders());
    }
  }

  const json = await res.json();
  if (!json.success) {
    const err: Error & { status?: number; code?: string; details?: unknown } = new Error(
      json.message || `Request failed (${res.status})`,
    );
    err.status = res.status;
    if (res.status === 401) err.code = 'SESSION_EXPIRED';
    else if (json.code) err.code = String(json.code);
    if (json.details !== undefined) err.details = json.details;
    throw err;
  }
  return json;
}

export const api = {
  get: (endpoint: string) => request('GET', endpoint),
  post: (endpoint: string, body: any) => request('POST', endpoint, body),
  put: (endpoint: string, body: any) => request('PUT', endpoint, body),
  patch: (endpoint: string, body?: any) => request('PATCH', endpoint, body),
  delete: (endpoint: string) => request('DELETE', endpoint),
};
