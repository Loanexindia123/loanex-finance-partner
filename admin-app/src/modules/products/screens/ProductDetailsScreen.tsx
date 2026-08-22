import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Product } from '../types/product';
import { getProductById, updateProduct } from '../../../services/productService';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { SafeHeader } from '../../../components/layout/SafeHeader';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { RootStackParamList } from '../../../navigation/types';
import { isApprovedProductLocked, isFieldActor } from '../../../auth/rbacStore';
import { resolveMediaUrl, resolveProductImageUrl } from '../../../utils/resolveMediaUrl';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

export function ProductDetailsScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [product, setProduct] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadProduct() {
      try {
        const data = await getProductById(route.params.productId);
        // Map backend to frontend schema
        setProduct({
          id: data.id,
          name: data.name,
          sku: data.sku || '',
          category: data.category || data.categoryId || 'Uncategorized',
          brand: data.brand || 'No Brand',
          sellingPrice: Number(data.price) || 0,
          mrp: Number(data.mrp) || Number(data.price) || 0,
          stock: data.stock || 0,
          status: (data.status || 'active') as Product['status'],
          imageUrl: resolveProductImageUrl(data as any) || undefined,
          featured: Boolean(data.featured),
          trending: Boolean(data.trending),
          recommended: Boolean(data.recommended),
          emiAvailable: Boolean(data.emiAvailable),
        });
      } catch (err) {
        console.warn('Error loading product details', err);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [route.params.productId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <SafeHeader style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Product Details</Text>
          <View style={styles.backBtn} />
        </SafeHeader>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <SafeHeader style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Product Details</Text>
          <View style={styles.backBtn} />
        </SafeHeader>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Product not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;
  const editLocked = isApprovedProductLocked(product.status);

  const toggleFlag = async (key: 'featured' | 'trending' | 'recommended') => {
    const next = !product[key];
    // Optimistic update so the UI feels instant.
    setProduct((prev) => (prev ? { ...prev, [key]: next } : prev));
    try {
      await updateProduct(product.id, { [key]: next } as Partial<Product>);
    } catch (err) {
      console.warn(`Failed to update ${key}`, err);
      setProduct((prev) => (prev ? { ...prev, [key]: !next } : prev));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <SafeHeader style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Product Details</Text>
        {editLocked ? (
          <View style={styles.backBtn} />
        ) : (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('AddProduct', { mode: 'edit', productId: product.id })
            }
            style={styles.backBtn}
          >
            <Text style={[styles.backText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        )}
      </SafeHeader>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, isTablet && styles.heroTablet]}>
          {product.imageUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(product.imageUrl) }}
              style={styles.heroImage}
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={{ fontSize: 64 }}>📦</Text>
            </View>
          )}
          <View style={styles.heroInfo}>
            <Badge
              status={product.status}
              label={editLocked ? 'Approved (Locked)' : undefined}
            />
            {editLocked ? (
              <Text style={styles.lockHint}>
                This product has been approved and can no longer be edited.
              </Text>
            ) : null}
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

        {isFieldActor() ? null : (
        <Card style={styles.section}>
          <SectionTitle title="Marketing & Visibility" />
          <DetailRow label="EMI Available" value={product.emiAvailable ? 'Yes' : 'No'} />
          <View style={styles.flagRow}>
            <Text style={styles.flagLabel}>Featured</Text>
            <TouchableOpacity
              style={[styles.flagToggle, product.featured && styles.flagToggleOn]}
              onPress={() => toggleFlag('featured')}
            >
              <Text style={[styles.flagToggleText, product.featured && styles.flagToggleTextOn]}>
                {product.featured ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.flagRow}>
            <Text style={styles.flagLabel}>Trending</Text>
            <TouchableOpacity
              style={[styles.flagToggle, product.trending && styles.flagToggleOn]}
              onPress={() => toggleFlag('trending')}
            >
              <Text style={[styles.flagToggleText, product.trending && styles.flagToggleTextOn]}>
                {product.trending ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.flagRow}>
            <Text style={styles.flagLabel}>Recommended</Text>
            <TouchableOpacity
              style={[styles.flagToggle, product.recommended && styles.flagToggleOn]}
              onPress={() => toggleFlag('recommended')}
            >
              <Text style={[styles.flagToggleText, product.recommended && styles.flagToggleTextOn]}>
                {product.recommended ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Back" onPress={() => navigation.goBack()} variant="outline" style={{ flex: 1 }} />
        {editLocked ? null : (
          <Button
            title="Edit Product"
            onPress={() =>
              navigation.navigate('AddProduct', { mode: 'edit', productId: product.id })
            }
            variant="primary"
            style={{ flex: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 64, padding: spacing.sm },
  backText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
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
  lockHint: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
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
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  flagLabel: { fontSize: 14, color: colors.textSecondary },
  flagToggle: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.borderLight,
  },
  flagToggleOn: { backgroundColor: colors.primary },
  flagToggleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  flagToggleTextOn: { color: '#FFFFFF' },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: colors.textSecondary },
});
