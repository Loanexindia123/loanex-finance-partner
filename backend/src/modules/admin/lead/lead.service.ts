import { randomUUID } from 'node:crypto';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/app-error';
import { jsonDb } from '../../../config/json-db';
import { hasOrgWideEmployeeAccess } from '../employee/employee-hierarchy';
import {
  isOwnedByAgentSelf,
  isOwnedByDealerTree,
  resolveFieldActor,
} from '../hierarchy/field-actor';
import type { CreateLeadBody, UpdateLeadBody } from './lead.validator';

const COLLECTION = 'leads';

export interface LeadRecord {
  id: string;
  customerName: string;
  customerMobile: string;
  interestedProduct: string;
  notes: string;
  status: string;
  creatorId: string;
  dealerId: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
}

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildRecord(row: any): LeadRecord {
  return {
    id: str(row.id),
    customerName: str(row.customerName),
    customerMobile: str(row.customerMobile).replace(/\D/g, ''),
    interestedProduct: str(row.interestedProduct),
    notes: str(row.notes),
    status: str(row.status) || 'New',
    creatorId: str(row.creatorId),
    dealerId: str(row.dealerId),
    agentId: str(row.agentId),
    createdAt: str(row.createdAt) || nowIso(),
    updatedAt: str(row.updatedAt) || str(row.createdAt) || nowIso(),
  };
}

async function ensureReady(): Promise<void> {
  await jsonDb.ensureCollection(COLLECTION);
}

function canAccessLead(lead: LeadRecord, actorUserId: string, field: Awaited<ReturnType<typeof resolveFieldActor>>): boolean {
  if (hasOrgWideEmployeeAccess(actorUserId)) return true;
  if (!field) {
    // Staff without org-wide: own creations only (employee behavior unchanged for other modules;
    // leads are primarily field-actor scoped, but staff creators can see their own).
    return lead.creatorId === str(actorUserId);
  }
  if (field.kind === 'dealer') {
    return isOwnedByDealerTree(lead, { dealerId: field.dealerId, userId: field.userId });
  }
  if (field.kind === 'agent') {
    return isOwnedByAgentSelf(lead, { userId: field.userId, agentId: field.agentId });
  }
  return false;
}

export class LeadService {
  async list(actorUserId: string): Promise<LeadRecord[]> {
    await ensureReady();
    const field = await resolveFieldActor(actorUserId);
    const all = (jsonDb.findMany(COLLECTION, {}) as any[]).map(buildRecord);
    const scoped = all.filter((lead) => canAccessLead(lead, actorUserId, field));
    return scoped.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async getById(id: string, actorUserId: string): Promise<LeadRecord> {
    await ensureReady();
    const trimmed = str(id);
    if (!trimmed) throw new BadRequestError('Lead id is required');
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) throw new NotFoundError('Lead not found');
    const record = buildRecord(existing);
    const field = await resolveFieldActor(actorUserId);
    if (!canAccessLead(record, actorUserId, field)) {
      throw new ForbiddenError('You do not have access to this lead');
    }
    return record;
  }

  async create(body: CreateLeadBody, actorUserId: string): Promise<LeadRecord> {
    await ensureReady();
    const field = await resolveFieldActor(actorUserId);
    if (!field || (field.kind !== 'dealer' && field.kind !== 'agent')) {
      if (!hasOrgWideEmployeeAccess(actorUserId) && !str(actorUserId)) {
        throw new ForbiddenError('Not authorized to create leads');
      }
    }

    const mobile = str(body.customerMobile).replace(/\D/g, '');
    if (mobile.length < 10) {
      throw new BadRequestError('Customer Mobile must be a valid phone number');
    }

    const now = nowIso();
    const dealerId =
      field?.kind === 'dealer' || field?.kind === 'agent'
        ? field.dealerId
        : '';
    const agentId = field?.kind === 'agent' ? field.agentId : '';

    const record: LeadRecord = {
      id: str(body.id) || randomUUID(),
      customerName: str(body.customerName),
      customerMobile: mobile,
      interestedProduct: str(body.interestedProduct),
      notes: str(body.notes),
      status: str(body.status) || 'New',
      creatorId: str(actorUserId),
      dealerId,
      agentId,
      createdAt: now,
      updatedAt: now,
    };

    if (jsonDb.findOne(COLLECTION, { id: record.id })) {
      throw new BadRequestError('Lead id already exists');
    }

    const created = jsonDb.insert(COLLECTION, record);
    return buildRecord(created);
  }

  async update(id: string, body: UpdateLeadBody, actorUserId: string): Promise<LeadRecord> {
    await ensureReady();
    const current = await this.getById(id, actorUserId);
    const field = await resolveFieldActor(actorUserId);

    // Agents and dealers may only edit own records (agents: self; dealers: tree-owned).
    if (field?.kind === 'agent' && !isOwnedByAgentSelf(current, field)) {
      throw new ForbiddenError('You can only edit your own leads');
    }

    const mobile =
      body.customerMobile != null
        ? str(body.customerMobile).replace(/\D/g, '')
        : current.customerMobile;
    if (mobile.length < 10) {
      throw new BadRequestError('Customer Mobile must be a valid phone number');
    }

    const updates = {
      customerName: body.customerName != null ? str(body.customerName) : current.customerName,
      customerMobile: mobile,
      interestedProduct:
        body.interestedProduct != null ? str(body.interestedProduct) : current.interestedProduct,
      notes: body.notes != null ? str(body.notes) : current.notes,
      status: body.status != null ? str(body.status) || 'New' : current.status,
      // Ownership immutable.
      creatorId: current.creatorId,
      dealerId: current.dealerId,
      agentId: current.agentId,
      updatedAt: nowIso(),
    };

    const updated = jsonDb.update(COLLECTION, { id: current.id }, updates);
    if (!updated) throw new NotFoundError('Lead not found');
    return buildRecord(updated);
  }

  async delete(id: string, actorUserId: string): Promise<{ deleted: true; id: string }> {
    await ensureReady();
    const current = await this.getById(id, actorUserId);
    // Protected: only org-wide (admin) may delete; field actors cannot.
    if (!hasOrgWideEmployeeAccess(actorUserId)) {
      throw new ForbiddenError('You cannot delete leads');
    }
    jsonDb.delete(COLLECTION, { id: current.id });
    return { deleted: true, id: current.id };
  }

  async countForActor(actorUserId: string): Promise<number> {
    const list = await this.list(actorUserId);
    return list.length;
  }
}

export const leadService = new LeadService();
