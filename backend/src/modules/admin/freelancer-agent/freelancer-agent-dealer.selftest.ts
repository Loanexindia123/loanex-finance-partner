/**
 * Lightweight ownership checks for dealer-scoped agents (no DB).
 * Run: npx tsx src/modules/admin/freelancer-agent/freelancer-agent-dealer.selftest.ts
 */
import { isDealerOwnedAgent } from './freelancer-agent-visibility';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  isDealerOwnedAgent(
    { dealerId: 'd1', createdById: 'u1', creatorId: 'u1' },
    'd1',
    'u1',
  ),
  'same dealerId must own',
);

assert(
  !isDealerOwnedAgent(
    { dealerId: 'd2', createdById: 'u2', creatorId: 'u2' },
    'd1',
    'u1',
  ),
  'other dealerId must not own',
);

assert(
  isDealerOwnedAgent(
    { dealerId: '', createdById: 'u1', creatorId: 'x' },
    '',
    'u1',
  ),
  'createdById fallback when dealerId empty',
);

assert(
  !isDealerOwnedAgent(
    { dealerId: '', createdById: 'u9', creatorId: 'u9' },
    'd1',
    'u1',
  ),
  'other creators must not match',
);

console.log('freelancer-agent-dealer.selftest: ok');
