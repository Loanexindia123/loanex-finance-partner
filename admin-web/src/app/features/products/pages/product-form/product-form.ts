import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin, map, of } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { isStoredImageRef, resolveMediaUrl } from '../../../../core/config/api.config';
import { BrandedLoader } from '../../../../shared/components/branded-loader/branded-loader';
import { ManageableSelect } from '../../components/manageable-select/manageable-select';
import { ProductService } from '../../services/product.service';
import { WizardOptionsService } from '../../services/wizard-options.service';
import {
  DELIVERY_CHARGE_METHODS,
  GALLERY_IMAGE_LIMIT,
  PRODUCT_CONDITIONS,
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_TYPES,
  EmiPlanEntry,
  INVOICE_SETTINGS,
  PAYMENT_TERMS,
  Product,
  ProductPayload,
  ProductVariant,
  ProductWizardData,
  SERVICE_CHARGE_METHODS,
  SETTLEMENT_CYCLES,
  STOCK_OWNERSHIP_TYPES,
  SupplierEntry,
  WARRANTIES,
  WIZARD_STEP_META,
  WIZARD_STEPS,
  createEmptyEmiPlan,
  createEmptySupplier,
  createEmptyVariant,
  formatDealerPaymentSchedule,
  initialWizardData,
  normalizeEmiPlan,
  normalizeKeyValueItems,
  normalizeSupplier,
  normalizeTextListItems,
  normalizeVariant,
} from '../../models/product.models';
import { generateProductSku, getMockExistingSkus } from '../../utils/sku-generation';
import { parseAboutThisItemText } from '../../utils/parse-about-this-item';
import { parseBoxContentsText } from '../../utils/parse-box-contents';
import {
  amazonParseHasContent,
  mergeAmazonParseIntoProduct,
  mergeAmazonParseIntoVariant,
  parseAmazonProductText,
} from '../../utils/parse-amazon-product-text';
import {
  CompletenessSection,
  PricingCalculations,
  ValidationAlert,
  computeCompleteness,
  computeEmiRowCalculations,
  computeMarketLowestPrice,
  computeOverallCompleteness,
  computePricing,
  computeValidationAlerts,
  formatCurrency,
  formatEmiOptionLabel,
  formatPercent,
  getEffectiveSellingPrice,
  getSelectedEmiPlan,
  parseAmount,
} from '../../utils/wizard-calculations';
import { DealerService } from '../../../masters/services/dealer.service';
import { StaffUserService } from '../../../masters/services/staff-user.service';
import {
  Dealer,
  dealerToProductPatch,
  DEALER_PATCHED_PRODUCT_FIELDS,
} from '../../../masters/models/dealer.models';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    ToggleSwitchModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    BrandedLoader,
    ManageableSelect,
  ],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm {
  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductService);
  readonly options = inject(WizardOptionsService);
  private readonly dealerService = inject(DealerService);
  private readonly staffUsers = inject(StaffUserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly steps = WIZARD_STEPS;
  readonly stepMeta = WIZARD_STEP_META;
  readonly activeStep = signal(0);
  readonly currentStep = computed(() => this.stepMeta[this.activeStep()]);

  readonly productId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = !!this.productId;

  readonly loading = signal(this.isEdit);
  readonly submitting = signal(false);
  readonly submittingKind = signal<'draft' | 'active' | 'pending_approval' | null>(null);
  readonly newVariantName = signal('');
  readonly expandedVariantIds = signal<string[]>([]);
  readonly emiModalOpen = signal(false);
  readonly emiEditing = signal<EmiPlanEntry | null>(null);
  readonly liveCollapsed = signal(false);
  readonly galleryDraft = signal('');
  readonly variantImageDrafts = signal<Record<string, string>>({});
  readonly imageErrors = signal<Record<string, string>>({});
  readonly brokenUrls = signal<Set<string>>(new Set());
  readonly imageSource = signal<'upload' | 'url'>('upload');
  readonly uploading = signal<string | null>(null);
  readonly variantMediaTick = signal(0);
  readonly imageAccept = PRODUCT_IMAGE_ACCEPT;
  readonly actionTooltip = {
    tooltipPosition: 'top' as const,
    appendTo: 'body',
    showDelay: 200,
    hideDelay: 0,
    tooltipEvent: 'hover' as const,
    tooltipStyleClass: 'catalog-tooltip',
  };
  private loadedWizard: Partial<ProductWizardData> = {};
  private readonly pendingUploads = new Map<string, File>();
  private readonly dealerPatchedByIndex = new Map<number, Set<string>>();

  readonly dealerCatalog = signal<Dealer[]>([]);
  readonly staffOptions = signal<{ label: string; value: string; code: string; email: string }[]>([]);
  readonly dealersLoading = signal(true);
  readonly dealersError = signal('');

  readonly productTypeAddOpen = signal(false);
  readonly productTypeDraft = signal('');
  readonly productTypeSaving = signal(false);

  readonly amazonPaste = signal('');
  readonly amazonAnalyzing = signal(false);
  readonly amazonFeedback = signal<{
    severity: 'success' | 'warn' | 'error' | 'info';
    message: string;
  } | null>(null);

  readonly aboutThisItemPaste = signal('');
  readonly aboutThisItemAnalyzing = signal(false);
  readonly aboutThisItemFeedback = signal<{
    severity: 'success' | 'warn' | 'error' | 'info';
    message: string;
  } | null>(null);

  readonly boxContentsPaste = signal('');
  readonly boxContentsAnalyzing = signal(false);
  readonly boxContentsFeedback = signal<{
    severity: 'success' | 'warn' | 'error' | 'info';
    message: string;
  } | null>(null);

  readonly previewOpen = signal(false);

  /** Per-variant Amazon / About / Box Contents paste state keyed by variant id. */
  readonly variantAmazonPaste = signal<Record<string, string>>({});
  readonly variantAmazonAnalyzing = signal<Record<string, boolean>>({});
  readonly variantAmazonFeedback = signal<
    Record<string, { severity: 'success' | 'warn' | 'error' | 'info'; message: string } | null>
  >({});
  readonly variantAboutPaste = signal<Record<string, string>>({});
  readonly variantAboutAnalyzing = signal<Record<string, boolean>>({});
  readonly variantAboutFeedback = signal<
    Record<string, { severity: 'success' | 'warn' | 'error' | 'info'; message: string } | null>
  >({});
  readonly variantBoxPaste = signal<Record<string, string>>({});
  readonly variantBoxAnalyzing = signal<Record<string, boolean>>({});
  readonly variantBoxFeedback = signal<
    Record<string, { severity: 'success' | 'warn' | 'error' | 'info'; message: string } | null>
  >({});

  readonly productTypeSelectOptions = computed(() =>
    this.options.productTypes().map((v) => ({ label: v, value: v })),
  );
  readonly warrantyOptions = WARRANTIES.map((v) => ({ label: v, value: v }));
  readonly conditionOptions = PRODUCT_CONDITIONS.map((v) => ({ label: v, value: v }));

  selectOptions(
    current: unknown,
    base: ReadonlyArray<{ label: string; value: string }>,
  ): Array<{ label: string; value: string }> {
    const value = String(current ?? '').trim();
    if (value && !base.some((option) => option.value === value)) {
      return [{ label: value, value }, ...base];
    }
    return [...base];
  }
  readonly visibilityOptions = [
    { label: 'Visible to customers', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];
  readonly variantStatusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
    { label: 'Out of stock', value: 'out_of_stock' },
  ];
  readonly galleryLimit = GALLERY_IMAGE_LIMIT;
  readonly paymentTermsOptions = PAYMENT_TERMS.map((v) => ({ label: v, value: v }));
  readonly settlementCycleOptions = SETTLEMENT_CYCLES.map((v) => ({ label: v, value: v }));
  readonly dealerSelectOptions = computed(() =>
    this.dealerCatalog()
      .filter((d) => d.status === 'active')
      .map((d) => ({
        label: `${d.dealerName} (${d.dealerCode})`,
        value: d.id,
      })),
  );

  reloadDealers(): void {
    this.dealersLoading.set(true);
    this.dealersError.set('');
    this.dealerService.list().subscribe({
      next: (dealers) => {
        this.dealerCatalog.set(dealers);
        this.dealersLoading.set(false);
        this.suppliersArr.controls.forEach((_, index) => this.syncDealerReadOnlyState(index));
        this.applyReturnDealerSelection();
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.dealersLoading.set(false);
        this.dealersError.set(this.extractMessage(err) || 'Failed to load dealers.');
        this.cdr.markForCheck();
      },
    });
  }

  primaryDealerId(): string {
    if (!this.suppliersArr.length) return '';
    return String(this.asGroup(this.suppliersArr.at(0)).get('dealerId')?.value ?? '');
  }

  basicDealerSelectOptions(): Array<{ label: string; value: string }> {
    const current = this.primaryDealerId();
    const base = this.dealerSelectOptions();
    if (current && !base.some((opt) => opt.value === current)) {
      const dealer = this.dealerCatalog().find((d) => d.id === current);
      const label = dealer ? `${dealer.dealerName} (${dealer.dealerCode})` : current;
      return [{ label, value: current }, ...base];
    }
    return base;
  }
  readonly variantDealerSelectOptions = computed(() =>
    this.dealerCatalog().map((d) => ({
      label: `${d.dealerName} (${d.dealerCode})`,
      value: d.dealerName,
    })),
  );
  readonly stockOwnershipOptions = STOCK_OWNERSHIP_TYPES.map((v) => ({ label: v, value: v }));
  readonly serviceChargeMethodOptions = SERVICE_CHARGE_METHODS.map((v) => ({ label: v, value: v }));
  readonly invoiceSettingOptions = INVOICE_SETTINGS.map((v) => ({ label: v, value: v }));
  readonly deliveryChargeMethodOptions = DELIVERY_CHARGE_METHODS.map((v) => ({ label: v, value: v }));
  readonly emiVisibilityOptions = [
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];

  readonly form: FormGroup = this.fb.group({
    // Step 1
    productName: ['', Validators.required],
    shortName: [''],
    productType: [''],
    brand: [''],
    sku: [''],
    modelNumber: [''],
    barcode: [''],
    hsnCode: [''],
    manufacturer: [''],
    warranty: [''],
    productCondition: ['New'],
    shortDescription: [''],
    description: [''],
    features: this.fb.array<string>([]),
    boxContents: this.fb.array<string>([]),
    aboutThisItem: this.fb.array<string>([]),
    productVideoUrl: [''],
    colourSizeVariant: [''],
    serialImeiTracking: [false],
    specifications: this.fb.array([]),

    // Step 2
    category: [''],
    subCategory: [''],
    childCategory: [''],

    // Step 3
    variantsEnabled: [false],
    attributes: this.fb.array([]),
    variants: this.fb.array([]),

    // Step 4
    primaryImage: [''],
    galleryImages: this.fb.array<string>([]),

    // Step 5
    mrp: [null as number | null, Validators.required],
    sellingPrice: [null as number | null, Validators.required],
    purchasePrice: [null as number | null],
    gst: [null as number | null],
    amazonPrice: [null as number | null],
    flipkartPrice: [null as number | null],
    otherWebsitePrice: [null as number | null],
    marketLowestPrice: [null as number | null],
    priceCheckedDate: [''],
    priceCheckedBy: [''],
    priceMatchAllowed: [false],
    maximumDiscountAllowed: [null as number | null],
    gstAmount: [''],
    landingCost: [''],
    margin: [''],
    discount: [''],

    // Step 6
    warehouse: [''],
    openingStock: [null as number | null],
    availableStock: [null as number | null],
    reservedStock: [null as number | null],
    minimumQuantity: [null as number | null],
    maximumQuantity: [null as number | null],
    minOrderQuantity: [null as number | null],
    maxQuantityPerCustomer: [null as number | null],
    minimumCustomerAge: [null as number | null],
    eligiblePinCodes: [''],
    trackInventory: [true],
    cashPurchase: [true],
    invoiceSetting: ['Auto Generate'],
    requiresFieldVerification: [false],
    requiresSerialImeiCapture: [false],

    // Step 7
    suppliers: this.fb.array([]),

    // Step 8
    weight: [''],
    length: [''],
    width: [''],
    height: [''],
    dispatchSla: [''],
    deliveryCharges: [null as number | null],
    deliveryDays: [''],
    replacementWindow: [''],
    replacementDays: [''],
    replacementWindowDays: [''],
    deliveryCode: [''],
    deliveryChargeMethod: [''],
    installationCharge: [null as number | null],
    installationRequired: [false],
    deliveryPartner: [''],
    deliveryZone: [''],
    expressDelivery: [false],
    deliveryConfirmationOtp: [false],
    serialImeiCaptureAtDelivery: [false],

    // Step 9
    emiEnabled: [false],
    selectedEmiPlanId: [''],
    emiPlans: this.fb.array([]),
    defaultDownPaymentPercent: [null as number | null],
    minCustomerDownPayment: [null as number | null],
    maxDownPayment: [null as number | null],
    downPaymentEditableAtApproval: [false],
    serviceChargeMethod: [''],
    documentationCharge: [null as number | null],
    verificationCharge: [null as number | null],
    firstEmiDueAfter: [''],
    gracePeriod: [''],

    // Step 10
    slug: [''],
    metaTitle: [''],
    metaDescription: [''],
    keywords: [''],

    // Step 11 / publish
    status: ['draft'],
  });

  get featuresArr(): FormArray<FormControl<string | null>> {
    return this.form.get('features') as FormArray<FormControl<string | null>>;
  }
  get boxContentsArr(): FormArray<FormControl<string | null>> {
    return this.form.get('boxContents') as FormArray<FormControl<string | null>>;
  }
  get aboutThisItemArr(): FormArray<FormControl<string | null>> {
    return this.form.get('aboutThisItem') as FormArray<FormControl<string | null>>;
  }
  get specificationsArr(): FormArray {
    return this.form.get('specifications') as FormArray;
  }
  get attributesArr(): FormArray {
    return this.form.get('attributes') as FormArray;
  }
  get galleryImagesArr(): FormArray<FormControl<string | null>> {
    return this.form.get('galleryImages') as FormArray<FormControl<string | null>>;
  }
  get variantsArr(): FormArray {
    return this.form.get('variants') as FormArray;
  }
  get suppliersArr(): FormArray {
    return this.form.get('suppliers') as FormArray;
  }
  get emiPlansArr(): FormArray {
    return this.form.get('emiPlans') as FormArray;
  }

  constructor() {
    this.form
      .get('productName')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => this.maybeAutofillSeo(String(name ?? '')));
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshCalculatedPricing();
    });
    this.form
      .get('openingStock')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.form.patchValue({ availableStock: value }, { emitEvent: false });
      });
    this.form
      .get('replacementWindow')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.form.patchValue(
          { replacementDays: value, replacementWindowDays: value },
          { emitEvent: false },
        );
      });
    this.form
      .get('installationRequired')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((on) => {
        if (!on) this.form.patchValue({ installationCharge: null }, { emitEvent: false });
      });
    this.form
      .get('variantsEnabled')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => {
        if (!enabled) {
          this.clearVariantLocalImages();
          this.variantsArr.clear();
          this.attributesArr.clear();
          this.expandedVariantIds.set([]);
        }
      });
    this.destroyRef.onDestroy(() => this.releaseAllLocalImages());

    this.reloadDealers();
    this.staffUsers.listStaff().subscribe({
      next: (users) => {
        this.staffOptions.set(
          users.map((u) => ({
            label: formatStaffOptionLabel(u),
            value: u.id,
            code: u.code,
            email: u.email ?? '',
          })),
        );
        this.resolveSourceCreatedByValues();
      },
      error: () => void 0,
    });

    if (this.productId) {
      this.products.getById(this.productId).subscribe({
        next: (product) => {
          this.patchFromProduct(product);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.messages.add({
            severity: 'error',
            summary: 'Failed to load product',
            detail: this.extractMessage(err),
          });
        },
      });
    }
  }

  private patchFromProduct(product: Product): void {
    const wizard = {
      ...initialWizardData(),
      ...(product.wizardData ?? {}),
    } as ProductWizardData;
    this.loadedWizard = { ...wizard };

    const primaryImage = String(product.image || wizard.primaryImage || '').trim();
    const galleryRaw = product.galleryImages ?? wizard.galleryImages ?? product.images ?? [];
    const galleryImages = (Array.isArray(galleryRaw) ? galleryRaw : []).filter(
      (uri): uri is string => typeof uri === 'string' && !!uri.trim() && uri !== primaryImage,
    );
    const rawVariants =
      Array.isArray(wizard.variants) && wizard.variants.length
        ? wizard.variants
        : (product.variants ?? []);
    const variantsEnabled = rawVariants.length > 0 || wizard.variantsEnabled === true;

    this.form.patchValue({
      productName: product.name,
      shortName: wizard.shortName,
      productType: wizard.productType || '',
      brand: product.brand ?? wizard.brand,
      sku: product.sku ?? wizard.sku,
      modelNumber: wizard.modelNumber,
      barcode: wizard.barcode,
      hsnCode: product.hsnCode ?? wizard.hsnCode,
      manufacturer: product.manufacturer ?? wizard.manufacturer,
      warranty: matchOption(product.warranty ?? wizard.warranty, WARRANTIES),
      productCondition: mapProductCondition(wizard.productCondition),
      colourSizeVariant: wizard.colourSizeVariant || '',
      serialImeiTracking: wizard.serialImeiTracking === true,
      shortDescription: product.shortDescription ?? wizard.shortDescription,
      description: product.description ?? wizard.description,
      productVideoUrl: wizard.productVideoUrl,
      category: this.resolveCategoryName(product.categoryId ?? wizard.category, product.category),
      subCategory: wizard.subCategory,
      childCategory: wizard.childCategory ?? '',
      variantsEnabled,
      primaryImage,
      mrp: product.mrp ?? Number(wizard.mrp) ?? null,
      sellingPrice: product.price ?? Number(wizard.sellingPrice) ?? null,
      purchasePrice: numOrNull(wizard.purchasePrice),
      gst: numOrNull(wizard.gst),
      amazonPrice: numOrNull(wizard.amazonPrice),
      flipkartPrice: numOrNull(wizard.flipkartPrice),
      otherWebsitePrice: numOrNull(wizard.otherWebsitePrice),
      marketLowestPrice: numOrNull(wizard.marketLowestPrice),
      priceCheckedDate: wizard.priceCheckedDate || '',
      priceCheckedBy: wizard.priceCheckedBy || '',
      priceMatchAllowed: wizard.priceMatchAllowed === true,
      maximumDiscountAllowed: numOrNull(wizard.maximumDiscountAllowed),
      gstAmount: wizard.gstAmount || '',
      landingCost: wizard.landingCost || '',
      margin: wizard.margin || '',
      discount: wizard.discount || '',
      warehouse: wizard.warehouse,
      openingStock: numOrNull(wizard.openingStock),
      availableStock: product.availableStock ?? product.stock ?? numOrNull(wizard.availableStock),
      reservedStock: numOrNull(wizard.reservedStock),
      minimumQuantity: numOrNull(wizard.minimumQuantity),
      maximumQuantity: numOrNull(wizard.maximumQuantity),
      minOrderQuantity: numOrNull(wizard.minOrderQuantity),
      maxQuantityPerCustomer: numOrNull(wizard.maxQuantityPerCustomer),
      minimumCustomerAge: numOrNull(wizard.minimumCustomerAge),
      eligiblePinCodes: wizard.eligiblePinCodes,
      trackInventory: wizard.trackInventory,
      cashPurchase: wizard.cashPurchase !== false,
      invoiceSetting: wizard.invoiceSetting || 'Auto Generate',
      requiresFieldVerification: wizard.requiresFieldVerification,
      requiresSerialImeiCapture: wizard.requiresSerialImeiCapture,
      weight: wizard.weight,
      length: wizard.length || '',
      width: wizard.width || '',
      height: wizard.height || '',
      dispatchSla: wizard.dispatchSla,
      deliveryCharges: numOrNull(wizard.deliveryCharges),
      deliveryDays: wizard.deliveryDays,
      replacementWindow: wizard.replacementWindow || wizard.replacementWindowDays || '',
      replacementDays: wizard.replacementDays || wizard.replacementWindow || wizard.replacementWindowDays || '',
      replacementWindowDays: wizard.replacementWindowDays || wizard.replacementWindow || '',
      deliveryCode: wizard.deliveryCode || '',
      deliveryChargeMethod: wizard.deliveryChargeMethod || '',
      installationCharge: numOrNull(wizard.installationCharge),
      installationRequired: wizard.installationRequired,
      deliveryPartner: wizard.deliveryPartner,
      deliveryZone: wizard.deliveryZone,
      expressDelivery: wizard.expressDelivery,
      deliveryConfirmationOtp: wizard.deliveryConfirmationOtp === true,
      serialImeiCaptureAtDelivery: wizard.serialImeiCaptureAtDelivery === true,
      emiEnabled: wizard.emiEnabled,
      selectedEmiPlanId: wizard.selectedEmiPlanId || '',
      defaultDownPaymentPercent: numOrNull(wizard.defaultDownPaymentPercent),
      minCustomerDownPayment: numOrNull(wizard.minCustomerDownPayment),
      maxDownPayment: numOrNull(wizard.maxDownPayment),
      downPaymentEditableAtApproval: wizard.downPaymentEditableAtApproval === true,
      serviceChargeMethod: wizard.serviceChargeMethod || '',
      documentationCharge: numOrNull(wizard.documentationCharge),
      verificationCharge: numOrNull(wizard.verificationCharge),
      firstEmiDueAfter: wizard.firstEmiDueAfter || '',
      gracePeriod: wizard.gracePeriod,
      slug: product.sku ? wizard.slug : wizard.slug,
      metaTitle: wizard.metaTitle,
      metaDescription: wizard.metaDescription,
      keywords: wizard.keywords,
      status: product.status,
    });

    this.setStringArray(
      this.featuresArr,
      normalizeTextListItems(wizard.features).map((item) => item.value),
    );
    this.setStringArray(
      this.boxContentsArr,
      normalizeTextListItems(wizard.boxContents).map((item) => item.value),
    );
    this.setStringArray(
      this.aboutThisItemArr,
      normalizeTextListItems(wizard.aboutThisItem).map((item) => item.value),
    );
    this.setStringArray(this.galleryImagesArr, galleryImages);
    this.specificationsArr.clear();
    normalizeKeyValueItems(wizard.specifications).forEach((item) =>
      this.specificationsArr.push(this.fb.group({ id: [item.id], key: [item.key], value: [item.value] })),
    );
    this.attributesArr.clear();
    if (wizard.brand) this.options.ensureName('brands', wizard.brand);
    if (wizard.warehouse) this.options.ensureName('warehouses', wizard.warehouse);
    if (wizard.deliveryPartner) this.options.ensureName('delivery_partners', wizard.deliveryPartner);
    if (wizard.deliveryZone) this.options.ensureName('delivery_zones', wizard.deliveryZone);
    (wizard.suppliers ?? []).forEach((raw) => {
      const s = normalizeSupplier(raw);
      if (s.supplier) this.options.ensureName('suppliers', s.supplier);
      if (s.dealer) this.options.ensureName('dealers', s.dealer);
      if (s.wholesaler) this.options.ensureName('wholesalers', s.wholesaler);
    });

    this.variantsArr.clear();
    rawVariants.forEach((v, index) => this.variantsArr.push(this.createVariantGroup(normalizeVariant(v, index))));
    this.suppliersArr.clear();
    (wizard.suppliers ?? []).forEach((s) => {
      const normalized = normalizeSupplier(s);
      normalized.productSourceType = 'Dealer';
      this.suppliersArr.push(this.createSupplierGroup(normalized));
    });
    this.suppliersArr.controls.forEach((_, index) => this.syncDealerReadOnlyState(index));
    this.resolveSourceCreatedByValues();
    this.emiPlansArr.clear();
    (wizard.emiPlans ?? []).forEach((p) => this.emiPlansArr.push(this.createEmiPlanGroup(normalizeEmiPlan(p))));
  }

  private setStringArray(arr: FormArray, values: string[]): void {
    arr.clear();
    (values ?? []).forEach((v) => arr.push(this.fb.control(v)));
  }

  addFeature(): void {
    this.featuresArr.push(this.fb.control(''));
  }
  addBoxContent(): void {
    this.boxContentsArr.push(this.fb.control(''));
  }
  addAboutThisItem(): void {
    this.aboutThisItemArr.push(this.fb.control(''));
  }
  addSpecification(): void {
    this.specificationsArr.push(
      this.fb.group({
        id: [`spec-${Date.now()}-${this.specificationsArr.length}`],
        key: [''],
        value: [''],
      }),
    );
  }

  autoFillFromAmazon(): void {
    const text = this.amazonPaste().trim();
    if (!text || this.amazonAnalyzing()) return;

    this.amazonAnalyzing.set(true);
    this.amazonFeedback.set({
      severity: 'info',
      message: 'Analyzing product details...',
    });
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const parsed = parseAmazonProductText(text);
        if (!amazonParseHasContent(parsed)) {
          this.amazonFeedback.set({
            severity: 'warn',
            message: 'No product details could be extracted from the provided text.',
          });
          this.messages.add({
            severity: 'warn',
            summary: 'Nothing to fill',
            detail: 'No product details could be extracted from the provided text.',
          });
          return;
        }
        this.applyAmazonParse(parsed);
        this.amazonFeedback.set({
          severity: 'success',
          message: 'Product details extracted successfully.',
        });
        this.messages.add({
          severity: 'success',
          summary: 'Auto Fill complete',
          detail: 'Product details extracted successfully. Review the fields before saving.',
        });
      } catch {
        this.amazonFeedback.set({
          severity: 'error',
          message: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
        this.messages.add({
          severity: 'error',
          summary: 'Auto Fill failed',
          detail: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
      } finally {
        this.amazonAnalyzing.set(false);
        this.cdr.markForCheck();
      }
    }, 220);
  }

  autoFillAboutThisItem(): void {
    const text = this.aboutThisItemPaste().trim();
    if (!text || this.aboutThisItemAnalyzing()) return;

    this.aboutThisItemAnalyzing.set(true);
    this.aboutThisItemFeedback.set({
      severity: 'info',
      message: 'Analyzing About this item...',
    });
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const items = parseAboutThisItemText(text);
        if (!items.length) {
          this.aboutThisItemFeedback.set({
            severity: 'warn',
            message: 'No About this item entries could be extracted from the provided text.',
          });
          this.messages.add({
            severity: 'warn',
            summary: 'Nothing to fill',
            detail: 'No About this item entries could be extracted from the provided text.',
          });
          return;
        }
        this.setStringArray(this.aboutThisItemArr, items);
        this.aboutThisItemFeedback.set({
          severity: 'success',
          message: 'About this item extracted successfully.',
        });
        this.messages.add({
          severity: 'success',
          summary: 'About this item',
          detail: 'About this item extracted successfully.',
        });
      } catch {
        this.aboutThisItemFeedback.set({
          severity: 'error',
          message: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
        this.messages.add({
          severity: 'error',
          summary: 'Auto Fill failed',
          detail: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
      } finally {
        this.aboutThisItemAnalyzing.set(false);
        this.cdr.markForCheck();
      }
    }, 180);
  }

  autoFillBoxContents(): void {
    const text = this.boxContentsPaste().trim();
    if (!text || this.boxContentsAnalyzing()) return;

    const hasExisting = this.boxContentsArr.controls.some((ctrl) => String(ctrl.value ?? '').trim());
    if (hasExisting) {
      this.confirmation.confirm({
        header: 'Replace Box Contents?',
        message:
          'Existing Box Contents items will be replaced with the newly parsed list. Continue?',
        acceptLabel: 'Replace Box Contents',
        rejectLabel: 'Cancel',
        acceptButtonStyleClass: 'p-button-warning',
        accept: () => this.runBoxContentsAutoFill(text),
      });
      return;
    }

    this.runBoxContentsAutoFill(text);
  }

  private runBoxContentsAutoFill(text: string): void {
    this.boxContentsAnalyzing.set(true);
    this.boxContentsFeedback.set({
      severity: 'info',
      message: 'Analyzing Box Contents...',
    });
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const items = parseBoxContentsText(text);
        if (!items.length) {
          this.boxContentsFeedback.set({
            severity: 'warn',
            message: 'No Box Contents items could be extracted from the provided text.',
          });
          this.messages.add({
            severity: 'warn',
            summary: 'Nothing to fill',
            detail: 'No Box Contents items could be extracted from the provided text.',
          });
          return;
        }
        this.setStringArray(this.boxContentsArr, items);
        this.boxContentsFeedback.set({
          severity: 'success',
          message: `Box Contents extracted successfully (${items.length} items).`,
        });
        this.messages.add({
          severity: 'success',
          summary: 'Box Contents',
          detail: `Box Contents extracted successfully (${items.length} items).`,
        });
      } catch {
        this.boxContentsFeedback.set({
          severity: 'error',
          message: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
        this.messages.add({
          severity: 'error',
          summary: 'Auto Fill failed',
          detail: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
      } finally {
        this.boxContentsAnalyzing.set(false);
        this.cdr.markForCheck();
      }
    }, 180);
  }

  private applyAmazonParse(parsed: ReturnType<typeof parseAmazonProductText>): void {
    const currentSpecs = this.specificationsArr.controls.map((ctrl) => {
      const raw = (ctrl as FormGroup).getRawValue() as { id?: string; key?: string; value?: string };
      return {
        id: String(raw.id ?? ''),
        key: String(raw.key ?? ''),
        value: String(raw.value ?? ''),
      };
    });
    const merged = mergeAmazonParseIntoProduct(
      {
        brand: String(this.form.get('brand')?.value ?? ''),
        manufacturer: String(this.form.get('manufacturer')?.value ?? ''),
        modelNumber: String(this.form.get('modelNumber')?.value ?? ''),
        warranty: String(this.form.get('warranty')?.value ?? ''),
        colourSizeVariant: String(this.form.get('colourSizeVariant')?.value ?? ''),
        shortDescription: String(this.form.get('shortDescription')?.value ?? ''),
        description: String(this.form.get('description')?.value ?? ''),
        specifications: currentSpecs,
        features: this.featuresArr.controls.map((ctrl) => String(ctrl.value ?? '')),
        boxContents: this.boxContentsArr.controls.map((ctrl) => String(ctrl.value ?? '')),
      },
      parsed,
    );

    this.form.patchValue({
      brand: merged.brand,
      manufacturer: merged.manufacturer,
      modelNumber: merged.modelNumber,
      warranty: merged.warranty,
      colourSizeVariant: merged.colourSizeVariant,
      shortDescription: merged.shortDescription,
      description: merged.description,
    });

    if (merged.brand) this.options.ensureName('brands', merged.brand);

    this.specificationsArr.clear();
    merged.specifications.forEach((item, index) => {
      this.specificationsArr.push(
        this.fb.group({
          id: [item.id || `spec-${Date.now()}-${index}`],
          key: [item.key],
          value: [item.value],
        }),
      );
    });
    this.setStringArray(this.featuresArr, merged.features);
    this.setStringArray(this.boxContentsArr, merged.boxContents);
  }

  canAutoGenerateSku(): boolean {
    // Always available — SKU can be built from model number or other product fields.
    return true;
  }

  openAddProductType(): void {
    this.productTypeDraft.set('');
    this.productTypeAddOpen.set(true);
  }

  submitAddProductType(): void {
    const name = this.productTypeDraft().trim();
    if (!name) {
      this.messages.add({
        severity: 'warn',
        summary: 'Product Type name required',
        detail: 'Enter a product type name.',
      });
      return;
    }

    this.productTypeSaving.set(true);
    this.options.createProductType(name).subscribe({
      next: (savedName) => {
        this.productTypeSaving.set(false);
        this.productTypeAddOpen.set(false);
        this.productTypeDraft.set('');
        this.form.patchValue({ productType: savedName });
        this.messages.add({
          severity: 'success',
          summary: 'Product Type added',
          detail: `"${savedName}" is now available and selected.`,
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.productTypeSaving.set(false);
        const detail =
          err instanceof HttpErrorResponse
            ? ((err.error as { message?: string; error?: string } | null)?.message ||
                (err.error as { message?: string; error?: string } | null)?.error ||
                err.message)
            : err instanceof Error
              ? err.message
              : 'Could not create product type.';
        this.messages.add({
          severity: 'error',
          summary: 'Could not add Product Type',
          detail,
        });
      },
    });
  }

  autoGenerateSku(): void {
    const variantSkus = this.variantsArr.controls.map((ctrl) => String(ctrl.get('sku')?.value ?? ''));
    const existing = getMockExistingSkus([
      String(this.form.get('sku')?.value ?? ''),
      ...variantSkus,
    ]);
    const generated = generateProductSku(
      {
        modelNumber: this.form.get('modelNumber')?.value,
        productName: this.form.get('productName')?.value,
        shortName: this.form.get('shortName')?.value,
        productType: this.form.get('productType')?.value,
        brand: this.form.get('brand')?.value,
        category: this.form.get('category')?.value,
        subCategory: this.form.get('subCategory')?.value,
      },
      existing,
    );
    if (!generated?.trim()) {
      this.messages.add({
        severity: 'error',
        summary: 'SKU generation failed',
        detail:
          'Could not generate a SKU from the available product information. Enter a SKU manually or fill in product details and try again.',
      });
      return;
    }
    this.form.patchValue({ sku: generated });
  }

  addGalleryImage(): void {
    this.applyGalleryUrl(this.galleryDraft());
  }
  removeAt(arr: FormArray, index: number): void {
    const value = arr.at(index)?.value;
    if (typeof value === 'string') this.releaseLocalImage(value);
    arr.removeAt(index);
    this.variantMediaTick.update((n) => n + 1);
  }

  asGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  variantId(ctrl: AbstractControl): string {
    return String((ctrl as FormGroup).get('id')?.value ?? '');
  }

  variantGalleryArr(index: number): FormArray<FormControl<string | null>> {
    return this.variantsArr.at(index).get('galleryImages') as FormArray<FormControl<string | null>>;
  }

  variantSpecsArr(index: number): FormArray {
    return this.variantsArr.at(index).get('specifications') as FormArray;
  }

  variantFeaturesArr(index: number): FormArray {
    return this.variantsArr.at(index).get('features') as FormArray;
  }

  variantBoxArr(index: number): FormArray {
    return this.variantsArr.at(index).get('boxContents') as FormArray;
  }

  isVariantExpanded(id: string): boolean {
    return this.expandedVariantIds().includes(id);
  }

  toggleVariant(id: string): void {
    this.expandedVariantIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  setVariantsEnabled(enabled: boolean): void {
    this.form.patchValue({ variantsEnabled: enabled });
  }

  addVariant(): void {
    const typed = this.newVariantName().trim();
    if (!typed) {
      this.messages.add({
        severity: 'warn',
        summary: 'Variant name required',
        detail: 'Type a variant name (e.g. Red, 64GB) then click Add Variant.',
      });
      return;
    }
    const index = this.variantsArr.length;
    const name = typed;

    const duplicate = this.variantsArr.controls.some(
      (ctrl) => String(ctrl.get('name')?.value ?? '').toLowerCase() === typed.toLowerCase(),
    );
    if (duplicate) {
      this.newVariantName.set('');
      return;
    }

    const created = createEmptyVariant(name, index, String(this.form.get('sku')?.value ?? ''), {
      mrp: asWizardString(this.form.get('mrp')?.value),
      sellingPrice: asWizardString(this.form.get('sellingPrice')?.value),
      purchasePrice: asWizardString(this.form.get('purchasePrice')?.value),
    });
    this.variantsArr.push(this.createVariantGroup(created));
    this.form.patchValue({ variantsEnabled: true }, { emitEvent: false });
    this.newVariantName.set('');
    this.expandedVariantIds.set([created.id]);
    this.cdr.markForCheck();
  }

  removeVariant(index: number): void {
    const id = this.variantId(this.variantsArr.at(index));
    this.releaseLocalImage(String(this.variantsArr.at(index).get('variantImage')?.value ?? ''));
    this.variantGalleryArr(index).controls.forEach((item) => {
      this.releaseLocalImage(String(item.value ?? ''));
    });
    this.variantsArr.removeAt(index);
    this.expandedVariantIds.update((ids) => ids.filter((x) => x !== id));
    if (this.variantsArr.length === 0) {
      this.form.patchValue({ variantsEnabled: false }, { emitEvent: false });
    }
  }

  clearVariants(): void {
    this.clearVariantLocalImages();
    this.variantsArr.clear();
    this.expandedVariantIds.set([]);
    this.form.patchValue({ variantsEnabled: false }, { emitEvent: false });
  }

  saveVariant(index: number): void {
    this.variantsArr.at(index).patchValue({ saved: true }, { emitEvent: false });
  }

  addVariantSpec(index: number): void {
    this.variantSpecsArr(index).push(
      this.fb.group({
        id: [`spec-${Date.now()}-${this.variantSpecsArr(index).length}`],
        key: [''],
        value: [''],
      }),
    );
    this.markVariantUnsaved(index);
  }

  addVariantFeature(index: number): void {
    this.variantFeaturesArr(index).push(
      this.fb.group({
        id: [`text-${Date.now()}-${this.variantFeaturesArr(index).length}`],
        value: [''],
      }),
    );
    this.markVariantUnsaved(index);
  }

  addVariantBoxItem(index: number): void {
    this.variantBoxArr(index).push(
      this.fb.group({
        id: [`text-${Date.now()}-${this.variantBoxArr(index).length}`],
        value: [''],
      }),
    );
    this.markVariantUnsaved(index);
  }

  setVariantPaste(
    which: 'amazon' | 'about' | 'box',
    variantId: string,
    value: string,
  ): void {
    if (which === 'amazon') {
      this.variantAmazonPaste.update((m) => ({ ...m, [variantId]: value }));
      return;
    }
    if (which === 'about') {
      this.variantAboutPaste.update((m) => ({ ...m, [variantId]: value }));
      return;
    }
    this.variantBoxPaste.update((m) => ({ ...m, [variantId]: value }));
  }

  autoFillVariantFromAmazon(index: number): void {
    const group = this.asGroup(this.variantsArr.at(index));
    const id = this.variantId(group);
    const text = (this.variantAmazonPaste()[id] ?? '').trim();
    if (!text || this.variantAmazonAnalyzing()[id]) return;

    this.variantAmazonAnalyzing.update((m) => ({ ...m, [id]: true }));
    this.variantAmazonFeedback.update((m) => ({
      ...m,
      [id]: { severity: 'info', message: 'Analyzing product details...' },
    }));
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const parsed = parseAmazonProductText(text);
        if (!amazonParseHasContent(parsed)) {
          this.variantAmazonFeedback.update((m) => ({
            ...m,
            [id]: {
              severity: 'warn',
              message: 'No product details could be extracted from the provided text.',
            },
          }));
          this.messages.add({
            severity: 'warn',
            summary: 'Nothing to fill',
            detail: 'No product details could be extracted for this variant.',
          });
          return;
        }
        this.applyVariantAmazonParse(index, parsed);
        this.variantAmazonFeedback.update((m) => ({
          ...m,
          [id]: { severity: 'success', message: 'Variant details extracted successfully.' },
        }));
        this.messages.add({
          severity: 'success',
          summary: 'Auto Fill complete',
          detail: 'Variant details extracted successfully. Review before saving the variant.',
        });
      } catch {
        this.variantAmazonFeedback.update((m) => ({
          ...m,
          [id]: {
            severity: 'error',
            message: 'Unable to analyze the provided content.',
          },
        }));
        this.messages.add({
          severity: 'error',
          summary: 'Auto Fill failed',
          detail: 'Unable to analyze the provided content for this variant.',
        });
      } finally {
        this.variantAmazonAnalyzing.update((m) => ({ ...m, [id]: false }));
        this.cdr.markForCheck();
      }
    }, 180);
  }

  autoFillVariantAboutThisItem(index: number): void {
    const group = this.asGroup(this.variantsArr.at(index));
    const id = this.variantId(group);
    const text = (this.variantAboutPaste()[id] ?? '').trim();
    if (!text || this.variantAboutAnalyzing()[id]) return;

    this.variantAboutAnalyzing.update((m) => ({ ...m, [id]: true }));
    this.variantAboutFeedback.update((m) => ({
      ...m,
      [id]: { severity: 'info', message: 'Analyzing About this item...' },
    }));
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const items = parseAboutThisItemText(text);
        if (!items.length) {
          this.variantAboutFeedback.update((m) => ({
            ...m,
            [id]: {
              severity: 'warn',
              message: 'No About this item entries could be extracted.',
            },
          }));
          this.messages.add({
            severity: 'warn',
            summary: 'Nothing to fill',
            detail: 'No About this item entries could be extracted for this variant.',
          });
          return;
        }
        this.mergeVariantTextList(this.variantFeaturesArr(index), items, 'feature');
        this.markVariantUnsaved(index);
        this.variantAboutFeedback.update((m) => ({
          ...m,
          [id]: {
            severity: 'success',
            message: `Features updated from About this item (${items.length} items).`,
          },
        }));
        this.messages.add({
          severity: 'success',
          summary: 'About this item',
          detail: 'Variant features updated from About this item.',
        });
      } catch {
        this.variantAboutFeedback.update((m) => ({
          ...m,
          [id]: {
            severity: 'error',
            message: 'Unable to analyze the provided content.',
          },
        }));
        this.messages.add({
          severity: 'error',
          summary: 'Auto Fill failed',
          detail: 'Unable to analyze About this item for this variant.',
        });
      } finally {
        this.variantAboutAnalyzing.update((m) => ({ ...m, [id]: false }));
        this.cdr.markForCheck();
      }
    }, 180);
  }

  autoFillVariantBoxContents(index: number): void {
    const group = this.asGroup(this.variantsArr.at(index));
    const id = this.variantId(group);
    const text = (this.variantBoxPaste()[id] ?? '').trim();
    if (!text || this.variantBoxAnalyzing()[id]) return;

    const hasExisting = this.variantBoxArr(index).controls.some((ctrl) =>
      String(ctrl.get('value')?.value ?? '').trim(),
    );
    if (hasExisting) {
      this.confirmation.confirm({
        header: 'Replace Box Contents?',
        message:
          'Existing variant Box Contents items will be replaced with the newly parsed list. Continue?',
        acceptLabel: 'Replace Box Contents',
        rejectLabel: 'Cancel',
        acceptButtonStyleClass: 'p-button-warning',
        accept: () => this.runVariantBoxContentsAutoFill(index, id, text),
      });
      return;
    }

    this.runVariantBoxContentsAutoFill(index, id, text);
  }

  private runVariantBoxContentsAutoFill(index: number, id: string, text: string): void {
    this.variantBoxAnalyzing.update((m) => ({ ...m, [id]: true }));
    this.variantBoxFeedback.update((m) => ({
      ...m,
      [id]: { severity: 'info', message: 'Analyzing Box Contents...' },
    }));
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const items = parseBoxContentsText(text);
        if (!items.length) {
          this.variantBoxFeedback.update((m) => ({
            ...m,
            [id]: {
              severity: 'warn',
              message: 'No Box Contents items could be extracted.',
            },
          }));
          this.messages.add({
            severity: 'warn',
            summary: 'Nothing to fill',
            detail: 'No Box Contents items could be extracted for this variant.',
          });
          return;
        }
        this.replaceVariantTextList(this.variantBoxArr(index), items, 'box');
        this.markVariantUnsaved(index);
        this.variantBoxFeedback.update((m) => ({
          ...m,
          [id]: {
            severity: 'success',
            message: `Box Contents extracted successfully (${items.length} items).`,
          },
        }));
        this.messages.add({
          severity: 'success',
          summary: 'Box Contents',
          detail: `Variant Box Contents extracted successfully (${items.length} items).`,
        });
      } catch {
        this.variantBoxFeedback.update((m) => ({
          ...m,
          [id]: {
            severity: 'error',
            message: 'Unable to analyze the provided content.',
          },
        }));
        this.messages.add({
          severity: 'error',
          summary: 'Auto Fill failed',
          detail: 'Unable to analyze Box Contents for this variant.',
        });
      } finally {
        this.variantBoxAnalyzing.update((m) => ({ ...m, [id]: false }));
        this.cdr.markForCheck();
      }
    }, 180);
  }

  private applyVariantAmazonParse(
    index: number,
    parsed: ReturnType<typeof parseAmazonProductText>,
  ): void {
    const group = this.asGroup(this.variantsArr.at(index));
    const specsArr = this.variantSpecsArr(index);
    const featuresArr = this.variantFeaturesArr(index);
    const boxArr = this.variantBoxArr(index);

    const currentSpecs = specsArr.controls.map((ctrl) => {
      const raw = (ctrl as FormGroup).getRawValue() as { id?: string; key?: string; value?: string };
      return {
        id: String(raw.id ?? ''),
        key: String(raw.key ?? ''),
        value: String(raw.value ?? ''),
      };
    });
    const currentFeatures = featuresArr.controls.map((ctrl) =>
      String(ctrl.get('value')?.value ?? ''),
    );
    const currentBox = boxArr.controls.map((ctrl) => String(ctrl.get('value')?.value ?? ''));

    const merged = mergeAmazonParseIntoVariant(
      {
        description: String(group.get('description')?.value ?? ''),
        weight: String(group.get('weight')?.value ?? ''),
        length: String(group.get('length')?.value ?? ''),
        width: String(group.get('width')?.value ?? ''),
        height: String(group.get('height')?.value ?? ''),
        specifications: currentSpecs,
        features: currentFeatures,
        boxContents: currentBox,
      },
      parsed,
    );

    group.patchValue(
      {
        description: merged.description,
        weight: merged.weight,
        length: merged.length,
        width: merged.width,
        height: merged.height,
      },
      { emitEvent: false },
    );

    specsArr.clear();
    merged.specifications.forEach((item, specIndex) => {
      specsArr.push(
        this.fb.group({
          id: [item.id || `spec-${Date.now()}-${specIndex}`],
          key: [item.key],
          value: [item.value],
        }),
      );
    });
    this.replaceVariantTextList(featuresArr, merged.features, 'feature');
    this.replaceVariantTextList(boxArr, merged.boxContents, 'box');
    this.markVariantUnsaved(index);
    this.cdr.markForCheck();
  }

  private mergeVariantTextList(
    arr: FormArray,
    values: string[],
    kind: 'feature' | 'box',
  ): void {
    const existing = arr.controls.map((ctrl) => String(ctrl.get('value')?.value ?? ''));
    const seen = new Set(existing.map((v) => v.trim().toLowerCase()).filter(Boolean));
    for (const value of values) {
      const trimmed = String(value ?? '').trim();
      if (!trimmed) continue;
      const token = trimmed.toLowerCase();
      if (seen.has(token)) continue;
      seen.add(token);
      const emptyIndex = arr.controls.findIndex(
        (ctrl) => !String(ctrl.get('value')?.value ?? '').trim(),
      );
      if (emptyIndex >= 0) {
        arr.at(emptyIndex).patchValue({ value: trimmed });
      } else {
        arr.push(
          this.fb.group({
            id: [`${kind}-${Date.now()}-${arr.length}`],
            value: [trimmed],
          }),
        );
      }
    }
  }

  private replaceVariantTextList(
    arr: FormArray,
    values: string[],
    kind: 'feature' | 'box',
  ): void {
    arr.clear();
    values.forEach((value, i) => {
      arr.push(
        this.fb.group({
          id: [`${kind}-${Date.now()}-${i}`],
          value: [value],
        }),
      );
    });
  }

  addVariantGalleryImage(index: number): void {
    const id = this.variantId(this.variantsArr.at(index));
    const url = (this.variantImageDrafts()[id] ?? '').trim();
    if (!this.assertHttpUrl(url, `variant-gallery-${id}`)) return;
    this.variantGalleryArr(index).push(this.fb.control(url));
    this.variantImageDrafts.update((map) => ({ ...map, [id]: '' }));
    this.markVariantUnsaved(index);
  }

  clearVariantPrimaryImage(index: number): void {
    this.releaseLocalImage(String(this.variantsArr.at(index).get('variantImage')?.value ?? ''));
    this.variantsArr.at(index).patchValue({ variantImage: null });
    this.markVariantUnsaved(index);
  }

  applyPrimaryUrl(url: string): void {
    const trimmed = url.trim();
    if (!this.assertHttpUrl(trimmed, 'primary')) return;
    this.form.patchValue({ primaryImage: trimmed });
  }

  applyGalleryUrl(url: string): void {
    const trimmed = url.trim();
    if (!this.assertHttpUrl(trimmed, 'gallery')) return;
    if (this.galleryImagesArr.length >= GALLERY_IMAGE_LIMIT) {
      this.messages.add({
        severity: 'warn',
        summary: 'Gallery limit',
        detail: `Up to ${GALLERY_IMAGE_LIMIT} gallery images can be added.`,
      });
      return;
    }
    const exists = this.galleryImagesArr.controls.some((ctrl) => ctrl.value === trimmed);
    if (exists) {
      this.messages.add({
        severity: 'warn',
        summary: 'Already added',
        detail: 'That gallery URL is already in the list.',
      });
      return;
    }
    this.galleryImagesArr.push(this.fb.control(trimmed));
    this.galleryDraft.set('');
    this.clearImageError('gallery');
  }

  removePrimaryImage(): void {
    this.releaseLocalImage(String(this.form.get('primaryImage')?.value ?? ''));
    this.form.patchValue({ primaryImage: '' });
    this.clearImageError('primary');
  }

  isLocalImage(url: string | null | undefined): boolean {
    return !!url && (url.startsWith('blob:') || this.pendingUploads.has(url));
  }

  mediaSrc(url: string | null | undefined): string {
    return resolveMediaUrl(url);
  }

  fileNameFromUrl(url: string | null | undefined): string {
    if (!url) return '';
    const pending = this.pendingUploads.get(url);
    if (pending) return pending.name;
    try {
      const path = new URL(resolveMediaUrl(url), 'http://local.invalid').pathname;
      const name = path.split('/').filter(Boolean).pop();
      return name ? decodeURIComponent(name) : url;
    } catch {
      return url;
    }
  }

  onImageError(url: string): void {
    this.brokenUrls.update((set) => new Set(set).add(url));
  }

  onImageLoad(url: string): void {
    this.brokenUrls.update((set) => {
      const next = new Set(set);
      next.delete(url);
      return next;
    });
  }

  isBroken(url: string | null | undefined): boolean {
    return !!url && this.brokenUrls().has(url);
  }

  imageError(key: string): string {
    return this.imageErrors()[key] ?? '';
  }

  onPrimaryDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.uploadPrimaryFile(file);
      return;
    }
    const uri =
      event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain');
    if (uri?.trim()) this.applyPrimaryUrl(uri.trim());
  }

  onGalleryDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.uploadGalleryFiles(files);
      return;
    }
    const uri =
      event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain');
    if (uri?.trim()) this.applyGalleryUrl(uri.trim());
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onPrimaryFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.uploadPrimaryFile(file);
  }

  onGalleryFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    input.value = '';
    if (files?.length) this.uploadGalleryFiles(files);
  }

  onVariantFileSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.uploadVariantFile(index, file);
  }

  onVariantGalleryFilesSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    input.value = '';
    if (files?.length) this.uploadVariantGalleryFiles(index, files);
  }

  pickPrimaryImage(): void {
    this.openFilePicker(false, (files) => this.uploadPrimaryFile(files[0]));
  }

  pickGalleryImages(): void {
    this.openFilePicker(true, (files) => this.uploadGalleryFiles(files));
  }

  pickVariantImage(index: number): void {
    this.openFilePicker(false, (files) => this.uploadVariantFile(index, files[0]));
  }

  pickVariantGallery(index: number): void {
    this.openFilePicker(true, (files) => this.uploadVariantGalleryFiles(index, files));
  }

  private openFilePicker(multiple: boolean, onFiles: (files: File[]) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = this.imageAccept;
    input.multiple = multiple;
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      if (files.length) onFiles(files);
      input.remove();
    });
    input.click();
  }

  uploadPrimaryFile(file: File): void {
    const previous = String(this.form.get('primaryImage')?.value ?? '');
    this.attachLocalImage(file, 'primary', (url) => {
      this.releaseLocalImage(previous);
      this.form.patchValue({ primaryImage: url });
    });
  }

  uploadGalleryFiles(fileList: FileList | File[]): void {
    const remaining = GALLERY_IMAGE_LIMIT - this.galleryImagesArr.length;
    const files = Array.from(fileList).slice(0, Math.max(0, remaining));
    if (!files.length) {
      this.messages.add({
        severity: 'warn',
        summary: 'Gallery limit',
        detail: `Up to ${GALLERY_IMAGE_LIMIT} gallery images can be added.`,
      });
      return;
    }
    files.forEach((file) => {
      this.attachLocalImage(file, 'gallery', (url) => {
        this.galleryImagesArr.push(this.fb.control(url));
        this.clearImageError('gallery');
        this.variantMediaTick.update((n) => n + 1);
      });
    });
  }

  uploadVariantFile(index: number, file: File): void {
    const id = this.variantId(this.variantsArr.at(index));
    const previous = String(this.variantsArr.at(index).get('variantImage')?.value ?? '');
    this.attachLocalImage(file, `variant-${id}`, (url) => {
      this.releaseLocalImage(previous);
      this.variantsArr.at(index).patchValue({ variantImage: url });
      this.markVariantUnsaved(index);
      this.variantMediaTick.update((n) => n + 1);
    });
  }

  uploadVariantGalleryFiles(index: number, fileList: FileList | File[]): void {
    const id = this.variantId(this.variantsArr.at(index));
    Array.from(fileList).forEach((file) => {
      this.attachLocalImage(file, `variant-gallery-${id}`, (url) => {
        this.variantGalleryArr(index).push(this.fb.control(url));
        this.markVariantUnsaved(index);
        this.variantMediaTick.update((n) => n + 1);
      });
    });
  }

  setVariantDraft(id: string, value: string): void {
    this.variantImageDrafts.update((map) => ({ ...map, [id]: value }));
  }

  variantDraft(id: string): string {
    return this.variantImageDrafts()[id] ?? '';
  }

  private attachLocalImage(file: File, key: string, onUrl: (url: string) => void): void {
    const invalid = this.validateImageFile(file);
    if (invalid) {
      this.setImageError(key, invalid);
      this.messages.add({ severity: 'error', summary: 'Invalid image', detail: invalid });
      return;
    }

    const url = URL.createObjectURL(file);
    this.pendingUploads.set(url, file);
    this.brokenUrls.update((set) => {
      const next = new Set(set);
      next.delete(url);
      return next;
    });
    onUrl(url);
    this.clearImageError(key);
    this.cdr.markForCheck();
  }

  private releaseLocalImage(url: string | null | undefined): void {
    if (!url || !this.pendingUploads.has(url)) return;
    URL.revokeObjectURL(url);
    this.pendingUploads.delete(url);
  }

  private releaseAllLocalImages(): void {
    for (const url of this.pendingUploads.keys()) {
      URL.revokeObjectURL(url);
    }
    this.pendingUploads.clear();
  }

  private clearVariantLocalImages(): void {
    this.variantsArr.controls.forEach((ctrl, index) => {
      this.releaseLocalImage(String(ctrl.get('variantImage')?.value ?? ''));
      this.variantGalleryArr(index).controls.forEach((item) => {
        this.releaseLocalImage(String(item.value ?? ''));
      });
    });
  }

  private collectPendingImageUrls(): string[] {
    const urls: string[] = [];
    const add = (value: unknown) => {
      const url = String(value ?? '').trim();
      if (url && this.pendingUploads.has(url) && !urls.includes(url)) urls.push(url);
    };
    add(this.form.get('primaryImage')?.value);
    this.galleryImagesArr.controls.forEach((ctrl) => add(ctrl.value));
    this.variantsArr.controls.forEach((ctrl, index) => {
      add(ctrl.get('variantImage')?.value);
      this.variantGalleryArr(index).controls.forEach((item) => add(item.value));
    });
    return urls;
  }

  private replaceImageUrl(from: string, to: string): void {
    if (this.form.get('primaryImage')?.value === from) {
      this.form.patchValue({ primaryImage: to }, { emitEvent: false });
    }
    this.galleryImagesArr.controls.forEach((ctrl) => {
      if (ctrl.value === from) ctrl.setValue(to, { emitEvent: false });
    });
    this.variantsArr.controls.forEach((ctrl, index) => {
      if (ctrl.get('variantImage')?.value === from) {
        ctrl.patchValue({ variantImage: to }, { emitEvent: false });
      }
      this.variantGalleryArr(index).controls.forEach((item) => {
        if (item.value === from) item.setValue(to, { emitEvent: false });
      });
    });
    this.releaseLocalImage(from);
  }

  private flushPendingImages(): Observable<void> {
    const urls = this.collectPendingImageUrls();
    if (!urls.length) return of(undefined);
    return forkJoin(
      urls.map((url) => {
        const file = this.pendingUploads.get(url);
        if (!file) return of(null);
        return this.products.uploadImage(file).pipe(
          map((uploaded) => {
            const next = uploaded?.url || '';
            if (next) this.replaceImageUrl(url, next);
            return next;
          }),
        );
      }),
    ).pipe(map(() => undefined));
  }

  private validateImageFile(file: File): string | null {
    const typeOk =
      PRODUCT_IMAGE_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_TYPES)[number]) ||
      /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!typeOk) return 'Use a JPG, PNG, WEBP, or GIF file.';
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) return 'Image must be 5MB or smaller.';
    return null;
  }

  private assertHttpUrl(url: string, key: string): boolean {
    if (!url) {
      this.setImageError(key, 'Enter an image URL.');
      return false;
    }
    if (
      url.startsWith('blob:') ||
      url.startsWith('data:image/') ||
      isStoredImageRef(url) ||
      url.startsWith('/api/v1/products/images/')
    ) {
      this.clearImageError(key);
      return true;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        this.setImageError(key, 'Use an http:// or https:// image URL.');
        return false;
      }
    } catch {
      this.setImageError(key, 'Enter a valid image URL.');
      return false;
    }
    this.clearImageError(key);
    return true;
  }

  private setImageError(key: string, message: string): void {
    this.imageErrors.update((map) => ({ ...map, [key]: message }));
  }

  private clearImageError(key: string): void {
    this.imageErrors.update((map) => {
      const next = { ...map };
      delete next[key];
      return next;
    });
  }

  private markVariantUnsaved(index: number): void {
    const group = this.variantsArr.at(index);
    if (group.get('saved')?.value) {
      group.patchValue({ saved: false }, { emitEvent: false });
    }
  }

  private createVariantGroup(variant: ProductVariant): FormGroup {
    const group = this.fb.group({
      id: [variant.id],
      name: [variant.name, Validators.required],
      variantImage: [variant.variantImage ?? ''],
      galleryImages: this.fb.array(variant.galleryImages.map((uri) => this.fb.control(uri))),
      sku: [variant.sku],
      barcode: [variant.barcode],
      mrp: [variant.mrp],
      sellingPrice: [variant.sellingPrice],
      purchasePrice: [variant.purchasePrice],
      stock: [variant.stock],
      description: [variant.description],
      specifications: this.fb.array(
        variant.specifications.map((item) =>
          this.fb.group({ id: [item.id], key: [item.key], value: [item.value] }),
        ),
      ),
      features: this.fb.array(
        variant.features.map((item) => this.fb.group({ id: [item.id], value: [item.value] })),
      ),
      boxContents: this.fb.array(
        variant.boxContents.map((item) => this.fb.group({ id: [item.id], value: [item.value] })),
      ),
      weight: [variant.weight],
      length: [variant.length],
      width: [variant.width],
      height: [variant.height],
      supplier: [variant.supplier],
      warehouse: [variant.warehouse],
      emiPlanId: [variant.emiPlanId],
      status: [variant.status],
      saved: [variant.saved],
    });
    group.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (group.get('saved')?.value) {
        group.patchValue({ saved: false }, { emitEvent: false });
      }
    });
    return group;
  }

  private serializeVariants(): ProductVariant[] {
    return this.variantsArr.controls.map((ctrl, index) => {
      const raw = (ctrl as FormGroup).getRawValue() as ProductVariant;
      return normalizeVariant(
        {
          ...raw,
          variantImage: raw.variantImage || null,
          galleryImages: (raw.galleryImages ?? []).filter((uri) => !!String(uri ?? '').trim()),
        },
        index,
      );
    });
  }

  addSupplier(): void {
    this.suppliersArr.push(this.createSupplierGroup(createEmptySupplier()));
    const index = this.suppliersArr.length - 1;
    this.asGroup(this.suppliersArr.at(index)).patchValue({ productSourceType: 'Dealer' });
  }

  removeSupplier(index: number): void {
    this.suppliersArr.removeAt(index);
  }

  supplierSchedule(ctrl: AbstractControl): string {
    return formatDealerPaymentSchedule(this.asGroup(ctrl).getRawValue() as SupplierEntry);
  }

  addEmiPlan(): void {
    this.emiPlansArr.push(this.createEmiPlanGroup(createEmptyEmiPlan()));
  }

  removeEmiPlan(index: number): void {
    this.emiPlansArr.removeAt(index);
  }

  private createSupplierGroup(supplier: SupplierEntry): FormGroup {
    return this.fb.group({
      id: [supplier.id],
      productSourceType: [supplier.productSourceType || 'Dealer'],
      sourceCreatedBy: [supplier.sourceCreatedBy],
      dealerId: [supplier.dealerId],
      supplier: [supplier.supplier],
      dealer: [supplier.dealer],
      wholesaler: [supplier.wholesaler],
      supplierSku: [supplier.supplierSku],
      purchaseInvoice: [supplier.purchaseInvoice],
      purchaseDate: [supplier.purchaseDate],
      settlementCycle: [supplier.settlementCycle],
      leadTime: [supplier.leadTime],
      paymentTerms: [supplier.paymentTerms],
      notes: [supplier.notes],
      productSource: [supplier.productSource],
      supplierCode: [supplier.supplierCode],
      dealerBranch: [supplier.dealerBranch],
      supplierGstin: [supplier.supplierGstin],
      supplierContact: [supplier.supplierContact],
      supplierProductCode: [supplier.supplierProductCode],
      stockOwnership: [supplier.stockOwnership],
      dispatchFrom: [supplier.dispatchFrom],
      firstPaymentPercent: [supplier.firstPaymentPercent],
      deliveryPaymentPercent: [supplier.deliveryPaymentPercent],
      holdPaymentPercent: [supplier.holdPaymentPercent],
      returnToSupplierAllowed: [supplier.returnToSupplierAllowed],
      dealerIncentivePercent: [supplier.dealerIncentivePercent],
    });
  }

  private createEmiPlanGroup(plan: EmiPlanEntry): FormGroup {
    return this.fb.group({
      id: [plan.id],
      enabled: [plan.enabled],
      planName: [plan.planName, Validators.required],
      months: [plan.months],
      downPayment: [plan.downPayment],
      serviceCharge: [plan.serviceCharge],
      deliveryCharge: [plan.deliveryCharge],
      minEligibilityAmount: [plan.minEligibilityAmount],
      customerVisibility: [plan.customerVisibility],
    });
  }

  private serializeSuppliers(): SupplierEntry[] {
    return this.suppliersArr.controls.map((ctrl) =>
      normalizeSupplier((ctrl as FormGroup).getRawValue()),
    );
  }

  private serializeEmiPlans(): EmiPlanEntry[] {
    return this.emiPlansArr.controls.map((ctrl) =>
      normalizeEmiPlan((ctrl as FormGroup).getRawValue()),
    );
  }

  categoryNames(): string[] {
    return this.options.categoryNames();
  }

  subCategoryNames(): string[] {
    return this.options.subCategoryNames(String(this.form.get('category')?.value ?? ''));
  }

  onCategoryChange(value: string): void {
    this.form.patchValue({
      category: value,
      subCategory: '',
      brand: '',
      childCategory: '',
    });
  }

  onSubCategoryChange(value: string): void {
    this.form.patchValue({ subCategory: value, brand: '', childCategory: '' });
  }

  onBrandChange(value: string): void {
    this.form.patchValue({ brand: value });
  }

  renameCategory(from: string, to: string): void {
    const ok = this.options.renameCategory(from, to);
    if (ok && this.form.get('category')?.value === from) {
      this.form.patchValue({ category: to });
    }
  }

  deleteCategory(name: string): void {
    this.options.deleteCategory(name);
    if (this.form.get('category')?.value === name) {
      this.form.patchValue({ category: '', subCategory: '', brand: '', childCategory: '' });
    }
  }

  renameSubCategory(from: string, to: string): void {
    const category = String(this.form.get('category')?.value ?? '');
    const ok = this.options.renameSubCategory(category, from, to);
    if (ok && this.form.get('subCategory')?.value === from) {
      this.form.patchValue({ subCategory: to });
    }
  }

  deleteSubCategory(name: string): void {
    this.options.deleteSubCategory(String(this.form.get('category')?.value ?? ''), name);
    if (this.form.get('subCategory')?.value === name) {
      this.form.patchValue({ subCategory: '', brand: '', childCategory: '' });
    }
  }

  renameBrand(from: string, to: string): void {
    const ok = this.options.renameBrand(from, to);
    if (ok && this.form.get('brand')?.value === from) this.form.patchValue({ brand: to });
  }

  deleteBrand(name: string): void {
    this.options.deleteBrand(name);
    if (this.form.get('brand')?.value === name) this.form.patchValue({ brand: '' });
  }

  onWarehouseChange(value: string): void {
    this.form.patchValue({ warehouse: value });
  }

  renameWarehouseEverywhere(from: string, to: string): void {
    const ok = this.options.renameWarehouse(from, to);
    if (!ok) return;
    if (this.form.get('warehouse')?.value === from) this.form.patchValue({ warehouse: to });
    this.variantsArr.controls.forEach((ctrl, index) => {
      if (ctrl.get('warehouse')?.value === from) {
        ctrl.patchValue({ warehouse: to });
        this.markVariantUnsaved(index);
      }
    });
  }

  deleteWarehouseEverywhere(name: string): void {
    this.options.deleteWarehouse(name);
    if (this.form.get('warehouse')?.value === name) this.form.patchValue({ warehouse: '' });
    this.variantsArr.controls.forEach((ctrl, index) => {
      if (ctrl.get('warehouse')?.value === name) {
        ctrl.patchValue({ warehouse: '' });
        this.markVariantUnsaved(index);
      }
    });
  }

  onSupplierFieldChange(index: number, field: 'supplier' | 'dealer' | 'wholesaler', value: string): void {
    const patch: Record<string, string> = { [field]: value };
    if (field === 'supplier') {
      const master = this.options.findSupplierByName(value);
      if (master?.paymentTerms) patch['paymentTerms'] = master.paymentTerms;
      if (master?.settlementCycle) patch['settlementCycle'] = master.settlementCycle;
      if (master?.gstin) patch['supplierGstin'] = master.gstin;
      if (master?.phone) patch['supplierContact'] = master.phone;
    }
    this.suppliersArr.at(index).patchValue(patch);
  }

  onProductSourceTypeChange(index: number, type: string): void {
    const group = this.asGroup(this.suppliersArr.at(index));
    this.clearDealerDerivedFields(index);
    group.patchValue({
      productSourceType: type,
      supplier: '',
      dealer: '',
      dealerId: '',
      wholesaler: '',
    });
    if (type !== 'Dealer') {
      this.dealerPatchedByIndex.delete(index);
    }
  }

  onPrimaryDealerSelected(dealerId: string | null): void {
    if (!dealerId) {
      if (this.suppliersArr.length) {
        this.onDealerSelected(0, null);
      }
      return;
    }
    if (!this.suppliersArr.length) {
      this.addSupplier();
    }
    this.onDealerSelected(0, dealerId);
  }

  onDealerSelected(index: number, dealerId: string | null): void {
    this.clearDealerDerivedFields(index);
    const group = this.asGroup(this.suppliersArr.at(index));
    if (!dealerId) {
      group.patchValue({ dealerId: '', dealer: '' });
      return;
    }
    const dealer = this.dealerCatalog().find((d) => d.id === dealerId);
    if (!dealer) return;
    this.applyDealerPatch(index, dealer);
  }

  selectedDealer(index: number): Dealer | null {
    const ctrl = this.suppliersArr.at(index);
    if (!ctrl) return null;
    const dealerId = String(this.asGroup(ctrl).get('dealerId')?.value ?? '');
    if (!dealerId) return null;
    return this.dealerCatalog().find((d) => d.id === dealerId) ?? null;
  }

  isDealerFieldReadOnly(index: number, field: string): boolean {
    const group = this.asGroup(this.suppliersArr.at(index));
    if (!this.isDealerSourceRow(group)) return false;
    return this.dealerPatchedByIndex.get(index)?.has(field) ?? false;
  }

  navigateToAddDealer(supplierIndex: number): void {
    const returnTo = this.router.url;
    this.router.navigate(['/masters/dealers/new'], {
      queryParams: {
        returnTo,
        returnLabel: 'Back to Product',
        supplierIndex,
      },
    });
  }

  navigateToAddDealerFromVariant(): void {
    const returnTo = this.router.url;
    this.router.navigate(['/masters/dealers/new'], {
      queryParams: {
        returnTo,
        returnLabel: 'Back to Product',
      },
    });
  }

  onVariantDealerChange(variantIndex: number): void {
    this.markVariantUnsaved(variantIndex);
  }

  private applyReturnDealerSelection(): void {
    const state = history.state as {
      selectedDealerId?: string;
      selectedDealerName?: string;
    } | null;
    if (!state?.selectedDealerId) return;
    const index = Number(this.route.snapshot.queryParamMap.get('supplierIndex') ?? 0);
    const group =
      this.suppliersArr.at(index) ?? this.suppliersArr.at(this.suppliersArr.length - 1);
    if (!group) {
      this.addSupplier();
    }
    const targetIndex = group ? index : this.suppliersArr.length - 1;
    const target = this.asGroup(this.suppliersArr.at(targetIndex));
    target.patchValue({ productSourceType: 'Dealer' });
    this.onDealerSelected(targetIndex, state.selectedDealerId);
  }

  private applyDealerPatch(index: number, dealer: Dealer): void {
    const patch = dealerToProductPatch(dealer);
    const patched = new Set<string>();
    for (const field of DEALER_PATCHED_PRODUCT_FIELDS) {
      if (field === 'dealerId') continue;
      const value = patch[field];
      if (value) patched.add(field);
    }
    this.dealerPatchedByIndex.set(index, patched);
    this.asGroup(this.suppliersArr.at(index)).patchValue(patch);
    this.syncDealerReadOnlyState(index);
  }

  private clearDealerDerivedFields(index: number): void {
    const group = this.asGroup(this.suppliersArr.at(index));
    const patched = this.dealerPatchedByIndex.get(index);
    if (patched) {
      const reset: Record<string, string> = {};
      for (const field of patched) {
        reset[field] = '';
      }
      reset['dealer'] = '';
      reset['dealerId'] = '';
      group.patchValue(reset);
      for (const field of patched) {
        group.get(field)?.enable({ emitEvent: false });
      }
    }
    this.dealerPatchedByIndex.delete(index);
  }

  private resolveSourceCreatedByValues(): void {
    const staff = this.staffOptions();
    if (!staff.length) return;
    for (const ctrl of this.suppliersArr.controls) {
      const current = String(ctrl.get('sourceCreatedBy')?.value ?? '').trim();
      if (!current) continue;
      if (staff.some((s) => s.value === current)) continue;
      const match = staff.find((s) => {
        const nameOnly = s.label.replace(/\s+\([^)]+\)\s*$/, '').trim();
        return nameOnly === current || s.label === current || s.code === current;
      });
      if (match) {
        ctrl.patchValue({ sourceCreatedBy: match.value }, { emitEvent: false });
      }
    }
  }

  private syncDealerReadOnlyState(index: number): void {
    const group = this.asGroup(this.suppliersArr.at(index));
    const dealerId = String(group.get('dealerId')?.value ?? '');
    if (this.isDealerSourceRow(group) && dealerId) {
      const dealer = this.dealerCatalog().find((d) => d.id === dealerId);
      if (dealer) {
        const patch = dealerToProductPatch(dealer);
        const patched = new Set<string>();
        for (const field of DEALER_PATCHED_PRODUCT_FIELDS) {
          if (field === 'dealerId') continue;
          if (patch[field]) patched.add(field);
        }
        this.dealerPatchedByIndex.set(index, patched);
        group.patchValue({ ...patch, productSourceType: 'Dealer' }, { emitEvent: false });
      }
    }
    const patched = this.dealerPatchedByIndex.get(index);
    if (this.isDealerSourceRow(group) && patched) {
      for (const field of patched) {
        group.get(field)?.disable({ emitEvent: false });
      }
    }
  }

  private isDealerSourceRow(group: FormGroup): boolean {
    const type = String(group.get('productSourceType')?.value ?? '');
    return !type || type === 'Dealer';
  }

  renameSupplierEverywhere(from: string, to: string): void {
    if (!this.options.renameSupplier(from, to)) return;
    this.suppliersArr.controls.forEach((ctrl) => {
      if (ctrl.get('supplier')?.value === from) ctrl.patchValue({ supplier: to });
    });
    this.variantsArr.controls.forEach((ctrl, index) => {
      if (ctrl.get('supplier')?.value === from) {
        ctrl.patchValue({ supplier: to });
        this.markVariantUnsaved(index);
      }
    });
  }

  deleteSupplierEverywhere(name: string): void {
    this.options.deleteSupplier(name);
    this.suppliersArr.controls.forEach((ctrl) => {
      if (ctrl.get('supplier')?.value === name) ctrl.patchValue({ supplier: '' });
    });
    this.variantsArr.controls.forEach((ctrl, index) => {
      if (ctrl.get('supplier')?.value === name) {
        ctrl.patchValue({ supplier: '' });
        this.markVariantUnsaved(index);
      }
    });
  }

  renameDealerEverywhere(from: string, to: string): void {
    if (!this.options.renameDealer(from, to)) return;
    this.suppliersArr.controls.forEach((ctrl) => {
      if (ctrl.get('dealer')?.value === from) ctrl.patchValue({ dealer: to });
    });
  }

  deleteDealerEverywhere(name: string): void {
    this.options.deleteDealer(name);
    this.suppliersArr.controls.forEach((ctrl) => {
      if (ctrl.get('dealer')?.value === name) ctrl.patchValue({ dealer: '' });
    });
  }

  renameWholesalerEverywhere(from: string, to: string): void {
    if (!this.options.renameWholesaler(from, to)) return;
    this.suppliersArr.controls.forEach((ctrl) => {
      if (ctrl.get('wholesaler')?.value === from) ctrl.patchValue({ wholesaler: to });
    });
  }

  deleteWholesalerEverywhere(name: string): void {
    this.options.deleteWholesaler(name);
    this.suppliersArr.controls.forEach((ctrl) => {
      if (ctrl.get('wholesaler')?.value === name) ctrl.patchValue({ wholesaler: '' });
    });
  }

  emiPlanOptions(): Array<{ label: string; value: string }> {
    return this.serializeEmiPlans()
      .filter((p) => p.enabled && p.customerVisibility === 'visible' && p.months)
      .map((p, i) => ({ label: formatEmiOptionLabel(p, i), value: p.id }));
  }

  openAddEmiModal(): void {
    this.emiEditing.set(createEmptyEmiPlan());
    this.emiModalOpen.set(true);
  }

  openEditEmiModal(index: number): void {
    this.emiEditing.set({ ...normalizeEmiPlan(this.emiPlansArr.at(index).getRawValue()) });
    this.emiModalOpen.set(true);
  }

  updateEmiDraft(patch: Partial<EmiPlanEntry>): void {
    const current = this.emiEditing();
    if (!current) return;
    this.emiEditing.set({ ...current, ...patch });
  }

  saveEmiModal(): void {
    const plan = this.emiEditing();
    if (!plan) return;
    const index = this.emiPlansArr.controls.findIndex((ctrl) => ctrl.get('id')?.value === plan.id);
    if (index >= 0) {
      this.emiPlansArr.at(index).patchValue(plan);
    } else {
      this.emiPlansArr.push(this.createEmiPlanGroup(plan));
    }
    this.emiModalOpen.set(false);
    this.emiEditing.set(null);
  }

  closeEmiModal(): void {
    this.emiModalOpen.set(false);
    this.emiEditing.set(null);
  }

  emiModalCalcs() {
    const plan = this.emiEditing();
    if (!plan) return null;
    return computeEmiRowCalculations(this.effectiveSellingPrice(), plan);
  }

  effectiveSellingPrice(): number {
    return getEffectiveSellingPrice(this.snapshotWizard());
  }

  emiRowCalcs(index: number) {
    return computeEmiRowCalculations(
      this.effectiveSellingPrice(),
      normalizeEmiPlan(this.emiPlansArr.at(index).getRawValue()),
    );
  }

  money(value: unknown): string {
    const n = parseAmount(value);
    return n ? formatCurrency(n) : '—';
  }

  selectedPath(): string {
    const parts = [
      this.form.get('category')?.value,
      this.form.get('subCategory')?.value,
      this.form.get('brand')?.value,
    ].filter(Boolean);
    return parts.join(' › ');
  }

  liveCalc(): PricingCalculations {
    return computePricing(this.snapshotWizard());
  }

  liveAlerts(): ValidationAlert[] {
    const wizard = this.snapshotWizard();
    return computeValidationAlerts(wizard, computePricing(wizard));
  }

  pricingAlerts(): ValidationAlert[] {
    return this.liveAlerts().filter((a) => a.id === 'mrp-low' || a.id === 'above-market');
  }

  completeness(): CompletenessSection[] {
    return computeCompleteness(this.snapshotWizard());
  }

  overallCompleteness(): number {
    return computeOverallCompleteness(this.completeness());
  }

  selectedEmi() {
    return getSelectedEmiPlan(this.snapshotWizard());
  }

  selectedEmiCalcs() {
    const plan = this.selectedEmi();
    if (!plan) return null;
    return computeEmiRowCalculations(this.liveCalc().sellingPrice, plan);
  }

  slugPreview(): string {
    return `yoursite.com/products/${this.form.get('slug')?.value || 'product-slug'}`;
  }

  private maybeAutofillSeo(productName: string): void {
    if (!productName.trim()) return;
    const slug = this.form.get('slug')?.value;
    if (!slug) {
      const generated = productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      this.form.patchValue({ slug: generated }, { emitEvent: false });
    }
    if (!this.form.get('metaTitle')?.value) {
      this.form.patchValue({ metaTitle: `${productName} | Buy Online` }, { emitEvent: false });
    }
  }

  private refreshCalculatedPricing(): void {
    const wizard = this.snapshotWizard();
    const calc = computePricing(wizard);
    const marketLowest = computeMarketLowestPrice(wizard);
    this.form.patchValue(
      {
        gstAmount: calc.gstAmount > 0 ? calc.gstAmount.toFixed(2) : '',
        landingCost: calc.landingCost > 0 ? calc.landingCost.toFixed(2) : '',
        margin: calc.sellingPrice > 0 ? formatPercent(calc.margin) : '',
        discount: calc.mrp > 0 ? formatPercent(calc.discount) : '',
        marketLowestPrice:
          marketLowest > 0 ? marketLowest : this.form.get('marketLowestPrice')?.value,
      },
      { emitEvent: false },
    );
  }

  private snapshotWizard(): ProductWizardData {
    const v = this.form.getRawValue();
    return {
      ...initialWizardData(),
      ...this.loadedWizard,
      ...v,
      specifications: this.specificationsArr.controls.map((ctrl) => {
        const raw = (ctrl as FormGroup).getRawValue() as { id: string; key: string; value: string };
        return { id: raw.id, key: raw.key ?? '', value: raw.value ?? '' };
      }),
      features: (v.features ?? []).map((item: unknown) => String(item ?? '')),
      boxContents: (v.boxContents ?? []).map((item: unknown) => String(item ?? '')),
      aboutThisItem: (v.aboutThisItem ?? []).map((item: unknown) => String(item ?? '')),
      variants: this.serializeVariants(),
      suppliers: this.serializeSuppliers(),
      emiPlans: this.serializeEmiPlans(),
      mrp: String(v.mrp ?? ''),
      sellingPrice: String(v.sellingPrice ?? ''),
      purchasePrice: String(v.purchasePrice ?? ''),
      gst: String(v.gst ?? ''),
      amazonPrice: String(v.amazonPrice ?? ''),
      flipkartPrice: String(v.flipkartPrice ?? ''),
      otherWebsitePrice: String(v.otherWebsitePrice ?? ''),
    } as ProductWizardData;
  }

  private resolveCategoryName(categoryIdOrName: unknown, fallbackName?: string): string {
    const raw = String(categoryIdOrName ?? '').trim();
    if (!raw) return String(fallbackName ?? '');
    const names = this.options.categoryNames();
    if (names.includes(raw)) return raw;
    if (fallbackName && names.includes(fallbackName)) return fallbackName;
    return fallbackName || raw;
  }

  goToStep(index: number): void {
    this.activeStep.set(index);
  }
  next(): void {
    this.activeStep.update((i) => Math.min(i + 1, this.steps.length - 1));
  }
  back(): void {
    this.activeStep.update((i) => Math.max(i - 1, 0));
  }
  backToList(): void {
    this.router.navigate(['/products']);
  }

  invalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  inr(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  }

  categoryLabel(): string {
    return this.display(this.form.get('category')?.value);
  }

  previewUrls(): string[] {
    const urls: string[] = [];
    const add = (value: unknown) => {
      const url = typeof value === 'string' ? value.trim() : '';
      if (url && !urls.includes(url)) urls.push(url);
    };
    add(this.form.get('primaryImage')?.value);
    this.galleryImagesArr.controls.forEach((ctrl) => add(ctrl.value));
    this.variantsArr.controls.forEach((ctrl) => add(ctrl.get('variantImage')?.value));
    return urls;
  }

  openPreview(): void {
    this.previewOpen.set(true);
  }

  closePreview(): void {
    this.previewOpen.set(false);
  }

  save(status: 'draft' | 'active' | 'pending_approval'): void {
    if (this.submitting()) return;
    if (this.form.get('productName')!.invalid || this.form.get('sellingPrice')!.invalid || this.form.get('mrp')!.invalid) {
      this.form.markAllAsTouched();
      this.activeStep.set(0);
      this.messages.add({
        severity: 'warn',
        summary: 'Missing required fields',
        detail: 'Product name, MRP and selling price are required.',
      });
      return;
    }

    this.submitting.set(true);
    this.submittingKind.set(status);
    this.flushPendingImages().subscribe({
      next: () => {
        const refreshed = this.buildSavePayload(status);
        const request$ = this.isEdit
          ? this.products.update(this.productId!, refreshed)
          : this.products.create(refreshed);

        request$.subscribe({
          next: () => {
            this.submitting.set(false);
            this.submittingKind.set(null);
            if (status === 'pending_approval') {
              this.messages.add({
                severity: 'success',
                summary: 'Submitted for approval',
                detail: 'Product submitted for approval.',
              });
            } else {
              this.messages.add({
                severity: 'success',
                summary: this.isEdit ? 'Product updated' : 'Product created',
                detail:
                  status === 'draft'
                    ? 'Saved as draft. Not visible to customers.'
                    : 'Product is now active in the catalogue.',
              });
            }
            this.router.navigate(['/products']);
          },
          error: (err: unknown) => {
            this.submitting.set(false);
            this.submittingKind.set(null);
            this.messages.add({
              severity: 'error',
              summary: 'Save failed',
              detail: this.extractMessage(err),
            });
          },
        });
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.submittingKind.set(null);
        this.messages.add({
          severity: 'error',
          summary: 'Image upload failed',
          detail: this.extractMessage(err),
        });
      },
    });
  }

  private buildSavePayload(status: 'draft' | 'active' | 'pending_approval'): ProductPayload {
    const v = this.form.getRawValue();
    const variants = this.serializeVariants();
    const variantsEnabled = variants.length > 0;
    const primaryImage = String(v.primaryImage ?? '').trim();
    const galleryImages = (v.galleryImages ?? [])
      .map((uri: unknown) => String(uri ?? '').trim())
      .filter((uri: string) => !!uri);

    const replacementWindow = String(v.replacementWindow || v.replacementWindowDays || '');
    const wizardData: ProductWizardData = {
      ...initialWizardData(),
      ...this.loadedWizard,
      ...v,
      variantsEnabled,
      attributes: this.loadedWizard.attributes ?? [],
      specifications: this.specificationsArr.controls.map((ctrl) => {
        const raw = (ctrl as FormGroup).getRawValue() as { id: string; key: string; value: string };
        return { id: raw.id, key: raw.key ?? '', value: raw.value ?? '' };
      }),
      aboutThisItem: (v.aboutThisItem ?? []).map((item: unknown) => String(item ?? '')),
      variants,
      suppliers: this.serializeSuppliers(),
      emiPlans: this.serializeEmiPlans(),
      primaryImage,
      galleryImages,
      mrp: String(v.mrp ?? ''),
      sellingPrice: String(v.sellingPrice ?? ''),
      purchasePrice: String(v.purchasePrice ?? ''),
      gst: String(v.gst ?? ''),
      amazonPrice: String(v.amazonPrice ?? ''),
      flipkartPrice: String(v.flipkartPrice ?? ''),
      otherWebsitePrice: String(v.otherWebsitePrice ?? ''),
      marketLowestPrice: String(v.marketLowestPrice ?? ''),
      maximumDiscountAllowed: String(v.maximumDiscountAllowed ?? ''),
      openingStock: String(v.openingStock ?? ''),
      availableStock: String(v.availableStock ?? ''),
      reservedStock: String(v.reservedStock ?? ''),
      minimumQuantity: String(v.minimumQuantity ?? ''),
      maximumQuantity: String(v.maximumQuantity ?? ''),
      minOrderQuantity: String(v.minOrderQuantity ?? ''),
      maxQuantityPerCustomer: String(v.maxQuantityPerCustomer ?? ''),
      minimumCustomerAge: String(v.minimumCustomerAge ?? ''),
      deliveryCharges: String(v.deliveryCharges ?? ''),
      installationCharge: String(v.installationCharge ?? ''),
      defaultDownPaymentPercent: String(v.defaultDownPaymentPercent ?? ''),
      minCustomerDownPayment: String(v.minCustomerDownPayment ?? ''),
      maxDownPayment: String(v.maxDownPayment ?? ''),
      documentationCharge: String(v.documentationCharge ?? ''),
      verificationCharge: String(v.verificationCharge ?? ''),
      replacementWindow,
      replacementDays: replacementWindow,
      replacementWindowDays: replacementWindow,
    };

    return {
      name: v.productName,
      sku: v.sku || undefined,
      brand: v.brand || undefined,
      description: v.description || undefined,
      shortDescription: v.shortDescription || undefined,
      categoryId: v.category || undefined,
      image: primaryImage || undefined,
      galleryImages,
      price: Number(v.sellingPrice) || 0,
      mrp: Number(v.mrp) || 0,
      stock: Number(v.availableStock) || 0,
      status,
      emiAvailable: v.emiEnabled,
      warranty: v.warranty || undefined,
      hsnCode: v.hsnCode || undefined,
      manufacturer: v.manufacturer || undefined,
      wizardData,
    };
  }

  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | undefined;
      return body?.message || 'Something went wrong.';
    }
    return 'Something went wrong.';
  }
}

function numOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function asWizardString(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

function matchOption(value: unknown, options: readonly string[]): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return options.find((option) => option.toLowerCase() === raw.toLowerCase()) ?? raw;
}

function mapProductCondition(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'New';
  const lower = raw.toLowerCase();
  if (lower === 'new') return 'New';
  if (lower === 'refurbished' || lower === 'refurbished - like new') return 'Refurbished - Like New';
  if (lower === 'refurbished - good') return 'Refurbished - Good';
  if (lower === 'open-box' || lower === 'open box') return 'Open Box';
  return matchOption(raw, PRODUCT_CONDITIONS) || raw;
}

function formatStaffOptionLabel(user: { name: string; code: string }): string {
  const name = user.name?.trim();
  const code = user.code?.trim();
  if (name && code) return `${name} (${code})`;
  return name || code || 'Unknown';
}
