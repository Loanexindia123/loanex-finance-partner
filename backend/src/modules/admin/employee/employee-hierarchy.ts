import { jsonDb } from '../../../config/json-db';
import type { EmployeeRecord } from './employee.service';

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function normEmail(value: unknown): string {
  return str(value).toLowerCase();
}

function normMobile(value: unknown): string {
  return str(value).replace(/\D/g, '');
}

export interface ViewerIdentity {
  userId: string;
  displayName: string;
  email: string;
  mobile: string;
  orgWide: boolean;
  /** Employee record ids that belong to this viewer (own records). */
  ownEmployeeIds: string[];
  /** Stable ids that may appear as onboardedById for this viewer as parent. */
  parentKeys: string[];
}

/**
 * Super Admin (and legacy admin with no role_id) keep organization-wide
 * employee visibility. Custom roles with users.* follow the descendant chain.
 */
export function hasOrgWideEmployeeAccess(userId: string): boolean {
  const user = jsonDb.findOne('users', { id: userId });
  if (!user) return false;

  const roleId = user.role_id ?? user.roleId ?? null;
  if (roleId) {
    const role = jsonDb.findOne('roles', { id: roleId });
    if (role && String(role.name ?? '').trim().toLowerCase() === 'super admin') {
      return true;
    }
    return false;
  }

  // Legacy admin without role_id keeps full Super Admin access.
  return String(user.role ?? '') === 'admin';
}

export function loadUserContact(userId: string): { // CHANGED: added `export`
  user: any | null;
  email: string;
  mobile: string;
  displayName: string;
} {
  const user = jsonDb.findOne('users', { id: userId }) ?? null;
  const profile = jsonDb.findOne('profiles', { id: userId }) as any;
  const email = normEmail(profile?.email || user?.email);
  const mobile = normMobile(
    profile?.mobile_number ?? profile?.mobileNumber ?? user?.phone ?? user?.mobile,
  );
  const displayName =
    str(profile?.fullName) ||
    str(profile?.name) ||
    email ||
    mobile ||
    str(user?.email) ||
    str(user?.phone) ||
    userId;
  return { user, email, mobile, displayName };
}

/** Match employee master rows that represent the authenticated user. */
export function findOwnEmployeeRecords(
  all: EmployeeRecord[],
  userId: string,
  email: string,
  mobile: string,
): EmployeeRecord[] {
  return all.filter((emp) => {
    if (emp.id === userId) return true;
    const empEmail = normEmail(emp.email);
    const empMobile = normMobile(emp.mobile);
    if (email && empEmail && empEmail === email) return true;
    if (mobile && empMobile && empMobile === mobile) return true;
    return false;
  });
}

/**
 * Resolve linked auth user ids for employee rows (email/mobile match).
 * Used so descendant walks work when children were onboarded with a user id.
 */
export function resolveLinkedUserIds(employees: EmployeeRecord[]): Map<string, string> {
  const users = jsonDb.findMany('users', {}) as any[];
  const profiles = jsonDb.findMany('profiles', {}) as any[];
  const profileById = new Map(profiles.map((p) => [str(p.id), p]));

  const byEmail = new Map<string, string>();
  const byMobile = new Map<string, string>();
  for (const user of users) {
    const id = str(user.id);
    if (!id) continue;
    // Only staff/admin accounts can sit in the onboarding chain as parents.
    if (String(user.role ?? '') === 'customer') continue;
    const profile = profileById.get(id);
    const email = normEmail(profile?.email || user.email);
    const mobile = normMobile(
      profile?.mobile_number ?? profile?.mobileNumber ?? user.phone ?? user.mobile,
    );
    if (email) byEmail.set(email, id);
    if (mobile) byMobile.set(mobile, id);
  }

  const linked = new Map<string, string>();
  for (const emp of employees) {
    const email = normEmail(emp.email);
    const mobile = normMobile(emp.mobile);
    const userId = (email && byEmail.get(email)) || (mobile && byMobile.get(mobile)) || '';
    if (userId) linked.set(emp.id, userId);
  }
  return linked;
}

export function resolveViewerIdentity(userId: string, all: EmployeeRecord[]): ViewerIdentity {
  const trimmed = str(userId);
  const { email, mobile, displayName } = loadUserContact(trimmed);
  const orgWide = hasOrgWideEmployeeAccess(trimmed);
  const own = findOwnEmployeeRecords(all, trimmed, email, mobile);
  const ownEmployeeIds = own.map((e) => e.id).filter(Boolean);
  const parentKeys = Array.from(new Set([trimmed, ...ownEmployeeIds].filter(Boolean)));
  return {
    userId: trimmed,
    displayName,
    email,
    mobile,
    orgWide,
    ownEmployeeIds,
    parentKeys,
  };
}

/**
 * Recursively collect descendants whose onboardedById points at an anchor
 * (viewer user id, own employee ids, or deeper child ids / linked user ids).
 */
