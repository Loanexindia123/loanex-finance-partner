import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useWizard, WizardProvider } from '../wizard/WizardContext';
import { StepProgress, WIZARD_STEPS } from '../../../components/ui/StepProgress';
import { Button } from '../../../components/ui/Button';
import { SafeHeader } from '../../../components/layout/SafeHeader';
import { Step1BasicInfo } from '../wizard/steps/Step1BasicInfo';
import { Step2Category } from '../wizard/steps/Step2Category';
import { Step3Variants } from '../wizard/steps/Step3Variants';
import { Step4Images } from '../wizard/steps/Step4Images';
import { Step5Pricing } from '../wizard/steps/Step5Pricing';
import { Step8Delivery } from '../wizard/steps/Step8Delivery';
import { Step9EMI } from '../wizard/steps/Step9EMI';
import { Step10SEO } from '../wizard/steps/Step10SEO';
import { Step11Review } from '../wizard/steps/Step11Review';
import { colors } from '../../../theme/colors';
import { shadow, spacing } from '../../../theme/spacing';
import { RootStackParamList } from '../../../navigation/types';
import { useRbac, isApprovedProductLocked } from '../../../auth/rbacStore';
import { getProductById, createProduct, updateProduct, uploadProductImage } from '../../../services/productService';
import { ProductFormData, ProductVariant, TextListItem } from '../types/product';
import {
  normalizeColourSizeVariant,
  normalizeKeyValueItems,
  normalizeString,
  normalizeTextListItems,
} from '../utils/normalizeWizardLists';
import {
  clearPendingImage,
  getPendingImage,
  remapImageUris,
} from '../utils/pendingImages';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

/** Step components in Admin Web order (Inventory/Supplier are not separate wizard steps on Web). */
const STEP_COMPONENTS = [
  Step1BasicInfo,
  Step2Category,
  Step3Variants,
  Step4Images,
  Step5Pricing,
  Step8Delivery,
  Step9EMI,
  Step10SEO,
  Step11Review,
];

function parseNonNegativeIntValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw === '') return null;
  if (!/^\d+$/.test(raw)) return null;
  return parseInt(raw, 10);
}

function toStringList(items: Array<TextListItem | string> | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    typeof item === 'string' ? item : String((item as TextListItem)?.value ?? ''),
  );
}

function resolvePayloadStock(
  availableStock: unknown,
  variants: ProductVariant[],
): number | undefined {
  if (variants.length > 0) {
    let sum = 0;
    for (const variant of variants) {
      const parsed = parseNonNegativeIntValue(variant.stock);
      if (parsed === null) return undefined;
      sum += parsed;
    }
    return sum;
  }
  return parseNonNegativeIntValue(availableStock) ?? undefined;
}

/** Collect image URIs from form and upload any pending local files (Admin Web flushPendingImages). */
async function flushPendingProductImages(data: ProductFormData): Promise<ProductFormData> {
  const uris = new Set<string>();
  if (data.primaryImage) uris.add(data.primaryImage);
  for (const uri of data.galleryImages ?? []) {
    if (uri) uris.add(uri);
  }
  for (const variant of data.variants ?? []) {
    if (variant.variantImage) uris.add(variant.variantImage);
    for (const uri of variant.galleryImages ?? []) {
      if (uri) uris.add(uri);
    }
  }

  const urlMap = new Map<string, string>();
  for (const uri of uris) {
    const pending = getPendingImage(uri);
    if (!pending) continue;
    const uploaded = await uploadProductImage(pending);
    const serverUrl = String(uploaded?.url ?? '').trim();
    if (!serverUrl) {
      throw new Error('Image upload did not return a URL');
    }
    urlMap.set(uri, serverUrl);
    clearPendingImage(uri);
  }

  if (urlMap.size === 0) return data;
  return remapImageUris(data, urlMap);
}

