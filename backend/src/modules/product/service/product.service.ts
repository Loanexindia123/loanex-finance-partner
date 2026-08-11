import { randomUUID } from 'crypto';
import { NotFoundError } from '../../../common/errors/app-error';
import { jsonDb } from '../../../config/json-db';
import { calculateEmiBreakdown } from '../../loan/service/emi-calculator.service';
import { stockState } from '../../../common/utils/inventory';
import type { ListProductsQuery } from '../dto/product.dto';
import { productRepository } from '../repository/product.repository';
import { deleteOrphanedProductImages, persistInlineProductImages } from './product-image.service';
import {
  isCustomerVisibleProduct,
  resolveCustomerFacingName,
} from '../utils/customer-visibility';
import type { Product } from '../../../types/database.types';
type ProductVariant = any;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toNumber(value: { toNumber?: () => number } | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
}

function toStr(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = typeof value === 'string' ? value.trim() : String(value);
  return s === '' ? undefined : s;
}

function toInt(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? fallback : n;
}

function toFloat(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? fallback : n;
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off', ''].includes(s)) return false;
  const n = Number(s);
  return Number.isFinite(n) ? n > 0 : fallback;
}

function toDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

type ProductSpecs = {
  warranty?: string;
  highlights?: string[];
  keySpecs?: Array<{ id: string; icon: string; label: string; value: string }>;
  rows?: Array<{ label: string; value: string }>;
  colors?: Array<{ id: string; name: string; hex: string }>;
  returnsPolicy?: string[];
  questions?: Array<{ id: string; question: string; answer: string }>;
};

type VariantSpecs = {
  keySpecs?: Array<{ id: string; icon: string; label: string; value: string }>;
  rows?: Array<{ label: string; value: string }>;
};

const META_ATTRIBUTE_KEYS = new Set(['colorhex', 'hex', 'swatch', 'image']);

const KEY_SPEC_ICONS = [
  'pi pi-mobile',
  'pi pi-desktop',
  'pi pi-cog',
  'pi pi-bolt',
  'pi pi-wifi',
  'pi pi-camera',
  'pi pi-box',
  'pi pi-check-circle',
];

function parseImages(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function asNonEmptyString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function normalizeWarrantyLabel(raw: unknown): string | undefined {
  const value = asNonEmptyString(raw);
  if (!value) return undefined;
  return /warranty/i.test(value) ? value : `${value} Warranty`;
}

function normalizeFeatureList(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return asNonEmptyString((item as any).value ?? (item as any).label ?? (item as any).text) ?? '';
      }
      return '';
    })
    .filter(Boolean);
}

function normalizeBoxContents(boxContents: unknown): string[] {
  return normalizeFeatureList(boxContents);
}

function keyValueArrayToRows(
  specifications: unknown,
): Array<{ label: string; value: string }> {
  if (!Array.isArray(specifications)) return [];
  return specifications
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = asNonEmptyString((item as any).key ?? (item as any).label ?? (item as any).name);
      const value = asNonEmptyString((item as any).value);
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
}

function rowsToKeySpecs(
  rows: Array<{ label: string; value: string }>,
): Array<{ id: string; icon: string; label: string; value: string }> {
  return rows.slice(0, 8).map((row, index) => ({
    id: `spec-${index + 1}`,
    icon: KEY_SPEC_ICONS[index % KEY_SPEC_ICONS.length],
    label: row.label,
    value: row.value,
  }));
}

function parseSpecs(specifications: unknown): ProductSpecs {
  if (!specifications) return {};

  // Admin wizard stores KeyValueItem[] — convert to PDP rows/keySpecs.
  if (Array.isArray(specifications)) {
    const rows = keyValueArrayToRows(specifications);
    return {
      rows,
      keySpecs: rowsToKeySpecs(rows),
    };
  }

  if (typeof specifications === 'object') {
    const obj = specifications as ProductSpecs & {
      specifications?: unknown;
      features?: unknown;
    };
    // Nested arrays inside an object payload
    if (Array.isArray((obj as any).rows) || Array.isArray(obj.keySpecs)) {
      return obj;
    }
    const nestedRows = keyValueArrayToRows((obj as any).items ?? (obj as any).list);
    if (nestedRows.length > 0) {
      return {
        ...obj,
        rows: nestedRows,
        keySpecs:
          Array.isArray((obj as any).keySpecs) && (obj as any).keySpecs.length > 0
            ? (obj as any).keySpecs
            : rowsToKeySpecs(nestedRows),
      };
    }
    return obj;
  }

  return {};
}

