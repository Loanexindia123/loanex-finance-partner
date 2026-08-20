export type ProductStatus = 'active' | 'draft' | 'pending_approval' | 'rejected' | 'out_of_stock' | 'archived';
export type CustomerVisibility = 'visible' | 'hidden';

export interface EMIPlan {
  id: string;
  enabled: boolean;
  planName: string;
  months: string;
  downPayment: string;
  serviceCharge: string;
  deliveryCharge: string;
  minEligibilityAmount: string;
  customerVisibility: CustomerVisibility;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  sellingPrice: number;
  mrp: number;
  stock: number;
  status: ProductStatus;
  imageUrl?: string;
  featured?: boolean;
  trending?: boolean;
  recommended?: boolean;
  emiAvailable?: boolean;
}

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

export interface TextListItem {
  id: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  variantImage: string | null;
  galleryImages: string[];
  sku: string;
  barcode: string;
  mrp: string;
  sellingPrice: string;
  purchasePrice: string;
  stock: string;
  description: string;
  specifications: KeyValueItem[];
  features: TextListItem[];
  boxContents: TextListItem[];
  weight: string;
  length: string;
  width: string;
  height: string;
  supplier: string;
  warehouse: string;
  emiPlanId: string;
  status: ProductStatus;
  saved: boolean;
}

export interface VariantAttribute {
  id: string;
  name: string;
  values: string[];
}

export interface SupplierEntry {
  id: string;
  /** Matches Admin Web supplier.dealerId */
  dealerId?: string;
  productSourceType?: string;
  sourceCreatedBy?: string;
  supplier: string;
  dealer: string;
  wholesaler: string;
  supplierSku: string;
  purchaseInvoice: string;
  purchaseDate: string;
  settlementCycle: string;
  leadTime: string;
  paymentTerms: string;
  notes: string;
  productSource: string;
  supplierCode: string;
  dealerBranch: string;
  supplierGstin: string;
  supplierContact: string;
  supplierProductCode: string;
  stockOwnership: string;
  dispatchFrom: string;
  firstPaymentPercent: string;
  deliveryPaymentPercent: string;
  holdPaymentPercent: string;
  returnToSupplierAllowed: boolean;
  dealerIncentivePercent: string;
}

export interface ProductFormData {
  productName: string;
  shortName: string;
  productType: string;
  brand: string;
  sku: string;
  modelNumber: string;
  barcode: string;
  hsnCode: string;
  manufacturer: string;
  countryOfOrigin: string;
  warranty: string;
  productCondition: string;
  shortDescription: string;
  /** UI label: Overview — backend key remains `description`. */
  description: string;
  specifications: KeyValueItem[];
  /** Matches Admin Web "About this item" list. */
  aboutThisItem: TextListItem[];
  features: TextListItem[];
  boxContents: TextListItem[];
  productVideoUrl: string;
  colourSizeVariant: string;
  serialImeiTracking: boolean;
  category: string;
  subCategory: string;
  childCategory: string;
  variantsEnabled: boolean;
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  primaryImage: string | null;
  galleryImages: string[];
  variantImages: string[];
  mrp: string;
  sellingPrice: string;
  purchasePrice: string;
  gst: string;
  discount: string;
  landingCost: string;
  margin: string;
  gstAmount: string;
  amazonPrice: string;
  flipkartPrice: string;
  otherWebsitePrice: string;
  marketLowestPrice: string;
  priceCheckedDate: string;
  priceCheckedBy: string;
  priceMatchAllowed: boolean;
  maximumDiscountAllowed: string;
  warehouse: string;
  openingStock: string;
  availableStock: string;
  reservedStock: string;
  minimumQuantity: string;
  maximumQuantity: string;
  trackInventory: boolean;
  minOrderQuantity: string;
  maxQuantityPerCustomer: string;
  minimumCustomerAge: string;
  eligiblePinCodes: string;
  cashPurchase: boolean;
  invoiceSetting: string;
  requiresFieldVerification: boolean;
  requiresSerialImeiCapture: boolean;
  suppliers: SupplierEntry[];
  weight: string;
  length: string;
  width: string;
  height: string;
  dispatchSla: string;
  deliveryCharges: string;
  deliveryDays: string;
  replacementWindow: string;
  replacementDays: string;
  installationRequired: boolean;
  deliveryCode: string;
  deliveryPartner: string;
  deliveryZone: string;
  expressDelivery: boolean;
  deliveryChargeMethod: string;
  installationCharge: string;
  deliveryConfirmationOtp: boolean;
  serialImeiCaptureAtDelivery: boolean;
  emiEnabled: boolean;
  selectedEmiPlanId: string;
  emiPlans: EMIPlan[];
  /** Product-wise default down payment percentage (admin-configured). */
  defaultDownPaymentPercent: string;
  minCustomerDownPayment: string;
  maxDownPayment: string;
  downPaymentEditableAtApproval: boolean;
  serviceChargeMethod: string;
  documentationCharge: string;
  verificationCharge: string;
  firstEmiDueAfter: string;
  gracePeriod: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
}

