import api from './api';

export interface AppDealer {
  id: string;
  dealerCode: string;
  dealerName: string;
  ownerName: string;
  mobile: string;
  email: string;
  formStatus: string;
  verificationStatus: string;
  status: string;
  creatorId?: string;
  dealerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DealerPayload {
  dealerCode: string;
  dealerName: string;
  ownerName?: string;
  mobile?: string;
  email?: string;
  shopAddress?: string;
  pincode?: string;
  formStatus?: 'draft' | 'pending' | 'approved' | 'rejected' | 'hold';
  businessType?: string;
  dealerType?: string;
}

function pick(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function normalizeDealer(raw: unknown): AppDealer {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: pick(row, 'id'),
    dealerCode: pick(row, 'dealerCode'),
    dealerName: pick(row, 'dealerName') || pick(row, 'name'),
    ownerName: pick(row, 'ownerName'),
    mobile: pick(row, 'mobile') || pick(row, 'dealerMobile'),
    email: pick(row, 'email'),
    formStatus: pick(row, 'formStatus') || 'draft',
    verificationStatus: pick(row, 'verificationStatus') || 'pending',
    status: pick(row, 'status') || 'active',
    creatorId: pick(row, 'creatorId') || undefined,
    dealerId: pick(row, 'dealerId') || undefined,
    createdAt: pick(row, 'createdAt') || undefined,
    updatedAt: pick(row, 'updatedAt') || undefined,
  };
}

function unwrapList(raw: unknown): AppDealer[] {
  if (Array.isArray(raw)) return raw.map(normalizeDealer);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeDealer);
  }
  return [];
}

export async function listDealers(): Promise<AppDealer[]> {
  const response = await api.get('/admin/dealers');
  return unwrapList(response.data?.data);
}

export async function getDealerById(id: string): Promise<AppDealer> {
  const response = await api.get(`/admin/dealers/${id}`);
  return normalizeDealer(response.data?.data);
}

export async function createDealer(payload: DealerPayload): Promise<AppDealer> {
  const response = await api.post('/admin/dealers', payload);
  return normalizeDealer(response.data?.data);
}

export async function updateDealer(id: string, payload: DealerPayload): Promise<AppDealer> {
  const response = await api.put(`/admin/dealers/${id}`, payload);
  return normalizeDealer(response.data?.data);
}
