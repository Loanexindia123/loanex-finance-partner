/** Dealer onboarding record — mirrors backend DealerRecord. */
export type DealerFormStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'hold';
export type DealerVerificationStatus = 'pending' | 'approved' | 'rejected' | 'hold';
export type DealerCatalogStatus = 'active' | 'inactive';

export interface Dealer {
  id: string;
  name: string;
  dealerCode: string;
  dealerName: string;
  ownerName: string;
  businessType: string;
  mobile: string;
  whatsapp: string;
  email: string;
  dealerType: string;
  categoryDepartment: string;
  establishedYear: string;
  shopAddress: string;
  pincode: string;
  googleLocation: string;
  deliveryArea: string;
  deliveryTime: string;
  warehouseAddress: string;
  panCard: string;
  gstCertificate: string;
  ownerAadhaar: string;
  shopAddressProof: string;
  cancelledCheque: string;
  shopPhotos: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  paymentCycle: string;
  holdPercentage: string;
  productDeliveryBy: string;
  assignedB2BManager: string;
  verificationStatus: DealerVerificationStatus;
  dealerAgreement: string;
  creatorType: string;
  creatorId: string;
  creatorName: string;
  status: DealerCatalogStatus;
  formStatus: DealerFormStatus;
  dealer_address: string;
  dealerMobile: string;
  gstNumber: string;
  branch: string;
  paymentSchedule: string;
  holdDays: number;
  commission: number;
  dealerBranch: string;
  paymentSettlementTerms: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DealerPayload = Omit<Dealer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export const DEALER_TYPES = ['Retailer', 'Wholesaler', 'Distributor'] as const;

export const BUSINESS_TYPES = ['Proprietorship', 'Partnership', 'Company'] as const;

export const CREATOR_TYPES = ['Employee', 'Self', 'Partner'] as const;

export const PAYMENT_CYCLES = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'On Delivery'] as const;

/** Payment terms stored on dealer master and mapped to product `paymentTerms`. */
export const PAYMENT_SETTLEMENT_TERMS = [
  'Advance',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'On Delivery',
] as const;

export const PRODUCT_DELIVERY_BY = ['Dealer', 'LoanEx', 'Third Party'] as const;

export const FORM_STATUS_OPTIONS: { label: string; value: DealerFormStatus }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Hold', value: 'hold' },
];

export const VERIFICATION_STATUS_OPTIONS: { label: string; value: DealerVerificationStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Hold', value: 'hold' },
];

export function emptyDealer(): DealerPayload {
  return {
    name: '',
    dealerCode: '',
    dealerName: '',
    ownerName: '',
    businessType: '',
    mobile: '',
    whatsapp: '',
    email: '',
    dealerType: '',
    categoryDepartment: '',
    establishedYear: '',
    shopAddress: '',
    pincode: '',
    googleLocation: '',
    deliveryArea: '',
    deliveryTime: '',
    warehouseAddress: '',
    panCard: '',
    gstCertificate: '',
    ownerAadhaar: '',
    shopAddressProof: '',
    cancelledCheque: '',
    shopPhotos: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    paymentCycle: '',
    holdPercentage: '',
    productDeliveryBy: '',
    assignedB2BManager: '',
    verificationStatus: 'pending',
    dealerAgreement: '',
    creatorType: '',
    creatorId: '',
    creatorName: '',
    status: 'active',
    formStatus: 'draft',
    dealer_address: '',
    dealerMobile: '',
    gstNumber: '',
    branch: '',
    paymentSchedule: '',
    holdDays: 0,
    commission: 0,
    dealerBranch: '',
    paymentSettlementTerms: '',
  };
}

