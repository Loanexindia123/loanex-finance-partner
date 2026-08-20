export interface ProductImage {
  id: string;
  src: string;
  alt: string;
}

export interface ProductColorOption {
  id: string;
  name: string;
  hex: string;
}

export interface ProductVariantOption {
  id: string;
  label: string;
}

export interface ProductKeySpec {
  id: string;
  icon: string;
  label: string;
  value: string;
}

export interface ProductSpecRow {
  label: string;
  value: string;
}

export interface ProductReviewHighlight {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  dateLabel: string;
}

export interface ProductQaItem {
  id: string;
  question: string;
  answer: string;
}

export interface TrustBadge {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
}

export interface DeliveryStep {
  id: string;
  icon: string;
  label: string;
  description: string;
}

export interface BreadcrumbTrailItem {
  label: string;
  path?: string;
}

export interface VariantAttributeOption {
  value: string;
  label: string;
  hex: string | null;
  inStock: boolean;
  disabled: boolean;
}

export interface VariantAttributeGroup {
  key: string;
  label: string;
  type: 'swatch' | 'chip' | string;
  options: VariantAttributeOption[];
}

export type ProductStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ProductVariantSku {
  id: string;
  productId: string;
  sku: string;
  variantName: string;
  price: number;
  discountPrice: number | null;
  sellingPrice: number;
  mrp: number;
  discount: number;
  stock: number;
  stockQuantity: number;
  stockStatus: ProductStockStatus;
  inStock: boolean;
  images: string[];
  imagesGallery: ProductImage[];
  thumbnail: string | null;
  keySpecs: ProductKeySpec[];
  specificationRows: ProductSpecRow[];
  attributes: Record<string, string>;
  isDefault: boolean;
}

export interface ProductDetails {
  id: string;
  name: string;
  /** Original catalog product name (never mutated by variant selection). */
  baseName: string;
  brand: string;
  categoryLabel: string;
  subcategoryLabel: string;
  price: number;
  mrp?: number;
  rating: number;
  reviewCount: number;
  answeredQuestions: number;
  inStock: boolean;
  stockQuantity: number;
  stockStatus: ProductStockStatus;
  sku: string;
  deliveryPincode: string;
  warrantyLabel: string;
  images: ProductImage[];
  colors: ProductColorOption[];
  variants: ProductVariantOption[];
  attributeGroups: VariantAttributeGroup[];
  productVariants: ProductVariantSku[];
  selectedVariantId: string | null;
  keySpecs: ProductKeySpec[];
  overviewTitle: string;
  overviewBody: string;
  baseOverviewBody: string;
  overviewHighlights: string[];
  specifications: ProductSpecRow[];
  boxContents?: string[];
  shortDescription?: string;
  deliveryCharge?: number;
  deliveryDays?: number;
  reviews: ProductReviewHighlight[];
  returnsPolicy: string[];
  questions: ProductQaItem[];
  breadcrumbs: BreadcrumbTrailItem[];
  emiPlans?: ProductEmiPlan[];
}

export interface ProductEmiPlan {
  id: string;
  planName?: string;
  months: number;
  downPayment: number;
  serviceCharge: number;
  deliveryCharge: number;
  minEligibilityAmount: number;
  customerVisibility?: string;
  isRecommended: boolean;
  /** Backend-authored fields (Excel model) — preferred when present */
  processingFee?: number;
  loanAmount?: number;
  monthlyEmi?: number;
  upfrontPayment?: number;
  totalPayable?: number;
  loanTotal?: number;
  grandTotal?: number;
}

export interface EmiTenureOption {
  label: string;
  value: number;
}

export interface EmiDownPaymentOption {
  label: string;
  value: number;
}

export interface EmiPlanCard {
  months: number;
  monthlyEmi: number;
  /** Service/convenience (+ delivery); included in EMI principal */
  processingFee: number;
  /** Plan service charge only — do not display delivery under this label. */
  serviceCharge: number;
  /** Plan delivery charge only. */
  deliveryCharge: number;
  downPayment: number;
  /** Sale − DP + Processing Fee (Amount Converted into EMI) */
  loanAmount: number;
  /** Down Payment only */
  upfrontPayment: number;
  /** Sale Price + Processing Fee */
  totalPayable: number;
  /** @deprecated Alias of totalEmi (financed portion) */
  loanTotal: number;
  /** @deprecated Alias of totalPayable */
  grandTotal: number;
  recommended: boolean;
}

export interface EmiPlanSummary {
  productPrice: number;
  downPayment: number;
  processingFee: number;
  serviceCharge: number;
  deliveryCharge: number;
  loanAmount: number;
  monthlyEmi: number;
  upfrontPayment: number;
  totalPayable: number;
  /** @deprecated Alias of totalEmi */
  loanTotal: number;
  /** @deprecated Alias of totalPayable */
  grandTotal: number;
}
