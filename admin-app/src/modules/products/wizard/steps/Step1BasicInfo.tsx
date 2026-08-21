import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useWizard } from '../WizardContext';
import { useOptionsRegistry } from '../OptionsRegistryContext';
import { Input } from '../../../../components/ui/Input';
import { Dropdown } from '../../../../components/ui/Dropdown';
import { ToggleSwitch } from '../../../../components/ui/ToggleSwitch';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { DynamicKeyValueList } from '../../../../components/ui/DynamicKeyValueList';
import { DynamicTextList } from '../../../../components/ui/DynamicTextList';
import { ManageableDropdown } from '../../components/ManageableDropdown';
import { WARRANTIES, PRODUCT_CONDITIONS } from '../../data/constants';
import { useProductTypes, loadProductTypes } from '../../data/productTypeStore';
import { generateProductSku, getMockExistingSkus } from '../../utils/skuGeneration';
import {
  amazonParseHasContent,
  mergeAmazonParseIntoProduct,
  parseAmazonProductText,
} from '../../utils/parse-amazon-product-text';
import { parseAboutThisItemText } from '../../utils/parse-about-this-item';
import { parseBoxContentsText } from '../../utils/parse-box-contents';
import { createEmptySupplier, TextListItem } from '../../types/product';
import { normalizeTextListItems } from '../../utils/normalizeWizardLists';
import { useRbac, isFieldActor } from '../../../../auth/rbacStore';
import { colors } from '../../../../theme/colors';
import { radius, spacing } from '../../../../theme/spacing';

type FillFeedback = { severity: 'info' | 'success' | 'warn' | 'error'; message: string } | null;

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

function toTextList(values: string[]): TextListItem[] {
  return normalizeTextListItems(values);
}

function fromTextList(items: TextListItem[]): string[] {
  return (items ?? []).map((item) => String(item.value ?? ''));
}

