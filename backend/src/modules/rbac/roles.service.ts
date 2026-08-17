import { jsonDb } from '../../config/json-db';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/app-error';
import {
  rolePermissions,
  SUPER_ADMIN_PERMISSIONS,
  ALL_PERMISSIONS,
  effectivePermissionsForRole,
} from './permissions';
import { rolesRepository } from './roles.repository';

const KNOWN_PERMISSIONS = new Set<string>(ALL_PERMISSIONS);

export class RolesService {
  listRoles() {
    return rolesRepository.list();
  }

  getRole(id: string) {
    const role = rolesRepository.findById(id);
    if (!role) throw new NotFoundError('Role not found');
    return this.serialize(role);
  }

  async createRole(input: { name: string; description?: string; permissions?: string[] }) {
    const name = String(input.name ?? '').trim();
    if (!name) throw new BadRequestError('Role name is required');
    if (name.length > 60) throw new BadRequestError('Role name must be 60 characters or fewer');

    if (rolesRepository.findByName(name)) {
      throw new ConflictError(`A role named "${name}" already exists`);
    }

    const permissions = this.normalizePermissions(input.permissions);
    const role = await rolesRepository.create({
      name,
      description: String(input.description ?? '').trim(),
      permissions,
      isSystem: false,
    });
    return this.serialize(role);
  }

  async updateRole(id: string, input: { name?: string; description?: string; permissions?: string[] }) {
    const existing = rolesRepository.findById(id);
    if (!existing) throw new NotFoundError('Role not found');
    if (existing.is_system || existing.isSystem) {
      throw new ForbiddenError('The Super Admin role is protected and cannot be modified');
    }

    const patch: { name?: string; description?: string; permissions?: string[] } = {};
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (!name) throw new BadRequestError('Role name cannot be empty');
      const clash = rolesRepository.findByName(name);
      if (clash && clash.id !== id) {
        throw new ConflictError(`A role named "${name}" already exists`);
      }
      patch.name = name;
    }
    if (input.description !== undefined) {
      patch.description = String(input.description).trim();
    }
    if (input.permissions !== undefined) {
      patch.permissions = this.normalizePermissions(input.permissions);
    }

    const updated = await rolesRepository.update(id, patch);
    return this.serialize(updated ?? existing);
  }

  async deleteRole(id: string) {
    const existing = rolesRepository.findById(id);
    if (!existing) throw new NotFoundError('Role not found');
    if (existing.is_system || existing.isSystem) {
      throw new ForbiddenError('The Super Admin role is protected and cannot be deleted');
    }

    const assigned = rolesRepository.countUsersWithRole(id);
    if (assigned > 0) {
      throw new ConflictError(
        `Cannot delete this role — ${assigned} user${assigned === 1 ? ' is' : 's are'} assigned to it. Reassign those users first.`,
      );
    }

    await rolesRepository.remove(id);
    return { deleted: true, id };
  }

  /**
   * Resolve the effective permission list for a user:
   *  - role_id → role.permissions (role fetched from Supabase if not yet cached)
   *  - legacy role === 'admin' with NO role_id → Super Admin (never locks admins out)
   *  - anything else (customers) → []
   *
   * Security: when role_id is set but the role cannot be found, we DENY ([]) —
   * we never fall back to Super Admin, which would be a privilege escalation
   * for a user whose role was deleted or not yet synced.
   */
  async resolveUserPermissions(userId: string): Promise<string[]> {
    let user = jsonDb.findOne('users', { id: userId });

    // Mongo is the auth source of truth — load staff/customer users from there
    // when this serverless instance's memory cache is cold/stale.
    if (!user) {
      try {
        const { authRepository } = await import('../auth/auth.repository');
        const fromMongo = await authRepository.findById(userId);
        if (fromMongo) {
          user = fromMongo;
          const collection = jsonDb.getCollection('users');
          if (!collection.some((u: any) => u.id === fromMongo.id)) {
            const { profiles: _profiles, ...row } = fromMongo as any;
            collection.push(row);
          }
        }
      } catch {
        /* fall through */
      }
    }

    if (!user) return [];

    const roleId = user.role_id ?? user.roleId ?? null;
    if (roleId) {
      let role = jsonDb.findOne('roles', { id: roleId });
      if (!role) {
        // Role may have been created on another serverless instance.
        try {
          await jsonDb.refreshCollection('roles', { force: true });
          role = jsonDb.findOne('roles', { id: roleId });
        } catch {
          /* keep local state */
        }
      }
      if (role) return effectivePermissionsForRole(role);
      // role_id set but role missing → deny, never escalate.
      return [];
    }

    // Legacy admin rows (created before RBAC) keep full access until assigned a role.
    if (String(user.role ?? '') === 'admin') {
      return [...SUPER_ADMIN_PERMISSIONS];
    }

    return [];
  }

  private normalizePermissions(permissions: unknown): string[] {
    if (!Array.isArray(permissions)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of permissions) {
      if (typeof p !== 'string' || seen.has(p)) continue;
      if (!KNOWN_PERMISSIONS.has(p)) {
        throw new BadRequestError(`Unknown permission "${p}"`);
      }
      seen.add(p);
      out.push(p);
    }
    return out;
  }

  private serialize(role: any) {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? '',
      permissions: rolePermissions(role),
      isSystem: Boolean(role.is_system ?? role.isSystem),
      createdAt: role.created_at ?? role.createdAt,
      updatedAt: role.updated_at ?? role.updatedAt,
      userCount: jsonDb.count('users', { role_id: role.id }),
    };
  }
}

export const rolesService = new RolesService();
