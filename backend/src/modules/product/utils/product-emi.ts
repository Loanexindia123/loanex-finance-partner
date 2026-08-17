import { BadRequestError } from '../../../common/errors/app-error';
import { jsonDb } from '../../../config/json-db';

/** Catalog EMI columns on `products`. Not loan/application EMI. */
export const PRODUCT_EMI_COLUMN_KEYS = [
  'emiAvailable',
  'selectedEmiPlanId',
  'defaultDownPaymentPercent',
  'minCustomerDownPayment',
  'maxDownPayment',
  'downPaymentEditableAtApproval',
  'serviceChargeMethod',
  'documentationCharge',
  'verificationCharge',
  'firstEmiDueAfter',
  'gracePeriod',
  'emiStartingFrom',
] as const;

const WIZARD_EMI_KEYS = [
  'emiEnabled',
  'selectedEmiPlanId',
  'emiPlans',
  'defaultDownPaymentPercent',
  'minCustomerDownPayment',
  'maxDownPayment',
  'downPaymentEditableAtApproval',
  'serviceChargeMethod',
  'documentationCharge',
  'verificationCharge',
  'firstEmiDueAfter',
  'gracePeriod',
] as const;

export function isEmployeeUser(userId: string | undefined): boolean {
  if (!userId) return false;
  const user = jsonDb.findOne('users', { id: userId }) as any;
  if (!user) return false;
  const roleId = user.role_id ?? user.roleId;
  if (!roleId) return false;
  const role = jsonDb.findOne('roles', { id: roleId }) as any;
  return String(role?.name ?? '').trim().toLowerCase() === 'employee';
}

function isUsableCatalogEmiPlan(plan: any): boolean {
  if (!plan || plan.enabled === false) return false;
  const months = Number(plan.months);
  if (!Number.isFinite(months) || months <= 0) return false;
  const visibility = String(plan.customerVisibility ?? 'visible').trim().toLowerCase();
  return visibility !== 'hidden';
}

/** True when the product has at least one enabled, visible catalog EMI plan. */
export function hasConfiguredCatalogEmiPlan(product: any): boolean {
  const fromTable = Array.isArray(product?.productEmiPlans) ? product.productEmiPlans : [];
  const fromWizard = Array.isArray(product?.wizardData?.emiPlans)
    ? product.wizardData.emiPlans
    : Array.isArray(product?.emiPlans)
      ? product.emiPlans
      : [];
  const source = fromTable.length > 0 ? fromTable : fromWizard;
  return source.some(isUsableCatalogEmiPlan);
}

/**
 * Publishing a product that requires EMI needs at least one configured plan.
 * `emiAvailable !== true` is the "No EMI" approval path.
 */
export function assertCatalogEmiReadyForPublish(product: any): void {
  if (product?.emiAvailable !== true) return;
  if (hasConfiguredCatalogEmiPlan(product)) return;
  throw new BadRequestError(
    'This product requires EMI. Configure at least one visible EMI plan before approving.',
  );
}

/** Employees must not create or edit catalog EMI. Strip it from the request body. */
export function stripEmployeeEmiFromPayload(data: any): void {
  if (!data || typeof data !== 'object') return;
  delete data.emiAvailable;
  delete data.emiEnabled;
  delete data.emiPlans;
  for (const key of PRODUCT_EMI_COLUMN_KEYS) {
    delete data[key];
  }
  if (data.wizardData && typeof data.wizardData === 'object') {
    for (const key of WIZARD_EMI_KEYS) {
      delete data.wizardData[key];
    }
  }
}

/** New employee-created products wait for an admin EMI decision. */
export function applyEmployeeEmiCreateDefaults(mapped: Record<string, any>): void {
  for (const key of PRODUCT_EMI_COLUMN_KEYS) {
    delete mapped[key];
  }
  mapped.emiAvailable = false;
  const wizard =
    mapped.wizardData && typeof mapped.wizardData === 'object' ? { ...mapped.wizardData } : {};
  wizard.emiEnabled = false;
  wizard.emiPlans = [];
  wizard.selectedEmiPlanId = '';
  if (Array.isArray(wizard.variants)) {
    wizard.variants = wizard.variants.map((variant: any) => ({
      ...variant,
      emiPlanId: '',
    }));
  }
  mapped.wizardData = wizard;
  if (Array.isArray(mapped.variants)) {
    mapped.variants = mapped.variants.map((variant: any) => ({
      ...variant,
      emiPlanId: '',
    }));
  }
}

function preserveWizardEmi(mappedWizard: any, existingWizard: any): any {
  const next =
    mappedWizard && typeof mappedWizard === 'object' ? { ...mappedWizard } : {};
  const prev = existingWizard && typeof existingWizard === 'object' ? existingWizard : {};
  for (const key of WIZARD_EMI_KEYS) {
    if (prev[key] !== undefined) {
      next[key] = prev[key];
    } else {
      delete next[key];
    }
  }
  if (!Array.isArray(next.emiPlans) && Array.isArray(prev.emiPlans)) {
    next.emiPlans = prev.emiPlans;
  }
  if (Array.isArray(next.variants) && Array.isArray(prev.variants)) {
    const previousById = new Map(
      prev.variants
        .filter((variant: any) => variant && variant.id)
        .map((variant: any) => [String(variant.id), variant.emiPlanId]),
    );
    next.variants = next.variants.map((variant: any) => ({
      ...variant,
      emiPlanId: previousById.get(String(variant?.id ?? '')) ?? variant?.emiPlanId ?? '',
    }));
  }
  return next;
}

/** Employee product edits must not wipe admin-configured catalog EMI. */
export function restoreEmployeeEmiFromExisting(
  mapped: Record<string, any>,
  existing: Record<string, any>,
): void {
  for (const key of PRODUCT_EMI_COLUMN_KEYS) {
    if (existing[key] !== undefined) {
      mapped[key] = existing[key];
    } else {
      delete mapped[key];
    }
  }
  mapped.wizardData = preserveWizardEmi(mapped.wizardData, existing.wizardData);
}
