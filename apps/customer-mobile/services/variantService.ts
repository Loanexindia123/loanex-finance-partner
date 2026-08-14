import { api } from '../lib/apiClient';
import { ProductVariant } from '../types';
import { resolveMediaUrlList } from '../utils/mediaUrl';

function mapVariant(data: any): ProductVariant {
  return {
    id: data.id,
    productId: data.productId || data.product_id,
    sku: data.sku || '',
    barcode: data.barcode || '',
    sellingPrice: data.sellingPrice ?? data.selling_price ?? 0,
    purchasePrice: data.purchasePrice ?? data.purchase_price ?? 0,
    gst: data.gst ?? 0,
    stock: data.stock ?? 0,
    reservedStock: data.reservedStock ?? data.reserved_stock ?? 0,
    images: resolveMediaUrlList(data.images || []),
    weight: data.weight ?? 0,
    length: data.length ?? 0,
    width: data.width ?? 0,
    height: data.height ?? 0,
    status: data.status,
    createdAt: data.createdAt || data.created_at,
  };
}

/** Master data via Backend API → MongoDB. */
export async function getVariants(productId: string): Promise<ProductVariant[]> {
  const res = await api.get('/admin/product_variants');
  const items = res.data || [];
  return (Array.isArray(items) ? items : [])
    .map(mapVariant)
    .filter((v) => v.productId === productId);
}

export async function getVariant(id: string): Promise<ProductVariant | null> {
  const res = await api.get('/admin/product_variants');
  const items = (res.data || []).map(mapVariant);
  return items.find((v: ProductVariant) => v.id === id) || null;
}

export async function createVariant(
  v: Omit<ProductVariant, 'id' | 'createdAt'>,
): Promise<ProductVariant> {
  const res = await api.post('/admin/product_variants', {
    productId: v.productId,
    sku: v.sku,
    barcode: v.barcode,
    sellingPrice: v.sellingPrice,
    purchasePrice: v.purchasePrice,
    gst: v.gst,
    stock: v.stock,
    reservedStock: v.reservedStock,
    images: v.images,
    weight: v.weight,
    length: v.length,
    width: v.width,
    height: v.height,
    status: v.status,
  });
  return mapVariant(res.data);
}

export async function updateVariant(
  id: string,
  v: Partial<Omit<ProductVariant, 'id' | 'createdAt'>>,
): Promise<ProductVariant> {
  const payload: any = {};
  if (v.productId !== undefined) payload.productId = v.productId;
  if (v.sku !== undefined) payload.sku = v.sku;
  if (v.barcode !== undefined) payload.barcode = v.barcode;
  if (v.sellingPrice !== undefined) payload.sellingPrice = v.sellingPrice;
  if (v.purchasePrice !== undefined) payload.purchasePrice = v.purchasePrice;
  if (v.gst !== undefined) payload.gst = v.gst;
  if (v.stock !== undefined) payload.stock = v.stock;
  if (v.reservedStock !== undefined) payload.reservedStock = v.reservedStock;
  if (v.images !== undefined) payload.images = v.images;
  if (v.weight !== undefined) payload.weight = v.weight;
  if (v.length !== undefined) payload.length = v.length;
  if (v.width !== undefined) payload.width = v.width;
  if (v.height !== undefined) payload.height = v.height;
  if (v.status !== undefined) payload.status = v.status;
  const res = await api.put(`/admin/product_variants/${id}`, payload);
  return mapVariant(res.data);
}

export async function deleteVariant(id: string): Promise<void> {
  await api.delete(`/admin/product_variants/${id}`);
}

export async function getVariantAttributes(
  variantId: string,
): Promise<{ attributeId: string; valueId: string }[]> {
  const res = await api.get('/admin/product_variant_attributes');
  const items = res.data || [];
  return (Array.isArray(items) ? items : [])
    .filter((d: any) => (d.variantId || d.variant_id) === variantId)
    .map((d: any) => ({
      attributeId: d.attributeId || d.attribute_id,
      valueId: d.valueId || d.value_id,
    }));
}

export async function setVariantAttributes(
  variantId: string,
  attributes: { attributeId: string; valueId: string }[],
): Promise<void> {
  const existing = await getVariantAttributes(variantId);
  // Clear previous rows then insert replacements
  const allRes = await api.get('/admin/product_variant_attributes');
  const all = Array.isArray(allRes.data) ? allRes.data : [];
  for (const row of all) {
    if ((row.variantId || row.variant_id) === variantId && row.id) {
      await api.delete(`/admin/product_variant_attributes/${row.id}`);
    }
  }
  void existing;
  for (const a of attributes) {
    await api.post('/admin/product_variant_attributes', {
      variantId,
      attributeId: a.attributeId,
      valueId: a.valueId,
    });
  }
}
