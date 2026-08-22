import { jsonDb } from '../../../config/json-db';
import {
  findLinkedDealerByUserId,
  resolveIsDealerUserId,
} from '../dealer/dealer-account';
import {
  findLinkedAgentByUserId,
  resolveIsAgentUserId,
} from '../freelancer-agent/agent-account';

function str(value: unknown): string {
  return String(value ?? '').trim();
}

export type FieldActorKind = 'dealer' | 'agent' | null;

export interface FieldActorContext {
  kind: FieldActorKind;
  /** Auth users.id */
  userId: string;
  /** Parent dealer profile id (dealers.id). Always set for dealers and agents. */
  dealerId: string;
  /** Agent profile id (freelancer_agents.id). Set only for agents. */
  agentId: string;
}

/**
 * Resolve dealer/agent field actor from JWT sub. Never trusts client dealerId/agentId.
 */
export async function resolveFieldActor(actorUserId: string): Promise<FieldActorContext | null> {
  const userId = str(actorUserId);
  if (!userId) return null;

  if (await resolveIsAgentUserId(userId)) {
    await jsonDb.ensureCollection('freelancer_agents');
    let agent = findLinkedAgentByUserId(userId);
    if (!agent?.id) {
      try {
        await jsonDb.refreshCollection('freelancer_agents', { force: true });
      } catch {
        /* keep local */
      }
      agent = findLinkedAgentByUserId(userId);
    }
    const dealerId = str(agent?.dealerId);
    const agentId = str(agent?.id);
    return {
      kind: 'agent',
      userId,
      dealerId,
      agentId,
    };
  }

  if (await resolveIsDealerUserId(userId)) {
    await jsonDb.ensureCollection('dealers');
    let dealer = findLinkedDealerByUserId(userId);
    if (!dealer?.id) {
      try {
        await jsonDb.refreshCollection('dealers', { force: true });
      } catch {
        /* keep local */
      }
      dealer = findLinkedDealerByUserId(userId);
    }
    // Fallback: match dealer row by the auth user's email (legacy links)
    if (!dealer?.id) {
      const user = jsonDb.findOne('users', { id: userId }) as any;
      const email = str(user?.email).toLowerCase();
      if (email) {
        const dealers = jsonDb.findMany('dealers', {}) as any[];
        dealer =
          dealers.find((row) => str(row.email).toLowerCase() === email) ?? null;
      }
    }
    return {
      kind: 'dealer',
      userId,
      dealerId: str(dealer?.id),
      agentId: '',
    };
  }

  return null;
}

/** Collect login userIds for agents belonging to a dealer profile. */
export function collectDealerAgentUserIds(dealerId: string): Set<string> {
  const did = str(dealerId);
  const ids = new Set<string>();
  if (!did) return ids;
  const agents = jsonDb.findMany('freelancer_agents', {}) as any[];
  for (const row of agents) {
    if (str(row.dealerId) !== did) continue;
    const uid = str(row.userId ?? row.user_id);
    if (uid) ids.add(uid);
    // Also include creators who belong to this dealer tree (pre-login rows use creatorId).
    const creator = str(row.createdById || row.creatorId);
    if (creator) ids.add(creator);
  }
  return ids;
}

export function isOwnedByDealerTree(
  record: { dealerId?: string | null; creatorId?: string | null; createdById?: string | null },
  dealerCtx: { dealerId: string; userId: string },
): boolean {
  const did = str(dealerCtx.dealerId);
  const actor = str(dealerCtx.userId);
  if (did && str(record.dealerId) === did) return true;
  if (actor && (str(record.creatorId) === actor || str(record.createdById) === actor)) {
    return true;
  }
  // Child-agent creations: creator is an agent under this dealer.
  if (did) {
    const agentUserIds = collectDealerAgentUserIds(did);
    if (agentUserIds.has(str(record.creatorId)) || agentUserIds.has(str(record.createdById))) {
      return true;
    }
  }
  return false;
}

export function isOwnedByAgentSelf(
  record: { creatorId?: string | null; createdById?: string | null; agentId?: string | null },
  agentCtx: { userId: string; agentId: string },
): boolean {
  const actor = str(agentCtx.userId);
  const aid = str(agentCtx.agentId);
  if (actor && (str(record.creatorId) === actor || str(record.createdById) === actor)) {
    return true;
  }
  if (aid && str(record.agentId) === aid) return true;
  return false;
}
