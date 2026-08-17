import {
  ProductDetails,
  ProductEmiPlan,
  ProductStockStatus,
  ProductVariantSku,
} from '../models/product-details.models';
import { ProductDetail } from '../services/products-api.service';
import { resolveMediaUrl } from '../../../shared/utils/media-url';

function toMoneyNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Map wizard / API EMI rows into PDP plan shape. */
function normalizeEmiPlans(
  plans: ProductDetail['emiPlans'] | NonNullable<ProductDetail['wizardData']>['emiPlans'],
): ProductEmiPlan[] {
  if (!Array.isArray(plans) || plans.length === 0) return [];

  return plans
    .filter((plan) => {
      if (!plan) return false;
      if ((plan as { enabled?: boolean }).enabled === false) return false;
      return toMoneyNumber((plan as { months?: number | string }).months) > 0;
    })
    .map((plan) => {
      const months = Math.max(0, Math.floor(toMoneyNumber(plan.months)));
      const row = plan as {
        minEligibilityAmount?: number | string;
        customerVisibility?: string;
        isRecommended?: boolean;
        processingFee?: number | string;
        loanAmount?: number | string;
        monthlyEmi?: number | string;
        upfrontPayment?: number | string;
        totalPayable?: number | string;
        loanTotal?: number | string;
        grandTotal?: number | string;
      };
      const mapped: ProductEmiPlan = {
        id: String(plan.id || `emi-${months}`),
        planName: plan.planName,
        months,
        downPayment: toMoneyNumber(plan.downPayment),
        serviceCharge: toMoneyNumber(plan.serviceCharge),
        deliveryCharge: toMoneyNumber(plan.deliveryCharge),
        minEligibilityAmount: toMoneyNumber(row.minEligibilityAmount),
        customerVisibility: row.customerVisibility,
        isRecommended: Boolean(row.isRecommended) || months === 6,
      };
      // Pass through backend Excel-model totals when the PDP API computed them.
      if (row.processingFee != null && row.processingFee !== '') {
        mapped.processingFee = toMoneyNumber(row.processingFee);
      }
      if (row.loanAmount != null && row.loanAmount !== '') {
        mapped.loanAmount = toMoneyNumber(row.loanAmount);
      }
      if (row.monthlyEmi != null && row.monthlyEmi !== '') {
        mapped.monthlyEmi = toMoneyNumber(row.monthlyEmi);
      }
      if (row.upfrontPayment != null && row.upfrontPayment !== '') {
        mapped.upfrontPayment = toMoneyNumber(row.upfrontPayment);
      }
      if (row.totalPayable != null && row.totalPayable !== '') {
        mapped.totalPayable = toMoneyNumber(row.totalPayable);
      }
      if (row.loanTotal != null && row.loanTotal !== '') {
        mapped.loanTotal = toMoneyNumber(row.loanTotal);
      }
      if (row.grandTotal != null && row.grandTotal !== '') {
        mapped.grandTotal = toMoneyNumber(row.grandTotal);
      }
      return mapped;
    });
}

function resolveEmiPlans(detail: ProductDetail): ProductEmiPlan[] {
  if (detail.emiAvailable === false) return [];
  const fromApi = normalizeEmiPlans(detail.emiPlans);
  if (fromApi.length > 0) return fromApi;
  return normalizeEmiPlans(detail.wizardData?.emiPlans);
}

function textList(
  items: Array<string | { value?: string; label?: string; text?: string }> | undefined,
): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      return String(item?.value ?? item?.label ?? item?.text ?? '').trim();
    })
    .filter(Boolean);
}

function warrantyFromDetail(detail: ProductDetail): string {
  const raw =
    detail.warrantyLabel ||
    detail.warranty ||
    detail.wizardData?.warranty ||
    '';
  const value = String(raw).trim();
  if (!value) return 'Manufacturer Warranty';
  return /warranty/i.test(value) ? value : `${value} Warranty`;
}

