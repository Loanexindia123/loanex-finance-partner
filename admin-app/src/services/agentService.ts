import api from './api';
import type { Agent, AgentPayload } from '../types/agent';

function pick(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function pickList(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeAgent(raw: unknown): Agent {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const status = pick(row, 'status') === 'active' ? 'active' : 'inactive';
  return {
    id: pick(row, 'id'),
    agentId: pick(row, 'agentId'),
    agentIdIssued: row['agentIdIssued'] === true,
    creatorType: pick(row, 'creatorType'),
    creatorId: pick(row, 'creatorId'),
    creatorName: pick(row, 'creatorName'),
    fullName: pick(row, 'fullName'),
    fatherHusbandName: pick(row, 'fatherHusbandName'),
    dateOfBirth: pick(row, 'dateOfBirth'),
    mobile: pick(row, 'mobile'),
    whatsapp: pick(row, 'whatsapp'),
    email: pick(row, 'email'),
    gender: pick(row, 'gender'),
    education: pick(row, 'education'),
    occupation: pick(row, 'occupation'),
    currentAddress: pick(row, 'currentAddress'),
    city: pick(row, 'city'),
    state: pick(row, 'state'),
    pincode: pick(row, 'pincode'),
    googleLocation: pick(row, 'googleLocation'),
    preferredWorkArea: pick(row, 'preferredWorkArea'),
    workMode: pick(row, 'workMode'),
    emergencyContactName: pick(row, 'emergencyContactName'),
    emergencyContactMobile: pick(row, 'emergencyContactMobile'),
    profilePhoto: pick(row, 'profilePhoto'),
    aadhaarFront: pick(row, 'aadhaarFront'),
    aadhaarBack: pick(row, 'aadhaarBack'),
    aadhaarNumber: pick(row, 'aadhaarNumber'),
    panCard: pick(row, 'panCard'),
    panNumber: pick(row, 'panNumber'),
    addressProof: pick(row, 'addressProof'),
    cancelledCheque: pick(row, 'cancelledCheque'),
    signature: pick(row, 'signature'),
    agentType: pick(row, 'agentType'),
    preferredDepartments: pickList(row, 'preferredDepartments'),
    allowedWork: pickList(row, 'allowedWork'),
    assignedManager: pick(row, 'assignedManager'),
    assignedManagerId: pick(row, 'assignedManagerId'),
    branch: pick(row, 'branch'),
    branchId: pick(row, 'branchId'),
    trainingStatus: pick(row, 'trainingStatus') || 'Pending',
    accountNumber: pick(row, 'accountNumber'),
    ifscCode: pick(row, 'ifscCode'),
    policyAccepted: row['policyAccepted'] === true || row['policyAccepted'] === 'true',
    status,
    formStatus: pick(row, 'formStatus') || undefined,
    dealerId: pick(row, 'dealerId') || undefined,
    createdAt: pick(row, 'createdAt') || undefined,
    updatedAt: pick(row, 'updatedAt') || undefined,
  };
}

function unwrapList(raw: unknown): Agent[] {
  if (Array.isArray(raw)) return raw.map(normalizeAgent);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeAgent);
  }
  return [];
}

/** GET /admin/freelancer-agents — dealer-scoped on backend. */
export async function listAgents(): Promise<Agent[]> {
  const response = await api.get('/admin/freelancer-agents');
  return unwrapList(response.data?.data);
}

/** GET /admin/freelancer-agents/:id */
export async function getAgentById(id: string): Promise<Agent> {
  const response = await api.get(`/admin/freelancer-agents/${id}`);
  return normalizeAgent(response.data?.data);
}

/** POST /admin/freelancer-agents */
export async function createAgent(payload: AgentPayload): Promise<Agent> {
  const response = await api.post('/admin/freelancer-agents', payload);
  return normalizeAgent(response.data?.data);
}

/** PUT /admin/freelancer-agents/:id */
export async function updateAgent(id: string, payload: AgentPayload): Promise<Agent> {
  const response = await api.put(`/admin/freelancer-agents/${id}`, payload);
  return normalizeAgent(response.data?.data);
}

/** DELETE /admin/freelancer-agents/:id */
export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/admin/freelancer-agents/${id}`);
}
