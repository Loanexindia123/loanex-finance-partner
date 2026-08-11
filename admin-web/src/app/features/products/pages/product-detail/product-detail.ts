import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { LoadingSkeleton } from '../../../../shared/components/loading-skeleton/loading-skeleton';
import { ErrorState } from '../../../../shared/components/error-state/error-state';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { CanDirective } from '../../../../shared/directives/can.directive';
import { ProductService } from '../../services/product.service';
import {
  Category,
  Product,
  ProductWizardData,
  initialWizardData,
  normalizeSupplier,
  productImageUrls,
  productStockQty,
  productStockState,
} from '../../models/product.models';

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
    ButtonModule,
    PageHeader,
    LoadingSkeleton,
    ErrorState,
    StatusBadge,
    CanDirective,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetail {
  private readonly products = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly productId = this.route.snapshot.paramMap.get('id')!;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly product = signal<Product | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly activeImage = signal(0);

  readonly gallery = computed(() => {
    const product = this.product();
    return product ? productImageUrls(product) : [];
  });

  readonly wizard = computed<ProductWizardData | null>(() => {
    const product = this.product();
    if (!product) return null;
    return { ...initialWizardData(), ...(product.wizardData ?? {}) };
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
    return product?.price ?? product?.sellingPrice ?? null;
  });

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
      field('Created', formatDate(product.createdAt)),
      field('Updated', formatDate(product.updatedAt)),
    ]);

    push('Category', [
      field('Category', this.categoryLabel()),
      field('Sub-category', wizard.subCategory),
    ]);

    push('Description', [
      field('Short description', product.shortDescription ?? wizard.shortDescription),
      field('Description', product.description ?? wizard.description),
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

    if ((wizard.attributes ?? []).length) {
      push(
        'Variant options',
        wizard.attributes.map((attr) =>
          field(attr.name, (attr.values ?? []).join(', ')),
        ),
      );
    }

    if (wizard.variants.length) {
      push(
        'Variants',
        wizard.variants.flatMap((variant, index) => {
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

    const suppliers = (wizard.suppliers ?? []).flatMap((entry, index) => {
      const s = normalizeSupplier(entry);
      const prefix = wizard.suppliers.length > 1 ? `Supplier ${index + 1} · ` : '';
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
    push('EMI information', emiFields);

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

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || err.message || 'Unable to load this product.';
    }
    return 'Unable to load this product.';
  }
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