export function collectDescendantEmployees(
  all: EmployeeRecord[],
  rootParentKeys: string[],
): EmployeeRecord[] {
  const linkedUserIds = resolveLinkedUserIds(all);
  const byParent = new Map<string, EmployeeRecord[]>();
  for (const emp of all) {
    const parent = str(emp.onboardedById);
    if (!parent) continue;
    const list = byParent.get(parent) ?? [];
    list.push(emp);
    byParent.set(parent, list);
  }

  const found = new Map<string, EmployeeRecord>();
  const frontier = new Set(rootParentKeys.map(str).filter(Boolean));
  const seenKeys = new Set<string>();

  while (frontier.size > 0) {
    const current = [...frontier];
    frontier.clear();
    for (const key of current) {
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      const children = byParent.get(key) ?? [];
      for (const child of children) {
        if (!child.id || found.has(child.id)) continue;
        found.set(child.id, child);
        frontier.add(child.id);
        const linked = linkedUserIds.get(child.id);
        if (linked) frontier.add(linked);
      }
    }
  }

  return [...found.values()];
}

/** Visible records: own + descendants (or all when org-wide). */
export function filterVisibleEmployees(
  all: EmployeeRecord[],
  viewer: ViewerIdentity,
): EmployeeRecord[] {
  if (viewer.orgWide) return all;

  const own = all.filter((e) => viewer.ownEmployeeIds.includes(e.id));
  const descendants = collectDescendantEmployees(all, viewer.parentKeys);
  const visible = new Map<string, EmployeeRecord>();
  for (const emp of own) visible.set(emp.id, emp);
  for (const emp of descendants) visible.set(emp.id, emp);
  return [...visible.values()];
}

export function canViewEmployee(
  all: EmployeeRecord[],
  viewer: ViewerIdentity,
  employeeId: string,
): boolean {
  if (viewer.orgWide) return true;
  return filterVisibleEmployees(all, viewer).some((e) => e.id === employeeId);
}

export interface OnboarderOption {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  mobile: string;
  designation: string;
  department: string;
  isCurrentUser: boolean;
}

/**
 * People who may appear in the Onboarded By picker.
 * Sourced from Employee Master (+ current user if they have no employee row),
 * scoped by onboarding hierarchy. Never includes customer accounts.
 */
export function listOnboarderOptions(
  all: EmployeeRecord[],
  viewer: ViewerIdentity,
): OnboarderOption[] {
  const visible = filterVisibleEmployees(all, viewer);
  const options: OnboarderOption[] = [];
  const seen = new Set<string>();

  const push = (opt: OnboarderOption) => {
    if (!opt.id || seen.has(opt.id)) return;
    seen.add(opt.id);
    options.push(opt);
  };

  // Current user always available as default creator.
  const ownRecords = all.filter((e) => viewer.ownEmployeeIds.includes(e.id));
  if (ownRecords.length) {
    for (const emp of ownRecords) {
      push({
        id: emp.id,
        name: emp.fullName || viewer.displayName,
        employeeId: emp.employeeId,
        email: emp.email,
        mobile: emp.mobile,
        designation: emp.designation,
        department: emp.department,
        isCurrentUser: true,
      });
    }
  } else {
    push({
      id: viewer.userId,
      name: viewer.displayName,
      employeeId: '',
      email: viewer.email,
      mobile: viewer.mobile,
      designation: '',
      department: '',
      isCurrentUser: true,
    });
  }

  const pool = viewer.orgWide ? all : visible;
  for (const emp of pool) {
    if (viewer.ownEmployeeIds.includes(emp.id)) continue;
    push({
      id: emp.id,
      name: emp.fullName || emp.employeeId || emp.id,
      employeeId: emp.employeeId,
      email: emp.email,
      mobile: emp.mobile,
      designation: emp.designation,
      department: emp.department,
      isCurrentUser: false,
    });
  }

  return options.sort((a, b) => {
    if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Resolve onboardedBy / onboardedById for create.
 * Defaults to the current viewer; only allows picker values from the allowed set.
 */
export function resolveCreateOnboardedBy(
  viewer: ViewerIdentity,
  all: EmployeeRecord[],
  requestedId: string,
  requestedName: string,
): { onboardedById: string; onboardedBy: string } {
  const onboarders = listOnboarderOptions(all, viewer);
  const requested = str(requestedId);
  const match = requested ? onboarders.find((o) => o.id === requested) : undefined;
  if (match) {
    return { onboardedById: match.id, onboardedBy: match.name || requestedName || match.id };
  }

  const self = onboarders.find((o) => o.isCurrentUser) ?? onboarders[0];
  if (self) {
    return { onboardedById: self.id, onboardedBy: self.name || viewer.displayName };
  }

  return {
    onboardedById: viewer.userId,
    onboardedBy: viewer.displayName || requestedName,
  };
}
