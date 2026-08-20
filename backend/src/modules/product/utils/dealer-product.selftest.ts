/**
 * Dealer catalog restrictions — run with:
 *   npx tsx src/modules/product/utils/dealer-product.selftest.ts
 */
import { DEALER_ROLE_PERMISSIONS, isDealerAuthUser, isDealerRoleName } from '../../admin/dealer/dealer-account';
import { canAccessProductByCreator, type ProductCreatorScope } from './product-ownership';
import { stripEmployeeDeliveryFromPayload, stripEmployeeEmiFromPayload } from './product-emi';

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}

assert(isDealerRoleName('Dealer'), 'Dealer role name matches');
assert(!isDealerRoleName('Employee'), 'Employee is not Dealer');
assert(DEALER_ROLE_PERMISSIONS.length === 0, 'Dealer role has no Admin Web permissions');
assert(!DEALER_ROLE_PERMISSIONS.includes('masters.create'), 'Dealer cannot have Add Dealer permission');
assert(!DEALER_ROLE_PERMISSIONS.includes('products.delete'), 'Dealer cannot have product delete permission');

assert(isDealerAuthUser({ role: 'dealer' }), 'role=dealer is a dealer user');
assert(!isDealerAuthUser({ role: 'admin' }), 'Admin is not a dealer user');
assert(!isDealerAuthUser({ role: 'authenticated' }), 'Customer is not a dealer user');

const dealerA: ProductCreatorScope = {
  orgWide: false,
  allowedCreatorIds: new Set(['user-dealer-a']),
};
const dealerB: ProductCreatorScope = {
  orgWide: false,
  allowedCreatorIds: new Set(['user-dealer-b']),
};
const admin: ProductCreatorScope = { orgWide: true, allowedCreatorIds: new Set() };

assert(canAccessProductByCreator({ creatorId: 'user-dealer-a' }, dealerA), 'Dealer A sees own product');
assert(!canAccessProductByCreator({ creatorId: 'user-dealer-b' }, dealerA), 'Dealer A cannot see Dealer B product');
assert(!canAccessProductByCreator({ creatorId: 'user-admin' }, dealerA), 'Dealer A cannot see Admin product');
assert(!canAccessProductByCreator({ creatorId: 'user-employee' }, dealerA), 'Dealer A cannot see Employee product');
assert(!canAccessProductByCreator({ creatorId: 'user-dealer-a' }, dealerB), 'Dealer B cannot see Dealer A product');
assert(canAccessProductByCreator({ creatorId: 'user-dealer-a' }, admin), 'Admin can see Dealer A product');
assert(canAccessProductByCreator({ creatorId: 'user-dealer-b' }, admin), 'Admin can see Dealer B product');

const emiPayload: any = {
  emiAvailable: true,
  emiEnabled: true,
  emiPlans: [{ months: 6, enabled: true }],
  wizardData: { emiEnabled: true, emiPlans: [{ months: 9 }] },
  dealerId: 'spoofed-dealer',
  creatorId: 'spoofed-creator',
};
stripEmployeeEmiFromPayload(emiPayload);
assert(emiPayload.emiAvailable === undefined, 'Dealer EMI emiAvailable stripped');
assert(emiPayload.emiEnabled === undefined, 'Dealer EMI emiEnabled stripped');
assert(emiPayload.emiPlans === undefined, 'Dealer EMI plans stripped');
assert(!Array.isArray(emiPayload.wizardData?.emiPlans), 'Dealer wizard EMI plans stripped');
assert(emiPayload.wizardData?.emiEnabled === undefined, 'Dealer wizard emiEnabled stripped');

const deliveryPayload: any = {
  deliveryCharges: 99,
  deliveryPartner: 'BlueDart',
  deliveryZone: 'Zone 1',
  expressDelivery: true,
  wizardData: {
    deliveryCharges: '120',
    deliveryDays: '3-5',
    deliveryPartner: 'Delhivery',
    expressDelivery: true,
  },
};
stripEmployeeDeliveryFromPayload(deliveryPayload);
assert(deliveryPayload.deliveryCharges === undefined, 'Dealer deliveryCharges stripped');
assert(deliveryPayload.deliveryPartner === undefined, 'Dealer deliveryPartner stripped');
assert(deliveryPayload.wizardData?.deliveryDays === undefined, 'Dealer wizard deliveryDays stripped');
assert(deliveryPayload.wizardData?.expressDelivery === undefined, 'Dealer wizard expressDelivery stripped');

console.log('dealer-product.selftest: all assertions passed');
process.exit(0);
