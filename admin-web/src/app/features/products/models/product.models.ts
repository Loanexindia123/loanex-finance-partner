import { resolveMediaUrl } from '../../../core/config/api.config';

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  bgColor?: string;
  status?: string;
  sortOrder?: number;
  parentId?: string | null;
  createdAt?: string;
}

export type ProductVariantStatus = 'active' | 'draft' | 'out_of_stock' | 'archived';

export interface VariantAttribute {
  id: string;
  name: string;
  values: string[];
}

export const PRODUCT_TYPES = ['Smartphone', 'Tablet', 'Laptop', 'Accessories', 'Smartwatch', 'Audio'];
export const COUNTRIES = ['India', 'China', 'Vietnam', 'USA', 'South Korea'];
export const WARRANTIES = ['None', '6 Months', '1 Year', '2 Years', '3 Years'];
export const PRODUCT_CONDITIONS = ['New', 'Refurbished - Like New', 'Refurbished - Good', 'Open Box'];

export function createEmptyAttribute(name: string): VariantAttribute {
  return {
    id: `attr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    values: [],
  };
}

export function normalizeAttribute(raw: unknown, index = 0): VariantAttribute {
  const row = asRecord(raw);
  const values = row['values'];
  return {
    id: pick(row, 'id', `attr-${Date.now()}-${index}`),
    name: pick(row, 'name') || pick(row, 'key') || `Option ${index + 1}`,
    values: Array.isArray(values)
      ? values.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [],
  };
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

/** Matches admin-app ProductVariant — persisted inside wizardData.variants. */
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
  status: ProductVariantStatus;
  saved: boolean;
}

export const GALLERY_IMAGE_LIMIT = 8;

/** Matches backend product-image.service limits. */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export function createEmptyVariant(
  name: string,
  index: number,
  baseSku: string,
  defaults: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: `v-${Date.now()}-${index}`,
    name,
    variantImage: null,
    galleryImages: [],
    sku: `${baseSku || 'SKU'}-${index + 1}`,
    barcode: '',
    mrp: defaults.mrp || '',
    sellingPrice: defaults.sellingPrice || '',
    purchasePrice: defaults.purchasePrice || '',
    stock: defaults.stock || '0',
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
  };
}

function nextListId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pick(row: Record<string, unknown>, key: string, fallback = ''): string {
  const value = row[key];
  return value == null ? fallback : String(value);
}

export function normalizeKeyValueItems(raw: unknown): KeyValueItem[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const row = asRecord(item);
        return {
          id: pick(row, 'id', nextListId('spec', index)),
          key: pick(row, 'key') || pick(row, 'name') || pick(row, 'label'),
          value: pick(row, 'value'),
        };
      }
      return { id: nextListId('spec', index), key: '', value: String(item ?? '') };
    });
  }
  return [];
}

export function normalizeTextListItems(raw: unknown): TextListItem[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      if (typeof item === 'string') {
        return { id: nextListId('text', index), value: item };
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const row = asRecord(item);
        return {
          id: pick(row, 'id', nextListId('text', index)),
          value: pick(row, 'value') || pick(row, 'text') || pick(row, 'label'),
        };
      }
      return { id: nextListId('text', index), value: String(item ?? '') };
    });
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [{ id: nextListId('text', 0), value: raw }];
  }
  return [];
}

export function normalizeVariant(raw: unknown, index = 0): ProductVariant {
  const row = asRecord(raw);
  const status = pick(row, 'status', 'draft');
  const variantImage = row['variantImage'];
  const galleryImages = row['galleryImages'];
  return {
    id: pick(row, 'id', `v-${Date.now()}-${index}`),
    name: pick(row, 'name'),
    variantImage: typeof variantImage === 'string' && variantImage ? variantImage : null,
    galleryImages: Array.isArray(galleryImages)
      ? galleryImages.filter((uri): uri is string => typeof uri === 'string' && !!uri.trim())
      : [],
    sku: pick(row, 'sku'),
    barcode: pick(row, 'barcode'),
    mrp: pick(row, 'mrp'),
    sellingPrice: pick(row, 'sellingPrice'),
    purchasePrice: pick(row, 'purchasePrice'),
    stock: pick(row, 'stock', '0'),
    description: pick(row, 'description'),
    specifications: normalizeKeyValueItems(row['specifications']),
    features: normalizeTextListItems(row['features']),
    boxContents: normalizeTextListItems(row['boxContents']),
    weight: pick(row, 'weight'),
    length: pick(row, 'length'),
    width: pick(row, 'width'),
    height: pick(row, 'height'),
    supplier: pick(row, 'supplier'),
    warehouse: pick(row, 'warehouse'),
    emiPlanId: pick(row, 'emiPlanId'),
    status:
      status === 'active' || status === 'out_of_stock' || status === 'archived' ? status : 'draft',
    saved: row['saved'] === true,
  };
}

/** Matches admin-app SupplierEntry — persisted inside wizardData.suppliers. */
export interface SupplierEntry {
  id: string;
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

export const PAYMENT_TERMS = ['Advance', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'On Delivery'];
export const SETTLEMENT_CYCLES = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];
export const PRODUCT_SOURCES = ['Direct Manufacturer', 'Authorized Distributor', 'Wholesaler', 'Import'];
export const STOCK_OWNERSHIP_TYPES = ['Owned', 'Consignment', 'Marketplace'];
export const SERVICE_CHARGE_METHODS = ['Flat Fee', 'Percentage', 'Tiered', 'None'];
export const INVOICE_SETTINGS = ['Auto Generate', 'Manual', 'Disabled'];
export const DELIVERY_CHARGE_METHODS = ['Fixed Rate', 'Distance Based', 'Weight Based', 'Free Shipping'];
export const CUSTOMER_VISIBILITY = ['Visible', 'Hidden'];

export function createEmptySupplier(): SupplierEntry {
  return {
    id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
  };
}

export function normalizeSupplier(raw: unknown): SupplierEntry {
  const row = asRecord(raw);
  const base = createEmptySupplier();
  return {
    ...base,
    id: pick(row, 'id', base.id),
    supplier: pick(row, 'supplier'),
    dealer: pick(row, 'dealer'),
    wholesaler: pick(row, 'wholesaler'),
    supplierSku: pick(row, 'supplierSku'),
    purchaseInvoice: pick(row, 'purchaseInvoice') || pick(row, 'invoiceNumber'),
    purchaseDate: pick(row, 'purchaseDate'),
    settlementCycle: pick(row, 'settlementCycle'),
    leadTime: pick(row, 'leadTime'),
    paymentTerms: pick(row, 'paymentTerms'),
    notes: pick(row, 'notes'),
    productSource: pick(row, 'productSource'),
    supplierCode: pick(row, 'supplierCode'),
    dealerBranch: pick(row, 'dealerBranch'),
    supplierGstin: pick(row, 'supplierGstin') || pick(row, 'gstin'),
    supplierContact: pick(row, 'supplierContact') || pick(row, 'contact'),
    supplierProductCode: pick(row, 'supplierProductCode'),
    stockOwnership: pick(row, 'stockOwnership'),
    dispatchFrom: pick(row, 'dispatchFrom'),
    firstPaymentPercent: pick(row, 'firstPaymentPercent'),
    deliveryPaymentPercent: pick(row, 'deliveryPaymentPercent'),
    holdPaymentPercent: pick(row, 'holdPaymentPercent'),
    returnToSupplierAllowed: row['returnToSupplierAllowed'] === true,
    dealerIncentivePercent: pick(row, 'dealerIncentivePercent'),
  };
}

export function formatDealerPaymentSchedule(supplier?: SupplierEntry | null): string {
  if (!supplier) return 'No supplier schedule';
  const first = Number(supplier.firstPaymentPercent) || 0;
  const delivery = Number(supplier.deliveryPaymentPercent) || 0;
  const hold = Number(supplier.holdPaymentPercent) || 0;
  if (first > 0 || delivery > 0 || hold > 0) {
    const parts: string[] = [];
    if (first > 0) parts.push(`${first}% at Purchase`);
    if (delivery > 0) parts.push(`${delivery}% after Delivery`);
    if (hold > 0) parts.push(`${hold}% Hold`);
    return parts.join(' / ') + (hold > 0 ? ` · Payment Hold ${hold}%` : '');
  }
  return `${supplier.paymentTerms || 'Net 30'} · Lead ${supplier.leadTime || '—'} days`;
}

/** Matches admin-app EMIPlan — persisted inside wizardData.emiPlans. */
export interface EmiPlanEntry {
  id: string;
  enabled: boolean;
  planName: string;
  months: string;
  downPayment: string;
  serviceCharge: string;
  deliveryCharge: string;
  minEligibilityAmount: string;
  customerVisibility: 'visible' | 'hidden';
}

export function createEmptyEmiPlan(): EmiPlanEntry {
  return {
    id: `emi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    enabled: true,
    planName: '',
    months: '',
    downPayment: '',
    serviceCharge: '',
    deliveryCharge: '',
    minEligibilityAmount: '',
    customerVisibility: 'visible',
  };
}