export function normalizeDealer(raw: unknown): Dealer {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: string, fallback = '') =>
    row[key] == null ? fallback : String(row[key]).trim();
  const base = emptyDealer();
  const dealerName = pick('dealerName') || pick('name');
  return {
    ...base,
    id: pick('id'),
    name: dealerName,
    dealerCode: pick('dealerCode') || pick('code'),
    dealerName,
    ownerName: pick('ownerName'),
    businessType: pick('businessType'),
    mobile: pick('mobile') || pick('dealerMobile'),
    whatsapp: pick('whatsapp'),
    email: pick('email'),
    dealerType: pick('dealerType'),
    categoryDepartment: pick('categoryDepartment'),
    establishedYear: pick('establishedYear'),
    shopAddress: pick('shopAddress') || pick('dealer_address'),
    pincode: pick('pincode'),
    googleLocation: pick('googleLocation'),
    deliveryArea: pick('deliveryArea'),
    deliveryTime: pick('deliveryTime'),
    warehouseAddress: pick('warehouseAddress'),
    panCard: pick('panCard'),
    gstCertificate: pick('gstCertificate'),
    ownerAadhaar: pick('ownerAadhaar'),
    shopAddressProof: pick('shopAddressProof'),
    cancelledCheque: pick('cancelledCheque'),
    shopPhotos: pick('shopPhotos'),
    accountHolderName: pick('accountHolderName'),
    accountNumber: pick('accountNumber'),
    ifscCode: pick('ifscCode'),
    paymentCycle: pick('paymentCycle') || pick('paymentSchedule'),
    holdPercentage: pick('holdPercentage'),
    productDeliveryBy: pick('productDeliveryBy'),
    assignedB2BManager: pick('assignedB2BManager'),
    verificationStatus: (pick('verificationStatus') as DealerVerificationStatus) || 'pending',
    dealerAgreement: pick('dealerAgreement'),
    creatorType: pick('creatorType'),
    creatorId: pick('creatorId'),
    creatorName: pick('creatorName'),
    status: pick('status') === 'inactive' ? 'inactive' : 'active',
    formStatus: (pick('formStatus') as DealerFormStatus) || 'pending',
    dealer_address: pick('shopAddress') || pick('dealer_address'),
    dealerMobile: pick('mobile') || pick('dealerMobile'),
    gstNumber: pick('gstNumber'),
    branch: pick('branch') || pick('dealerBranch'),
    paymentSchedule: pick('paymentSchedule') || pick('paymentCycle'),
    holdDays: Number(row['holdDays'] ?? 0) || 0,
    commission: Number(row['commission'] ?? 0) || 0,
    dealerBranch: pick('branch') || pick('dealerBranch'),
    paymentSettlementTerms: pick('paymentSettlementTerms') || pick('paymentSchedule'),
    createdAt: pick('createdAt'),
    updatedAt: pick('updatedAt'),
  };
}

/** Maps dealer master fields → product supplier entry fields for auto-patch. */
export function dealerToProductPatch(dealer: Dealer): Record<string, string> {
  const contact = dealer.mobile || dealer.email || dealer.whatsapp;
  const holdPct =
    dealer.holdPercentage ||
    (dealer.holdDays > 0 ? String(dealer.holdDays) : '');
  const paymentTerms = dealer.paymentSettlementTerms || dealer.paymentCycle || dealer.paymentSchedule;
  return {
    dealer: dealer.dealerName || dealer.name,
    dealerId: dealer.id,
    supplierCode: dealer.dealerCode,
    dealerBranch: dealer.dealerBranch || dealer.branch,
    supplierGstin: dealer.gstNumber,
    supplierContact: contact,
    paymentTerms,
    settlementCycle: dealer.paymentCycle || '',
    holdPaymentPercent: holdPct,
    dealerIncentivePercent: dealer.commission > 0 ? String(dealer.commission) : '',
    dispatchFrom: dealer.warehouseAddress || dealer.deliveryArea,
  };
}

export const DEALER_PATCHED_PRODUCT_FIELDS = [
  'dealer',
  'dealerId',
  'supplierCode',
  'dealerBranch',
  'supplierGstin',
  'supplierContact',
  'paymentTerms',
  'settlementCycle',
  'holdPaymentPercent',
  'dealerIncentivePercent',
  'dispatchFrom',
] as const;

export type DealerPatchedProductField = (typeof DEALER_PATCHED_PRODUCT_FIELDS)[number];
