import {
  hasOrgWideEmployeeAccess,
  resolveViewerIdentity,
  type ViewerIdentity,
} from '../employee/employee-hierarchy';
import { loadEmployeeRecordsForHierarchy } from '../employee/employee.service';
import type { FreelancerAgentRecord } from './freelancer-agent.service';

function str(value: unknown): string {
  return String(value ?? '').trim();
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

  const parentKeys = new Set(viewer.parentKeys);
  const own = all.filter(
    (row) =>
      parentKeys.has(row.createdById) ||
      parentKeys.has(row.creatorId) ||
      parentKeys.has(row.id) ||
      parentKeys.has(row.assignedManagerId),
  );
  const descendants = collectDescendantAgents(all, [...parentKeys, ...own.map((row) => row.id)]);
  const visible = new Map<string, FreelancerAgentRecord>();
  for (const row of own) visible.set(row.id, row);
  for (const row of descendants) visible.set(row.id, row);
  return [...visible.values()];
}

export function canViewAgent(
  all: FreelancerAgentRecord[],
  viewer: ViewerIdentity,
  id: string,
): boolean {
  if (viewer.orgWide) return true;
  return filterVisibleAgents(all, viewer).some((row) => row.id === id);
}
