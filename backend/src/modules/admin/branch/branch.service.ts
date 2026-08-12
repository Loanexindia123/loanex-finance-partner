import { randomUUID } from 'node:crypto';
import { jsonDb } from '../../../config/json-db';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../../common/errors/app-error';
import type { CreateBranchBody, UpdateBranchBody } from './branch.validator';

const COLLECTION = 'branches';

/** Public Branch shape — matches admin-app BranchMaster (no extra fields). */
export interface BranchRecord {
  id: string;
  name: string;
  branchCode: string;
  city: string;
  state: string;
  branchManager: string;
  mobile: string;
  status: 'active' | 'inactive';
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function toPublicBranch(row: any): BranchRecord {
  const status = row?.status === 'inactive' ? 'inactive' : 'active';
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    branchCode: String(row.branchCode ?? ''),
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    branchManager: String(row.branchManager ?? ''),
    mobile: String(row.mobile ?? ''),
    status,
  };
}

async function ensureReady(): Promise<void> {
  await jsonDb.ensureCollection(COLLECTION);
  await jsonDb.ensureCollection('pincodes');
  await jsonDb.ensureCollection('profiles');
}

function findDuplicate(
  name: string,
  branchCode: string,
  excludeId?: string,
): 'name' | 'branchCode' | null {
  const nameKey = normalizeKey(name);
  const codeKey = normalizeKey(branchCode);
  const items = jsonDb.findMany(COLLECTION, {}) as any[];

  for (const item of items) {
    if (excludeId && String(item.id) === excludeId) continue;
    if (normalizeKey(String(item.name ?? '')) === nameKey) return 'name';
    if (normalizeKey(String(item.branchCode ?? '')) === codeKey) return 'branchCode';
  }
  return null;
}

function assertUnique(name: string, branchCode: string, excludeId?: string): void {
  const dup = findDuplicate(name, branchCode, excludeId);
  if (dup === 'name') {
    throw new ConflictError('Branch Name already exists');
  }
  if (dup === 'branchCode') {
    throw new ConflictError('Branch Code already exists');
  }
}

/** References that would break if the branch were hard-deleted. */
function collectDeleteBlockers(branch: BranchRecord): string[] {
  const blockers: string[] = [];
  const name = branch.name;

  const pincodes = (jsonDb.findMany('pincodes', {}) as any[]).filter(
    (p) => String(p.branchName ?? '') === name,
  );
  if (pincodes.length > 0) {
    blockers.push(`${pincodes.length} pincode(s)`);
  }

  const profiles = (jsonDb.findMany('profiles', {}) as any[]).filter((p) => {
    const list = Array.isArray(p.branches) ? p.branches : [];
    return list.some((b: unknown) => String(b) === name);
  });
  if (profiles.length > 0) {
    blockers.push(`${profiles.length} user profile(s)`);
  }

  return blockers;
}

export class BranchService {
  async list(): Promise<BranchRecord[]> {
    await ensureReady();
    return (jsonDb.findMany(COLLECTION, {}) as any[]).map(toPublicBranch);
  }

  async getById(id: string): Promise<BranchRecord> {
    await ensureReady();
    const trimmed = String(id ?? '').trim();
    if (!trimmed) {
      throw new BadRequestError('Branch id is required');
    }
    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }
    return toPublicBranch(existing);
  }

  async create(body: CreateBranchBody): Promise<BranchRecord> {
    await ensureReady();
    assertUnique(body.name, body.branchCode);

    const payload = {
      id: body.id?.trim() || randomUUID(),
      name: body.name.trim(),
      branchCode: body.branchCode.trim(),
      city: body.city.trim(),
      state: body.state.trim(),
      branchManager: body.branchManager.trim(),
      mobile: body.mobile.trim(),
      status: (body.status ?? 'active') as 'active' | 'inactive',
    };

    // Guard against colliding with an existing id when client supplies one.
    if (jsonDb.findOne(COLLECTION, { id: payload.id })) {
      throw new ConflictError('Branch id already exists');
    }

    const created = jsonDb.insert(COLLECTION, payload);
    return toPublicBranch(created);
  }

  async update(id: string, body: UpdateBranchBody): Promise<BranchRecord> {
    await ensureReady();
    const trimmed = String(id ?? '').trim();
    if (!trimmed) {
      throw new BadRequestError('Branch id is required');
    }

    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }

    assertUnique(body.name, body.branchCode, trimmed);

    const updates = {
      name: body.name.trim(),
      branchCode: body.branchCode.trim(),
      city: body.city.trim(),
      state: body.state.trim(),
      branchManager: body.branchManager.trim(),
      mobile: body.mobile.trim(),
      status: (body.status ?? existing.status ?? 'active') as 'active' | 'inactive',
    };

    const updated = jsonDb.update(COLLECTION, { id: trimmed }, updates);
    if (!updated) {
      throw new NotFoundError('Branch not found');
    }
    return toPublicBranch(updated);
  }

  /**
   * Hard-delete when unreferenced.
   * Blocks with 409 when pincodes (branchName) or user profiles (branches[])
   * still reference this branch by name — same string keys admin-app uses.
   */
  async delete(id: string): Promise<{ deleted: true; id: string }> {
    await ensureReady();
    const trimmed = String(id ?? '').trim();
    if (!trimmed) {
      throw new BadRequestError('Branch id is required');
    }

    const existing = jsonDb.findOne(COLLECTION, { id: trimmed });
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }

    const branch = toPublicBranch(existing);
    const blockers = collectDeleteBlockers(branch);
    if (blockers.length > 0) {
      throw new ConflictError(
        `Cannot delete branch: still referenced by ${blockers.join(' and ')}`,
      );
    }

    jsonDb.delete(COLLECTION, { id: trimmed });
    return { deleted: true, id: trimmed };
  }
}

export const branchService = new BranchService();