export const createKeyValueItem = (): KeyValueItem => ({
  id: Date.now().toString() + Math.random(),
  key: '',
  value: '',
});

export const createTextListItem = (): TextListItem => ({
  id: Date.now().toString() + Math.random(),
  value: '',
});

export const createEmptyVariant = (name: string, index: number, baseSku: string, defaults: Partial<ProductVariant> = {}): ProductVariant => ({
  id: `v-${Date.now()}-${index}`,
  name,
  variantImage: null,
  galleryImages: [],
  sku: `${baseSku || 'SKU'}-${index + 1}`,
  barcode: '',
  mrp: defaults.mrp || '',
  sellingPrice: defaults.sellingPrice || '',
  purchasePrice: defaults.purchasePrice || '',
  stock: '0',
  description: '',
  specifications: [],
  features: [],
  boxContents: [],
  weight: '',
  length: '',
  width: '',
  height: '',
  supplier: '',
  warehouse: '',
  emiPlanId: '',
  status: 'draft',
  saved: false,
});

export const createEmptyEmiPlan = (): EMIPlan => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  enabled: true,
  planName: '',
  months: '',
  downPayment: '',
  serviceCharge: '',
  deliveryCharge: '',
  minEligibilityAmount: '',
  customerVisibility: 'visible',
});

export const createEmptySupplier = (): SupplierEntry => ({
  id: Date.now().toString(),
  dealerId: '',
  productSourceType: 'Dealer',
  sourceCreatedBy: '',
  supplier: '',
  dealer: '',
  wholesaler: '',
  supplierSku: '',
  purchaseInvoice: '',
  purchaseDate: '',
  settlementCycle: '',
  leadTime: '',
  paymentTerms: '',
  notes: '',
  productSource: '',
  supplierCode: '',
  dealerBranch: '',
  supplierGstin: '',
  supplierContact: '',
  supplierProductCode: '',
  stockOwnership: '',
  dispatchFrom: '',
  firstPaymentPercent: '',
  deliveryPaymentPercent: '',
  holdPaymentPercent: '',
  returnToSupplierAllowed: false,
  dealerIncentivePercent: '',
});

export const initialFormData: ProductFormData = {
  productName: '',
  shortName: '',
  productType: '',
  brand: '',
  sku: '',
  modelNumber: '',
  barcode: '',
  hsnCode: '',
  manufacturer: '',
  countryOfOrigin: '',
  warranty: '',
  productCondition: 'New',
  shortDescription: '',
  description: '',
  specifications: [],
  aboutThisItem: [],
  features: [],
  boxContents: [],
  productVideoUrl: '',
  colourSizeVariant: '',
  serialImeiTracking: false,
  category: '',
  subCategory: '',
  childCategory: '',
  variantsEnabled: false,
  attributes: [],
  variants: [],
  primaryImage: null,
  galleryImages: [],
  variantImages: [],
  mrp: '',
  sellingPrice: '',
  purchasePrice: '',
  gst: '18',
  discount: '',
  landingCost: '',
  margin: '',
  gstAmount: '',
  amazonPrice: '',
  flipkartPrice: '',
  otherWebsitePrice: '',
  marketLowestPrice: '',
  priceCheckedDate: '',
  priceCheckedBy: '',
  priceMatchAllowed: false,
  maximumDiscountAllowed: '',
  warehouse: '',
  openingStock: '',
  availableStock: '',
  reservedStock: '0',
  minimumQuantity: '5',
  maximumQuantity: '1000',
  trackInventory: true,
  minOrderQuantity: '1',
  maxQuantityPerCustomer: '',
  minimumCustomerAge: '',
  eligiblePinCodes: '',
  cashPurchase: true,
  invoiceSetting: 'Auto Generate',
  requiresFieldVerification: false,
  requiresSerialImeiCapture: false,
  suppliers: [],
  weight: '',
  length: '',
  width: '',
  height: '',
  dispatchSla: '',
  deliveryCharges: '',
  deliveryDays: '3-5',
  replacementWindow: '7',
  replacementDays: '7',
  installationRequired: false,
  deliveryCode: '',
  deliveryPartner: '',
  deliveryZone: '',
  expressDelivery: false,
  deliveryChargeMethod: '',
  installationCharge: '',
  deliveryConfirmationOtp: false,
  serialImeiCaptureAtDelivery: false,
  emiEnabled: false,
  selectedEmiPlanId: '',
  emiPlans: [],
  defaultDownPaymentPercent: '20',
  minCustomerDownPayment: '',
  maxDownPayment: '',
  downPaymentEditableAtApproval: false,
  serviceChargeMethod: '',
  documentationCharge: '',
  verificationCharge: '',
  firstEmiDueAfter: '',
  gracePeriod: '',
  slug: '',
  metaTitle: '',
  metaDescription: '',
  keywords: '',
};
