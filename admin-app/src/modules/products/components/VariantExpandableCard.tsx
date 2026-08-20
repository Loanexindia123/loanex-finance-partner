import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ProductVariant } from '../types/product';
import { ExpandableCard } from '../../../components/ui/ExpandableCard';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Button } from '../../../components/ui/Button';
import { ImagePlaceholder } from '../../../components/ui/ImagePlaceholder';
import { pickProductImage } from '../utils/pickProductImage';
import { clearPendingImage } from '../utils/pendingImages';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

interface VariantExpandableCardProps {
  variant: ProductVariant;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (data: Partial<ProductVariant>) => void;
  /** Validate + persist locally; return true when saved successfully. */
  onSave: () => boolean;
  onDelete: () => void;
  onEdit: () => void;
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(String(value ?? '').trim());
}

export function validateVariant(variant: ProductVariant): string | null {
  if (!String(variant.name ?? '').trim()) {
    return 'Variant name is required.';
  }
  const stock = String(variant.stock ?? '').trim();
  if (stock === '') {
    return 'Stock quantity is required.';
  }
  if (!isNonNegativeInteger(stock)) {
    return 'Stock quantity must be an integer of 0 or more.';
  }
  return null;
}

/**
 * Variant editor — field set requested for mobile parity with Admin Web core fields.
 */
export function VariantExpandableCard({
  variant,
  expanded,
  onToggle,
  onUpdate,
  onSave,
  onDelete,
  onEdit,
}: VariantExpandableCardProps) {
  const [showErrors, setShowErrors] = useState(false);
  const nameError =
    showErrors && !String(variant.name ?? '').trim() ? 'Name is required.' : '';
  const stockError = !showErrors
    ? ''
    : variant.stock === ''
      ? 'Enter a whole number of 0 or more.'
      : isNonNegativeInteger(variant.stock)
        ? ''
        : 'Enter a whole number of 0 or more.';

  const pickVariantImage = async () => {
    const file = await pickProductImage();
    if (!file) return;
    if (variant.variantImage) clearPendingImage(variant.variantImage);
    onUpdate({ variantImage: file.uri });
  };

  const addGalleryImage = async () => {
    const file = await pickProductImage();
    if (!file) return;
    onUpdate({ galleryImages: [...(variant.galleryImages ?? []), file.uri] });
  };

  const removeGalleryImage = (index: number) => {
    const uri = variant.galleryImages[index];
    if (uri) clearPendingImage(uri);
    onUpdate({ galleryImages: variant.galleryImages.filter((_, i) => i !== index) });
  };

  const handleSave = () => {
    const error = validateVariant(variant);
    if (error) {
      setShowErrors(true);
      Alert.alert('Variant incomplete', error);
      return;
    }
    setShowErrors(false);
    if (onSave()) {
      Alert.alert('Variant saved', `"${variant.name.trim()}" is saved in this product form.`);
    }
  };

  return (
    <ExpandableCard
      title={variant.name || 'Untitled variant'}
      subtitle={`SKU: ${variant.sku || '—'} · Stock: ${variant.stock || '0'}`}
      expanded={expanded}
      onToggle={onToggle}
      badge={variant.saved ? 'Saved' : 'Draft'}
      badgeColor={variant.saved ? colors.success : undefined}
    >
      <View style={styles.actionRow}>
        <Button title="Edit" onPress={onEdit} variant="outline" size="sm" style={styles.actionBtn} />
        <Button title="Delete" onPress={onDelete} variant="danger" size="sm" style={styles.actionBtn} />
      </View>

      <Input
        label="Variant Name"
        value={variant.name}
        onChangeText={(v) => onUpdate({ name: v })}
        required
        error={nameError || undefined}
        placeholder="e.g. Red - 64GB"
      />
      <Input label="SKU" value={variant.sku} onChangeText={(v) => onUpdate({ sku: v })} />
      <Input label="Barcode" value={variant.barcode} onChangeText={(v) => onUpdate({ barcode: v })} />
      <Input
        label="MRP"
        value={variant.mrp}
        onChangeText={(v) => onUpdate({ mrp: v })}
        keyboardType="numeric"
      />
      <Input
        label="Selling Price"
        value={variant.sellingPrice}
        onChangeText={(v) => onUpdate({ sellingPrice: v })}
        keyboardType="numeric"
      />
      <Input
        label="Purchase Price"
        value={variant.purchasePrice}
        onChangeText={(v) => onUpdate({ purchasePrice: v })}
        keyboardType="numeric"
      />
      <Input
        label="Stock"
        value={variant.stock}
        onChangeText={(v) => onUpdate({ stock: v.replace(/[^\d]/g, '') })}
        keyboardType="number-pad"
        required
        error={stockError || undefined}
      />
      <Dropdown
        label="Status"
        value={variant.status}
        options={['active', 'draft', 'out_of_stock']}
        onSelect={(v) => onUpdate({ status: v as ProductVariant['status'] })}
      />

      <Text style={styles.sectionLabel}>Dimensions</Text>
      <View style={styles.row}>
        <View style={styles.quarter}>
          <Input
            label="Weight"
            value={variant.weight}
            onChangeText={(v) => onUpdate({ weight: v })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.quarter}>
          <Input
            label="Length"
            value={variant.length}
            onChangeText={(v) => onUpdate({ length: v })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.quarter}>
          <Input
            label="Width"
            value={variant.width}
            onChangeText={(v) => onUpdate({ width: v })}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.quarter}>
          <Input
            label="Height"
            value={variant.height}
            onChangeText={(v) => onUpdate({ height: v })}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Variant Images</Text>
      <View style={styles.imageRow}>
        <View>
          <Text style={styles.imageLabel}>Variant image</Text>
          <ImagePlaceholder
            size="md"
            imageUri={variant.variantImage}
            label="Upload"
            subtitle="Tap to select"
            onPress={() => void pickVariantImage()}
          />
        </View>
        <View style={styles.galleryWrap}>
          <Text style={styles.imageLabel}>Variant gallery</Text>
          <View style={styles.galleryRow}>
            {(variant.galleryImages ?? []).map((uri, i) => (
              <ImagePlaceholder
                key={`${uri}-${i}`}
                size="sm"
                imageUri={uri}
                onPress={() => removeGalleryImage(i)}
              />
            ))}
            <ImagePlaceholder
              size="sm"
              label="Add"
              subtitle="Photo"
              onPress={() => void addGalleryImage()}
            />
          </View>
        </View>
      </View>

      <Button title="Save Variant" onPress={handleSave} style={{ marginTop: spacing.md }} />
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  imageLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  imageRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  galleryWrap: { flex: 1 },
  galleryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quarter: { flexGrow: 1, flexShrink: 1, flexBasis: 70, minWidth: 0 },
});