export function normalizeEmiPlan(raw: unknown): EmiPlanEntry {
  const row = asRecord(raw);
  const base = createEmptyEmiPlan();
  const visibility = pick(row, 'customerVisibility', 'visible').toLowerCase();
  return {
    ...base,
    id: pick(row, 'id', base.id),
    enabled: row['enabled'] !== false,
    planName: pick(row, 'planName'),
    months: pick(row, 'months'),
    downPayment: pick(row, 'downPayment'),
    serviceCharge: pick(row, 'serviceCharge'),
    deliveryCharge: pick(row, 'deliveryCharge'),
    minEligibilityAmount: pick(row, 'minEligibilityAmount'),
    customerVisibility:
      visibility === 'hidden' || visibility === 'members_only' ? 'hidden' : 'visible',
  };
}

/**
 * Ported from admin-app/src/modules/products/types/product.ts — a pragmatic
 * subset of the mobile app's ~95-field ProductFormData, grouped by the same
 * 11 wizard steps. Preserves the same flattened-plus-nested submit shape;
 * does not attempt literal 1:1 field parity with the mobile wizard.
 */
export interface ProductWizardData {
  // Step 1 — Basic info
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
  description: string;
  features: string[];
  boxContents: string[];
  productVideoUrl: string;
  colourSizeVariant: string;
  serialImeiTracking: boolean;
  specifications: KeyValueItem[];

