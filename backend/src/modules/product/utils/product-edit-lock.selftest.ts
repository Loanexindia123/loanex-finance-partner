/**
 * Approved-product edit lock — run with:
 *   npx tsx src/modules/product/utils/product-edit-lock.selftest.ts
 */
import { isApprovedProductEditLocked } from './product-emi';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// Restricted roles: active = locked
assert(isApprovedProductEditLocked('active', true), 'restricted + active → locked');
assert(isApprovedProductEditLocked('Active', true), 'restricted + Active → locked');
assert(isApprovedProductEditLocked(' ACTIVE ', true), 'restricted + padded active → locked');

// Restricted roles: non-active remain editable
assert(!isApprovedProductEditLocked('draft', true), 'restricted + draft → editable');
assert(
  !isApprovedProductEditLocked('pending_approval', true),
  'restricted + pending_approval → editable',
);
assert(!isApprovedProductEditLocked('rejected', true), 'restricted + rejected → editable');
assert(!isApprovedProductEditLocked('inactive', true), 'restricted + inactive → editable');
assert(!isApprovedProductEditLocked('', true), 'restricted + empty → editable');
assert(!isApprovedProductEditLocked(null, true), 'restricted + null → editable');

// Admin / Super Admin (not restricted): always editable including active
assert(!isApprovedProductEditLocked('active', false), 'admin + active → editable');
assert(!isApprovedProductEditLocked('draft', false), 'admin + draft → editable');
assert(!isApprovedProductEditLocked('pending_approval', false), 'admin + pending → editable');

console.log('product-edit-lock.selftest: all assertions passed');
process.exit(0);
