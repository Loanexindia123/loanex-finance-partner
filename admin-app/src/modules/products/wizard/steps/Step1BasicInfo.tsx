import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useWizard } from '../WizardContext';
import { Input } from '../../../../components/ui/Input';
import { Dropdown } from '../../../../components/ui/Dropdown';
import { ToggleSwitch } from '../../../../components/ui/ToggleSwitch';
import { Card } from '../../../../components/ui/Card';
import { DynamicKeyValueList } from '../../../../components/ui/DynamicKeyValueList';
import { DynamicTextList } from '../../../../components/ui/DynamicTextList';
import {
  PRODUCT_TYPES,
  COUNTRIES,
  WARRANTIES,
  PRODUCT_CONDITIONS,
} from '../../data/constants';
import { generateSkuFromModelNumber, getMockExistingSkus } from '../../utils/skuGeneration';
import { colors } from '../../../../theme/colors';
import { radius, spacing } from '../../../../theme/spacing';

export function Step1BasicInfo() {
  const { formData, updateForm } = useWizard();

  const handleAutoGenerateSku = () => {
    const variantSkus = formData.variants.map((v) => v.sku);
    const existing = getMockExistingSkus([formData.sku, ...variantSkus]);
    const generated = generateSkuFromModelNumber(formData.modelNumber, existing);

    if (!generated) {
      console.log('Enter a Model Number before auto-generating SKU');
      return;
    }

    updateForm({ sku: generated });
    console.log('SKU auto-generated:', generated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Basic Information</Text>
      <Text style={styles.subheading}>Enter core product details and identification info</Text>

      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Product Name" placeholder="e.g. Samsung Galaxy S24 Ultra" value={formData.productName} onChangeText={(v) => updateForm({ productName: v })} required />
        </View>
        <View style={styles.half}>
          <Input label="Short Name" placeholder="Display name" value={formData.shortName} onChangeText={(v) => updateForm({ shortName: v })} />
        </View>
      </View>

      <Dropdown label="Product Type" value={formData.productType} options={PRODUCT_TYPES} onSelect={(v) => updateForm({ productType: v })} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="SKU"
            placeholder="Unique product code"
            value={formData.sku}
            onChangeText={(v) => updateForm({ sku: v })}
            required
            suffix={
              <TouchableOpacity
                style={[styles.autoGenBtn, !formData.modelNumber.trim() && styles.autoGenBtnDisabled]}
                onPress={handleAutoGenerateSku}
                activeOpacity={0.7}
                disabled={!formData.modelNumber.trim()}
              >
                <Text style={[styles.autoGenText, !formData.modelNumber.trim() && styles.autoGenTextDisabled]}>
                  Auto Generate
                </Text>
              </TouchableOpacity>
            }
          />
        </View>
        <View style={styles.half}>
          <Input label="Model Number" placeholder="e.g. TN-X1-256" value={formData.modelNumber} onChangeText={(v) => updateForm({ modelNumber: v })} hint="Used to auto-generate SKU suffix (001, 002…)" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Barcode" placeholder="EAN / UPC" value={formData.barcode} onChangeText={(v) => updateForm({ barcode: v })} />
        </View>
        <View style={styles.half}>
          <Input label="HSN Code" placeholder="Tax classification" value={formData.hsnCode} onChangeText={(v) => updateForm({ hsnCode: v })} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Manufacturer" placeholder="Manufacturer name" value={formData.manufacturer} onChangeText={(v) => updateForm({ manufacturer: v })} />
        </View>
        <View style={styles.half}>
          <Dropdown label="Country of Origin" value={formData.countryOfOrigin} options={COUNTRIES} onSelect={(v) => updateForm({ countryOfOrigin: v })} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Dropdown label="Warranty" value={formData.warranty} options={WARRANTIES} onSelect={(v) => updateForm({ warranty: v })} />
        </View>
        <View style={styles.half}>
          <Dropdown label="Product Condition" value={formData.productCondition} options={PRODUCT_CONDITIONS} onSelect={(v) => updateForm({ productCondition: v })} />
        </View>
      </View>

      <Input label="Short Description" placeholder="Brief product summary (max 160 chars)" value={formData.shortDescription} onChangeText={(v) => updateForm({ shortDescription: v })} maxLength={160} />
      <Input label="Overview" placeholder="Enter product overview..." value={formData.description} onChangeText={(v) => updateForm({ description: v })} multiline numberOfLines={5} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="Product Video URL"
            placeholder="https://youtube.com/watch?v=..."
            value={formData.productVideoUrl}
            onChangeText={(v) => updateForm({ productVideoUrl: v })}
          />
        </View>
        <View style={styles.half}>
          <Input
            label="Colour / Size / Variant"
            placeholder="e.g. Black / 256GB"
            value={
              typeof formData.colourSizeVariant === 'string'
                ? formData.colourSizeVariant
                : ''
            }
            onChangeText={(v) => updateForm({ colourSizeVariant: v })}
            hint="Free-text label; separate from Variants step attributes"
          />
        </View>
      </View>

      <Card style={styles.dynamicSection}>
        <ToggleSwitch
          label="Serial Number / IMEI Tracking"
          description="Track serial numbers or IMEI for this product"
          value={formData.serialImeiTracking}
          onValueChange={(v) => updateForm({ serialImeiTracking: v })}
        />
      </Card>

      <Card style={styles.dynamicSection}>
        <DynamicKeyValueList
          title="Specifications"
          items={formData.specifications}
          onChange={(specifications) => updateForm({ specifications })}
        />
        <DynamicTextList
          title="Features"
          addLabel="+ Add Feature"
          placeholder="Enter product feature"
          items={formData.features}
          onChange={(features) => updateForm({ features })}
        />
        <DynamicTextList
          title="Box Contents"
          addLabel="+ Add Item"
          placeholder="Enter box content item"
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
  autoGenBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.borderLight,
  },
  autoGenText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
    textAlign: 'center',
  },
  autoGenTextDisabled: {
    color: colors.textMuted,
  },
});
