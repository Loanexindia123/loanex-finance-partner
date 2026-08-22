/**
 * Self-test: Dealer/Agent ownership visibility helpers.
 *   npx tsx src/modules/admin/hierarchy/field-actor.selftest.ts
 */
import { isOwnedByAgentSelf, isOwnedByDealerTree } from './field-actor';
import {
  filterAgentCreatedAgents,
  isAgentOwnedAgent,
  isDealerOwnedAgent,
} from '../freelancer-agent/freelancer-agent-visibility';
import { canAccessProductByCreator, type ProductCreatorScope } from '../../product/utils/product-ownership';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// Dealer tree ownership
assert(
  isOwnedByDealerTree(
    { dealerId: 'D1', creatorId: 'A1' },
    { dealerId: 'D1', userId: 'u-d1' },
  ),
  'Dealer sees child-agent product via dealerId',
);
assert(
  isOwnedByDealerTree(
    { dealerId: 'D2', creatorId: 'u-d1' },
    { dealerId: 'D1', userId: 'u-d1' },
  ),
  'Dealer sees own creatorId records',
);
assert(
  !isOwnedByDealerTree(
    { dealerId: 'D2', creatorId: 'other' },
    { dealerId: 'D1', userId: 'u-d1' },
  ),
  'Dealer cannot see other dealer tree',
);

// Agent self ownership
assert(
  isOwnedByAgentSelf(
    { creatorId: 'u-a1', agentId: 'AG1' },
    { userId: 'u-a1', agentId: 'AG1' },
  ),
  'Agent sees own lead',
);
assert(
  !isOwnedByAgentSelf(
    { creatorId: 'u-a2', agentId: 'AG2' },
    { userId: 'u-a1', agentId: 'AG1' },
  ),
  'Agent cannot see sibling lead',
);

// Agent list visibility
const agents = [
  { id: 'AG1', createdById: 'u-d1', creatorId: 'u-d1', dealerId: 'D1', userId: 'u-a1' },
  { id: 'AG2', createdById: 'u-a1', creatorId: 'u-a1', dealerId: 'D1', userId: '' },
  { id: 'AG3', createdById: 'u-other', creatorId: 'u-other', dealerId: 'D9', userId: '' },
] as any[];

assert(isDealerOwnedAgent(agents[1], 'D1', 'u-d1'), 'Dealer owns agent-created agent via dealerId');
assert(isAgentOwnedAgent(agents[1], 'u-a1', 'AG1'), 'Agent owns agent they created');
assert(!isAgentOwnedAgent(agents[2], 'u-a1', 'AG1'), 'Agent does not own other dealer agent');

const agentVisible = filterAgentCreatedAgents(agents, 'u-a1', 'AG1');
assert(agentVisible.some((a) => a.id === 'AG1'), 'Agent sees self');
assert(agentVisible.some((a) => a.id === 'AG2'), 'Agent sees created agent');
assert(!agentVisible.some((a) => a.id === 'AG3'), 'Agent does not see outsider');

// Product scope
const dealerScope: ProductCreatorScope = {
  orgWide: false,
  allowedCreatorIds: new Set(['u-d1', 'u-a1']),
  dealerId: 'D1',
  allowDealerIdMatch: true,
};
const agentScope: ProductCreatorScope = {
  orgWide: false,
  allowedCreatorIds: new Set(['u-a1']),
  dealerId: 'D1',
  allowDealerIdMatch: false,
};

assert(
  canAccessProductByCreator({ creatorId: 'u-a1', dealerId: 'D1' }, dealerScope),
  'Dealer sees agent product by creator',
);
assert(
  canAccessProductByCreator({ creatorId: 'x', dealerId: 'D1' }, dealerScope),
  'Dealer sees product stamped with dealerId',
);
assert(
  canAccessProductByCreator({ creatorId: 'u-a1', dealerId: 'D1' }, agentScope),
  'Agent sees own product',
);
assert(
  !canAccessProductByCreator({ creatorId: 'u-a2', dealerId: 'D1' }, agentScope),
  'Agent cannot see sibling product via dealerId',
);

console.log('field-actor.selftest: all assertions passed');
process.exit(0);
