import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Product } from '../types/product';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';

interface ProductPreviewModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onEdit?: () => void;
}

export function ProductPreviewModal({ visible, product, onClose, onEdit }: ProductPreviewModalProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  if (!product) return null;

  const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;
  const imageUri = resolveMediaUrl(product.imageUrl);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Product Preview</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, isTablet && styles.heroTablet]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.heroImage} />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Text style={{ fontSize: 64 }}>📦</Text>
              </View>
            )}
            <View style={styles.heroInfo}>
              <Badge status={product.status} />
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.sku}>SKU: {product.sku}</Text>
              <View style={styles.priceBlock}>
                <Text style={styles.sellingPrice}>{formatPrice(product.sellingPrice)}</Text>
                {product.mrp > product.sellingPrice && (
                  <Text style={styles.mrp}>{formatPrice(product.mrp)}</Text>
                )}
              </View>
            </View>
          </View>

          <Card style={styles.section}>
            <SectionTitle title="Product Details" />
            <DetailRow label="Category" value={product.category} />
            <DetailRow label="Brand" value={product.brand} />
            <DetailRow label="Stock Available" value={String(product.stock)} />
            <DetailRow label="Status" value={product.status.replace('_', ' ')} />
          </Card>

          <Card style={styles.section}>
            <SectionTitle title="Pricing Summary" />
            <DetailRow label="MRP" value={formatPrice(product.mrp)} />
            <DetailRow label="Selling Price" value={formatPrice(product.sellingPrice)} />
            <DetailRow
              label="Discount"
              value={`${
                product.mrp > product.sellingPrice
                  ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
                  : 0
              }%`}
            />
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Close" onPress={onClose} variant="outline" style={{ flex: 1 }} />
          {onEdit && (
            <Button
              title="Edit Product"
              onPress={() => {
                onEdit();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, color: colors.textSecondary },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  hero: {},
  heroTablet: { flexDirection: 'row', gap: spacing.xxl },
  heroImage: {
    width: '100%',
    height: 240,
    borderRadius: radius.lg,
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width: '100%',
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { marginTop: spacing.lg },
  productName: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  sku: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
  priceBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  sellingPrice: { fontSize: 24, fontWeight: '800', color: colors.primary },
  mrp: { fontSize: 16, color: colors.textMuted, textDecorationLine: 'line-through' },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});
