import { ProductFormData, EMIPlan } from '../types/product';
import { parseAmount } from './amountUtils';
import { computeEmiRowCalculations } from './emiCalculations';

/** Selling price for EMI — product price first, then first variant with a price. */
export function getEffectiveSellingPrice(formData: ProductFormData): number {
  const productPrice = parseAmount(formData.sellingPrice);
  if (productPrice > 0) return productPrice;

  if (formData.variantsEnabled && formData.variants.length > 0) {
    const variantPrice = formData.variants
      .map((v) => parseAmount(v.sellingPrice))
      .find((p) => p > 0);
    if (variantPrice) return variantPrice;
  }

  return parseAmount(formData.mrp);
}

export { parseAmount } from './amountUtils';

export interface PricingCalculations {
  purchasePrice: number;
  gstRate: number;
  gstAmount: number;
  landingCost: number;
  sellingPrice: number;
  mrp: number;
  discount: number;
  margin: number;
  totalPayable: number;
  dealerSchedule: string;
}

export function computePricing(formData: ProductFormData): PricingCalculations {
  const purchasePrice = parseAmount(formData.purchasePrice);
  const gstRate = parseAmount(formData.gst);
  const sellingPrice = getEffectiveSellingPrice(formData);
  const mrp = parseAmount(formData.mrp);

  const gstAmount = (purchasePrice * gstRate) / 100;
  const landingCost = purchasePrice + gstAmount;
  const discount = mrp > 0 ? ((mrp - sellingPrice) / mrp) * 100 : 0;
  const margin = sellingPrice > 0 ? ((sellingPrice - landingCost) / sellingPrice) * 100 : 0;

  const defaultPlan = formData.emiPlans.find((p) => p.enabled && p.customerVisibility === 'visible');
  const selectedPlan = defaultPlan || formData.emiPlans.find((p) => p.id === formData.selectedEmiPlanId && p.enabled);

  let totalPayable = sellingPrice;
  if (selectedPlan && formData.emiEnabled) {
    // Excel: Sale Price + Service/Convenience Charge (0% interest)
    totalPayable = computeEmiRowCalculations(sellingPrice, selectedPlan).totalPayable;
  }

  const dealerSchedule = formatDealerPaymentSchedule(formData.suppliers[0]);

  return {
    purchasePrice,
    gstRate,
    gstAmount,
    landingCost,
    sellingPrice,
    mrp,
    discount,
    margin,
    totalPayable: formData.emiEnabled ? totalPayable : sellingPrice,
    dealerSchedule,
  };
}

/** Build dealer payment schedule text from First / Delivery / Hold % fields. */
export function formatDealerPaymentSchedule(
  supplier?: ProductFormData['suppliers'][number]
): string {
  if (!supplier) return 'No supplier linked';

  const first = parseAmount(supplier.firstPaymentPercent);
  const delivery = parseAmount(supplier.deliveryPaymentPercent);
  const hold = parseAmount(supplier.holdPaymentPercent);

  if (first > 0 || delivery > 0 || hold > 0) {
    const parts: string[] = [];
    if (first > 0) parts.push(`${first}% at Purchase`);
    if (delivery > 0) parts.push(`${delivery}% after Delivery`);
    if (hold > 0) parts.push(`${hold}% Hold`);
    const holdNote = hold > 0 ? ` · Payment Hold ${hold}%` : '';
    return parts.join(' / ') + holdNote;
  }

  return `${supplier.paymentTerms || 'Net 30'} · Lead ${supplier.leadTime || '—'} days`;
}

/** Auto-calculated market lowest from Amazon / Flipkart / Other website prices. */
export function computeMarketLowestPrice(formData: ProductFormData): number {
  const prices = [formData.amazonPrice, formData.flipkartPrice, formData.otherWebsitePrice]
    .map(parseAmount)
    .filter((p) => p > 0);
  if (prices.length === 0) return 0;
  return Math.min(...prices);
}