function parseVariantSpecs(specifications: unknown): VariantSpecs {
  const parsed = parseSpecs(specifications);
  return {
    keySpecs: parsed.keySpecs ?? [],
    rows: parsed.rows ?? [],
  };
}

function buildReturnsPolicy(product: any, specs: ProductSpecs): string[] {
  if (Array.isArray(specs.returnsPolicy) && specs.returnsPolicy.length > 0) {
    return specs.returnsPolicy;
  }
  const days =
    toNumber(product.replacementDays) ||
    toNumber(product.wizardData?.replacementDays) ||
    (product.replacementWindow ? 7 : 0);
  if (days > 0) {
    return [
      `${days}-day replacement available on eligible products.`,
      'Product must be unused and returned in original packaging with all accessories.',
      'Replacement request can be raised from My Orders after delivery.',
    ];
  }
  return [];
}

function resolveWarrantyLabel(product: any, specs: ProductSpecs): string {
  return (
    normalizeWarrantyLabel(product.warranty) ||
    normalizeWarrantyLabel(product.wizardData?.warranty) ||
    normalizeWarrantyLabel(specs.warranty) ||
    'Manufacturer Warranty'
  );
}

function resolveOverviewHighlights(product: any, specs: ProductSpecs): string[] {
  if (Array.isArray(specs.highlights) && specs.highlights.length > 0) {
    return specs.highlights;
  }
  const fromFeatures = normalizeFeatureList(product.features);
  if (fromFeatures.length > 0) return fromFeatures;
  return normalizeFeatureList(product.wizardData?.features);
}

function resolveSpecificationPayload(product: any): ProductSpecs {
  const top = parseSpecs(product.specifications);
  if ((top.rows?.length ?? 0) > 0 || (top.keySpecs?.length ?? 0) > 0) {
    return top;
  }
  return parseSpecs(product.wizardData?.specifications);
}

/** Build lightweight variants from wizard when product.variants table is empty. */
function mapWizardVariants(product: any): ReturnType<typeof mapVariant>[] {
  const wizardVariants = Array.isArray(product?.wizardData?.variants)
    ? product.wizardData.variants
    : [];
  if (wizardVariants.length === 0) return [];

  return wizardVariants
    .filter((variant: any) => {
      if (!variant) return false;
      // Skip incomplete draft rows from the admin wizard
      if (variant.saved === false && !asNonEmptyString(variant.sellingPrice) && toNumber(variant.stock) <= 0) {
        return false;
      }
      return Boolean(asNonEmptyString(variant.name) || asNonEmptyString(variant.sku));
    })
    .map((variant: any, index: number) => {
      const name = asNonEmptyString(variant.name) || `Variant ${index + 1}`;
      const stock = toNumber(variant.stock ?? variant.availableStock);
      const sellingPrice =
        toNumber(variant.sellingPrice) || toNumber(product.price) || toNumber(product.sellingPrice);
      const mrp = toNumber(variant.mrp) || toNumber(product.mrp) || sellingPrice;
      const images = parseImages(
        variant.galleryImages?.length
          ? variant.galleryImages
          : variant.variantImage
            ? [variant.variantImage]
            : [],
      );
      const attributes: Record<string, string> = {};
      if (/gb|tb|inch|kg|l\b|ton/i.test(name)) {
        attributes['Option'] = name;
      } else {
        attributes['Color'] = name;
      }

      return {
        id: String(variant.id || `wizard-variant-${index + 1}`),
        productId: product.id,
        sku: asNonEmptyString(variant.sku) || `${product.sku || 'SKU'}-${index + 1}`,
        price: mrp,
        discountPrice: sellingPrice < mrp ? sellingPrice : null,
        sellingPrice,
        mrp,
        discount: Math.max(mrp - sellingPrice, 0),
        stock,
        stockQuantity: stock,
        inStock: stock > 0,
        images,
        imagesGallery: images.map((src: string, imgIndex: number) => ({
          id: `${variant.id || index}-img-${imgIndex + 1}`,
          src,
          alt: `${name} image ${imgIndex + 1}`,
        })),
        thumbnail: images[0] ?? null,
        specifications: variant.specifications,
        keySpecs: [],
        specificationRows: [],
        attributes,
        isDefault: index === 0,
        variantName: name,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    })
    .filter((v: any) => Boolean(v.id));
}

function parseAttributes(attributes: unknown): Record<string, string> {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number') {
      result[key] = String(value);
    }
  }
  return result;
}

