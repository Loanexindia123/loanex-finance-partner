import api from './api';

export interface Lead {
  id: string;
  customerName: string;
  customerMobile: string;
  interestedProduct: string;
  notes: string;
  status: string;
  creatorId?: string;
  dealerId?: string;
  agentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadPayload {
  customerName: string;
  customerMobile: string;
  interestedProduct?: string;
  notes?: string;
  status?: string;
}

function pick(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function normalizeLead(raw: unknown): Lead {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: pick(row, 'id'),
    customerName: pick(row, 'customerName'),
    customerMobile: pick(row, 'customerMobile'),
    interestedProduct: pick(row, 'interestedProduct'),
    notes: pick(row, 'notes'),
    status: pick(row, 'status') || 'New',
    creatorId: pick(row, 'creatorId') || undefined,
    dealerId: pick(row, 'dealerId') || undefined,
    agentId: pick(row, 'agentId') || undefined,
    createdAt: pick(row, 'createdAt') || undefined,
    updatedAt: pick(row, 'updatedAt') || undefined,
  };
}

function unwrapList(raw: unknown): Lead[] {
  if (Array.isArray(raw)) return raw.map(normalizeLead);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeLead);
  }
  return [];
}

export async function listLeads(): Promise<Lead[]> {
  const response = await api.get('/admin/leads');
  return unwrapList(response.data?.data);
}

export async function getLeadById(id: string): Promise<Lead> {
  const response = await api.get(`/admin/leads/${id}`);
  return normalizeLead(response.data?.data);
}

export async function createLead(payload: LeadPayload): Promise<Lead> {
  const response = await api.post('/admin/leads', payload);
  return normalizeLead(response.data?.data);
}

export async function updateLead(id: string, payload: LeadPayload): Promise<Lead> {
  const response = await api.put(`/admin/leads/${id}`, payload);
  return normalizeLead(response.data?.data);
}