export function formatCurrency(value: number): string {
  if (!value && value !== 0) return '—';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  if (Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export interface CompletenessSection {
  key: string;
  label: string;
  percent: number;
}

export function computeCompleteness(formData: ProductFormData): CompletenessSection[] {
  const score = (filled: number, total: number) =>
    total === 0 ? 100 : Math.round((filled / total) * 100);

  const basicFields = [
    formData.productName,
    formData.sku,
    formData.brand,
    formData.productType,
    formData.shortDescription || formData.description,
  ];
  const pricingFields = [formData.mrp, formData.sellingPrice, formData.purchasePrice, formData.gst];
  const deliveryFields = [formData.weight, formData.deliveryDays, formData.dispatchSla];
  const seoFields = [formData.slug, formData.metaTitle, formData.metaDescription];

  let variantsPercent = 100;
  if (formData.variantsEnabled) {
    if (formData.variants.length === 0) variantsPercent = 0;
    else {
      const saved = formData.variants.filter((v) => v.saved).length;
      variantsPercent = score(saved, formData.variants.length);
    }
  }

  let emiPercent = 100;
  if (formData.emiEnabled) {
    const active = formData.emiPlans.filter((p) => p.enabled && p.months && p.planName);
    emiPercent = active.length > 0 ? 100 : 0;
  }

  const imageCount = (formData.primaryImage ? 1 : 0) + formData.galleryImages.length;

  return [
    { key: 'basic', label: 'Basic Information', percent: score(basicFields.filter(Boolean).length, basicFields.length) },
    { key: 'pricing', label: 'Pricing', percent: score(pricingFields.filter(Boolean).length, pricingFields.length) },
    { key: 'variants', label: 'Variants', percent: variantsPercent },
    { key: 'images', label: 'Images', percent: imageCount > 0 ? 100 : 0 },
    { key: 'delivery', label: 'Delivery', percent: score(deliveryFields.filter(Boolean).length, deliveryFields.length) },
    { key: 'emi', label: 'EMI', percent: emiPercent },
    { key: 'seo', label: 'SEO', percent: score(seoFields.filter(Boolean).length, seoFields.length) },
  ];
}

export interface ValidationAlert {
  id: string;
  message: string;
  severity: 'error' | 'warning';
}

export function computeValidationAlerts(formData: ProductFormData, calc: PricingCalculations): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  if (!formData.primaryImage) {
    alerts.push({ id: 'missing-image', message: 'Missing Primary Image', severity: 'error' });
  }

  if (formData.emiEnabled && !formData.emiPlans.some((p) => p.enabled && p.customerVisibility === 'visible')) {
    alerts.push({ id: 'missing-emi', message: 'Missing EMI Plan', severity: 'error' });
  }

  const stock = parseFloat(formData.availableStock || formData.openingStock) || 0;
  if (stock === 0 && formData.trackInventory) {
    alerts.push({ id: 'zero-stock', message: 'Zero Stock', severity: 'warning' });
  }

  const gst = parseFloat(formData.gst);
  if (formData.gst === '' || Number.isNaN(gst) || gst < 0 || gst > 100) {
    alerts.push({ id: 'invalid-gst', message: 'Invalid GST', severity: 'error' });
  }

  if (calc.mrp > 0 && calc.sellingPrice > 0 && calc.mrp < calc.sellingPrice) {
    alerts.push({ id: 'mrp-low', message: 'MRP lower than Selling Price', severity: 'error' });
  }

  const marketLowest =
    parseAmount(formData.marketLowestPrice) || computeMarketLowestPrice(formData);
  if (marketLowest > 0 && calc.sellingPrice > marketLowest) {
    alerts.push({
      id: 'above-market',
      message: 'Selling Price is above Market Lowest Price',
      severity: 'warning',
    });
  }

  if (calc.margin > 0 && calc.margin < 10) {
    alerts.push({ id: 'low-margin', message: 'Low Margin', severity: 'warning' });
  }

  return alerts;
}

export function getSelectedEmiPlan(formData: ProductFormData): EMIPlan | undefined {
  const selected = formData.emiPlans.find((p) => p.id === formData.selectedEmiPlanId && p.enabled);
  if (selected) return selected;
  return formData.emiPlans.find((p) => p.enabled && p.customerVisibility === 'visible');
}

export function formatEmiOptionLabel(plan: EMIPlan, index: number): string {
  if (plan.planName) return plan.planName;
  if (plan.months) return `${plan.months} Months`;
  return `EMI Option ${index + 1}`;
}

export function computeOverallCompleteness(sections: CompletenessSection[]): number {
  if (sections.length === 0) return 0;
  return Math.round(sections.reduce((sum, s) => sum + s.percent, 0) / sections.length);
}
