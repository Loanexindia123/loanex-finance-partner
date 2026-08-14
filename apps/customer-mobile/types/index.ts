export interface ProductPhoto { id: string; url: string; order: number; isCover: boolean; }

export interface DealerSource {
  id: string; dealerCode: string; dealerName: string;
  dealerAddress: string; dealerMobile: string; purchasePrice: number;
}

export type EMIPlanMode = 'single' | 'multiple';
export type DownPaymentType = 'amount' | 'percentage';
export type FirstPaymentRule = 'down_payment' | 'emi_1';

export interface EMICalcResult {
  tenure: number;
  /** Product Price + Processing Fee (+ interest) */
  totalPayable: number;
  downPaymentAmount: number;
  /** Loan Amount (Product Price − Down Payment) */
  balanceForEMI: number;
  loanAmount: number;
  /** Down Payment + Processing Fee */
  upfrontPayment: number;
  /** @deprecated Alias of totalEmi */
  loanTotal: number;
  /** @deprecated Alias of totalPayable */
  grandTotal: number;
  processingFee: number;
  futureEMICount: number;
  regularEMIAmount: number;
  finalEMIAmount: number;
  firstDueDate: Date;
  isRounded: boolean;
}

export interface Brand {
  id: string; name: string; logo: string; description: string; status: 'active' | 'inactive'; createdAt: string;
}

export interface Manufacturer {
  id: string; name: string; gstNumber: string; address: string; contactPerson: string;
  phone: string; email: string; status: 'active' | 'inactive'; createdAt: string;
}

export interface Supplier {
  id: string; name: string; code: string; gstNumber: string; address: string;
  phone: string; email: string; contactPerson: string; bankDetails: string;
  paymentTerms: string; status: 'active' | 'inactive'; createdAt: string;
}

export interface Warehouse {
  id: string; name: string; address: string; contactPerson: string; phone: string;
  capacity: number; status: 'active' | 'inactive'; createdAt: string;
}

export interface SubCategory {
  id: string; categoryId: string; name: string; description: string; image: string;
  sortOrder: number; status: 'active' | 'inactive'; createdAt: string;
}

export interface ProductAttribute {
  id: string; name: string; status: 'active' | 'inactive'; createdAt: string;
}

export interface ProductAttributeValue {
  id: string; attributeId: string; value: string; status: 'active' | 'inactive'; createdAt: string;
}

export interface ProductVariant {
  id: string; productId: string; sku: string; barcode: string;
  sellingPrice: number; purchasePrice: number; gst: number;
  stock: number; reservedStock: number; images: string[];
  weight: number; length: number; width: number; height: number;
  status: 'active' | 'inactive'; createdAt: string;
  attributeValues?: { attributeId: string; attributeName: string; valueId: string; value: string }[];
  /** Selected attribute map as returned by the backend (e.g. { Color: 'Black' }). */
  attributes?: Record<string, string>;
}