function specsFromDetail(detail: ProductDetail): {
  rows: { label: string; value: string }[];
  keySpecs: { id: string; icon: string; label: string; value: string }[];
  highlights: string[];
  boxContents: string[];
  returnsPolicy: string[];
} {
  const icons = [
    'pi pi-mobile',
    'pi pi-desktop',
    'pi pi-cog',
    'pi pi-bolt',
    'pi pi-wifi',
    'pi pi-camera',
    'pi pi-box',
    'pi pi-check-circle',
  ];

  let rows =
    detail.specificationRows?.map((row) => ({ label: row.label, value: row.value })) ?? [];
  if (!rows.length && Array.isArray(detail.wizardData?.specifications)) {
    rows = detail.wizardData.specifications
      .map((item) => ({
        label: String(item.key || '').trim(),
        value: String(item.value || '').trim(),
      }))
      .filter((row) => row.label && row.value);
  }

  let keySpecs = detail.keySpecs ?? [];
  if (!keySpecs.length && rows.length) {
    keySpecs = rows.slice(0, 8).map((row, index) => ({
      id: `spec-${index + 1}`,
      icon: icons[index % icons.length],
      label: row.label,
      value: row.value,
    }));
  }

  let highlights = detail.overviewHighlights ?? [];
  if (!highlights.length) {
    highlights = textList(detail.features as any);
  }
  if (!highlights.length) {
    highlights = textList(detail.wizardData?.features);
  }

  let boxContents = textList(detail.boxContents as any);
  if (!boxContents.length) {
    boxContents = textList(detail.wizardData?.boxContents);
  }

  let returnsPolicy = detail.returnsPolicy ?? [];
  if (!returnsPolicy.length) {
    const days =
      toMoneyNumber(detail.replacementDays) ||
      toMoneyNumber(detail.wizardData?.replacementDays);
    if (days > 0) {
      returnsPolicy = [
        `${days}-day replacement available on eligible products.`,
        'Product must be unused and returned in original packaging with all accessories.',
        'Replacement request can be raised from My Orders after delivery.',
      ];
    }
  }

  return { rows, keySpecs, highlights, boxContents, returnsPolicy };
}

/** Frontend fallback when the API hasn't shipped a stockStatus yet. */
function deriveStockStatus(stock: number): ProductStockStatus {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= 5) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function galleryFromUrls(urls: string[], name: string, prefix = 'img') {
  return urls.map((src, index) => ({
    id: `${prefix}-${index + 1}`,
    src: resolveMediaUrl(src),
    alt: `${name} image ${index + 1}`,
  }));
}

