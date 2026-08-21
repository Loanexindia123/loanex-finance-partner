import { ForbiddenError } from '../../../common/errors/app-error';
import {
  collectDescendantEmployees,
  resolveLinkedUserIds,
  resolveViewerIdentity,
  type ViewerIdentity,
} from '../../admin/employee/employee-hierarchy';
import type { EmployeeRecord } from '../../admin/employee/employee.service';
import {
  collectDealerAgentUserIds,
  resolveFieldActor,
} from '../../admin/hierarchy/field-actor';

function str(value: unknown): string {
  return String(value ?? '').trim();
}

export interface ProductCreatorScope {
  orgWide: boolean;
  /** Creator ids the actor may access (self + descendant user/employee ids). */
  allowedCreatorIds: Set<string>;
  /** Optional dealer profile id — products stamped with this dealerId are visible to the dealer. */
  dealerId?: string;
  /** When true, dealerId match alone is enough (Dealer actor). Agents require creatorId match. */
  allowDealerIdMatch?: boolean;
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
 * Resolve product creator scope for an authenticated staff/field user.
 * Dealers see own + child-agent products; Agents see only self-created.
 */
export async function resolveProductCreatorScope(
  actorUserId: string,
  loadEmployees: () => Promise<EmployeeRecord[]>,
): Promise<ProductCreatorScope> {
  const field = await resolveFieldActor(actorUserId);
  if (field?.kind === 'agent') {
    return {
      orgWide: false,
      allowedCreatorIds: new Set([field.userId].filter(Boolean)),
      dealerId: field.dealerId || undefined,
      allowDealerIdMatch: false,
    };
  }
  if (field?.kind === 'dealer') {
    const ids = new Set<string>([field.userId].filter(Boolean));
    for (const uid of collectDealerAgentUserIds(field.dealerId)) {
      ids.add(uid);
    }
    return {
      orgWide: false,
      allowedCreatorIds: ids,
      dealerId: field.dealerId || undefined,
      allowDealerIdMatch: true,
    };
  }

  const all = await loadEmployees();
  const viewer = resolveViewerIdentity(str(actorUserId), all);
  return resolveProductCreatorScopeFromViewer(viewer, all);
}

/**
 * Hierarchy visibility for a product creator.
 * Legacy products with no creatorId: Super Admin (orgWide) only.
 * Dealer tree: also match product.dealerId when stamped.
 */
export function canAccessProductByCreator(
  product: { creatorId?: string | null; dealerId?: string | null },
  scope: ProductCreatorScope,
): boolean {
  if (scope.orgWide) return true;
  const owner = str(product.creatorId);
  if (owner && scope.allowedCreatorIds.has(owner)) return true;
  if (scope.allowDealerIdMatch && scope.dealerId) {
    const productDealerId = str(product.dealerId);
    if (productDealerId && productDealerId === scope.dealerId) return true;
  }
  if (!owner) return false;
  return false;
}

export function assertCanAccessProductByCreator(
  product: { creatorId?: string | null; dealerId?: string | null },
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
  delete data.agentId;
}