export interface Product {
  id: string; name: string; shortName: string; sku: string; barcode: string;
  hsnCode: string; gstPercentage: number; price: number; originalPrice: number;
  category: string; categoryId: string; subCategoryId?: string;
  image: string; photos: ProductPhoto[]; videoUrl: string;
  rating: number; reviews: number; description: string; descriptionShort: string; brand: string; brandId?: string;
  manufacturerId?: string; features: string[]; boxContents: string[];
  usageInstructions: string; stock: number; status: 'active' | 'inactive' | 'draft';
  emiAvailable: boolean; emiPlanMode: EMIPlanMode; tenureOptions: number[];
  /** Variants/EMI plans as returned by the backend catalog (field names vary by endpoint). */
  variants?: ProductVariant[];
  productVariants?: ProductVariant[];
  product_variants?: ProductVariant[];
  /** Selectable attribute groups (Color/Storage/RAM) used to pick a variant. */
  attributeGroups?: Array<{ key: string; label: string; type: string; options: Array<{ value: string; label: string; hex?: string | null; inStock?: boolean; disabled?: boolean }> }>;
  emiPlans?: EMIPlan[];
  downPayment: number; minDownPayment: number; maxDownPayment: number;
  downPaymentType: DownPaymentType; firstPaymentRule: FirstPaymentRule;
  serviceCharge: number; deliveryCharge: number; processingCharge: number;
  verificationCharge: number; documentationCharge: number; gracePeriod: number;
  firstEmiDate: string; dealers: DealerSource[]; suppliers: string[];
  warehouseId?: string; purchasePrice: number; procurementCost: number;
  packagingCost: number; transportCost: number; loadingCost: number; otherCharges: number;
  landingCost: number; mrp: number; discount: number; discountPercent: number;
  grossMargin: number; grossMarginPercent: number; taxableValue: number;
  gstAmount: number; finalPrice: number; reservedStock: number; minStock: number;
  maxStock: number; reorderLevel: number; weight: number; length: number;
  width: number; height: number; deliveryZone: string; deliveryPartner: string;
  estDeliveryDays: number; returnWindow: number; replacementAllowed: boolean;
  codAllowed: boolean; installationRequired: boolean; installationCharges: number;
  countryOfOrigin: string; warranty: string; condition: 'new' | 'refurbished' | 'used';
  serialTracking: boolean; minQuantity: number; maxQuantity: number;
  minCustomerAge: number; eligiblePincodes: string[]; cashPurchaseAllowed: boolean;
  emiPurchaseAllowed: boolean; returnAllowed: boolean; serialCaptureRequired: boolean;
  fieldVerificationRequired: boolean; seoTitle: string; seoDescription: string;
  seoKeywords: string; slug: string; visibility: 'visible' | 'hidden';
  featured: boolean; trending: boolean; recommended: boolean;
  createdAt: string; updatedAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedTenure?: number;
  /** Selected product variant (color/size/storage) — drives per-variant stock decrement on the backend. */
  variantId?: string;
  /** Selling price of the selected variant, when it differs from the base product price. */
  variantPrice?: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export type EMIStatus = 'pending_approval' | 'proposal_sent' | 'accepted' | 'rejected' | 'downpayment_paid' | 'active' | 'completed';

export interface EMIProposal {
  downPayment: number; downPaymentType: DownPaymentType;
  serviceCharge: number; deliveryCharge: number; tenure: number;
  monthlyAmount: number; downPaymentAmount: number; totalPayable: number;
  balanceForEMI: number; regularEMIAmount: number; finalEMIAmount: number;
  notes?: string; createdAt: string;
}

export interface OrderItem { productId: string; productName: string; image: string; quantity: number; price: number; }

export interface OrderDealerSnapshot {
  dealerCode: string; dealerName: string; dealerAddress: string;
  dealerMobile: string; purchasePrice: number; grossMargin: number;
}

export interface EMIInstallment {
  installmentNumber: number; amount: number; dueDate: string;
  /** When the EMI was actually collected (paid rows only). */
  paidAt?: string;
  status: 'upcoming' | 'paid' | 'overdue';
}

export interface EMIDetails {
  id?: string; orderId: string; tenure: number;
  firstPaymentRule: FirstPaymentRule; downPaymentAmount: number;
  serviceCharge: number; deliveryCharge: number; totalPayable: number;
  balanceForEMI: number; regularEMIAmount: number; finalEMIAmount: number;
  months: number; monthlyAmount: number; totalAmount: number;
  interestRate: number; emiStatus: EMIStatus; paidInstallments: number;
  nextDueDate: string; schedule: EMIInstallment[]; dealerId?: string;
  dealerSnapshot?: OrderDealerSnapshot; adminProposal?: EMIProposal;
  customerAccepted?: boolean; customerAcceptedAt?: string;
  downpaymentPaid?: boolean; downpaymentPaidAt?: string; customerNotes?: string;
}

export interface Order {
  id: string; orderNumber?: string; userId: string; items: OrderItem[];
  subtotal: number; total: number; status: OrderStatus;
  /** 'cod' | 'emi' | 'online' (full payment via Razorpay) */
  paymentMethod: 'cod' | 'emi' | 'online';
  emiDetails?: EMIDetails; addressId?: string;
  addressSnapshot?: AddressSnapshot; address: string; phone: string; notes?: string;
  createdAt: string; updatedAt?: string;
}

export interface AddressSnapshot {
  label: string; fullAddress: string; city: string; state: string; pincode: string;
}

export interface User {
  id: string; phone: string; name: string; email?: string;
  avatarUrl?: string; role: 'admin' | 'customer'; createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label?: string;
  fullAddress: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  imageUrl: string;
  linkUrl?: string;
  position?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string; name: string; icon: string; color: string; bgColor: string;
  sortOrder: number; image?: string; description?: string;
}

export interface WishlistItem {
  id: string; userId: string; productId: string; product?: Product; createdAt: string;
}

export interface Review {
  id: string; productId: string; userId: string; rating: number;
  title?: string; comment?: string; createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

export interface EMIPlan {
  months: number;
  interestRate: number;
  monthlyAmount: number;
  loanAmount: number;
  upfrontPayment: number;
  totalPayable: number;
  /** @deprecated Alias of totalEmi */
  loanTotal: number;
  /** @deprecated Alias of totalPayable */
  grandTotal: number;
  /** @deprecated Alias of totalPayable */
  totalAmount: number;
  processingFee: number;
}

export interface AuditLog {
  id: string; userId: string; action: string; entityType: string;
  entityId: string; changes: any; createdAt: string;
}

export interface CustomerKYC {
  id: string;
  userId: string;
  fullName: string;
  aadharNumber: string;
  /** DigiLocker / Aadhaar step — mirrors backend `aadhaarVerified` / `aadharVerified`. */
  aadharVerified: boolean;
  aadhaarVerified: boolean;
  dob?: string;
  gender?: string;
  address?: any;
  rawKycData?: any;
  panNumber: string;
  panVerified: boolean;
  bankVerified: boolean;
  cibilScore: number;
  cibilChecked: boolean;
  /** Persisted KYC face match (`customer_kyc.face_verified`), not EMI session face. */
  faceVerified: boolean;
  kycCompleted: boolean;
  kycCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = 'order' | 'emi' | 'payment' | 'kyc' | 'general';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  route: string;
  createdAt: string;
}

/** Backend AutopayMandateStatus — do not invent values. */
export type AutopayMandateStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface AutopayMandate {
  id: string;
  provider: string;
  mandateId: string;
  mandateReference: string;
  paymentMethod: string;
  bankName: string | null;
  upiId: string | null;
  maximumDebitAmount: number;
  frequency: string;
  nextDebitDate: string | null;
  status: AutopayMandateStatus | string;
  failureReason: string | null;
  /** Razorpay hosted authorization URL (subscription.short_url). */
  approvalUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  message?: string;
}

export interface AutopayStatus {
  loan: {
    id: string;
    loanAccountNumber: string;
    applicationNumber: string;
    emiAmount: number;
    nextEmiDueDate: string | null;
    loanStatus: string;
    autopayEnabled: boolean;
  };
  autopayStatus: string;
  mandate: AutopayMandate | null;
  options: Array<{ code: string; label: string }>;
  canEnable: boolean;
  canDisable: boolean;
}

export interface AutopayHistoryResponse {
  total: number;
  items: Array<AutopayMandate & { loanAccountNumber: string; applicationNumber: string | null }>;
}