  // Step 2 — Category
  category: string;
  subCategory: string;
  childCategory: string;

  // Step 3 — Variants
  variantsEnabled: boolean;
  attributes: VariantAttribute[];
  variants: ProductVariant[];

  // Step 4 — Images
  primaryImage: string;
  galleryImages: string[];

  // Step 5 — Pricing
  mrp: string;
  sellingPrice: string;
  purchasePrice: string;
  gst: string;
  amazonPrice: string;
  flipkartPrice: string;
  otherWebsitePrice: string;
  marketLowestPrice: string;
  priceCheckedDate: string;
  priceCheckedBy: string;
  priceMatchAllowed: boolean;
  maximumDiscountAllowed: string;
  gstAmount: string;
  landingCost: string;
  margin: string;
  discount: string;

  // Step 6 — Inventory
  warehouse: string;
  openingStock: string;
  availableStock: string;
  reservedStock: string;
  minimumQuantity: string;
  maximumQuantity: string;
  minOrderQuantity: string;
  maxQuantityPerCustomer: string;
  minimumCustomerAge: string;
  eligiblePinCodes: string;
  trackInventory: boolean;
  cashPurchase: boolean;
  invoiceSetting: string;
  requiresFieldVerification: boolean;
  requiresSerialImeiCapture: boolean;

  // Step 7 — Supplier
  suppliers: SupplierEntry[];

  // Step 8 — Delivery
  weight: string;
  length: string;
  width: string;
  height: string;
  dispatchSla: string;
  deliveryCharges: string;
  deliveryDays: string;
  replacementWindow: string;
  replacementDays: string;
  replacementWindowDays: string;
  deliveryCode: string;
  deliveryChargeMethod: string;
  installationCharge: string;
  installationRequired: boolean;
  deliveryPartner: string;
  deliveryZone: string;
  expressDelivery: boolean;
  deliveryConfirmationOtp: boolean;
  serialImeiCaptureAtDelivery: boolean;

  // Step 9 — EMI
  emiEnabled: boolean;
  selectedEmiPlanId: string;
  emiPlans: EmiPlanEntry[];
  defaultDownPaymentPercent: string;
  minCustomerDownPayment: string;
  maxDownPayment: string;
  downPaymentEditableAtApproval: boolean;
  serviceChargeMethod: string;
  documentationCharge: string;
  verificationCharge: string;
  firstEmiDueAfter: string;
  gracePeriod: string;

  // Step 10 — SEO
  slug: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
}

