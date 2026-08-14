/**
 * Normalized admin-user shape used throughout admin-web.
 * The backend returns two differently-shaped user objects depending on the
 * endpoint (POST /auth/admin-login vs GET /auth/me) — AuthService normalizes
 * both into this single interface before storing/exposing them.
 */
export interface AdminUser {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  /** When true, user must change the initial password before using the portal. */
  mustChangePassword: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Raw response body of POST /auth/admin-login (data field). */
export interface AdminLoginRawResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    email: string;
    role: 'admin';
    roleId: string | null;
    roleName: string | null;
    permissions: string[];
    mustChangePassword?: boolean;
    created_at: string;
    updated_at: string;
  };
  message?: string;
}

/** Raw response body of GET /auth/me (data field). */
export interface MeRawResponse {
  user: {
    id: string;
    uuid?: string;
    fullName: string;
    mobile: string;
    email: string;
    isMobileVerified?: boolean;
    isEmailVerified?: boolean;
    status: 'ACTIVE' | 'PENDING' | 'BLOCKED';
    roleId: string | null;
    roleName: string | null;
    permissions: string[];
    mustChangePassword?: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface AdminLoginCredentials {
  /** Accepts email OR mobile despite the field name — mirrors backend validator. */
  email: string;
  password: string;
}