export function Step1BasicInfo() {
  const { formData, updateForm } = useWizard();
  useRbac();
  const dealerMode = isFieldActor();
  const options = useOptionsRegistry();
  const {
    productTypes,
    loading: productTypesLoading,
    error: productTypesError,
    addProductType,
    renameProductType,
    deleteProductType,
    reload,
  } = useProductTypes();
  const [stockError, setStockError] = useState('');
  const [amazonPaste, setAmazonPaste] = useState('');
  const [aboutPaste, setAboutPaste] = useState('');
  const [boxPaste, setBoxPaste] = useState('');
  const [amazonAnalyzing, setAmazonAnalyzing] = useState(false);
  const [aboutAnalyzing, setAboutAnalyzing] = useState(false);
  const [boxAnalyzing, setBoxAnalyzing] = useState(false);
  const [amazonFeedback, setAmazonFeedback] = useState<FillFeedback>(null);
  const [aboutFeedback, setAboutFeedback] = useState<FillFeedback>(null);
  const [boxFeedback, setBoxFeedback] = useState<FillFeedback>(null);

  useEffect(() => {
    void loadProductTypes();
  }, []);

  const primaryDealerName = useMemo(
    () => formData.suppliers[0]?.dealer || '',
    [formData.suppliers],
  );

  const handleAutoGenerateSku = () => {
    const variantSkus = formData.variants.map((v) => v.sku);
    const existing = getMockExistingSkus([formData.sku, ...variantSkus]);
    const generated = generateProductSku(
      {
        modelNumber: formData.modelNumber,
        productName: formData.productName,
        shortName: formData.shortName,
        productType: formData.productType,
        brand: formData.brand,
        category: formData.category,
        subCategory: formData.subCategory,
      },
      existing,
    );
    updateForm({ sku: generated });
  };

  const handleStockChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, '');
    updateForm({ availableStock: cleaned, openingStock: cleaned || formData.openingStock });
    if (cleaned === '') {
      setStockError('Stock quantity is required.');
    } else if (!isNonNegativeInteger(cleaned)) {
      setStockError('Stock quantity must be an integer of 0 or more.');
    } else {
      setStockError('');
    }
  };

  const handleDealerSelect = (dealerName: string) => {
    const next = [...formData.suppliers];
    const master = options.findDealerByName(dealerName);
    const patch = {
      dealerId: master?.id || '',
      dealer: dealerName,
      productSourceType: 'Dealer' as const,
      supplierCode: master?.dealerCode || '',
      dealerBranch: master?.dealerBranch || '',
      supplierGstin: '',
      supplierContact: master?.mobile || master?.email || '',
      paymentTerms: master?.paymentSettlementTerms || '',
    };
    if (next.length === 0) {
      next.push({ ...createEmptySupplier(), ...patch });
    } else {
      next[0] = { ...next[0], ...patch };
    }
    updateForm({ suppliers: next });
  };

  /** Mirrors Admin Web applyAmazonParse / autoFillFromAmazon. */
  const autoFillFromAmazon = () => {
    const text = amazonPaste.trim();
    if (!text || amazonAnalyzing) return;
    setAmazonAnalyzing(true);
    setAmazonFeedback({ severity: 'info', message: 'Analyzing product details...' });
    setTimeout(() => {
      try {
        const parsed = parseAmazonProductText(text);
        if (!amazonParseHasContent(parsed)) {
          setAmazonFeedback({
            severity: 'warn',
            message: 'No product details could be extracted from the provided text.',
          });
          return;
        }
        const merged = mergeAmazonParseIntoProduct(
          {
            brand: formData.brand,
            manufacturer: formData.manufacturer,
            modelNumber: formData.modelNumber,
            warranty: formData.warranty,
            colourSizeVariant:
              typeof formData.colourSizeVariant === 'string' ? formData.colourSizeVariant : '',
            shortDescription: formData.shortDescription,
            description: formData.description,
            specifications: formData.specifications,
            features: fromTextList(formData.features),
            boxContents: fromTextList(formData.boxContents),
          },
          parsed,
        );
        updateForm({
          brand: merged.brand,
          manufacturer: merged.manufacturer,
          modelNumber: merged.modelNumber,
          warranty: merged.warranty,
          colourSizeVariant: merged.colourSizeVariant,
          shortDescription: merged.shortDescription,
          description: merged.description,
          specifications: merged.specifications,
          features: toTextList(merged.features),
          boxContents: toTextList(merged.boxContents),
        });
        setAmazonFeedback({
          severity: 'success',
          message: 'Product details extracted successfully.',
        });
      } catch {
        setAmazonFeedback({
          severity: 'error',
          message: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
      } finally {
        setAmazonAnalyzing(false);
      }
    }, 220);
  };

  /** Mirrors Admin Web autoFillAboutThisItem. */
  const autoFillAboutThisItem = () => {
    const text = aboutPaste.trim();
    if (!text || aboutAnalyzing) return;
    setAboutAnalyzing(true);
    setAboutFeedback({ severity: 'info', message: 'Analyzing About this item...' });
    setTimeout(() => {
      try {
        const items = parseAboutThisItemText(text);
        if (!items.length) {
          setAboutFeedback({
            severity: 'warn',
            message: 'No About this item entries could be extracted from the provided text.',
          });
          return;
        }
        updateForm({ aboutThisItem: toTextList(items) });
        setAboutFeedback({
          severity: 'success',
          message: 'About this item extracted successfully.',
        });
      } catch {
        setAboutFeedback({
          severity: 'error',
          message: 'Unable to analyze the provided content. You can still enter the details manually.',
        });
      } finally {
        setAboutAnalyzing(false);
      }
    }, 180);
  };

  /** Mirrors Admin Web autoFillBoxContents (replace with confirm if existing). */
  const autoFillBoxContents = () => {
    const text = boxPaste.trim();
    if (!text || boxAnalyzing) return;

    const run = () => {
      setBoxAnalyzing(true);
      setBoxFeedback({ severity: 'info', message: 'Analyzing Box Contents...' });
      setTimeout(() => {
        try {
          const items = parseBoxContentsText(text);
          if (!items.length) {
            setBoxFeedback({
              severity: 'warn',
              message: 'No Box Contents items could be extracted from the provided text.',
            });
            return;
          }
          updateForm({ boxContents: toTextList(items) });
          setBoxFeedback({
            severity: 'success',
            message: `Box Contents extracted successfully (${items.length} items).`,
          });
        } catch {
          setBoxFeedback({
            severity: 'error',
            message:
              'Unable to analyze the provided content. You can still enter the details manually.',
          });
        } finally {
          setBoxAnalyzing(false);
        }
      }, 180);
    };

    const hasExisting = fromTextList(formData.boxContents).some((v) => v.trim());
    if (hasExisting) {
      Alert.alert(
        'Replace Box Contents?',
        'Existing Box Contents items will be replaced with the newly parsed list. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace Box Contents', style: 'destructive', onPress: run },
        ],
      );
      return;
    }
    run();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Basic Information</Text>
      <Text style={styles.subheading}>Name, brand, identifiers and product description.</Text>

      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="Product Name"
            placeholder="e.g. Samsung Galaxy S24 Ultra"
            value={formData.productName}
            onChangeText={(v) => updateForm({ productName: v })}
            required
          />
        </View>
        <View style={styles.half}>
          <Input
            label="Short Name"
            placeholder="Display name"
            value={formData.shortName}
            onChangeText={(v) => updateForm({ shortName: v })}
          />
        </View>
      </View>

      <ManageableDropdown
        label="Product Type"
        placeholder={
          productTypesLoading
            ? 'Loading types...'
            : productTypes.length
              ? 'Select type'
              : 'No active types'
        }
        entityName="Product Type"
        entityNamePlural="Product Types"
        value={formData.productType}
        options={productTypes}
        disabled={productTypesLoading}
        allowManage={!dealerMode}
        onSelect={(v) => updateForm({ productType: v })}
        onAdd={(name) => addProductType(name)}
        onRename={(from, to) => {
          const ok = renameProductType(from, to);
          if (ok && formData.productType === from) updateForm({ productType: to });
          return ok;
        }}
        onDelete={(name) => {
          deleteProductType(name);
          if (formData.productType === name) updateForm({ productType: '' });
        }}
      />
      {productTypesError && !dealerMode ? (
        <Text style={styles.warn}>
          {productTypesError}{' '}
          <Text style={styles.link} onPress={() => void reload()}>
            Retry
          </Text>
        </Text>
      ) : null}
      {dealerMode && !productTypesLoading && productTypes.length === 0 ? (
        <Text style={styles.hint}>
          No product types yet. Add them under Masters → Product Types, then return here.
        </Text>
      ) : null}

      <Input
        label="Model Number"
        placeholder="e.g. TN-X1-256"
        value={formData.modelNumber}
        onChangeText={(v) => updateForm({ modelNumber: v })}
        hint="Preferred for auto-generate SKU; Auto Generate also works without it."
      />

      <Input
        label="SKU"
        placeholder="Unique product code"
        value={formData.sku}
        onChangeText={(v) => updateForm({ sku: v })}
        required
        suffix={
          <TouchableOpacity style={styles.autoGenBtn} onPress={handleAutoGenerateSku} activeOpacity={0.7}>
            <Text style={styles.autoGenText}>Auto Generate</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="Barcode"
            placeholder="EAN / UPC"
            value={formData.barcode}
            onChangeText={(v) => updateForm({ barcode: v })}
          />
        </View>
        <View style={styles.half}>
          <Input
            label="HSN Code"
            placeholder="Tax classification"
            value={formData.hsnCode}
            onChangeText={(v) => updateForm({ hsnCode: v })}
          />
        </View>
      </View>

      <Input
        label="Manufacturer"
        placeholder="Manufacturer name"
        value={formData.manufacturer}
        onChangeText={(v) => updateForm({ manufacturer: v })}
      />

      {!dealerMode ? (
        <Dropdown
          label="Dealer"
          placeholder="Select Dealer"
          value={primaryDealerName}
          options={options.dealers}
          onSelect={handleDealerSelect}
        />
      ) : null}

      <View style={styles.row}>
        <View style={styles.half}>
          <Dropdown
            label="Warranty"
            value={formData.warranty}
            options={WARRANTIES}
            onSelect={(v) => updateForm({ warranty: v })}
            placeholder="Select warranty"
          />
        </View>
        <View style={styles.half}>
          <Dropdown
            label="Product Condition"
            value={formData.productCondition}
            options={PRODUCT_CONDITIONS}
            onSelect={(v) => updateForm({ productCondition: v })}
          />
        </View>
      </View>

      <Input
        label="Stock Quantity"
        placeholder="10"
        value={formData.availableStock}
        onChangeText={handleStockChange}
        keyboardType="number-pad"
        required
        error={stockError}
        hint="Enter the quantity currently available for sale."
      />

      <Input
        label="Short Description"
        placeholder="Brief product summary (max 160 chars)"
        value={formData.shortDescription}
        onChangeText={(v) => updateForm({ shortDescription: v })}
        maxLength={160}
      />
      <Input
        label="Overview"
        placeholder="Enter product overview..."
        value={formData.description}
        onChangeText={(v) => updateForm({ description: v })}
        multiline
        numberOfLines={5}
      />

      <Input
        label="Product Video URL"
        placeholder="https://youtube.com/watch?v=..."
        value={formData.productVideoUrl}
        onChangeText={(v) => updateForm({ productVideoUrl: v })}
      />

      <Input
        label="Colour / Size / Variant"
        placeholder="e.g. Black / 256GB"
        value={typeof formData.colourSizeVariant === 'string' ? formData.colourSizeVariant : ''}
        onChangeText={(v) => updateForm({ colourSizeVariant: v })}
        hint="Free-text label; separate from Variants step attributes"
      />

      <Card style={styles.dynamicSection}>
        <ToggleSwitch
          label="Serial Number / IMEI Tracking"
          description="Track serial numbers or IMEI for this product"
          value={formData.serialImeiTracking}
          onValueChange={(v) => updateForm({ serialImeiTracking: v })}
        />
      </Card>

      <Card style={styles.pasteCard}>
        <Text style={styles.pasteTitle}>Product Details</Text>
        <Text style={styles.pasteDesc}>
          Paste Amazon product information here. Auto Fill populates the existing fields below so you
          can review them before saving.
        </Text>
        <TextInput
          style={styles.pasteInput}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          placeholder="Paste product details here..."
          value={amazonPaste}
          onChangeText={setAmazonPaste}
        />
        <Button
          title={amazonAnalyzing ? 'Analyzing...' : 'Auto Fill Product Details'}
          onPress={autoFillFromAmazon}
          disabled={amazonAnalyzing || !amazonPaste.trim()}
          variant="secondary"
        />
        {amazonFeedback ? (
          <Text
            style={[
              styles.feedback,
              amazonFeedback.severity === 'success' && styles.feedbackSuccess,
              amazonFeedback.severity === 'warn' && styles.feedbackWarn,
              amazonFeedback.severity === 'error' && styles.feedbackError,
            ]}
          >
            {amazonFeedback.message}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.dynamicSection}>
        <DynamicKeyValueList
          title="Specifications"
          items={formData.specifications}
          onChange={(specifications) => updateForm({ specifications })}
        />
      </Card>

      <Card style={styles.pasteCard}>
        <Text style={styles.pasteTitle}>About this item</Text>
        <Text style={styles.pasteDesc}>
          Paste Amazon&apos;s About this item section. Auto Fill creates editable entries below. This
          stays separate from Specifications and Features.
        </Text>
        <TextInput
          style={styles.pasteInput}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          placeholder="Paste About this item content here..."
          value={aboutPaste}
          onChangeText={setAboutPaste}
        />
        <Button
          title={aboutAnalyzing ? 'Analyzing...' : 'Auto Fill About This Item'}
          onPress={autoFillAboutThisItem}
          disabled={aboutAnalyzing || !aboutPaste.trim()}
          variant="secondary"
        />
        {aboutFeedback ? (
          <Text
            style={[
              styles.feedback,
              aboutFeedback.severity === 'success' && styles.feedbackSuccess,
              aboutFeedback.severity === 'warn' && styles.feedbackWarn,
              aboutFeedback.severity === 'error' && styles.feedbackError,
            ]}
          >
            {aboutFeedback.message}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.dynamicSection}>
        <DynamicTextList
          title="About this item"
          addLabel="+ Add item"
          placeholder="About this item entry"
          items={formData.aboutThisItem}
          onChange={(aboutThisItem) => updateForm({ aboutThisItem })}
        />
        <DynamicTextList
          title="Features"
          addLabel="+ Add Feature"
          placeholder="Key feature"
          items={formData.features}
          onChange={(features) => updateForm({ features })}
        />
      </Card>

      <Card style={styles.pasteCard}>
        <Text style={styles.pasteTitle}>Amazon Box Contents</Text>
        <Text style={styles.pasteDesc}>
          Paste the &apos;What&apos;s in the box&apos; / &apos;Box Contents&apos; section copied from
          Amazon.
        </Text>
        <TextInput
          style={styles.pasteInput}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          placeholder="Paste box contents here..."
          value={boxPaste}
          onChangeText={setBoxPaste}
        />
        <Button
          title={boxAnalyzing ? 'Analyzing...' : 'Auto Fill Box Contents'}
          onPress={autoFillBoxContents}
          disabled={boxAnalyzing || !boxPaste.trim()}
          variant="secondary"
        />
        {boxFeedback ? (
          <Text
            style={[
              styles.feedback,
              boxFeedback.severity === 'success' && styles.feedbackSuccess,
              boxFeedback.severity === 'warn' && styles.feedbackWarn,
              boxFeedback.severity === 'error' && styles.feedbackError,
            ]}
          >
            {boxFeedback.message}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.dynamicSection}>
        <DynamicTextList
          title="Box Contents"
          addLabel="+ Add item"
          placeholder="Item in the box"
          items={formData.boxContents}
          onChange={(boxContents) => updateForm({ boxContents })}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textHeading, marginBottom: spacing.xs },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xxl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  half: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, maxWidth: '100%' },
  dynamicSection: { marginTop: spacing.lg },
  pasteCard: { marginTop: spacing.lg, gap: spacing.sm },
  pasteTitle: { fontSize: 15, fontWeight: '700', color: colors.textHeading },
  pasteDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm },
  pasteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  feedback: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  feedbackSuccess: { color: colors.success },
  feedbackWarn: { color: colors.warning },
  feedbackError: { color: colors.danger },
  warn: { fontSize: 12, color: colors.danger, marginTop: -spacing.md, marginBottom: spacing.lg },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  link: { color: colors.secondary, fontWeight: '700' },
  autoGenBtn: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight,
    minWidth: 108,
  },
  autoGenText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
    textAlign: 'center',
  },
});