function isSelectorAttribute(key: string): boolean {
  return !META_ATTRIBUTE_KEYS.has(key.toLowerCase());
}

function humanizeAttributeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapVariant(variant: ProductVariant) {
  const mrp = toNumber(variant.price);
  const discountPrice = variant.discountPrice == null ? null : toNumber(variant.discountPrice);
  const sellingPrice = discountPrice ?? mrp;
  const images = parseImages(variant.images);
  const attributes = parseAttributes(variant.attributes);
  const specs = parseVariantSpecs(variant.specifications);
  const stock = toNumber(variant.stock);
  const inStock = stock > 0;

  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    price: mrp,
    discountPrice,
    sellingPrice,
    mrp,
    discount: Math.max(mrp - sellingPrice, 0),
    stock,
    stockQuantity: stock,
    stockStatus: stockState(stock),
    inStock,
    images,
    imagesGallery: images.map((src: string, index: number) => ({
      id: `${variant.id}-img-${index + 1}`,
      src,
      alt: `${variant.variantName} image ${index + 1}`,
    })),
    thumbnail: images[0] ?? null,
    variantName: (variant as any).variantName ?? (variant as any).name ?? variant.sku,
    specifications: variant.specifications,
    keySpecs: specs.keySpecs ?? [],
    specificationRows: specs.rows ?? [],
    attributes,
    isDefault: variant.isDefault,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

function buildAttributeGroups(variants: ReturnType<typeof mapVariant>[]) {
  const keyOrder: string[] = [];
  const valuesByKey = new Map<string, Map<string, { value: string; hex?: string; inStock: boolean }>>();

  for (const variant of variants) {
    for (const [rawKey, rawValue] of Object.entries(variant.attributes)) {
      if (!isSelectorAttribute(rawKey)) continue;
      const key = rawKey;
      if (!valuesByKey.has(key)) {
        valuesByKey.set(key, new Map());
        keyOrder.push(key);
      }
      const bucket = valuesByKey.get(key)!;
      const existing = bucket.get(rawValue);
      const hexKey = Object.keys(variant.attributes).find(
        (attr) => attr.toLowerCase() === `${key.toLowerCase()}hex` || (key.toLowerCase() === 'color' && attr.toLowerCase() === 'colorhex'),
      );
      const hex = hexKey ? variant.attributes[hexKey] : undefined;
      bucket.set(rawValue, {
        value: rawValue,
        hex: hex ?? existing?.hex,
        inStock: Boolean(existing?.inStock) || variant.inStock,
      });
    }
  }

  return keyOrder.map((key) => ({
    key,
    label: humanizeAttributeKey(key),
    type: key.toLowerCase() === 'color' ? 'swatch' : 'chip',
    options: Array.from(valuesByKey.get(key)!.values()).map((option) => ({
      value: option.value,
      label: option.value,
      hex: option.hex ?? null,
      inStock: option.inStock,
      disabled: !option.inStock,
    })),
  }));
}

function pickDefaultVariant(variants: ReturnType<typeof mapVariant>[]) {
  return variants.find((row) => row.isDefault) ?? variants.find((row) => row.inStock) ?? variants[0] ?? null;
}

function mapProduct(
  product: Product,
  stats: { averageRating: number; reviewCount: number } = { averageRating: 0, reviewCount: 0 },
) {
  const selling = toNumber(product.price);
  const listedMrp = toNumber((product as any).mrp);
  const mrp = listedMrp > 0 ? listedMrp : selling;
  const discountPrice =
    product.discountPrice == null
      ? mrp > selling
        ? selling
        : null
      : toNumber(product.discountPrice);
  const sellingPrice = discountPrice ?? selling;
  const discount = Math.max(mrp - sellingPrice, 0);
  const parsedGallery = parseImages(product.galleryImages);
  const images = product.image
    ? [product.image, ...parsedGallery.filter((img) => img !== product.image)]
    : parsedGallery;  const inStock =
    (product.status === 'active' || (product as any).isActive !== false) &&
    toNumber(product.stock) > 0;
  const liveReviewCount = stats.reviewCount;
  const liveAverageRating = stats.averageRating;
  const averageRating =
    liveReviewCount > 0
      ? Math.round(liveAverageRating * 10) / 10
      : Math.round(toNumber(product.rating) * 10) / 10;
  const reviewCount = liveReviewCount > 0 ? liveReviewCount : product.totalReviews;

  return {
    ...product,
    id: product.id,
    name: resolveCustomerFacingName(product),
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    brand: product.brand,
    category: product.category,
    price: sellingPrice,
    discountPrice,
    sellingPrice,
    mrp,
    discount,
    stock: toNumber(product.stock),
    stockQuantity: toNumber(product.stock),
    stockStatus: stockState(toNumber(product.stock)),
    inStock,
    sku: product.sku,
    thumbnail: product.image,
    imageUrl: product.image,
    images,
    specifications: product.specifications,
    emiAvailable: product.emiAvailable,
    emiStartingFrom: product.emiStartingFrom == null ? null : toNumber(product.emiStartingFrom),
    rating: toNumber(product.rating),
    totalReviews: product.totalReviews,
    averageRating,
    reviewCount,
    isFeatured: Boolean((product as any).featured ?? product.isFeatured),
    featured: Boolean((product as any).featured ?? product.isFeatured),
    trending: Boolean((product as any).trending),
    recommended: Boolean((product as any).recommended),
    newArrival: Boolean((product as any).recommended || (product as any).newArrival),
    status: product.status ?? 'active',
    deliveryCharge:
      toNumber((product as any).deliveryCharges) || toNumber(product.deliveryCharge),
    createdAt: product.createdAt,
    colourSizeVariant: (product as any).colourSizeVariant ?? null,
    features: (product as any).features ?? null,
    keywords: (product as any).keywords ?? null,
    wizardData: (product as any).wizardData,
  };
}

/**
 * Prefer normalized product_emi_plans rows; fall back to wizardData.emiPlans
 * (admin often saves plans only inside wizardData).
 */
function resolveRawEmiPlans(product: any): any[] {
  const fromTable = Array.isArray(product?.productEmiPlans) ? product.productEmiPlans : [];
  const fromWizard = Array.isArray(product?.wizardData?.emiPlans)
    ? product.wizardData.emiPlans
    : [];
  const source = fromTable.length > 0 ? fromTable : fromWizard;

  return source.filter((plan: any) => {
    if (!plan) return false;
    if (plan.enabled === false) return false;
    const months = toNumber(plan.months);
    return months > 0;
  });
}

function mapPdpProduct(
  product: Product & { },
  stats: { averageRating: number; reviewCount: number },
) {
  const base = mapProduct(product, stats);
  const specs = resolveSpecificationPayload(product);
  const tableVariants = (product.variants ?? []).map(mapVariant);
  const mappedVariants =
    tableVariants.length > 0 ? tableVariants : mapWizardVariants(product);
  const selectedVariant = pickDefaultVariant(mappedVariants);
  const attributeGroups = buildAttributeGroups(mappedVariants);

  const images = selectedVariant?.images?.length ? selectedVariant.images : base.images;
  const sellingPrice = selectedVariant?.sellingPrice ?? base.sellingPrice;
  const mrp = selectedVariant?.mrp ?? base.mrp;
  const discountPrice = selectedVariant?.discountPrice ?? base.discountPrice;
  const stock = selectedVariant?.stock ?? base.stock;
  const sku = selectedVariant?.sku ?? base.sku;
  const inStock = (product.status === 'active' || (product as any).isActive !== false) && stock > 0;
  const stockStatus = stockState(stock);
  const keySpecs =
    selectedVariant?.keySpecs?.length ? selectedVariant.keySpecs : (specs.keySpecs ?? []);
  const specificationRows =
    selectedVariant?.specificationRows?.length
      ? selectedVariant.specificationRows
      : (specs.rows ?? []);

  // Backward-compatible colors/variants arrays derived from real attribute groups
  const colorGroup = attributeGroups.find((group) => group.key.toLowerCase() === 'color');
  const colors =
    colorGroup?.options.map((option, index) => ({
      id: `color-${index + 1}`,
      name: option.label,
      hex: option.hex ?? '#cccccc',
    })) ??
    specs.colors ??
    [];

  const nonColorGroups = attributeGroups.filter((group) => group.key.toLowerCase() !== 'color');
  const legacyVariants =
    nonColorGroups.length === 1
      ? nonColorGroups[0].options.map((option, index) => ({
          id: `cfg-${index + 1}`,
          label: option.label,
        }))
      : (specs as any).variants ?? [];

  const emiPlans = resolveRawEmiPlans(product).map((plan: any) => {
    const months = Math.max(0, Math.floor(toNumber(plan.months)));
    const downPayment = toNumber(plan.downPayment);
    const serviceCharge = toNumber(plan.serviceCharge);
    const deliveryCharge = toNumber(plan.deliveryCharge);
    // Client Excel model: 0% interest; fee included in EMI principal.
    const calc = calculateEmiBreakdown({
      productPrice: sellingPrice,
      downPayment,
      processingFee: serviceCharge + deliveryCharge,
      tenureMonths: months,
    });

    return {
      id: plan.id,
      planName: plan.planName,
      months,
      downPayment: calc.downPayment,
      downPaymentAmount: calc.downPayment,
      serviceCharge,
      deliveryCharge,
      processingFee: calc.processingFee,
      minEligibilityAmount: toNumber(plan.minEligibilityAmount),
      customerVisibility: plan.customerVisibility,
      isRecommended: Boolean(plan.isRecommended) || months === 6,
      loanAmount: calc.loanAmount,
      monthlyEmi: calc.monthlyEmi,
      upfrontPayment: calc.upfrontPayment,
      loanTotal: calc.loanTotal,
      grandTotal: calc.totalPayable,
      totalPayable: calc.totalPayable,
    };
  });

  const emiStartingFrom =
    emiPlans.length > 0
      ? Math.min(...emiPlans.map((plan: { monthlyEmi: number }) => plan.monthlyEmi))
      : undefined;

  const wizard = (product as any).wizardData ?? {};
  const subcategoryLabel =
    asNonEmptyString((product as any).subCategory) ||
    asNonEmptyString(wizard.subCategory) ||
    asNonEmptyString(wizard.childCategory) ||
    product.brand;
  const boxContents = normalizeBoxContents(
    (product as any).boxContents ?? wizard.boxContents,
  );
  const deliveryCharge =
    toNumber((product as any).deliveryCharges) ||
    toNumber((product as any).deliveryCharge) ||
    toNumber(wizard.deliveryCharges) ||
    0;
  const deliveryDays =
    toNumber((product as any).deliveryDays) || toNumber(wizard.deliveryDays) || undefined;
  const shortDescription =
    asNonEmptyString((product as any).shortDescription) ||
    asNonEmptyString(wizard.shortDescription) ||
    undefined;

  return {
    ...base,
    price: sellingPrice,
    discountPrice,
    sellingPrice,
    mrp,
    discount: Math.max(mrp - sellingPrice, 0),
    stock,
    stockQuantity: stock,
    stockStatus,
    inStock,
    sku,
    thumbnail: images[0] ?? base.thumbnail,
    imageUrl: images[0] ?? base.imageUrl,
    images,
    imagesGallery: images.map((src: string, index: number) => ({
      id: `img-${index + 1}`,
      src,
      alt: `${product.name} image ${index + 1}`,
    })),
    categoryLabel: product.category,
    subcategoryLabel,
    shortDescription,
    overviewTitle: product.name,
    overviewBody: product.description || shortDescription || '',
    overviewHighlights: resolveOverviewHighlights(product, specs),
    keySpecs,
    specificationRows,
    boxContents,
    colors,
    variants: legacyVariants,
    attributeGroups,
    productVariants: mappedVariants,
    selectedVariantId: selectedVariant?.id ?? null,
    selectedVariant,
    warrantyLabel: resolveWarrantyLabel(product, specs),
    returnsPolicy: buildReturnsPolicy(product, specs),
    questions: specs.questions ?? [],
    deliveryCharge,
    deliveryDays,
    emiPlans,
    emiStartingFrom: emiStartingFrom ?? base.emiStartingFrom,
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Products', path: '/products' },
      { label: product.category, path: `/products?category=${encodeURIComponent(product.category)}` },
      { label: product.name, path: `/products/${product.slug}` },
    ],
  };
}

