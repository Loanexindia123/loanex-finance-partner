import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { AuthService } from '../../../../core/services/auth.service';
import { RbacService } from '../../../../core/services/rbac.service';
import { ProductService } from '../../services/product.service';
import { ProductEmiConfig } from '../../components/product-emi-config/product-emi-config';
import {
  Category,
  Product,
  ProductWizardData,
  initialWizardData,
  normalizeEmiPlan,
  normalizeSupplier,
  productImageUrls,
  productStockQty,
  productStockState,
} from '../../models/product.models';
import { hasConfiguredEmiPlan } from '../../utils/wizard-calculations';

interface DetailField {
  label: string;
  value: string;
}

interface DetailSection {
  title: string;
  fields: DetailField[];
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    NgTemplateOutlet,
    ButtonModule,
    PageHeader,
    BrandedLoader,
    ErrorState,
    StatusBadge,
    CanDirective,
    ProductEmiConfig,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail {
  private readonly products = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  readonly productId = this.route.snapshot.paramMap.get('id')!;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly product = signal<Product | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly activeImage = signal(0);
  readonly deciding = signal<'approve' | 'reject' | null>(null);
  readonly savingEmi = signal(false);
  readonly emiRequired = signal(false);
  readonly emiDirty = signal(false);
  private readonly emiConfig = viewChild(ProductEmiConfig);

  readonly isPendingApproval = computed(
    () => String(this.product()?.status ?? '').toLowerCase() === 'pending_approval',
  );

  readonly canApproveProducts = computed(() => {
    const role = String(this.auth.user()?.roleName ?? '')
      .trim()
      .toLowerCase();
    return role !== 'employee';
  });

  readonly canEditProducts = computed(() => this.rbac.can('products.edit'));

  readonly showEmiDecision = computed(
    () => this.isPendingApproval() && this.canApproveProducts(),
  );

  readonly savedEmiRequired = computed(() => this.product()?.emiAvailable === true);

  readonly emiApproveBlockedReason = computed(() => {
    if (!this.showEmiDecision()) return '';
    if (this.emiDirty()) {
      return 'Save the EMI decision before approving this product.';
    }
    if (this.savedEmiRequired() && !hasConfiguredEmiPlan(this.wizard()?.emiPlans)) {
      return 'This product requires EMI. Configure at least one visible EMI plan before approving.';
    }
    return '';
  });

  readonly gallery = computed(() => {
    const product = this.product();
    return product ? productImageUrls(product) : [];
  });

  readonly wizard = computed<ProductWizardData | null>(() => {
    const product = this.product();
    if (!product) return null;
    return mergeWizardData(product.wizardData);
  });

  readonly categoryLabel = computed(() => {
    const product = this.product();
    if (!product) return '';
    if (product.category?.trim()) return product.category;
    if (!product.categoryId) return '';
    return this.categories().find((c) => c.id === product.categoryId)?.name ?? product.categoryId;
  });

  readonly stockQty = computed(() => {
    const product = this.product();
    return product ? productStockQty(product) : 0;
  });

  readonly stockLabel = computed(() => {
    const product = this.product();
    if (!product) return '';
    const state = productStockState(product);
    if (state === 'out') return 'Out of stock';
    if (state === 'low') return 'Low stock';
    return 'Healthy';
  });

  readonly stockState = computed(() => {
    const product = this.product();
    return product ? productStockState(product) : 'out';
  });

  readonly displayPrice = computed(() => {
    const product = this.product();
    const wizard = this.wizard();
    const fromProduct = Number(product?.price ?? product?.sellingPrice ?? NaN);
    if (Number.isFinite(fromProduct) && fromProduct > 0) return fromProduct;
    const fromWizard = Number(wizard?.sellingPrice ?? NaN);
    return Number.isFinite(fromWizard) && fromWizard > 0 ? fromWizard : null;
  });

  readonly displayBrand = computed(
    () => String(this.product()?.brand || this.wizard()?.brand || '').trim(),
  );

  readonly displaySku = computed(
    () => String(this.product()?.sku || this.wizard()?.sku || '').trim(),
  );

  readonly sections = computed<DetailSection[]>(() => {
    const product = this.product();
    const wizard = this.wizard();
    if (!product || !wizard) return [];

    const sections: DetailSection[] = [];
    const push = (title: string, fields: DetailField[]) => {
      const present = fields.filter((field) => field.value);
      if (present.length) sections.push({ title, fields: present });
    };

    push('Basic Information', [
      field('Product name', product.name),
      field('Short name', wizard.shortName),
      field('Product type', wizard.productType),
      field('Brand', product.brand ?? wizard.brand),
      field('Model number', wizard.modelNumber),
      field('SKU', product.sku ?? wizard.sku),
      field('Slug', product.slug ?? wizard.slug),
      field('Barcode', wizard.barcode),
      field('HSN', product.hsnCode ?? wizard.hsnCode),
      field('Manufacturer', product.manufacturer ?? wizard.manufacturer),
      field('Country of origin', wizard.countryOfOrigin),
      field('Warranty', product.warranty ?? wizard.warranty),
      field('Condition', formatCondition(wizard.productCondition)),
      field('Colour / Size / Variant', wizard.colourSizeVariant),
      field('Serial / IMEI tracking', yesNo(wizard.serialImeiTracking)),
      field('Status', product.status),
      field('Created by', product.creatorName), // NEW
      field('Created', formatDate(product.createdAt)),
      field('Updated', formatDate(product.updatedAt)),
    ]);

    push('Category', [
      field('Category', this.categoryLabel()),
      field('Sub-category', wizard.subCategory),
    ]);

    push('Description', [
      field('Short description', product.shortDescription ?? wizard.shortDescription),
      field('Overview', product.description ?? wizard.description),
      field('Video URL', wizard.productVideoUrl),
    ]);

    const specRows = specificationFields(product.specifications ?? (wizard as ProductWizardData & { specifications?: unknown }).specifications);
    const features = presentStrings(wizard.features ?? product.features);
    const specSection = [
      ...specRows,
      ...features.map((value, index) => ({ label: `Feature ${index + 1}`, value })),
    ];
    if (specSection.length) {
      sections.push({ title: 'Product Specifications', fields: specSection });
    }

    const attributes = wizard.attributes ?? [];
    if (attributes.length) {
      push(
        'Variant options',
        attributes.map((attr) =>
          field(attr.name, (attr.values ?? []).join(', ')),
        ),
      );
    }

    const variants = wizard.variants ?? [];
    if (variants.length) {
      push(
        'Variants',
        variants.flatMap((variant, index) => {
          const prefix = `Variant ${index + 1} · `;
          return [
            field(`${prefix}Name`, variant.name),
            field(`${prefix}SKU`, variant.sku),
            money(`${prefix}MRP`, variant.mrp),
            money(`${prefix}Selling price`, variant.sellingPrice),
            field(`${prefix}Stock`, variant.stock),
          ];
        }),
      );
    }

    const box = presentStrings(wizard.boxContents);
    if (box.length) {
      sections.push({
        title: 'Box contents',
        fields: box.map((value, index) => ({ label: `Item ${index + 1}`, value })),
      });
    }

    push('Pricing', [
      money('Selling price', product.price ?? wizard.sellingPrice),
      money('MRP', product.mrp ?? wizard.mrp),
      money('Purchase price', wizard.purchasePrice),
      field('GST', wizard.gst ? `${wizard.gst}%` : ''),
      money('Amazon price', wizard.amazonPrice),
      money('Flipkart price', wizard.flipkartPrice),
      money('Market lowest price', wizard.marketLowestPrice),
      money('Max discount allowed', wizard.maximumDiscountAllowed),
    ]);

    push('Inventory', [
      field('Available stock', String(product.availableStock ?? product.stock ?? wizard.availableStock ?? '')),
      field('Reserved stock', wizard.reservedStock),
      field('Warehouse', wizard.warehouse),
      field('Min order quantity', wizard.minOrderQuantity),
      field('Max quantity / customer', wizard.maxQuantityPerCustomer),
      field('Eligible pin codes', wizard.eligiblePinCodes),
      field('Track inventory', yesNo(wizard.trackInventory, wizard.trackInventory !== true)),
      field('Field verification', yesNo(wizard.requiresFieldVerification)),
      field('Serial / IMEI capture', yesNo(wizard.requiresSerialImeiCapture)),
    ]);

    const supplierRows = wizard.suppliers ?? [];
    const suppliers = supplierRows.flatMap((entry, index) => {
      const s = normalizeSupplier(entry);
      const prefix = supplierRows.length > 1 ? `Supplier ${index + 1} · ` : '';
      return [
        field(`${prefix}Name`, s.supplier),
        field(`${prefix}SKU`, s.supplierSku),
        field(`${prefix}Invoice`, s.purchaseInvoice),
        field(`${prefix}Lead time`, s.leadTime),
        field(`${prefix}Payment terms`, s.paymentTerms),
        field(`${prefix}GSTIN`, s.supplierGstin),
        field(`${prefix}Contact`, s.supplierContact),
      ];
    });
    push('Supplier', suppliers);

    push('Delivery', [
      field('Weight', wizard.weight),
      field('Dispatch SLA', wizard.dispatchSla),
      money('Delivery charges', wizard.deliveryCharges),
      field('Delivery days', wizard.deliveryDays),
      field('Replacement window (days)', wizard.replacementWindowDays),
      field('Delivery partner', wizard.deliveryPartner),
      field('Delivery zone', wizard.deliveryZone),
      field('Installation required', yesNo(wizard.installationRequired)),
      field('Express delivery', yesNo(wizard.expressDelivery)),
    ]);

    const emiFields: DetailField[] = [
      field('EMI available', yesNo(product.emiAvailable ?? wizard.emiEnabled, !(product.emiAvailable ?? wizard.emiEnabled))),
      field('Default down payment %', wizard.defaultDownPaymentPercent),
      money('Documentation charge', wizard.documentationCharge),
      field('Grace period', wizard.gracePeriod),
    ];
    (wizard.emiPlans ?? []).forEach((plan, index) => {
      const prefix = `Plan ${index + 1} · `;
      emiFields.push(
        field(`${prefix}Name`, plan.planName),
        field(`${prefix}Months`, plan.months == null ? '' : String(plan.months)),
        money(`${prefix}Down payment`, plan.downPayment),
        money(`${prefix}Service charge`, plan.serviceCharge),
        money(`${prefix}Min eligibility`, plan.minEligibilityAmount),
        field(`${prefix}Visibility`, plan.customerVisibility),
      );
    });
    if (!this.showEmiDecision()) {
      push('EMI information', emiFields);
    }

    push('SEO information', [
      field('Slug', wizard.slug || product.slug),
      field('Meta title', wizard.metaTitle),
      field('Meta description', wizard.metaDescription),
      field('Keywords', wizard.keywords),
    ]);

    return sections;
  });

  constructor() {
    this.products.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => void 0,
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.products.getById(this.productId).subscribe({
      next: (product) => {
        this.product.set(product);
        this.activeImage.set(0);
        this.syncEmiDecisionFromProduct(product);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(this.extractMessage(err));
        this.loading.set(false);
      },
    });
  }

  selectImage(index: number): void {
    this.activeImage.set(index);
  }

  back(): void {
    this.router.navigate(['/products']);
  }

  edit(): void {
    this.router.navigate(['/products', this.productId]);
  }

  emiSellingPrice(): number {
    const product = this.product();
    const wizard = this.wizard();
    const fromProduct = Number(product?.price ?? product?.sellingPrice ?? 0);
    if (Number.isFinite(fromProduct) && fromProduct > 0) return fromProduct;
    const fromWizard = Number(wizard?.sellingPrice ?? 0);
    return Number.isFinite(fromWizard) ? fromWizard : 0;
  }

  emiSettingsFromWizard() {
    const wizard = this.wizard() ?? initialWizardData();
    return {
      defaultDownPaymentPercent: String(wizard.defaultDownPaymentPercent ?? ''),
      minCustomerDownPayment: String(wizard.minCustomerDownPayment ?? ''),
      maxDownPayment: String(wizard.maxDownPayment ?? ''),
      downPaymentEditableAtApproval: wizard.downPaymentEditableAtApproval === true,
      serviceChargeMethod: String(wizard.serviceChargeMethod ?? ''),
      documentationCharge: String(wizard.documentationCharge ?? ''),
      verificationCharge: String(wizard.verificationCharge ?? ''),
      firstEmiDueAfter: String(wizard.firstEmiDueAfter ?? ''),
      gracePeriod: String(wizard.gracePeriod ?? ''),
    };
  }

  chooseEmiRequired(required: boolean): void {
    this.emiRequired.set(required);
    this.emiDirty.set(required !== this.savedEmiRequired());
    if (required) {
      setTimeout(() => this.emiConfig()?.hydrate(), 0);
    }
  }

  onEmiConfigChanged(): void {
    this.emiDirty.set(true);
  }

  saveEmiDecision(): void {
    const product = this.product();
    const wizard = this.wizard();
    if (!product || !wizard || this.savingEmi()) return;
    if (this.emiRequired() && !hasConfiguredEmiPlan(this.emiConfig()?.getValue().emiPlans)) {
      this.messages.add({
        severity: 'warn',
        summary: 'EMI plan required',
        detail: 'Add at least one visible EMI plan before saving a required-EMI decision.',
      });
      return;
    }

    const config = this.emiConfig()?.getValue();
    const settings = config?.settings ?? this.emiSettingsFromWizard();
    const emiPlans = (config?.emiPlans ?? wizard.emiPlans ?? []).map((plan) =>
      normalizeEmiPlan(plan),
    );
    const wizardData: ProductWizardData = {
      ...wizard,
      emiEnabled: this.emiRequired(),
      emiPlans,
      defaultDownPaymentPercent: settings.defaultDownPaymentPercent,
      minCustomerDownPayment: settings.minCustomerDownPayment,
      maxDownPayment: settings.maxDownPayment,
      downPaymentEditableAtApproval: settings.downPaymentEditableAtApproval,
      serviceChargeMethod: settings.serviceChargeMethod,
      documentationCharge: settings.documentationCharge,
      verificationCharge: settings.verificationCharge,
      firstEmiDueAfter: settings.firstEmiDueAfter,
      gracePeriod: settings.gracePeriod,
    };

    this.savingEmi.set(true);
    this.products
      .update(this.productId, {
        status: 'pending_approval',
        emiAvailable: this.emiRequired(),
        wizardData,
      })
      .subscribe({
        next: (updated) => {
          this.product.set(updated);
          this.syncEmiDecisionFromProduct(updated);
          this.savingEmi.set(false);
          this.messages.add({
            severity: 'success',
            summary: 'EMI decision saved',
            detail: this.emiRequired()
              ? 'EMI is required. You can now approve this product.'
              : 'This product will be approved without EMI.',
          });
        },
        error: (err: unknown) => {
          this.savingEmi.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Could not save EMI decision',
            detail: this.extractMessage(err),
          });
        },
      });
  }

  private syncEmiDecisionFromProduct(product: Product): void {
    this.emiRequired.set(product.emiAvailable === true);
    this.emiDirty.set(false);
    setTimeout(() => this.emiConfig()?.hydrate(), 0);
  }

  confirmApprove(): void {
    if (!this.isPendingApproval() || this.deciding()) return;
    const blocked = this.emiApproveBlockedReason();
    if (blocked) {
      this.messages.add({
        severity: 'warn',
        summary: 'EMI decision required',
        detail: blocked,
      });
      return;
    }
    const requiresEmi = this.savedEmiRequired();
    this.confirmation.confirm({
      header: 'Approve Product?',
      message: requiresEmi
        ? 'Approve this product with EMI and make it visible to customers?'
        : 'Approve this product without EMI and make it visible to customers?',
      acceptLabel: 'Approve',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approve(),
    });
  }

  confirmReject(): void {
    if (!this.isPendingApproval() || this.deciding()) return;
    this.confirmation.confirm({
      header: 'Reject Product?',
      message: 'Reject this product? It will remain hidden from customers.',
      acceptLabel: 'Reject',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.reject(),
    });
  }

  private approve(): void {
    this.deciding.set('approve');
    this.products.approve(this.productId).subscribe({
      next: (updated) => {
        this.product.set(updated);
        this.deciding.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Product approved',
          detail: 'Product is now visible to customers.',
        });
      },
      error: (err: unknown) => {
        this.deciding.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Approval failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private reject(): void {
    this.deciding.set('reject');
    this.products.reject(this.productId).subscribe({
      next: (updated) => {
        this.product.set(updated);
        this.deciding.set(null);
        this.messages.add({
          severity: 'success',
          summary: 'Product rejected',
          detail: 'Product remains hidden from customers.',
        });
      },
      error: (err: unknown) => {
        this.deciding.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Rejection failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || err.message || 'Unable to load this product.';
    }
    return 'Unable to load this product.';
  }
}

const WIZARD_ARRAY_KEYS = [
  'features',
  'boxContents',
  'aboutThisItem',
  'specifications',
  'attributes',
  'variants',
  'galleryImages',
  'suppliers',
  'emiPlans',
] as const;

function mergeWizardData(raw: Partial<ProductWizardData> | null | undefined): ProductWizardData {
  const merged = { ...initialWizardData(), ...(raw ?? {}) };
  for (const key of WIZARD_ARRAY_KEYS) {
    if (!Array.isArray(merged[key])) {
      merged[key] = [] as never;
    }
  }
  return merged;
}

function field(label: string, value: unknown): DetailField {
  return { label, value: present(value) };
}

function money(label: string, value: unknown): DetailField {
  if (value === null || value === undefined || value === '') {
    return { label, value: '' };
  }
  const n = Number(value);
  if (Number.isNaN(n)) return { label, value: String(value) };
  return {
    label,
    value: new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n),
  };
}

function present(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text;
}

function presentStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => present(value)).filter(Boolean);
}

function yesNo(value: unknown, includeFalse = true): string {
  if (value === true) return 'Yes';
  if (value === false) return includeFalse ? 'No' : '';
  return '';
}

function formatCondition(value: string): string {
  if (!value) return '';
  return value.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function specificationFields(raw: unknown): DetailField[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as { label?: unknown; key?: unknown; name?: unknown; value?: unknown };
        const label = present(row.label ?? row.key ?? row.name);
        const value = present(row.value);
        return label && value ? { label, value } : null;
      })
      .filter((row): row is DetailField => !!row);
  }
  if (typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return specificationFields((raw as { rows: unknown }).rows);
  }
  return [];
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
