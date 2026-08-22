import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Product, ProductStatus } from '../types/product';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';

interface ProductCardProps {
  product: Product;
  /** Hidden when the logged-in user lacks products.edit. */
  onEdit?: () => void;
  /** Hidden when the logged-in user lacks products.delete. */
  onDelete?: () => void;
  onView: () => void;
}

const IMAGE_SIZE = 84;

const STATUS_STYLE: Record<ProductStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: colors.successLight, text: colors.success },
  draft: { label: 'Draft', bg: colors.warningLight, text: colors.warning },
  pending_approval: { label: 'Pending Approval', bg: colors.warningLight, text: colors.warning },
  rejected: { label: 'Rejected', bg: colors.dangerLight, text: colors.danger },
  out_of_stock: { label: 'Out of Stock', bg: colors.dangerLight, text: colors.danger },
  archived: { label: 'Archived', bg: colors.borderLight, text: colors.textSecondary },
};

export function ProductCard({ product, onEdit, onDelete, onView }: ProductCardProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const imageUri = resolveMediaUrl(product.imageUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUri]);

  const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;
  // Sold out reads clearly even when an admin hasn't flipped the status field.
  const status =
    product.stock === 0
      ? STATUS_STYLE.out_of_stock
      : STATUS_STYLE[product.status] || { label: product.status || 'Unknown', bg: colors.borderLight, text: colors.textSecondary };
  const lowStock = product.stock > 0 && product.stock <= 5;
  const showImage = Boolean(imageUri) && !imageFailed;

  return (
    <View style={[styles.card, shadow.sm, isTablet && styles.cardTablet]}>
      <View style={styles.content}>
        <View style={styles.thumb}>
          {showImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={styles.brandLine} numberOfLines={1}>
            {product.brand} · {product.category}
          </Text>

          <Text style={styles.skuLine} numberOfLines={1}>
            SKU: {product.sku}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.sellingPrice)}</Text>
            <Text
              style={[
                styles.stock,
                product.stock === 0 && styles.stockOut,
                lowStock && styles.stockLow,
              ]}
            >
              Stock: {product.stock}
              {lowStock ? ' · Low' : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <ActionBtn icon="eye-outline" label="View" onPress={onView} />
        {onEdit ? (
          <>
            <View style={styles.actionDivider} />
            <ActionBtn icon="create-outline" label="Edit" onPress={onEdit} primary />
          </>
        ) : null}
        {onDelete ? (
          <>
            <View style={styles.actionDivider} />
            <ActionBtn icon="trash-outline" label="Delete" onPress={onDelete} danger />
          </>
        ) : null}
      </View>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  primary,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const iconColor = danger ? colors.danger : colors.primary;
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text
        style={[
          styles.actionLabel,
          primary && styles.actionLabelPrimary,
          danger && styles.actionLabelDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardTablet: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  content: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    minHeight: 116,
  },
  thumb: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textHeading,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: 1,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  brandLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  skuLine: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: spacing.sm,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  stock: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stockOut: {
    color: colors.danger,
  },
  stockLow: {
    color: colors.warning,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 48,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  actionEmoji: {
    fontSize: 14,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionLabelPrimary: {
    color: colors.secondary,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
  },
});
