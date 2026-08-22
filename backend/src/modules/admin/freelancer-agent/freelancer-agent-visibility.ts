import {
  hasOrgWideEmployeeAccess,
  resolveViewerIdentity,
  type ViewerIdentity,
} from '../employee/employee-hierarchy';
import { loadEmployeeRecordsForHierarchy } from '../employee/employee.service';
import {
  findLinkedDealerByUserId,
  resolveIsDealerUserId,
} from '../dealer/dealer-account';
import {
  findLinkedAgentByUserId,
  resolveIsAgentUserId,
} from './agent-account';
import { jsonDb } from '../../../config/json-db';
import type { FreelancerAgentRecord } from './freelancer-agent.service';

function str(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Resolve the dealer profile id for a dealer auth user (never trust client dealerId).
 * Ensures the dealers collection is hydrated — cold cache after API restart was causing 403s.
 */
export async function resolveDealerIdForActor(actorUserId: string): Promise<string> {
  if (!(await resolveIsDealerUserId(actorUserId))) return '';
  await jsonDb.ensureCollection('dealers');
  let dealer = findLinkedDealerByUserId(actorUserId);
  if (!dealer?.id) {
    try {
      await jsonDb.refreshCollection('dealers', { force: true });
    } catch {
      /* keep local */
    }
    dealer = findLinkedDealerByUserId(actorUserId);
  }
  // Fallback: match dealer row by the auth user's email (legacy links)
  if (!dealer?.id) {
    const user = jsonDb.findOne('users', { id: actorUserId }) as any;
    const email = str(user?.email).toLowerCase();
    if (email) {
      const dealers = jsonDb.findMany('dealers', {}) as any[];
      dealer =
        dealers.find((row) => str(row.email).toLowerCase() === email) ??
        null;
    }
  }
  return str(dealer?.id);
}

/**
 * Resolve parent dealer id for an agent auth user (from linked agent profile).
 * Never trusts client dealerId.
 */
export async function resolveParentDealerIdForAgent(actorUserId: string): Promise<string> {
  if (!(await resolveIsAgentUserId(actorUserId))) return '';
  await jsonDb.ensureCollection('freelancer_agents');
  let agent = findLinkedAgentByUserId(actorUserId);
  if (!agent?.id) {
    try {
      await jsonDb.refreshCollection('freelancer_agents', { force: true });
    } catch {
      /* keep local */
    }
    agent = findLinkedAgentByUserId(actorUserId);
  }
  return str(agent?.dealerId);
}

export function isDealerOwnedAgent(
  record: Pick<FreelancerAgentRecord, 'dealerId' | 'createdById' | 'creatorId'>,
  dealerId: string,
  actorUserId: string,
): boolean {
  const did = str(dealerId);
  const actor = str(actorUserId);
  if (did && str(record.dealerId) === did) return true;
  // Own rows by creator / createdBy (works even when dealerId link is temporarily missing)
  if (actor && (str(record.createdById) === actor || str(record.creatorId) === actor)) {
    return true;
  }
  return false;
}

export function filterDealerAgents(
  all: FreelancerAgentRecord[],
  dealerId: string,
  actorUserId: string,
): FreelancerAgentRecord[] {
  return all.filter((row) => isDealerOwnedAgent(row, dealerId, actorUserId));
}

/** Agent sees only agents they created (plus self profile). */
export function isAgentOwnedAgent(
  record: Pick<FreelancerAgentRecord, 'id' | 'createdById' | 'creatorId' | 'userId'>,
  actorUserId: string,
  agentProfileId?: string,
): boolean {
  const actor = str(actorUserId);
  const selfId = str(agentProfileId);
  if (selfId && str(record.id) === selfId) return true;
  if (actor && str((record as any).userId) === actor) return true;
  if (actor && (str(record.createdById) === actor || str(record.creatorId) === actor)) {
    return true;
  }
  return false;
}

export function filterAgentCreatedAgents(
  all: FreelancerAgentRecord[],
  actorUserId: string,
  agentProfileId?: string,
): FreelancerAgentRecord[] {
  return all.filter((row) => isAgentOwnedAgent(row, actorUserId, agentProfileId));
}

export async function resolveFreelancerViewer(actorUserId: string): Promise<ViewerIdentity> {
  const employees = await loadEmployeeRecordsForHierarchy();
  return resolveViewerIdentity(str(actorUserId), employees);
}

export function isOrgWideFreelancerAccess(actorUserId: string): boolean {
  return hasOrgWideEmployeeAccess(str(actorUserId));
}

/**
 * Recursively collect agents referred by the viewer (creatorId chain).
 * Mirrors employee onboardedById downline without mixing the two collections.
 */
export function collectDescendantAgents(
  all: FreelancerAgentRecord[],
  rootParentKeys: string[],
): FreelancerAgentRecord[] {
  const byParent = new Map<string, FreelancerAgentRecord[]>();
  for (const row of all) {
    const parent = str(row.creatorId);
    if (!parent) continue;
    const list = byParent.get(parent) ?? [];
    list.push(row);
    byParent.set(parent, list);
  }

  const found = new Map<string, FreelancerAgentRecord>();
  const frontier = new Set(rootParentKeys.map(str).filter(Boolean));
  const seen = new Set<string>();

  while (frontier.size > 0) {
    const current = [...frontier];
    frontier.clear();
    for (const key of current) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const children = byParent.get(key) ?? [];
      for (const child of children) {
        if (!child.id || found.has(child.id)) continue;
        found.set(child.id, child);
        frontier.add(child.id);
        if (child.creatorId) frontier.add(child.creatorId);
      }
    }
  }

  return [...found.values()];
}

export function filterVisibleAgents(
  all: FreelancerAgentRecord[],
  viewer: ViewerIdentity,
): FreelancerAgentRecord[] {
  if (viewer.orgWide) return all;

  // Employee / non–org-wide staff: only agents they created (creatorId / createdById).
  const parentKeys = new Set(viewer.parentKeys);
  return all.filter(
    (row) =>
      parentKeys.has(row.createdById) ||
      parentKeys.has(row.creatorId) ||
      parentKeys.has(row.id),
  );
}

export function canViewAgent(
  all: FreelancerAgentRecord[],
  viewer: ViewerIdentity,
  id: string,
): boolean {
  if (viewer.orgWide) return true;
  return filterVisibleAgents(all, viewer).some((row) => row.id === id);
}
