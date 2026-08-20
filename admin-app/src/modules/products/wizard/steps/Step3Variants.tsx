import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useWizard } from '../WizardContext';
import { ToggleSwitch } from '../../../../components/ui/ToggleSwitch';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import {
  VariantExpandableCard,
  validateVariant,
} from '../../components/VariantExpandableCard';
import { createEmptyVariant, ProductVariant } from '../../types/product';
import { clearPendingImage, isLocalPendingImageUri } from '../../utils/pendingImages';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';

function releaseVariantImages(variant: ProductVariant) {
  if (variant.variantImage && isLocalPendingImageUri(variant.variantImage)) {
    clearPendingImage(variant.variantImage);
  }
  for (const uri of variant.galleryImages ?? []) {
    if (uri && isLocalPendingImageUri(uri)) clearPendingImage(uri);
  }
}

/** Alert.alert button callbacks are unreliable on web — use window.confirm there. */
function confirmAction(title: string, message: string): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(`${title}\n\n${message}`);
  }
  return false;
}

export function Step3Variants() {
  const { formData, updateForm } = useWizard();
  const [newVariantName, setNewVariantName] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const addVariant = () => {
    const name = newVariantName.trim();
    if (!name) {
      Alert.alert('Variant name required', 'Type a variant name (e.g. Red, 64GB) then click Add Variant.');
      return;
    }

    if (formData.variants.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setNewVariantName('');
      return;
    }

    const index = formData.variants.length;
    const newVariant = createEmptyVariant(name, index, formData.sku, {
      mrp: formData.mrp,
      sellingPrice: formData.sellingPrice,
      purchasePrice: formData.purchasePrice,
    });

    updateForm({
      variantsEnabled: true,
      variants: [...formData.variants, newVariant],
    });
    setNewVariantName('');
    setExpandedIds([newVariant.id]);
  };

  const removeVariant = (id: string) => {
    const target = formData.variants.find((v) => v.id === id);
    if (target) releaseVariantImages(target);

    const next = formData.variants.filter((v) => v.id !== id);
    updateForm({
      variants: next,
      // Keep variants enabled if user still has the toggle on — only clear list.
      variantsEnabled: formData.variantsEnabled,
    });
    setExpandedIds((prev) => prev.filter((x) => x !== id));
  };

  const confirmRemoveVariant = (id: string, name: string) => {
    const title = 'Delete variant?';
    const message = `Remove "${name || 'this variant'}" from the list?`;

    if (Platform.OS === 'web') {
      if (confirmAction(title, message)) {
        removeVariant(id);
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeVariant(id) },
    ]);
  };

  const clearAllVariants = () => {
    const title = 'Clear all variants?';
    const message = 'This removes every variant from the product form.';

    const runClear = () => {
      formData.variants.forEach(releaseVariantImages);
      updateForm({ variants: [], attributes: [] });
      setExpandedIds([]);
    };

    if (Platform.OS === 'web') {
      if (confirmAction(title, message)) runClear();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: runClear },
    ]);
  };

  const updateVariant = (id: string, data: Partial<ProductVariant>) => {
    updateForm({
      variants: formData.variants.map((v) =>
        v.id === id ? { ...v, ...data, saved: false } : v,
      ),
    });
  };

  /** Persist variant in wizard state immediately (no product API call). */
  const saveVariant = (id: string): boolean => {
    const current = formData.variants.find((v) => v.id === id);
    if (!current) return false;
    if (validateVariant(current)) {
      setExpandedIds([id]);
      return false;
    }

    updateForm({
      variants: formData.variants.map((v) => (v.id === id ? { ...v, saved: true } : v)),
    });
    // Collapse so it appears as a saved list row (Admin Web Saved pill).
    setExpandedIds((prev) => prev.filter((x) => x !== id));
    return true;
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const editVariant = (id: string) => {
    setExpandedIds([id]);
  };

  if (!formData.variantsEnabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Variants</Text>
        <Text style={styles.subheading}>Configure product variants or sell as a single SKU</Text>
        <Card>
          <ToggleSwitch
            label="Enable Variants"
            description="Turn on to create multiple SKUs with different attributes"
            value={formData.variantsEnabled}
            onValueChange={(v) => updateForm({ variantsEnabled: v })}
          />
          <View style={styles.normalProduct}>
            <Text style={styles.normalIcon}>📦</Text>
            <Text style={styles.normalTitle}>Normal Product</Text>
            <Text style={styles.normalDesc}>
              This product will be sold as a single SKU without variants.
            </Text>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Variants</Text>
      <Text style={styles.subheading}>Easily add options like Size, Color, or Storage capacity</Text>

      <Card style={styles.card}>
        <ToggleSwitch
          label="Enable Variants"
          value={formData.variantsEnabled}
          onValueChange={(v) => {
            if (!v) {
              formData.variants.forEach(releaseVariantImages);
              updateForm({ variantsEnabled: false, variants: [], attributes: [] });
              setExpandedIds([]);
              return;
            }
            updateForm({ variantsEnabled: true });
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Quick Add Variant</Text>
        <Text style={styles.quickHint}>
          Type a variant name (e.g., &quot;Red&quot;, &quot;64GB&quot;, &quot;Large&quot;) and add it to the list.
        </Text>
        <View style={styles.addValueRow}>
          <View style={styles.addInputWrap}>
            <Input
              placeholder="e.g. Red - 64GB"
              value={newVariantName}
              onChangeText={setNewVariantName}
              onSubmitEditing={addVariant}
              containerStyle={styles.addInputContainer}
              returnKeyType="done"
            />
          </View>
          <Button title="Add Variant" onPress={addVariant} size="md" style={styles.addBtn} />
        </View>
      </Card>

      {formData.variants.length > 0 && (
        <View>
          <View style={styles.variantHeader}>
            <Text style={styles.sectionTitle}>
              {formData.variants.length} Variant{formData.variants.length === 1 ? '' : 's'} Added
            </Text>
            <TouchableOpacity onPress={clearAllVariants}>
              <Text style={styles.removeAllText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {formData.variants.map((variant) => {
            const expanded = expandedIds.includes(variant.id);
            return (
              <View key={variant.id} style={styles.variantBlock}>
                {!expanded ? (
                  <Card style={styles.summaryCard}>
                    <View style={styles.summaryTop}>
                      <View style={styles.summaryText}>
                        <Text style={styles.summaryName}>{variant.name || 'Untitled variant'}</Text>
                        <Text style={styles.summaryMeta}>
                          SKU: {variant.sku || '—'} · Stock: {variant.stock || '0'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.pill,
                          variant.saved ? styles.pillSaved : styles.pillDraft,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            variant.saved ? styles.pillTextSaved : styles.pillTextDraft,
                          ]}
                        >
                          {variant.saved ? 'Saved' : 'Draft'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.summaryActions}>
                      <Button
                        title="Edit"
                        onPress={() => editVariant(variant.id)}
                        variant="outline"
                        size="sm"
                        style={styles.summaryBtn}
                      />
                      <Button
                        title="Delete"
                        onPress={() => confirmRemoveVariant(variant.id, variant.name)}
                        variant="danger"
                        size="sm"
                        style={styles.summaryBtn}
                      />
                    </View>
                  </Card>
                ) : (
                  <VariantExpandableCard
                    variant={variant}
                    expanded
                    onToggle={() => toggleExpanded(variant.id)}
                    onUpdate={(data) => updateVariant(variant.id, data)}
                    onSave={() => saveVariant(variant.id)}
                    onDelete={() => confirmRemoveVariant(variant.id, variant.name)}
                    onEdit={() => editVariant(variant.id)}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textHeading },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xxl },
  card: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  quickHint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  normalProduct: { alignItems: 'center', paddingVertical: spacing.xxxl },
  normalIcon: { fontSize: 48, marginBottom: spacing.md },
  normalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  normalDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  addValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  addInputWrap: { flex: 1, minWidth: 0 },
  addInputContainer: { marginBottom: 0, width: '100%' },
  addBtn: { flexShrink: 0, alignSelf: 'center' },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  removeAllText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  variantBlock: { marginBottom: spacing.sm },
  summaryCard: { marginBottom: spacing.sm },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryText: { flex: 1, minWidth: 0 },
  summaryName: { fontSize: 15, fontWeight: '700', color: colors.text },
  summaryMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  pillSaved: { backgroundColor: colors.successLight },
  pillDraft: { backgroundColor: colors.borderLight },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  pillTextSaved: { color: colors.success },
  pillTextDraft: { color: colors.textSecondary },
  summaryActions: { flexDirection: 'row', gap: spacing.sm },
  summaryBtn: { flex: 1 },
});
