/**
 * Self-test: Agent role helpers + approval gate.
 *   npx tsx src/modules/admin/freelancer-agent/agent-account.selftest.ts
 */
import {
  AGENT_ROLE_PERMISSIONS,
  isAgentApproved,
  isAgentAuthUser,
  isAgentRoleName,
} from './agent-account';
import { isDealerAuthUser } from '../dealer/dealer-account';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

assert(isAgentRoleName('Agent'), 'Agent role name matches');
assert(isAgentRoleName('agent'), 'agent role name matches');
assert(!isAgentRoleName('Dealer'), 'Dealer is not Agent');
assert(!isAgentRoleName('Employee'), 'Employee is not Agent');

assert(isAgentAuthUser({ role: 'agent' }), 'role=agent is an agent user');
assert(!isAgentAuthUser({ role: 'dealer' }), 'Dealer is not an agent user');
assert(!isAgentAuthUser({ role: 'admin' }), 'Admin is not an agent user');
assert(!isDealerAuthUser({ role: 'agent' }), 'Agent is not a dealer user');

assert(AGENT_ROLE_PERMISSIONS.length === 0, 'Agent role permissions stay empty');

assert(
  isAgentApproved({ formStatus: 'approved' } as any),
  'approved formStatus provisions login',
);
assert(
  !isAgentApproved({ formStatus: 'pending_approval' } as any),
  'pending does not provision',
);
assert(!isAgentApproved({ formStatus: 'draft' } as any), 'draft does not provision');

console.log('agent-account.selftest: all assertions passed');
process.exit(0);
