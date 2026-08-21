import api from './api';
import type { AppEmployee, EmployeePayload } from '../types/employee';

function pick(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function normalizeEmployee(raw: unknown): AppEmployee {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: pick(row, 'id'),
    employeeId: pick(row, 'employeeId'),
    fullName: pick(row, 'fullName'),
    fatherHusbandName: pick(row, 'fatherHusbandName'),
    dateOfBirth: pick(row, 'dateOfBirth'),
    mobile: pick(row, 'mobile'),
    whatsapp: pick(row, 'whatsapp'),
    email: pick(row, 'email'),
    gender: pick(row, 'gender'),
    department: pick(row, 'department'),
    designation: pick(row, 'designation'),
    employmentType: pick(row, 'employmentType'),
    dateOfJoining: pick(row, 'dateOfJoining'),
    branch: pick(row, 'branch'),
    workMode: pick(row, 'workMode'),
    reportingPerson: pick(row, 'reportingPerson'),
    shift: pick(row, 'shift'),
    monthlyCtc: pick(row, 'monthlyCtc'),
    basicSalary: pick(row, 'basicSalary'),
    salaryEffectiveFrom: pick(row, 'salaryEffectiveFrom'),
    profilePhoto: pick(row, 'profilePhoto'),
    aadhaarCard: pick(row, 'aadhaarCard'),
    panCard: pick(row, 'panCard'),
    addressProof: pick(row, 'addressProof'),
    cancelledCheque: pick(row, 'cancelledCheque'),
    signature: pick(row, 'signature'),
    accountHolderName: pick(row, 'accountHolderName'),
    accountNumber: pick(row, 'accountNumber'),
    ifscCode: pick(row, 'ifscCode'),
    onboardedBy: pick(row, 'onboardedBy'),
    onboardedById: pick(row, 'onboardedById'),
    userId: pick(row, 'userId'),
    formStatus: pick(row, 'formStatus') || 'draft',
    verificationStatus: pick(row, 'verificationStatus') || 'pending',
    status: pick(row, 'status') || 'active',
    createdAt: pick(row, 'createdAt') || undefined,
    updatedAt: pick(row, 'updatedAt') || undefined,
  };
}

function unwrapList(raw: unknown): AppEmployee[] {
  if (Array.isArray(raw)) return raw.map(normalizeEmployee);
  if (raw && typeof raw === 'object') {
    const items = (raw as Record<string, unknown>)['items'];
    if (Array.isArray(items)) return items.map(normalizeEmployee);
  }
  return [];
}

export async function listEmployees(): Promise<AppEmployee[]> {
  const response = await api.get('/admin/employees');
  return unwrapList(response.data?.data);
}

export async function getEmployeeById(id: string): Promise<AppEmployee> {
  const response = await api.get(`/admin/employees/${id}`);
  return normalizeEmployee(response.data?.data);
}

export async function createEmployee(payload: EmployeePayload): Promise<AppEmployee> {
  const response = await api.post('/admin/employees', payload);
  return normalizeEmployee(response.data?.data);
}

export async function updateEmployee(id: string, payload: EmployeePayload): Promise<AppEmployee> {
  const response = await api.put(`/admin/employees/${id}`, payload);
  return normalizeEmployee(response.data?.data);
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/admin/employees/${id}`);
}
