import { EmiPlanCard, EmiPlanSummary, ProductEmiPlan } from '../models/product-details.models';

/**
 * Legacy constant — product EMI uses the client Excel model (0% interest).
 * Kept so older imports do not break.
 */
export const DEFAULT_ANNUAL_INTEREST_RATE_PERCENT = 12.5;

/** Round money to 2 decimal places (internal currency precision). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface EmiCalcInput {
  productPrice: number;
  downPayment: number;
  processingFee: number;
  tenureMonths: number;
  /** Ignored — Excel product EMI is always 0% interest. */
  annualInterestRatePercent?: number;
}

export interface EmiCalcResult {
  productPrice: number;
  downPayment: number;
  /** Service/convenience (+ delivery) — included in EMI principal */
  processingFee: number;
  tenureMonths: number;
  annualInterestRatePercent: number;
  /**
   * Amount converted into EMI (Excel):
   * Sale Price − Down Payment + Processing Fee
   */
  loanAmount: number;
  monthlyEmi: number;
  totalEmi: number;
  totalInterest: number;
  /** Down Payment only */
  upfrontPayment: number;
  /** Sale Price + Processing Fee */
  totalPayable: number;
  /** @deprecated Alias of totalPayable */
  grandTotal: number;
  /** @deprecated Alias of totalEmi */
  loanTotal: number;
}

/**
 * Client Excel EMI model (must match backend calculateEmiBreakdown).
 *
 * EMI Principal = Sale Price − Down Payment + Processing Fee
 * Interest      = 0
 * Monthly EMI   = EMI Principal / Tenure
 * Upfront       = Down Payment
 * Total Payable = Sale Price + Processing Fee
 */
export function calculateEmiBreakdown(input: EmiCalcInput): EmiCalcResult {
  const productPrice = roundMoney(Math.max(0, input.productPrice));
  const downPayment = roundMoney(Math.min(Math.max(0, input.downPayment), productPrice));
  const processingFee = roundMoney(Math.max(0, input.processingFee));
  const tenureMonths = Math.max(0, Math.floor(input.tenureMonths));
  const annualInterestRatePercent = 0;

  const loanAmount = roundMoney(productPrice - downPayment + processingFee);
  const monthlyEmi =
    tenureMonths > 0 && loanAmount > 0 ? roundMoney(loanAmount / tenureMonths) : 0;
  const totalEmi = loanAmount;
  const totalInterest = 0;
  const upfrontPayment = downPayment;
  const totalPayable = roundMoney(productPrice + processingFee);

  return {
    productPrice,
    downPayment,
    processingFee,
    tenureMonths,
    annualInterestRatePercent,
    loanAmount,
    monthlyEmi,
    totalEmi,
    totalInterest,
    upfrontPayment,
    totalPayable,
    grandTotal: totalPayable,
    loanTotal: totalEmi,
  };
}

/** Principal / tenure at 0%; reducing-balance retained for rate > 0. */
export function calculateMonthlyEmi(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
): number {
  if (tenureMonths <= 0 || principal <= 0) return 0;

  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) {
    return roundMoney(principal / tenureMonths);
  }

  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  return roundMoney((principal * monthlyRate * factor) / (factor - 1));
}

function planProcessingFee(plan: ProductEmiPlan): number {
  if (plan.processingFee != null && Number.isFinite(plan.processingFee)) {
    return roundMoney(Math.max(0, plan.processingFee));
  }
  return roundMoney(
    Math.max(0, plan.serviceCharge || 0) + Math.max(0, plan.deliveryCharge || 0),
  );
}

/**
 * Prefer backend-authored plan fields when present (single source of truth).
 * Fall back to the Excel formula for wizard-only / incomplete payloads.
 */
export function buildEmiPlans(
  productPrice: number,
  _downPayment: number,
  dbPlans: ProductEmiPlan[] = [],
): EmiPlanCard[] {
  if (!dbPlans?.length) return [];

  return dbPlans.map((plan) => {
    const fee = planProcessingFee(plan);
    const hasApiCalc =
      plan.monthlyEmi != null &&
      Number.isFinite(plan.monthlyEmi) &&
      plan.totalPayable != null &&
      Number.isFinite(plan.totalPayable) &&
      plan.loanAmount != null &&
      Number.isFinite(plan.loanAmount);

    if (hasApiCalc) {
      return {
        months: plan.months,
        monthlyEmi: roundMoney(plan.monthlyEmi as number),
        processingFee: fee,
        serviceCharge: roundMoney(Math.max(0, plan.serviceCharge || 0)),
        deliveryCharge: roundMoney(Math.max(0, plan.deliveryCharge || 0)),
        downPayment: roundMoney(plan.downPayment),
        loanAmount: roundMoney(plan.loanAmount as number),
        upfrontPayment: roundMoney(
          plan.upfrontPayment != null ? plan.upfrontPayment : plan.downPayment,
        ),
        totalPayable: roundMoney(plan.totalPayable as number),
        loanTotal: roundMoney(
          plan.loanTotal != null ? plan.loanTotal : (plan.loanAmount as number),
        ),
        grandTotal: roundMoney(
          plan.grandTotal != null ? plan.grandTotal : (plan.totalPayable as number),
        ),
        recommended: plan.isRecommended,
      };
    }

    const calc = calculateEmiBreakdown({
      productPrice,
      downPayment: plan.downPayment,
      processingFee: fee,
      tenureMonths: plan.months,
    });

    return toPlanCard(
      calc,
      plan.months,
      plan.isRecommended,
      roundMoney(Math.max(0, plan.serviceCharge || 0)),
      roundMoney(Math.max(0, plan.deliveryCharge || 0)),
    );
  });
}

function toPlanCard(
  calc: EmiCalcResult,
  months: number,
  recommended: boolean,
  serviceCharge: number,
  deliveryCharge: number,
): EmiPlanCard {
  return {
    months,
    monthlyEmi: calc.monthlyEmi,
    processingFee: calc.processingFee,
    serviceCharge,
    deliveryCharge,
    downPayment: calc.downPayment,
    loanAmount: calc.loanAmount,
    upfrontPayment: calc.upfrontPayment,
    totalPayable: calc.totalPayable,
    loanTotal: calc.loanTotal,
    grandTotal: calc.grandTotal,
    recommended,
  };
}

export function buildPlanSummary(
  productPrice: number,
  _downPayment: number,
  plan: EmiPlanCard,
): EmiPlanSummary {
  return {
    productPrice: roundMoney(productPrice),
    downPayment: plan.downPayment,
    processingFee: plan.processingFee,
    serviceCharge: plan.serviceCharge,
    deliveryCharge: plan.deliveryCharge,
    loanAmount: plan.loanAmount,
    monthlyEmi: plan.monthlyEmi,
    upfrontPayment: plan.upfrontPayment,
    totalPayable: plan.totalPayable,
    loanTotal: plan.loanTotal,
    grandTotal: plan.grandTotal,
  };
}