function AddProductContent({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { currentStep, setCurrentStep, resetForm, formData, updateForm } = useWizard();
  const { roleName } = useRbac();
  const roleKey = String(roleName ?? '').trim().toLowerCase();
  const isEmployee = roleKey === 'employee';
  const isRestrictedCreator = isEmployee || roleKey === 'dealer';
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isEditMode = route.params?.mode === 'edit';
  const productId = route.params?.productId;
  const [loading, setLoading] = useState(isEditMode);
  const [savingDraft, setSavingDraft] = useState(false);
  const [productStatus, setProductStatus] = useState('');
  /** 1-based indices matching WIZARD_STEPS */
  const DELIVERY_STEP = 6;
  const EMI_STEP = 7;
  const SEO_STEP = 8;
  const RESTRICTED_HIDDEN_STEPS = new Set([DELIVERY_STEP, EMI_STEP]);
  const visibleSteps = isRestrictedCreator
    ? WIZARD_STEPS.filter((step) => step !== 'EMI' && step !== 'Delivery')
    : WIZARD_STEPS;
  const displayStep = isRestrictedCreator
    ? currentStep -
      [...RESTRICTED_HIDDEN_STEPS].filter((stepIndex) => stepIndex < currentStep).length
    : currentStep;
  const showSaveForApproval =
    isRestrictedCreator &&
    (!isEditMode ||
      ['draft', 'rejected', 'pending_approval', ''].includes(String(productStatus).toLowerCase()));

  useEffect(() => {
    if (isEditMode && productId) {
      const fetchProduct = async () => {
        try {
          const p = await getProductById(productId);
          const status = String((p as any).status ?? '');
          if (isApprovedProductLocked(status)) {
            Alert.alert(
              'Product Locked',
              'This product has been approved and can no longer be edited.',
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
            setLoading(false);
            return;
          }
          setProductStatus(status);
          const wizardDataRaw = ((p as any).wizardData || {}) as Record<string, unknown>;
          const wizardData = Object.fromEntries(
            Object.entries(wizardDataRaw).filter(([, v]) => v !== undefined),
          ) as Record<string, unknown>;
          const primaryImage =
            normalizeString(p.image || wizardData.primaryImage) || null;
          const galleryRaw =
            (p as any).galleryImages || wizardData.galleryImages || (p as any).images || [];

          updateForm({
            ...wizardData,
            productName: normalizeString(p.name || wizardData.productName),
            sku: normalizeString(p.sku || wizardData.sku),
            brand: normalizeString(p.brand || wizardData.brand),
            description: normalizeString((p as any).description || wizardData.description),
            shortDescription: normalizeString(
              (p as any).shortDescription || wizardData.shortDescription,
            ),
            category: normalizeString(
              (p as any).category || wizardData.category || p.categoryId,
            ),
            primaryImage,
            galleryImages: Array.isArray(galleryRaw)
              ? galleryRaw.filter(
                  (uri): uri is string =>
                    typeof uri === 'string' && uri !== primaryImage,
                )
              : [],
            sellingPrice: normalizeString(p.price ?? wizardData.sellingPrice, '0'),
            mrp: normalizeString(p.mrp ?? p.price ?? wizardData.mrp, '0'),
            availableStock: normalizeString(p.stock ?? wizardData.availableStock, '0'),
            warranty: normalizeString((p as any).warranty || wizardData.warranty),
            hsnCode: normalizeString((p as any).hsnCode || wizardData.hsnCode),
            emiEnabled: (p as any).emiAvailable === true,
            manufacturer: normalizeString(
              (p as any).manufacturer || wizardData.manufacturer,
            ),
            colourSizeVariant: normalizeColourSizeVariant(
              wizardData.colourSizeVariant ?? (p as any).colourSizeVariant,
            ),
            productVideoUrl: normalizeString(wizardData.productVideoUrl),
            slug: normalizeString(wizardData.slug ?? (p as any).slug),
            metaTitle: normalizeString(wizardData.metaTitle),
            metaDescription: normalizeString(wizardData.metaDescription),
            keywords: normalizeString(wizardData.keywords ?? (p as any).keywords),
            specifications: normalizeKeyValueItems(
              wizardData.specifications ?? (p as any).specifications,
            ),
            features: normalizeTextListItems(wizardData.features ?? (p as any).features),
            aboutThisItem: normalizeTextListItems(
              wizardData.aboutThisItem ?? (p as any).aboutThisItem,
            ),
            boxContents: normalizeTextListItems(
              wizardData.boxContents ?? (p as any).boxContents,
            ),
            variants: (Array.isArray(wizardData.variants) && wizardData.variants.length
              ? wizardData.variants
              : ((p as any).variants ?? [])
            ).map((variant: ProductVariant) => ({
              ...variant,
              galleryImages: Array.isArray(variant.galleryImages)
                ? variant.galleryImages
                : [],
              specifications: normalizeKeyValueItems(variant.specifications),
              features: normalizeTextListItems(variant.features),
              boxContents: normalizeTextListItems(variant.boxContents),
            })),
            variantsEnabled:
              (Array.isArray(wizardData.variants) && wizardData.variants.length > 0) ||
              wizardData.variantsEnabled === true,
            suppliers: Array.isArray(wizardData.suppliers) ? wizardData.suppliers : [],
            emiPlans: Array.isArray(wizardData.emiPlans) ? wizardData.emiPlans : [],
            attributes: Array.isArray(wizardData.attributes) ? wizardData.attributes : [],
          });
        } catch (e) {
          console.warn('Failed to load product', e);
        } finally {
          setLoading(false);
        }
      };
      fetchProduct();
    }
  }, [isEditMode, productId]);

  const animateStep = (nextStep: number) => {
    const useNativeDriver = Platform.OS !== 'web';
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver }),
    ]).start();
    setTimeout(() => setCurrentStep(nextStep), 150);
  };

  /** Matches Admin Web next() gate on Basic Info stock. */
  const validateBasicInfoStock = (): string | null => {
    const stock = String(formData.availableStock ?? '').trim();
    if (stock === '') return 'Stock quantity is required.';
    if (!/^\d+$/.test(stock)) return 'Stock quantity must be an integer of 0 or more.';
    return null;
  };

  /** Matches Admin Web save() required-field gates. */
  const validateForSave = (): { message: string; jumpStep?: number } | null => {
    if (!formData.productName?.trim()) {
      return { message: 'Product name, MRP and selling price are required.', jumpStep: 1 };
    }
    const mrp = String(formData.mrp ?? '').trim();
    const sellingPrice = String(formData.sellingPrice ?? '').trim();
    if (mrp === '' || sellingPrice === '') {
      return { message: 'Product name, MRP and selling price are required.', jumpStep: 1 };
    }

    const variantsOn = formData.variantsEnabled === true && formData.variants.length > 0;
    if (variantsOn) {
      const invalid = formData.variants.some((v) => parseNonNegativeIntValue(v.stock) === null);
      if (invalid) {
        return {
          message: 'Each variant needs a stock quantity (integer 0 or more).',
          jumpStep: 3,
        };
      }
    }

    const stockError = validateBasicInfoStock();
    if (stockError) return { message: stockError, jumpStep: 1 };
    return null;
  };

  const goNext = () => {
    if (currentStep >= WIZARD_STEPS.length) return;
    if (currentStep === 1) {
      const error = validateBasicInfoStock();
      if (error) {
        Alert.alert('Missing Details', error);
        return;
      }
    }
    let next = currentStep + 1;
    while (isRestrictedCreator && RESTRICTED_HIDDEN_STEPS.has(next) && next <= WIZARD_STEPS.length) {
      next += 1;
    }
    if (next <= WIZARD_STEPS.length) animateStep(next);
  };

  const goPrev = () => {
    if (currentStep <= 1) return;
    let prev = currentStep - 1;
    while (isRestrictedCreator && RESTRICTED_HIDDEN_STEPS.has(prev) && prev >= 1) {
      prev -= 1;
    }
    if (prev >= 1) animateStep(prev);
  };

  const buildWizardData = (data: ProductFormData, variants: ProductVariant[]) => {
    const replacementWindow = String(data.replacementWindow || data.replacementDays || '');
    const resolvedStock = resolvePayloadStock(data.availableStock, variants);
    return {
      ...data,
      variantsEnabled: variants.length > 0 ? true : data.variantsEnabled,
      variants,
      features: toStringList(data.features),
      boxContents: toStringList(data.boxContents),
      aboutThisItem: toStringList(data.aboutThisItem),
      mrp: String(data.mrp ?? ''),
      sellingPrice: String(data.sellingPrice ?? ''),
      purchasePrice: String(data.purchasePrice ?? ''),
      gst: String(data.gst ?? ''),
      availableStock: resolvedStock === undefined ? '' : String(resolvedStock),
      replacementWindow,
      replacementDays: replacementWindow,
      replacementWindowDays: replacementWindow,
    };
  };

  const buildPayload = (
    status: 'active' | 'draft' | 'pending_approval',
    data: ProductFormData = formData,
  ) => {
    const variants = data.variantsEnabled && data.variants.length > 0 ? data.variants : [];
    const wizardBase = buildWizardData(data, variants);
    const wizardData = isRestrictedCreator
      ? {
          ...wizardBase,
          emiEnabled: isEditMode ? data.emiEnabled : false,
          emiPlans: isEditMode ? data.emiPlans : [],
          deliveryCharges: isEditMode ? data.deliveryCharges : '',
          deliveryDays: isEditMode ? data.deliveryDays : '',
          dispatchSla: isEditMode ? data.dispatchSla : '',
          deliveryPartner: isEditMode ? data.deliveryPartner : '',
          deliveryZone: isEditMode ? data.deliveryZone : '',
          expressDelivery: isEditMode ? data.expressDelivery : false,
          installationRequired: isEditMode ? data.installationRequired : false,
          installationCharge: isEditMode ? data.installationCharge : '',
          deliveryConfirmationOtp: isEditMode ? data.deliveryConfirmationOtp : false,
          serialImeiCaptureAtDelivery: isEditMode ? data.serialImeiCaptureAtDelivery : false,
        }
      : wizardBase;

    return {
      name: data.productName,
      sku: data.sku,
      brand: data.brand,
      description: data.description,
      shortDescription: data.shortDescription,
      categoryId: data.category || undefined,
      image: data.primaryImage || undefined,
      galleryImages: data.galleryImages,
      price: Number(data.sellingPrice) || 0,
      mrp: Number(data.mrp) || 0,
      stock: resolvePayloadStock(data.availableStock, variants),
      status: isRestrictedCreator && status === 'active' ? 'pending_approval' : status,
      emiAvailable: isRestrictedCreator
        ? isEditMode
          ? data.emiEnabled
          : false
        : data.emiEnabled,
      warranty: data.warranty || undefined,
      hsnCode: data.hsnCode || undefined,
      manufacturer: data.manufacturer || undefined,
      wizardData,
    };
  };

  const saveWithImages = async (status: 'active' | 'draft' | 'pending_approval') => {
    const flushed = await flushPendingProductImages(formData);
    if (flushed !== formData) {
      updateForm(flushed);
    }
    const payload = buildPayload(status, flushed);
    if (isEditMode && productId) {
      await updateProduct(productId, payload);
    } else {
      await createProduct(payload);
    }
  };

  const handleSaveDraft = async () => {
    // Admin Web validates required fields on every save(), including draft.
    const saveError = validateForSave();
    if (saveError) {
      Alert.alert('Missing required fields', saveError.message);
      if (saveError.jumpStep) animateStep(saveError.jumpStep);
      return;
    }
    try {
      setSavingDraft(true);
      await saveWithImages('draft');
      Alert.alert('Draft Saved', `Product ${isEditMode ? 'updated as' : 'saved as'} draft`);
      resetForm();
      navigation.navigate('ProductList');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    const saveError = validateForSave();
    if (saveError) {
      Alert.alert('Missing required fields', saveError.message);
      if (saveError.jumpStep) animateStep(saveError.jumpStep);
      return;
    }

    try {
      await saveWithImages(isRestrictedCreator ? 'pending_approval' : 'active');

      Alert.alert(
        'Success',
        isRestrictedCreator
          ? 'Product submitted for approval.'
          : `Product ${isEditMode ? 'updated' : 'published'} successfully`,
      );
      resetForm();
      navigation.navigate('ProductList');
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Error',
        isRestrictedCreator
          ? 'Failed to submit product for approval'
          : `Failed to ${isEditMode ? 'update' : 'publish'} product`,
      );
    }
  };

  const StepComponent = STEP_COMPONENTS[currentStep - 1];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text>Loading product data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.container}>
        <SafeHeader style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isEditMode ? 'Edit Product' : 'Add Product'}</Text>
          <TouchableOpacity onPress={handleSaveDraft} style={styles.draftBtn} disabled={savingDraft}>
            <Text style={styles.draftText}>{savingDraft ? 'Saving...' : 'Save Draft'}</Text>
          </TouchableOpacity>
        </SafeHeader>

        <StepProgress currentStep={displayStep} steps={visibleSteps} />

        <View style={styles.body}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity: fadeAnim }}>
              <StepComponent />
            </Animated.View>
          </ScrollView>
        </View>

        <View style={[styles.footer, shadow.md, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          {currentStep === WIZARD_STEPS.length ? (
            <View style={styles.reviewActions}>
              <Button title="Back" onPress={goPrev} variant="outline" style={{ flex: 1 }} />
              <Button title="Save Draft" onPress={handleSaveDraft} variant="secondary" style={{ flex: 1 }} />
              {!isRestrictedCreator ? (
                <Button
                  title={isEditMode ? 'Update Product' : 'Publish Product'}
                  onPress={handlePublish}
                  variant="accent"
                  style={{ flex: 1 }}
                />
              ) : showSaveForApproval ? (
                <Button title="Save for Approval" onPress={handlePublish} variant="accent" style={{ flex: 1 }} />
              ) : null}
            </View>
          ) : (
            <View style={styles.navActions}>
              <Button
                title="Previous"
                onPress={goPrev}
                variant="outline"
                disabled={currentStep === 1}
                style={{ flex: 1 }}
              />
              <Button
                title={currentStep === SEO_STEP ? 'Continue' : 'Next'}
                onPress={goNext}
                variant={currentStep === SEO_STEP ? 'accent' : 'primary'}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function AddProductScreen(props: Props) {
  return (
    <WizardProvider>
      <AddProductContent {...props} />
    </WizardProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  backBtn: { padding: spacing.sm },
  backText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  draftBtn: { padding: spacing.sm },
  draftText: { fontSize: 14, color: colors.accentLight, fontWeight: '600' },
  body: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  navActions: { flexDirection: 'row', gap: spacing.md },
  reviewActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
