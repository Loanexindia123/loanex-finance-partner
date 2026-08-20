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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useWizard, WizardProvider } from '../wizard/WizardContext';
import { StepProgress, WIZARD_STEPS } from '../../../components/ui/StepProgress';
import { Button } from '../../../components/ui/Button';
import { Step1BasicInfo } from '../wizard/steps/Step1BasicInfo';
import { Step2Category } from '../wizard/steps/Step2Category';
import { Step3Variants } from '../wizard/steps/Step3Variants';
import { Step4Images } from '../wizard/steps/Step4Images';
import { Step5Pricing } from '../wizard/steps/Step5Pricing';
import { Step6Inventory } from '../wizard/steps/Step6Inventory';
import { Step7Supplier } from '../wizard/steps/Step7Supplier';
import { Step8Delivery } from '../wizard/steps/Step8Delivery';
import { Step9EMI } from '../wizard/steps/Step9EMI';
import { Step10SEO } from '../wizard/steps/Step10SEO';
import { Step11Review } from '../wizard/steps/Step11Review';
import { colors } from '../../../theme/colors';
import { shadow, spacing } from '../../../theme/spacing';
import { RootStackParamList } from '../../../navigation/types';
import { useRbac } from '../../../auth/rbacStore';
import { getProductById, createProduct, updateProduct } from '../../../services/productService';
import { ProductVariant } from '../types/product';
import {
  normalizeColourSizeVariant,
  normalizeKeyValueItems,
  normalizeString,
  normalizeTextListItems,
} from '../utils/normalizeWizardLists';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

const STEP_COMPONENTS = [
  Step1BasicInfo,
  Step2Category,
  Step3Variants,
  Step4Images,
  Step5Pricing,
  Step6Inventory,
  Step7Supplier,
  Step8Delivery,
  Step9EMI,
  Step10SEO,
  Step11Review,
];

function AddProductContent({ navigation, route }: Props) {
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
  const EMI_STEP = 9;
  const visibleSteps = isRestrictedCreator ? WIZARD_STEPS.filter((step) => step !== 'EMI') : WIZARD_STEPS;
  const displayStep =
    isRestrictedCreator && currentStep > EMI_STEP ? currentStep - 1 : currentStep;
  const showSaveForApproval =
    isRestrictedCreator &&
    (!isEditMode ||
      ['draft', 'rejected', 'pending_approval', ''].includes(String(productStatus).toLowerCase()));

  useEffect(() => {
    if (isEditMode && productId) {
      const fetchProduct = async () => {
        try {
          const p = await getProductById(productId);
          setProductStatus(String((p as any).status ?? ''));
          const wizardDataRaw = ((p as any).wizardData || {}) as Record<string, unknown>;
          // Never overwrite defaults with undefined — undefined fields crash `.trim()` calls.
          const wizardData = Object.fromEntries(
            Object.entries(wizardDataRaw).filter(([, v]) => v !== undefined),
          ) as Record<string, unknown>;
          const primaryImage =
            normalizeString(p.image || wizardData.primaryImage) || null;
          // Prefer the dedicated gallery list; fall back to `images`
          // (which includes the primary image) and drop the primary from it
          // so the gallery doesn't show a duplicate first image.
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
            // API may store these as plain objects / JSON; UI expects KeyValueItem[] / TextListItem[]
            specifications: normalizeKeyValueItems(
              wizardData.specifications ?? (p as any).specifications,
            ),
            features: normalizeTextListItems(wizardData.features ?? (p as any).features),
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
            // Products created before the variants step existed have no
            // wizardData.variantsEnabled — derive it from the saved variants.
            variantsEnabled:
              (Array.isArray(wizardData.variants) && wizardData.variants.length > 0) ||
              (wizardData.variantsEnabled === true),
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

  const goNext = () => {
    if (currentStep >= WIZARD_STEPS.length) return;
    let next = currentStep + 1;
    if (isRestrictedCreator && next === EMI_STEP) next += 1;
    if (next <= WIZARD_STEPS.length) animateStep(next);
  };

  const goPrev = () => {
    if (currentStep <= 1) return;
    let prev = currentStep - 1;
    if (isRestrictedCreator && prev === EMI_STEP) prev -= 1;
    if (prev >= 1) animateStep(prev);
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const payload = buildPayload('draft');
      if (isEditMode && productId) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }
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

  const buildPayload = (status: 'active' | 'draft' | 'pending_approval') => ({
    name: formData.productName,
    sku: formData.sku,
    brand: formData.brand,
    description: formData.description,
    shortDescription: formData.shortDescription,
    categoryId: formData.category || undefined,
    image: formData.primaryImage || undefined,
    galleryImages: formData.galleryImages,
    price: parseFloat(formData.sellingPrice) || 0,
    mrp: parseFloat(formData.mrp) || 0,
    stock: parseInt(formData.availableStock, 10) || 0,
    status: isRestrictedCreator && status === 'active' ? 'pending_approval' : status,
    emiAvailable: isRestrictedCreator ? false : formData.emiEnabled,
    warranty: formData.warranty,
    hsnCode: formData.hsnCode,
    manufacturer: formData.manufacturer,
    wizardData: isRestrictedCreator
      ? {
          ...formData,
          emiEnabled: isEditMode ? formData.emiEnabled : false,
          emiPlans: isEditMode ? formData.emiPlans : [],
        }
      : formData,
  });

  const handlePublish = async () => {
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    const mrp = parseFloat(formData.mrp) || 0;

    if (!formData.productName?.trim()) {
      Alert.alert('Missing Details', 'Product name is required.');
      return;
    }
    if (sellingPrice <= 0) {
      Alert.alert('Invalid Pricing', 'Selling price must be greater than 0.');
      return;
    }
    if (mrp > 0 && mrp < sellingPrice) {
      Alert.alert('Invalid Pricing', 'MRP cannot be less than the selling price.');
      return;
    }

    try {
      const payload = buildPayload(isRestrictedCreator ? 'pending_approval' : 'active');

      if (isEditMode && productId) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }

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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text>Loading product data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{isEditMode ? 'Edit Product' : 'Add Product'}</Text>
          <TouchableOpacity onPress={handleSaveDraft} style={styles.draftBtn} disabled={savingDraft}>
            <Text style={styles.draftText}>{savingDraft ? 'Saving...' : 'Save Draft'}</Text>
          </TouchableOpacity>
        </View>

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

        <View style={[styles.footer, shadow.md]}>
          {currentStep === WIZARD_STEPS.length ? (
            <View style={styles.reviewActions}>
              <Button title="Back" onPress={goPrev} variant="outline" style={{ flex: 1 }} />
              <Button title="Save Draft" onPress={handleSaveDraft} variant="secondary" style={{ flex: 1 }} />
              {!isRestrictedCreator ? (
                <Button title={isEditMode ? 'Update Product' : 'Publish Product'} onPress={handlePublish} variant="accent" style={{ flex: 1 }} />
              ) : showSaveForApproval ? (
                <Button title="Save for Approval" onPress={handlePublish} variant="accent" style={{ flex: 1 }} />
              ) : null}
            </View>
          ) : (
            <View style={styles.navActions}>
              <Button title="Previous" onPress={goPrev} variant="outline" disabled={currentStep === 1} style={{ flex: 1 }} />
              <Button
                title={currentStep === 9 ? 'Continue' : 'Next'}
                onPress={goNext}
                variant={currentStep === 9 ? 'accent' : 'primary'}
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
