import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useWizard } from '../WizardContext';
import { Card } from '../../../../components/ui/Card';
import { ImagePlaceholder } from '../../../../components/ui/ImagePlaceholder';
import { LiveCalculationPanel } from '../../components/LiveCalculationPanel';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';
import { formatCurrency } from '../../utils/productCalculations';
import { useRbac } from '../../../../auth/rbacStore';

/** Review groupings match Admin Web product-form Review step. */
export function Step11Review() {
  const { formData } = useWizard();
  const { roleName } = useRbac();
  const roleKey = String(roleName ?? '').trim().toLowerCase();
  const hideRestrictedSteps = roleKey === 'employee' || roleKey === 'dealer';
  const dealerName = formData.suppliers[0]?.dealer || '—';
  const categoryPath =
    [formData.category, formData.subCategory, formData.brand].filter(Boolean).join(' › ') || '—';
  const previewUrls = [
    formData.primaryImage,
    ...(formData.galleryImages ?? []),
    ...formData.variants.map((v) => v.variantImage).filter(Boolean),
  ].filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {hideRestrictedSteps ? 'Ready for Approval' : 'Ready to Publish'}
      </Text>
      <Text style={styles.subheading}>
        {hideRestrictedSteps
          ? 'Confirm product details before saving for approval. An admin will decide EMI and approve it before customers can see it.'
          : 'Confirm every section before saving or publishing.'}
      </Text>

      <LiveCalculationPanel formData={formData} />

      <ReviewCard title="Basic Information">
        <ReviewRow label="Product Name" value={formData.productName} />
        <ReviewRow label="SKU" value={formData.sku || '—'} />
        <ReviewRow label="Dealer" value={dealerName} />
        <ReviewRow
          label="Colour / Size / Variant"
          value={formatReviewValue(formData.colourSizeVariant)}
        />
        <ReviewRow
          label="Product Video URL"
          value={formatReviewValue(formData.productVideoUrl)}
        />
        <ReviewRow label="Stock Quantity" value={formData.availableStock || '—'} />
        <ReviewRow
          label="Serial/IMEI Tracking"
          value={formData.serialImeiTracking ? 'Yes' : 'No'}
        />
        <ReviewRow label="Specifications" value={`${(formData.specifications ?? []).length} items`} />
        <ReviewRow label="About this item" value={`${(formData.aboutThisItem ?? []).length} items`} />
        <ReviewRow label="Features" value={`${(formData.features ?? []).length} items`} />
        <ReviewRow label="Box Contents" value={`${(formData.boxContents ?? []).length} items`} />
      </ReviewCard>

      <ReviewCard title="Category">
        <ReviewRow label="Path" value={categoryPath} />
        <ReviewRow label="Brand" value={formData.brand || '—'} />
      </ReviewCard>

      <ReviewCard title="Variants">
        {formData.variantsEnabled ? (
          <>
            <ReviewRow label="Mode" value={`${formData.variants.length} variants`} />
            {formData.variants.length === 0 ? (
              <ReviewRow label="List" value="No variants added yet" />
            ) : (
              formData.variants.map((v) => (
                <ReviewRow
                  key={v.id}
                  label={v.name || 'Variant'}
                  value={`${v.sku || '—'}${v.saved ? ' · Saved' : ' · Draft'}`}
                />
              ))
            )}
          </>
        ) : (
          <ReviewRow label="Mode" value="Normal Product (Single SKU)" />
        )}
      </ReviewCard>

      <ReviewCard title="Images">
        {previewUrls.length === 0 ? (
          <Text style={styles.muted}>No image URLs entered.</Text>
        ) : (
          <View style={styles.imageRow}>
            {previewUrls.slice(0, 8).map((uri, i) =>
              uri ? (
                <Image key={`${uri}-${i}`} source={{ uri }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <ImagePlaceholder key={i} size="sm" />
              ),
            )}
          </View>
        )}
      </ReviewCard>

      <ReviewCard title="Pricing">
        <ReviewRow
          label="MRP"
          value={formData.mrp ? formatCurrency(parseFloat(formData.mrp)) : '—'}
        />
        <ReviewRow
          label="Selling price"
          value={formData.sellingPrice ? formatCurrency(parseFloat(formData.sellingPrice)) : '—'}
          highlight
        />
        <ReviewRow
          label="Purchase price"
          value={formData.purchasePrice ? formatCurrency(parseFloat(formData.purchasePrice)) : '—'}
        />
        <ReviewRow label="GST" value={formData.gst ? `${formData.gst}` : '—'} />
      </ReviewCard>

      <ReviewCard title="Delivery">
        {hideRestrictedSteps ? (
          <Text style={styles.muted}>
            An admin will configure delivery after you submit this product for approval.
          </Text>
        ) : (
          <>
            <ReviewRow label="Weight" value={formData.weight || '—'} />
            <ReviewRow
              label="Charges"
              value={
                formData.deliveryCharges
                  ? formatCurrency(parseFloat(formData.deliveryCharges))
                  : '—'
              }
            />
            <ReviewRow label="Days" value={formData.deliveryDays || '—'} />
            <ReviewRow label="Express" value={formData.expressDelivery ? 'Yes' : 'No'} />
          </>
        )}
      </ReviewCard>

      <ReviewCard title="EMI">
        {hideRestrictedSteps ? (
          <Text style={styles.muted}>
            An admin will decide whether this product requires EMI after you submit it for approval.
          </Text>
        ) : (
          <>
            <ReviewRow label="Enabled" value={formData.emiEnabled ? 'Yes' : 'No'} />
            <ReviewRow label="Plans" value={`${formData.emiPlans.length}`} />
          </>
        )}
      </ReviewCard>

      <ReviewCard title="SEO">
        <ReviewRow label="Slug" value={formData.slug || '—'} />
        <ReviewRow label="Meta title" value={formData.metaTitle || '—'} />
      </ReviewCard>
    </View>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function formatReviewValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => formatReviewValue(item)).filter((v) => v !== '—');
    return parts.length ? parts.join(', ') : '—';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts = [obj.color, obj.storageOrSize, obj.size, obj.variant, obj.label].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    if (parts.length) return parts.join(' / ');
  }
  return '—';
}

function ReviewRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: unknown;
  highlight?: boolean;
}) {
  const display = formatReviewValue(value);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.highlight]} numberOfLines={3}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textHeading },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xxl },
  card: { marginTop: spacing.lg },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textHeading, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  label: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  value: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  highlight: { color: colors.accentDark },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