/** Pull a leading numeric size token from attribute values like "43 inch", "260L", "128GB". */
function extractSizeToken(value: string): string | null {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(inch(?:es)?|"|l|kg|ton|gb|tb|mm)?/i);
  return match ? match[1] : null;
}

/**
 * Build a shopper-facing product title from the catalog name + selected variant attributes.
 * Example: "Samsung 55\" 4K Ultra HD Smart TV" + screen size 43 → "Samsung 43\" 4K Ultra HD Smart TV"
 */
export function buildVariantDisplayName(
  baseName: string,
  brand: string,
  variant: ProductVariantSku,
): string {
  const attrs = variant.attributes ?? {};
  let name = baseName;
  let changed = false;

  const screen = attrs['screen size'] ?? attrs['Screen Size'] ?? attrs['size'];
  if (screen) {
    const num = extractSizeToken(screen);
    if (num) {
      const next = name
        .replace(/\d+(?:\.\d+)?\s*(?:inch(?:es)?|")/gi, `${num}"`)
        .replace(/(\d+(?:\.\d+)?)(?=\s*4K|\s*Ultra|\s*Smart|\s*"|\s*$)/, num);
      if (next !== name) {
        name = next;
        changed = true;
      } else if (!name.includes(`${num}"`) && !name.includes(`${num} inch`)) {
        name = name.replace(brand, `${brand} ${num}"`).replace(/\s+/g, ' ').trim();
        changed = true;
      }
    }
  }

  const capacity = attrs['capacity'] ?? attrs['Capacity'];
  if (capacity) {
    const num = extractSizeToken(capacity);
    if (num) {
      const unit = /kg/i.test(capacity) ? 'kg' : /l/i.test(capacity) ? 'L' : '';
      const replacement = `${num}${unit}`;
      const next = name.replace(/\d+(?:\.\d+)?\s*(?:L|kg|Kg)/gi, replacement);
      if (next !== name) {
        name = next;
        changed = true;
      }
    }
  }

  const storage = attrs['storage'] ?? attrs['Storage'];
  if (storage) {
    const next = name.replace(/\(?\d+\s*GB\)?/gi, storage.includes('(') ? storage : `(${storage})`);
    if (next !== name) {
      name = next;
      changed = true;
    }
  }

  const tonnage = attrs['tonnage'] ?? attrs['Tonnage'];
  if (tonnage) {
    const next = name.replace(/\d+(?:\.\d+)?\s*Ton/gi, tonnage);
    if (next !== name) {
      name = next;
      changed = true;
    }
  }

  if (!changed && variant.variantName) {
    // Fallback: brand + variant label keeps title in sync with selection
    name = `${brand} ${variant.variantName}`.replace(/\s+/g, ' ').trim();
  }

  return name;
}

/** Rewrite overview copy so size/capacity mentions match the selected variant. */
export function buildVariantOverviewBody(
  baseBody: string,
  variant: ProductVariantSku,
): string {
  const attrs = variant.attributes ?? {};
  let body = baseBody;

  const screen = attrs['screen size'] ?? attrs['Screen Size'];
  if (screen) {
    const num = extractSizeToken(screen);
    if (num) {
      body = body
        .replace(/\d+(?:\.\d+)?-?\s*inch(?:es)?/gi, `${num}-inch`)
        .replace(/\d+(?:\.\d+)?\s*"/g, `${num}"`);
    }
  }

  const capacity = attrs['capacity'] ?? attrs['Capacity'];
  if (capacity) {
    const num = extractSizeToken(capacity);
    if (num) {
      if (/kg/i.test(capacity)) {
        body = body.replace(/\d+(?:\.\d+)?\s*kg/gi, `${num} kg`);
      } else {
        body = body.replace(/\d+(?:\.\d+)?\s*L(?:itres?|iters?)?/gi, `${num}L`);
      }
    }
  }

  const storage = attrs['storage'] ?? attrs['Storage'];
  if (storage) {
    body = body.replace(/\d+\s*GB/gi, storage);
  }

  const tonnage = attrs['tonnage'] ?? attrs['Tonnage'];
  if (tonnage) {
    body = body.replace(/\d+(?:\.\d+)?\s*Ton/gi, tonnage);
  }

  return body;
}

function withVariantPresentation(
  base: Pick<ProductDetails, 'baseName' | 'baseOverviewBody' | 'brand' | 'breadcrumbs'>,
  variant: ProductVariantSku | null,
): Pick<ProductDetails, 'name' | 'overviewTitle' | 'overviewBody' | 'breadcrumbs'> {
  if (!variant) {
    return {
      name: base.baseName,
      overviewTitle: base.baseName,
      overviewBody: base.baseOverviewBody,
      breadcrumbs: base.breadcrumbs,
    };
  }

  const name = buildVariantDisplayName(base.baseName, base.brand, variant);
  const overviewBody = buildVariantOverviewBody(base.baseOverviewBody, variant);
  const breadcrumbs = base.breadcrumbs.map((crumb, index, list) =>
    index === list.length - 1 ? { ...crumb, label: name } : crumb,
  );

  return {
    name,
    overviewTitle: name,
    overviewBody,
    breadcrumbs,
  };
}

export function mapProductDetails(detail: ProductDetail): ProductDetails {
  const selected =
    detail.productVariants?.find((row) => row.id === detail.selectedVariantId) ??
    detail.selectedVariant ??
    detail.productVariants?.find((row) => row.isDefault) ??
    detail.productVariants?.[0] ??
    null;

  const baseName = detail.name;
  const baseOverviewBody = detail.overviewBody || detail.description || '';
  const presentation = withVariantPresentation(
    {
      baseName,
      baseOverviewBody,
      brand: detail.brand,
      breadcrumbs: detail.breadcrumbs ?? [],
    },
    selected,
  );

  const displayName = presentation.name;
  const resolved = specsFromDetail(detail);
  const images =
    selected?.imagesGallery?.length
      ? selected.imagesGallery.map((img, index) => ({
          ...img,
          src: resolveMediaUrl(img.src),
          alt: `${displayName} image ${index + 1}`,
        }))
      : selected?.images?.length
        ? galleryFromUrls(selected.images, displayName, selected.id)
        : detail.imagesGallery.length > 0
          ? detail.imagesGallery.map((img, index) => ({
              ...img,
              src: resolveMediaUrl(img.src),
              alt: img.alt || `${displayName} image ${index + 1}`,
            }))
          : galleryFromUrls(detail.images, displayName);

  const isActive =
    detail.isActive !== false && String((detail as { status?: string }).status || 'active') !== 'inactive';

  return {
    id: detail.id,
    name: displayName,
    baseName,
    brand: detail.brand,
    categoryLabel: detail.categoryLabel,
    subcategoryLabel:
      detail.subcategoryLabel ||
      detail.wizardData?.subCategory ||
      detail.wizardData?.childCategory ||
      detail.brand,
    price: selected?.sellingPrice ?? detail.sellingPrice,
    mrp: (selected?.discount ?? detail.discount) > 0 ? (selected?.mrp ?? detail.mrp) : undefined,
    rating: detail.averageRating,
    reviewCount: detail.reviewCount,
    answeredQuestions: detail.questions?.length ?? 0,
    // detail.inStock is already computed server-side (status === 'active' and
    // stock > 0) — the API doesn't send isActive, so gating on it made every
    // variant product read as out of stock.
    inStock: selected ? selected.inStock && detail.inStock : detail.inStock,
    stockQuantity: selected?.stock ?? detail.stock,
    stockStatus: selected
      ? selected.stockStatus ?? deriveStockStatus(selected.stock)
      : detail.stockStatus ?? deriveStockStatus(detail.stock),
    sku: selected?.sku ?? detail.sku,
    deliveryPincode: '',
    warrantyLabel: warrantyFromDetail(detail),
    images,
    colors: detail.colors ?? [],
    variants: detail.variants ?? [],
    attributeGroups: detail.attributeGroups ?? [],
    productVariants: detail.productVariants ?? [],
    selectedVariantId: selected?.id ?? null,
    keySpecs: selected?.keySpecs?.length ? selected.keySpecs : resolved.keySpecs,
    overviewTitle: presentation.overviewTitle,
    overviewBody: presentation.overviewBody,
    baseOverviewBody,
    overviewHighlights: resolved.highlights,
    specifications: selected?.specificationRows?.length
      ? selected.specificationRows
      : resolved.rows,
    boxContents: resolved.boxContents,
    shortDescription: detail.shortDescription || detail.wizardData?.shortDescription,
    deliveryCharge:
      toMoneyNumber(detail.deliveryCharge) ||
      toMoneyNumber(detail.deliveryCharges) ||
      toMoneyNumber(detail.wizardData?.deliveryCharges),
    deliveryDays:
      toMoneyNumber(detail.deliveryDays) || toMoneyNumber(detail.wizardData?.deliveryDays) || undefined,
    reviews: [],
    returnsPolicy: resolved.returnsPolicy,
    questions: detail.questions ?? [],
    breadcrumbs: presentation.breadcrumbs,
    emiPlans: resolveEmiPlans(detail),
  };
}

export function applyVariantToDetails(
  current: ProductDetails,
  variant: ProductVariantSku,
  isActive = true,
): ProductDetails {
  const presentation = withVariantPresentation(
    {
      baseName: current.baseName || current.name,
      baseOverviewBody: current.baseOverviewBody || current.overviewBody,
      brand: current.brand,
      breadcrumbs: current.breadcrumbs,
    },
    variant,
  );

  const images =
    variant.imagesGallery?.length > 0
      ? variant.imagesGallery.map((img, index) => ({
          ...img,
          src: resolveMediaUrl(img.src),
          alt: `${presentation.name} image ${index + 1}`,
        }))
      : galleryFromUrls(variant.images ?? [], presentation.name, variant.id);

  return {
    ...current,
    ...presentation,
    price: variant.sellingPrice,
    mrp: variant.discount > 0 ? variant.mrp : undefined,
    inStock: isActive && variant.inStock,
    stockQuantity: variant.stock,
    stockStatus: variant.stockStatus ?? deriveStockStatus(variant.stock),
    sku: variant.sku,
    images,
    selectedVariantId: variant.id,
    keySpecs: variant.keySpecs?.length ? variant.keySpecs : current.keySpecs,
    specifications: variant.specificationRows?.length
      ? variant.specificationRows
      : current.specifications,
  };
}

export function findVariantByAttributes(
  variants: ProductVariantSku[],
  selected: Record<string, string>,
): ProductVariantSku | null {
  const list = variants ?? [];
  const keys = Object.keys(selected);
  if (keys.length === 0) return list.find((row) => row.isDefault) ?? list[0] ?? null;

  return (
    list.find((variant) =>
      keys.every((key) => variant.attributes?.[key] === selected[key]),
    ) ?? null
  );
}

export function isAttributeOptionAvailable(
  variants: ProductVariantSku[],
  selected: Record<string, string>,
  key: string,
  value: string,
): boolean {
  const next = { ...selected, [key]: value };
  const match = findVariantByAttributes(variants ?? [], next);
  return Boolean(match && match.inStock);
}