export function initialWizardData(): ProductWizardData {
  return {
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
    features: [],
    boxContents: [],
    productVideoUrl: '',
    colourSizeVariant: '',
    serialImeiTracking: false,
    specifications: [],
    category: '',
    subCategory: '',
    childCategory: '',
    variantsEnabled: false,
    attributes: [],
    variants: [],
    primaryImage: '',
    galleryImages: [],
    mrp: '',
    sellingPrice: '',
    purchasePrice: '',
    gst: '',
    amazonPrice: '',
    flipkartPrice: '',
    otherWebsitePrice: '',
    marketLowestPrice: '',
    priceCheckedDate: '',
    priceCheckedBy: '',
    priceMatchAllowed: false,
    maximumDiscountAllowed: '',
    gstAmount: '',
    landingCost: '',
    margin: '',
    discount: '',
    warehouse: '',
    openingStock: '',
    availableStock: '',
    reservedStock: '',
    minimumQuantity: '',
    maximumQuantity: '',
    minOrderQuantity: '',
    maxQuantityPerCustomer: '',
    minimumCustomerAge: '',
    eligiblePinCodes: '',
    trackInventory: true,
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
    deliveryDays: '',
    replacementWindow: '',
    replacementDays: '',
    replacementWindowDays: '',
    deliveryCode: '',
    deliveryChargeMethod: '',
    installationCharge: '',
    installationRequired: false,
    deliveryPartner: '',
    deliveryZone: '',
    expressDelivery: false,
    deliveryConfirmationOtp: false,
    serialImeiCaptureAtDelivery: false,
    emiEnabled: false,
    selectedEmiPlanId: '',
    emiPlans: [],
    defaultDownPaymentPercent: '',
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
}

export const WIZARD_STEPS = [
  'Basic Info',
  'Category',
  'Variants',
  'Images',
  'Pricing',
  'Inventory',
  'Supplier',
  'Delivery',
  'EMI',
  'SEO',
  'Review',
] as const;

export const WIZARD_STEP_META: ReadonlyArray<{
  title: (typeof WIZARD_STEPS)[number];
  description: string;
  icon: string;
}> = [
  { title: 'Basic Info', description: 'Name, brand, identifiers and product description.', icon: 'pi-info-circle' },
  { title: 'Category', description: 'Place this product in the catalogue taxonomy.', icon: 'pi-th-large' },
  { title: 'Variants', description: 'Optional named SKUs — colour, size, storage, and more.', icon: 'pi-clone' },
  { title: 'Images', description: 'Primary and gallery image URLs used on the storefront.', icon: 'pi-images' },
  { title: 'Pricing', description: 'MRP, selling price and marketplace comparison.', icon: 'pi-wallet' },
  { title: 'Inventory', description: 'Stock, warehouse and order quantity rules.', icon: 'pi-box' },
  { title: 'Supplier', description: 'Vendor, lead time and commercial terms.', icon: 'pi-truck' },
  { title: 'Delivery', description: 'Dispatch SLA, charges and fulfilment options.', icon: 'pi-send' },
  { title: 'EMI', description: 'LoanEx EMI availability and plan configuration.', icon: 'pi-credit-card' },
  { title: 'SEO', description: 'Slug, meta tags and search keywords.', icon: 'pi-search' },
  { title: 'Review', description: 'Confirm every section before saving or publishing.', icon: 'pi-check-circle' },
];

/** Matches backend `LOW_STOCK_THRESHOLD` in inventory.ts. */
export const LOW_STOCK_THRESHOLD = 5;

export type ProductStockState = 'healthy' | 'low' | 'out';

export function productStockQty(product: Pick<Product, 'availableStock' | 'stock'>): number {
  return Number(product.availableStock ?? product.stock ?? 0);
}

export function productStockState(
  product: Pick<Product, 'availableStock' | 'stock'>,
): ProductStockState {
  const qty = productStockQty(product);
  if (qty <= 0) return 'out';
  if (qty <= LOW_STOCK_THRESHOLD) return 'low';
  return 'healthy';
}

/** Collects only real image URLs already present on the product / wizard payload. */
export function productImageUrls(product: Product): string[] {
  const urls: string[] = [];
  const add = (value?: string | null) => {
    const url = resolveMediaUrl(value);
    if (url && !urls.includes(url)) urls.push(url);
  };
  add(product.image);
  add(product.imageUrl);
  add(product.thumbnail);
  (product.images ?? []).forEach(add);
  (product.galleryImages ?? []).forEach(add);
  add(product.wizardData?.primaryImage);
  (product.wizardData?.galleryImages ?? []).forEach(add);
  return urls;
}

/** Catalog record as returned by GET /products and GET /products/:id. */
export interface Product {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  brand?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  /** Resolved category name returned by the product API. */
  category?: string;
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  images?: string[];
  galleryImages?: string[];
  price: number;
  mrp?: number;
  sellingPrice?: number;
  stock?: number;
  availableStock?: number;
  stockStatus?: string;
  status: 'active' | 'inactive' | 'draft' | string;
  emiAvailable?: boolean;
  featured?: boolean;
  trending?: boolean;
  recommended?: boolean;
  warranty?: string;
  hsnCode?: string;
  manufacturer?: string;
  createdAt?: string;
  updatedAt?: string;
  specifications?: unknown;
  features?: unknown;
  wizardData?: Partial<ProductWizardData>;
  variants?: ProductVariant[];
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  featured?: boolean;
  trending?: boolean;
  recommended?: boolean;
  search?: string;
  status?: 'all' | 'active' | 'inactive' | 'draft';
  availability?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'ALL';
}

/** GET /products returns a paginated envelope, not a bare array. */
export interface ProductListPage {
  items: Product[];
  total: number;
  page?: number;
  limit?: number;
}

/** POST /products / PUT /products/:id body — flattened catalog fields plus the full wizard state. */
export interface ProductPayload {
  name: string;
  sku?: string;
  brand?: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  image?: string;
  galleryImages?: string[];
  price: number;
  mrp?: number;
  stock?: number;
  status: 'active' | 'draft' | 'inactive';
  emiAvailable?: boolean;
  warranty?: string;
  hsnCode?: string;
  manufacturer?: string;
  wizardData: ProductWizardData;
}
