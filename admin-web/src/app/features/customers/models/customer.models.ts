/** GET /admin/users record (role: 'admin' | 'customer'). See admin.controller.ts serializeUser(). */
export interface AdminUserRecord {
  id: string;
  phone: string;
  email: string;
  role: 'admin' | 'customer';
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  status: string;
  blocked: boolean;
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    mobile_number: string;
    fullName: string;
    email: string;
    dob: string;
    gender: string;
    kyc_status: 'Pending' | 'Approved' | 'Rejected' | string;
    branches?: string[];
    pincodes?: string[];
    createdAt: string;
    updatedAt: string;
  } | null;
}

/**
 * GET /admin/kyc row — backend never validates this collection on write,
 * treat every field as best-effort (per project audit).
 */
export interface KycRecord {
  id: string;
  userId: string;
  aadharVerified?: boolean;
  aadhar_number?: string;
  fullName?: string;
  dob?: string;
  gender?: string;
  address?: { country?: string; dist?: string; state?: string };
  pan_verified?: boolean;
  panNumber?: string;
  cibil_score?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer extends AdminUserRecord {
  kyc: KycRecord | null;
}
