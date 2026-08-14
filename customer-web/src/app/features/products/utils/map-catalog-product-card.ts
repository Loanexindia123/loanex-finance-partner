import { ProductCardItem } from '../../../shared/models/product-card.model';
import { formatInr } from '../../../shared/utils/currency';
import { resolveMediaUrl } from '../../../shared/utils/media-url';
import { CatalogProduct } from '../services/products-api.service';

export function toProductCardItem(product: CatalogProduct): ProductCardItem {
  const sellingPrice = product.sellingPrice ?? product.price;
  // Prefer API-computed starting EMI only — do not invent client-side EMI prices.
  const emiMonthly = product.emiStartingFrom != null ? product.emiStartingFrom : null;

  return {
    id: product.id,
    name: product.name,
    price: sellingPrice,
    priceLabel: formatInr(sellingPrice),
    emiLabel:
      product.emiAvailable && emiMonthly != null
        ? `${formatInr(emiMonthly)} / month`
        : product.emiAvailable
          ? 'EMI available'
          : 'EMI not available',
    deliveryLabel:
      product.deliveryCharge > 0 ? `Delivery ${formatInr(product.deliveryCharge)}` : 'Free Delivery',
    imageSrc: resolveMediaUrl(product.imageUrl || product.thumbnail),
    imageAlt: product.name,
    path: `/products/${product.slug || product.id}`,
    rating: product.averageRating,
    reviewCount: product.reviewCount,
    wishlist: false,
  };
}
