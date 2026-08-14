/**
 * Dealer ownership visibility checks — run with:
 *   npx tsx src/modules/admin/dealer/dealer-ownership.selftest.ts
 */
function canAccessDealer(
  dealer: { creatorId: string },
  actor: { userId: string; orgWide: boolean },
): boolean {
  if (actor.orgWide) return true;
  const owner = String(dealer.creatorId ?? '').trim();
  if (!owner) return false;
  return owner === actor.userId;
}

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}

const amit = { userId: 'u-amit', orgWide: false };
const rahul = { userId: 'u-rahul', orgWide: false };
const admin = { userId: 'u-admin', orgWide: true };

const dealerA = { creatorId: 'u-amit' };
const dealerB = { creatorId: 'u-rahul' };
const legacy = { creatorId: '' };

assert(canAccessDealer(dealerA, amit), 'Amit owns A');
assert(!canAccessDealer(dealerB, amit), 'Amit cannot see Rahul B');
assert(canAccessDealer(dealerB, rahul), 'Rahul owns B');
assert(!canAccessDealer(dealerA, rahul), 'Rahul cannot see Amit A');
assert(canAccessDealer(dealerA, admin), 'Super Admin sees A');
assert(canAccessDealer(dealerB, admin), 'Super Admin sees B');
assert(canAccessDealer(legacy, admin), 'Super Admin sees legacy');
assert(!canAccessDealer(legacy, amit), 'Employee cannot see legacy without owner');

console.log('dealer-ownership.selftest: all assertions passed');
