/**
 * Dealer auth/provisioning checks — run with:
 *   npx tsx src/modules/admin/dealer/dealer-account.selftest.ts
 */
import { createDealerBodySchema } from './dealer.validator';
import { isDealerApproved, isDealerAuthUser, isDealerRoleName } from './dealer-account';

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label);
}

assert(isDealerRoleName('Dealer'), 'Dealer role name matches');
assert(isDealerRoleName('dealer'), 'dealer role name is case-insensitive');
assert(!isDealerRoleName('Employee'), 'Employee is not Dealer');

assert(isDealerAuthUser({ role: 'dealer' }), 'role=dealer is a dealer user');
assert(!isDealerAuthUser({ role: 'admin' }), 'role=admin is not a dealer user');
assert(!isDealerAuthUser({ role: 'authenticated' }), 'customer is not a dealer user');
assert(!isDealerAuthUser(null), 'null user is not a dealer');

assert(
  isDealerApproved({ formStatus: 'approved', verificationStatus: 'pending' }),
  'formStatus approved provisions',
);
assert(
  isDealerApproved({ formStatus: 'pending', verificationStatus: 'approved' }),
  'verificationStatus approved provisions',
);
assert(
  !isDealerApproved({ formStatus: 'draft', verificationStatus: 'pending' }),
  'draft does not provision',
);
assert(
  !isDealerApproved({ formStatus: 'pending', verificationStatus: 'pending' }),
  'pending does not provision',
);
assert(
  !isDealerApproved({ formStatus: 'rejected', verificationStatus: 'rejected' }),
  'rejected does not provision',
);

const pendingWithoutAadhaar = createDealerBodySchema.parse({
  dealerCode: 'DLR-TEST-1',
  dealerName: 'Test Dealer',
  formStatus: 'pending',
  creatorType: 'Employee',
  creatorName: 'Amit',
  ownerName: 'Owner',
  businessType: 'Proprietorship',
  mobile: '9876543210',
  dealerType: 'Retailer',
  categoryDepartment: 'Mobile',
  shopAddress: 'Shop 1',
  pincode: '560001',
  googleLocation: 'https://maps.google.com',
  deliveryArea: 'Bengaluru',
  panCard: 'https://example.com/pan.jpg',
  shopAddressProof: 'https://example.com/addr.jpg',
  cancelledCheque: 'https://example.com/cheque.jpg',
  shopPhotos: 'https://example.com/shop.jpg',
  accountHolderName: 'Owner',
  accountNumber: '1234567890',
  ifscCode: 'HDFC0000001',
  paymentCycle: 'Weekly',
  productDeliveryBy: 'Dealer',
  assignedB2BManager: 'Manager',
  ownerAadhaar: '',
});
assert(pendingWithoutAadhaar.ownerAadhaar === '', 'empty Aadhaar is accepted when not draft');

const draftWithoutAadhaar = createDealerBodySchema.parse({
  dealerCode: 'DLR-TEST-2',
  dealerName: 'Draft Dealer',
  formStatus: 'draft',
  mobile: '9876543211',
});
assert(draftWithoutAadhaar.formStatus === 'draft', 'draft without Aadhaar is accepted');

console.log('dealer-account.selftest: all assertions passed');
process.exit(0);