export class ProductService {
  async list(query: ListProductsQuery) {
    const [{ rows, total }, filters] = await Promise.all([
      productRepository.list(query),
      productRepository.getDistinctFilters(),
    ]);

    const productIds = rows.map((row) => row.id);
    const statsMap = await productRepository.getReviewStats(productIds);

    const items = rows.map((product) =>
      mapProduct(product, statsMap.get(product.id) ?? { averageRating: 0, reviewCount: 0 }),
    );

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
      filters,
    };
  }

  async getById(productId: string, options?: { allowHidden?: boolean }) {
    const product = await productRepository.findByIdWithVariants(productId);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }

    if (!options?.allowHidden && !isCustomerVisibleProduct(product)) {
      throw new NotFoundError('Product not found.');
    }

    const statsMap = await productRepository.getReviewStats([productId]);
    const stats = statsMap.get(productId) ?? { averageRating: 0, reviewCount: 0 };

    return mapPdpProduct(product, stats);
  }

  async getBySlug(slug: string, options?: { allowHidden?: boolean }) {
    const product = await productRepository.findBySlugWithVariants(slug);
    if (!product) {
      throw new NotFoundError('Product not found.');
    }

    if (!options?.allowHidden && !isCustomerVisibleProduct(product)) {
      throw new NotFoundError('Product not found.');
    }

    const statsMap = await productRepository.getReviewStats([product.id]);
    const stats = statsMap.get(product.id) ?? { averageRating: 0, reviewCount: 0 };

    return mapPdpProduct(product, stats);
  }

  async getVariantForProduct(productId: string, variantId: string) {
    const variant = await productRepository.findVariantForProduct(productId, variantId);
    if (!variant) {
      throw new NotFoundError('Product variant not found.');
    }
    return mapVariant(variant);
  }

  
  private mapPayloadToPrisma(data: any): any {
    const payload = data.wizardData || data;

    const rawCategoryRef =
      toStr(payload.category) || toStr(data.categoryId) || toStr(data.category) || undefined;

    let resolvedCategoryId = rawCategoryRef;
    let resolvedCategoryName = toStr(data.category);

    if (rawCategoryRef) {
      const byId = jsonDb.findOne('categories', { id: rawCategoryRef });
      const byName = jsonDb
        .getCollection('categories')
        .find((c: any) => String(c.name || '').toLowerCase() === rawCategoryRef.toLowerCase());
      const matched = byId || byName;
      if (matched) {
        resolvedCategoryId = matched.id;
        resolvedCategoryName = matched.name;
      } else if (!isUuid(rawCategoryRef)) {
        // Admin wizard often sends the category display name.
        resolvedCategoryName = rawCategoryRef;
        resolvedCategoryId = undefined;
      }
    }

    const mapped: any = {
      name: payload.productName || data.name,
      sku: toStr(payload.sku) || data.sku,
      brand: toStr(payload.brand) || data.brand,
      description: payload.description || data.description,
      categoryId: resolvedCategoryId,
      category: resolvedCategoryName,
      image: payload.primaryImage || data.image,
      price: toFloat(payload.sellingPrice ?? data.price, 0),
      mrp: toFloat(payload.mrp ?? data.mrp, 0),
      stock: toInt(payload.availableStock ?? data.stock, 0),
      status: data.status || 'active',
      emiAvailable: toBool(payload.emiEnabled ?? data.emiAvailable, true),
      featured: toBool(payload.featured ?? data.featured, false),
      trending: toBool(payload.trending ?? data.trending, false),
      recommended: toBool(
        payload.recommended ?? data.recommended ?? data.newArrival ?? payload.newArrival,
        false,
      ),
      emiStartingFrom: toFloat(payload.emiStartingFrom ?? data.emiStartingFrom),
      shortDescription: payload.shortDescription || data.shortDescription,
      galleryImages: payload.galleryImages || data.galleryImages || [],
      warranty: payload.warranty || data.warranty,
      hsnCode: toStr(payload.hsnCode) || data.hsnCode,
      manufacturer: toStr(payload.manufacturer) || data.manufacturer,

      productType: toStr(payload.productType),
      modelNumber: toStr(payload.modelNumber),
      barcode: toStr(payload.barcode),
      countryOfOrigin: toStr(payload.countryOfOrigin),
      productCondition: toStr(payload.productCondition),

      specifications: payload.specifications || data.specifications || undefined,
      features: payload.features || data.features || undefined,
      boxContents: payload.boxContents || data.boxContents || undefined,
      productVideoUrl: toStr(payload.productVideoUrl) || toStr(data.productVideoUrl),

      subCategoryId: toStr(payload.subCategory) || toStr(data.subCategoryId) || undefined,
      childCategoryId: toStr(payload.childCategory) || toStr(data.childCategoryId) || undefined,
      colourSizeVariant:
        payload.colourSizeVariant || data.colourSizeVariant || undefined,
      // Variants must persist on the product row — cart/checkout/wishlist/PDP
      // all resolve variant selection from product.variants.
      variants:
        payload.variants ?? data.variants ?? undefined,
      metaTitle: toStr(payload.metaTitle),
      metaDescription: toStr(payload.metaDescription),
      keywords: Array.isArray(payload.keywords) ? payload.keywords.join(', ') : toStr(payload.keywords),

      purchasePrice: toFloat(payload.purchasePrice),
      gst: toFloat(payload.gst),
      discount: toFloat(payload.discount),
      landingCost: toFloat(payload.landingCost),
      margin: toFloat(payload.margin),
      gstAmount: toFloat(payload.gstAmount),
      amazonPrice: toFloat(payload.amazonPrice),
      flipkartPrice: toFloat(payload.flipkartPrice),
      otherWebsitePrice: toFloat(payload.otherWebsitePrice),
      marketLowestPrice: toFloat(payload.marketLowestPrice),
      priceCheckedDate: toDate(payload.priceCheckedDate),
      priceCheckedBy: toStr(payload.priceCheckedBy),
      priceMatchAllowed: toBool(payload.priceMatchAllowed, false),
      maximumDiscountAllowed: toFloat(payload.maximumDiscountAllowed),

      warehouseId: toStr(payload.warehouse) || undefined,
      openingStock: toInt(payload.openingStock, 0),
      availableStock: toInt(payload.availableStock, 0),
      reservedStock: toInt(payload.reservedStock, 0),
      minimumQuantity: toInt(payload.minimumQuantity, 1),
      maximumQuantity: toInt(payload.maximumQuantity),
      trackInventory: toBool(payload.trackInventory, true),
      serialImeiTracking: toBool(payload.serialImeiTracking, false),
      requiresSerialImeiCapture: toBool(payload.requiresSerialImeiCapture, false),
      minOrderQuantity: toInt(payload.minOrderQuantity, 1),
      maxQuantityPerCustomer: toInt(payload.maxQuantityPerCustomer),
      minimumCustomerAge: toInt(payload.minimumCustomerAge),
      eligiblePinCodes: payload.eligiblePinCodes,
      cashPurchase: toBool(payload.cashPurchase, false),
      invoiceSetting: toStr(payload.invoiceSetting),
      requiresFieldVerification: toBool(payload.requiresFieldVerification, false),

      weight: toFloat(payload.weight),
      length: toFloat(payload.length),
      width: toFloat(payload.width),
      height: toFloat(payload.height),
      dispatchSla: toInt(payload.dispatchSla),
      deliveryCharges: toFloat(payload.deliveryCharges),
      deliveryDays: toInt(payload.deliveryDays),
      deliveryCode: toStr(payload.deliveryCode),
      deliveryPartner: toStr(payload.deliveryPartner),
      deliveryZone: toStr(payload.deliveryZone),
      expressDelivery: toBool(payload.expressDelivery, false),
      deliveryChargeMethod: toStr(payload.deliveryChargeMethod),
      deliveryConfirmationOtp: toBool(payload.deliveryConfirmationOtp, false),
      serialImeiCaptureAtDelivery: toBool(payload.serialImeiCaptureAtDelivery, false),

      replacementWindow: toBool(payload.replacementWindow, false),
      replacementDays: toInt(payload.replacementDays),
      installationRequired: toBool(payload.installationRequired, false),
      installationCharge: toFloat(payload.installationCharge),

      selectedEmiPlanId: toStr(payload.selectedEmiPlanId) || undefined,
      defaultDownPaymentPercent: toFloat(payload.defaultDownPaymentPercent),
      minCustomerDownPayment: toFloat(payload.minCustomerDownPayment),
      maxDownPayment: toFloat(payload.maxDownPayment),
      downPaymentEditableAtApproval: toBool(payload.downPaymentEditableAtApproval, false),
      serviceChargeMethod: toStr(payload.serviceChargeMethod),
      documentationCharge: toFloat(payload.documentationCharge),
      verificationCharge: toFloat(payload.verificationCharge),
      firstEmiDueAfter: toInt(payload.firstEmiDueAfter),
      gracePeriod: toInt(payload.gracePeriod),

      wizardData: data.wizardData || undefined, // Keep a copy just in case
    };

    if (payload.slug && payload.slug.trim() !== '') {
      mapped.slug = payload.slug.trim();
    }

    // Drop undefined/empty values so strict Postgres column types
    // (boolean/numeric/timestamp) never receive invalid input.
    Object.keys(mapped).forEach((key) => {
      const v = mapped[key];
      if (v === undefined || (typeof v === 'string' && v.trim() === '')) delete mapped[key];
    });

    return mapped;
  }

  async create(data: any) {
    data = await persistInlineProductImages(data);
    const mapped = this.mapPayloadToPrisma(data);
    if (!mapped.id) {
      mapped.id = data.id && isUuid(String(data.id)) ? String(data.id) : randomUUID();
    }
    if (!mapped.slug) {
      const base = slugify(String(mapped.name || 'product'));
      mapped.slug = `${base}-${mapped.id.slice(0, 8)}`;
    }
    // Keep selling/list pricing consistent for catalog mapping.
    if (mapped.mrp != null && mapped.price != null && mapped.mrp > mapped.price) {
      mapped.discount = mapped.mrp - mapped.price;
      mapped.discountPrice = mapped.price;
    }
    const created = await productRepository.create(mapped);
    await this.syncEmiPlansFromWizard(created.id, data);
    return created;
  }

  async update(id: string, data: any) {
    const existing = await productRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Product not found.');
    }
    data = await persistInlineProductImages(data);
    const mapped = this.mapPayloadToPrisma(data);
    // Preserve marketing flags when this request didn't explicitly set them
    // (the wizard never sends them, so re-saving a featured product must not
    // silently un-feature it). mapPayloadToPrisma always yields booleans, so
    // we must inspect the raw input, not the mapped value.
    const payload = data.wizardData || data;
    if (data.featured === undefined && payload.featured === undefined) {
      mapped.featured = toBool(existing.featured, false);
    }
    if (data.trending === undefined && payload.trending === undefined) {
      mapped.trending = toBool(existing.trending, false);
    }
    if (
      data.recommended === undefined &&
      data.newArrival === undefined &&
      payload.recommended === undefined &&
      payload.newArrival === undefined
    ) {
      mapped.recommended = toBool(existing.recommended, false);
    }
    // mapPayloadToPrisma hard-defaults several fields (price 0, stock 0,
    // status 'active', emiAvailable true, warranty '1 Year', …). For partial
    // updates (e.g. a marketing-flag toggle that sends only { featured }) those
    // defaults would clobber real data, so restore the stored value for any
    // field the caller did not explicitly provide.
    const source = { ...data, ...(data.wizardData || {}) };
    for (const key of [
      'price',
      'mrp',
      'stock',
      'status',
      'emiAvailable',
      'deliveryCharge',
      'gst',
      'warranty',
      'warrantyType',
      'galleryImages',
    ]) {
      if (source[key] === undefined && mapped[key] !== undefined) {
        mapped[key] = existing[key];
      }
    }
    if (mapped.mrp != null && mapped.price != null && mapped.mrp > mapped.price) {
      mapped.discount = mapped.mrp - mapped.price;
      mapped.discountPrice = mapped.price;
    }
    const updated = await productRepository.update(id, mapped);
    await deleteOrphanedProductImages(existing, updated, id);
    // Only touch the plans collection when the request actually carries plans;
    // partial updates (e.g. a marketing-flag toggle) must not wipe previously
    // saved plans.
    const plans = data.wizardData?.emiPlans ?? data.emiPlans;
    if (Array.isArray(plans)) {
      await this.syncEmiPlansFromWizard(id, data);
    }
    return updated;
  }

  /** Persist wizard EMI plans into product_emi_plans so PDP can read them. */
  private async syncEmiPlansFromWizard(productId: string, data: any) {
    const wizardPlans = data?.wizardData?.emiPlans ?? data?.emiPlans;
    if (!Array.isArray(wizardPlans)) return;

    const existing = jsonDb.findMany('product_emi_plans', { productId });
    for (const plan of existing) {
      await jsonDb.deleteAwaited('product_emi_plans', { id: plan.id });
    }

    for (const plan of wizardPlans) {
      if (!plan || plan.enabled === false) continue;
      const months = Math.max(0, Math.floor(toNumber(plan.months)));
      if (months <= 0) continue;

      await jsonDb.insertAwaited('product_emi_plans', {
        id: plan.id && isUuid(String(plan.id)) ? String(plan.id) : randomUUID(),
        productId,
        planName: toStr(plan.planName) || `${months} Months`,
        months,
        downPayment: toNumber(plan.downPayment),
        serviceCharge: toNumber(plan.serviceCharge),
        deliveryCharge: toNumber(plan.deliveryCharge),
        minEligibilityAmount: toNumber(plan.minEligibilityAmount),
        customerVisibility: toStr(plan.customerVisibility) || 'visible',
        enabled: plan.enabled !== false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async remove(id: string) {
    const existing = await productRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Product not found.');
    }
    await productRepository.remove(id);
    await deleteOrphanedProductImages(existing, null, id);
    return { id };
  }
}

export const productService = new ProductService();
