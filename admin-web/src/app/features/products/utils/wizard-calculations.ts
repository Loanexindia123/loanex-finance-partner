import {
  EmiPlanEntry,
  ProductVariant,
  ProductWizardData,
  formatDealerPaymentSchedule,
} from '../models/product.models';

export function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value: number): string {
  if (!value && value !== 0) return '—';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number): string {
  if (Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export function getEffectiveSellingPrice(form: ProductWizardData): number {
  const productPrice = parseAmount(form.sellingPrice);
  if (productPrice > 0) return productPrice;
  if (form.variantsEnabled && form.variants.length > 0) {
    const variantPrice = form.variants
      .map((v) => parseAmount(v.sellingPrice))
      .find((p) => p > 0);
    if (variantPrice) return variantPrice;
  }
  return parseAmount(form.mrp);
}

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

export interface EmiRowCalculations {
  balanceAmount: number;
  loanAmount: number;
  monthlyEmi: number;
  processingFee: number;
  upfrontPayment: number;
  totalPayable: number;
}

export function computeEmiRowCalculations(
  sellingPrice: number,
  plan: Pick<EmiPlanEntry, 'downPayment' | 'serviceCharge' | 'deliveryCharge' | 'months'>,
): EmiRowCalculations {
  const productPrice = roundMoney(Math.max(0, sellingPrice));
  const downPayment = roundMoney(Math.min(Math.max(0, parseAmount(plan.downPayment)), productPrice));
  const processingFee = roundMoney(
    Math.max(0, parseAmount(plan.serviceCharge) + parseAmount(plan.deliveryCharge)),
  );
  const tenureMonths = Math.max(0, Math.floor(parseAmount(plan.months)));
  const loanAmount = roundMoney(productPrice - downPayment + processingFee);
  const monthlyEmi =
    tenureMonths > 0 && loanAmount > 0 ? roundMoney(loanAmount / tenureMonths) : 0;
  return {
    balanceAmount: loanAmount,
    loanAmount,
    monthlyEmi,
    processingFee,
    upfrontPayment: downPayment,
    totalPayable: roundMoney(productPrice + processingFee),
  };
}

export function computePricing(form: ProductWizardData): PricingCalculations {
  const purchasePrice = parseAmount(form.purchasePrice);
  const gstRate = parseAmount(form.gst);
  const sellingPrice = getEffectiveSellingPrice(form);
  const mrp = parseAmount(form.mrp);
  const gstAmount = (purchasePrice * gstRate) / 100;
  const landingCost = purchasePrice + gstAmount;
  const discount = mrp > 0 ? ((mrp - sellingPrice) / mrp) * 100 : 0;
  const margin = sellingPrice > 0 ? ((sellingPrice - landingCost) / sellingPrice) * 100 : 0;
  const defaultPlan = form.emiPlans.find((p) => p.enabled && p.customerVisibility === 'visible');
  const selectedPlan =
    form.emiPlans.find((p) => p.id === form.selectedEmiPlanId && p.enabled) || defaultPlan;
  let totalPayable = sellingPrice;
  if (selectedPlan && form.emiEnabled) {
    totalPayable = computeEmiRowCalculations(sellingPrice, selectedPlan).totalPayable;
  }
  return {
    purchasePrice,
    gstRate,
    gstAmount,
    landingCost,
    sellingPrice,
    mrp,
    discount,
    margin,
    totalPayable: form.emiEnabled ? totalPayable : sellingPrice,
    dealerSchedule: formatDealerPaymentSchedule(form.suppliers?.[0]),
  };
}

export function computeMarketLowestPrice(form: Pick<
  ProductWizardData,
  'amazonPrice' | 'flipkartPrice' | 'otherWebsitePrice'
>): number {
  const prices = [form.amazonPrice, form.flipkartPrice, form.otherWebsitePrice]
    .map(parseAmount)
    .filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

export interface CompletenessSection {
  key: string;
  label: string;
  percent: number;
}

export function computeCompleteness(form: ProductWizardData): CompletenessSection[] {
  const score = (filled: number, total: number) =>
    total === 0 ? 100 : Math.round((filled / total) * 100);
  const basicFields = [
    form.productName,
    form.sku,
    form.brand,
    form.productType,
    form.shortDescription || form.description,
  ];
  const pricingFields = [form.mrp, form.sellingPrice, form.purchasePrice, form.gst];
  const deliveryFields = [form.weight, form.deliveryDays, form.dispatchSla];
  const seoFields = [form.slug, form.metaTitle, form.metaDescription];

  let variantsPercent = 100;
  if (form.variantsEnabled) {
    if (form.variants.length === 0) variantsPercent = 0;
    else {
      const saved = form.variants.filter((v: ProductVariant) => v.saved).length;
      variantsPercent = score(saved, form.variants.length);
    }
  }

  let emiPercent = 100;
  if (form.emiEnabled) {
    const active = form.emiPlans.filter((p) => p.enabled && p.months && p.planName);
    emiPercent = active.length > 0 ? 100 : 0;
  }

  const imageCount = (form.primaryImage ? 1 : 0) + (form.galleryImages?.length ?? 0);

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

export function computeOverallCompleteness(sections: CompletenessSection[]): number {
  if (sections.length === 0) return 0;
  return Math.round(sections.reduce((sum, s) => sum + s.percent, 0) / sections.length);
}

export interface ValidationAlert {
  id: string;
  message: string;
  severity: 'error' | 'warning';
}

export function computeValidationAlerts(
  form: ProductWizardData,
  calc: PricingCalculations,
): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];
  if (!form.primaryImage) {
    alerts.push({ id: 'missing-image', message: 'Missing Primary Image', severity: 'error' });
  }
  if (form.emiEnabled && !form.emiPlans.some((p) => p.enabled && p.customerVisibility === 'visible')) {
    alerts.push({ id: 'missing-emi', message: 'Missing EMI Plan', severity: 'error' });
  }
  const stock = parseFloat(String(form.availableStock || form.openingStock)) || 0;
  if (stock === 0 && form.trackInventory) {
    alerts.push({ id: 'zero-stock', message: 'Zero Stock', severity: 'warning' });
  }
  const gst = parseFloat(String(form.gst));
  if (form.gst === '' || form.gst == null || Number.isNaN(gst) || gst < 0 || gst > 100) {
    alerts.push({ id: 'invalid-gst', message: 'Invalid GST', severity: 'error' });
  }
  if (calc.mrp > 0 && calc.sellingPrice > 0 && calc.mrp < calc.sellingPrice) {
    alerts.push({ id: 'mrp-low', message: 'MRP lower than Selling Price', severity: 'error' });
  }
  const marketLowest = parseAmount(form.marketLowestPrice) || computeMarketLowestPrice(form);
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

export function getSelectedEmiPlan(form: ProductWizardData): EmiPlanEntry | undefined {
  const selected = form.emiPlans.find((p) => p.id === form.selectedEmiPlanId && p.enabled);
  if (selected) return selected;
  return form.emiPlans.find((p) => p.enabled && p.customerVisibility === 'visible');
}

export function formatEmiOptionLabel(plan: EmiPlanEntry, index: number): string {
  if (plan.planName) return plan.planName;
  if (plan.months) return `${plan.months} Months`;
  return `EMI Option ${index + 1}`;
}
