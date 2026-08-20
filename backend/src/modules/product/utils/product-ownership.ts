import { ForbiddenError } from '../../../common/errors/app-error';
import {
  collectDescendantEmployees,
  resolveLinkedUserIds,
  resolveViewerIdentity,
  type ViewerIdentity,
} from '../../admin/employee/employee-hierarchy';
import type { EmployeeRecord } from '../../admin/employee/employee.service';

function str(value: unknown): string {
  return String(value ?? '').trim();
}

export interface ProductCreatorScope {
  orgWide: boolean;
  /** Creator ids the actor may access (self + descendant user/employee ids). */
  allowedCreatorIds: Set<string>;
}

/**
 * Build the set of product creatorIds visible to a viewer.
 * Reuses collectDescendantEmployees — does not reimplement the tree walk.
 */
export function buildAllowedCreatorIds(
  viewer: ViewerIdentity,
  all: EmployeeRecord[],
  linkedUserIds?: Map<string, string>,
): Set<string> {
  const ids = new Set<string>();
  if (!viewer.userId) return ids;

  ids.add(viewer.userId);
  for (const ownId of viewer.ownEmployeeIds) {
    if (ownId) ids.add(ownId);
  }

  const linked = linkedUserIds ?? resolveLinkedUserIds(all);
  const descendants = collectDescendantEmployees(all, viewer.parentKeys);
  for (const emp of descendants) {
    if (emp.id) ids.add(emp.id);
    const linkedUserId = linked.get(emp.id);
    if (linkedUserId) ids.add(linkedUserId);
    const storedUserId = str(emp.userId);
    if (storedUserId) ids.add(storedUserId);
  }

  return ids;
}

export function resolveProductCreatorScopeFromViewer(
  viewer: ViewerIdentity,
  all: EmployeeRecord[],
): ProductCreatorScope {
  if (viewer.orgWide) {
    return { orgWide: true, allowedCreatorIds: new Set() };
  }
  return {
    orgWide: false,
    allowedCreatorIds: buildAllowedCreatorIds(viewer, all),
  };
}

/**
 * Resolve product creator scope for an authenticated staff user.
 * `loadEmployees` is injected so this module stays free of jsonDb side effects.
 */
export async function resolveProductCreatorScope(
  actorUserId: string,
  loadEmployees: () => Promise<EmployeeRecord[]>,
): Promise<ProductCreatorScope> {
  const all = await loadEmployees();
  const viewer = resolveViewerIdentity(str(actorUserId), all);
  return resolveProductCreatorScopeFromViewer(viewer, all);
}

/**
 * Hierarchy visibility for a product creator.
 * Legacy products with no creatorId: Super Admin (orgWide) only.
 */
export function canAccessProductByCreator(
  product: { creatorId?: string | null },
  scope: ProductCreatorScope,
): boolean {
  if (scope.orgWide) return true;
  const owner = str(product.creatorId);
  if (!owner) return false;
  return scope.allowedCreatorIds.has(owner);
}

export function assertCanAccessProductByCreator(
  product: { creatorId?: string | null },
  scope: ProductCreatorScope,
): void {
  if (!canAccessProductByCreator(product, scope)) {
    throw new ForbiddenError('You do not have access to this product');
  }
}

/** Strip client-supplied ownership fields — never trust the request body. */
export function stripClientOwnershipFields(data: Record<string, any>): void {
  delete data.creatorId;
  delete data.creatorName;
  delete data.createdById;
  delete data.createdBy;
  delete data.ownerId;
  delete data.userId;
  delete data.employeeId;
  delete data.dealerId;
}
