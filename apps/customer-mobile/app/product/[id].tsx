import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, ActivityIndicator, Alert, Share,
} from 'react-native';
import { AppImage } from '../../components/ui/AppImage';
import { withMediaSize, prefetchMediaUrls } from '../../utils/mediaUrl';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { getProductById } from '../../services/productService';
import { calculateEmiBreakdown } from '../../services/emiService';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { addToWishlist, removeFromWishlist, isInWishlist } from '../../services/wishlistService';
import { Product } from '../../types';

const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;
/** Fallback before natural size is known (matches prior gallery height). */
const GALLERY_HEIGHT_FALLBACK = 300;
const GALLERY_HEIGHT_MIN = 220;
const GALLERY_HEIGHT_MAX = Math.round(H * 0.65);

const TRUST_BADGES = [
  { id: 'delivery', icon: 'local-shipping', title: 'Free Delivery', subtitle: 'Fast & Reliable' },
  { id: 'replacement', icon: 'autorenew', title: '7 Days Replacement', subtitle: 'No questions asked' },
  { id: 'secure', icon: 'security', title: 'Secure Payments', subtitle: '100% Safe & Secure' },
  { id: 'genuine', icon: 'verified', title: 'Genuine Products', subtitle: 'Brand Authorized' },
];

const DELIVERY_STEPS = [
  { id: 'confirmed', icon: 'check-circle', label: 'Order Confirmed', description: 'We confirm your order instantly' },
  { id: 'packed', icon: 'inventory-2', label: 'Packed', description: 'Secure packing at partner hub' },
  { id: 'out', icon: 'local-shipping', label: 'Out for Delivery', description: 'On the way to your pincode' },
  { id: 'delivered', icon: 'home', label: 'Delivered', description: 'Handed over at your doorstep' },
];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, totalItems } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedPlanMonths, setSelectedPlanMonths] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'qa' | 'returns'>('overview');
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  /** Natural width/height ratio (w/h) keyed by hero URI — drives dynamic gallery height. */
  const [heroAspectByUrl, setHeroAspectByUrl] = useState<Record<string, number>>({});
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    getProductById(id).then(p => {
      setProduct(p || null);
      setLoading(false);
      const vars = p?.productVariants || p?.product_variants || p?.variants || [];
      if (vars.length) {
        const def = vars.find((v: any) => v.isDefault) || vars[0];
        setSelectedVariantId(def.id);
        if (def.attributes) {
          // Only keep selectable attribute-group keys — variant payloads also
          // carry display-only extras (e.g. colorHex) that would otherwise
          // break exact-attribute matching for other variants.
          const selectable = new Set((p?.attributeGroups ?? []).map((g: any) => g.key));
          const attrs: Record<string, string> = {};
          for (const [k, v] of Object.entries(def.attributes)) {
            if (selectable.has(k)) attrs[k] = v;
          }
          setSelectedAttributes(attrs);
        }
      }
      if (p?.emiPlans?.length) {
        setSelectedPlanMonths(p.emiPlans[0].months);
      }
    });
    if (user) {
      isInWishlist(user.id, id).then(setWishlisted);
    }
  }, [id, user]);

  const toggleWishlist = async () => {
    if (!user || !product) return;
    if (wishlisted) { await removeFromWishlist(user.id, product.id); setWishlisted(false); }
    else { await addToWishlist(user.id, product.id); setWishlisted(true); }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${product?.name} on LoanEx! Price: ₹${displayPrice.toLocaleString('en-IN')}`,
      });
    } catch {}
  };

  const productVariantsList = useMemo(() => {
    return product?.productVariants || product?.product_variants || product?.variants || [];
  }, [product]);

  // Find variant by selected attributes or variant ID
  const selectedVariant = useMemo(() => {
    if (!productVariantsList.length) return null;
    if (Object.keys(selectedAttributes).length > 0) {
      const match = productVariantsList.find((v: any) =>
        Object.entries(selectedAttributes).every(([k, val]) => v.attributes?.[k] === val)
      );
      if (match) return match;
    }
    return productVariantsList.find((v: any) => v.id === selectedVariantId) ?? productVariantsList[0];
  }, [productVariantsList, selectedVariantId, selectedAttributes]);

  const displayPrice = selectedVariant ? selectedVariant.sellingPrice : (product?.price ?? 0);
  const displayOriginal = selectedVariant ? (selectedVariant.mrp || selectedVariant.purchasePrice) : ((product?.originalPrice || product?.mrp) ?? 0);
  const disc = displayOriginal > 0 ? Math.round((1 - displayPrice / displayOriginal) * 100) : 0;
  const displaySku = selectedVariant ? selectedVariant.sku : (product?.sku ?? '');

  const allImages: string[] = useMemo(() => {
    if (selectedVariant?.images?.length) return selectedVariant.images;
    return product?.images?.length ? product.images : [];
  }, [selectedVariant, product]);

  const fullGallery = useMemo(
    () => allImages.map((url) => withMediaSize(url, 'full')),
    [allImages],
  );
  const thumbGallery = useMemo(
    () => allImages.map((url) => withMediaSize(url, 'thumb')),
    [allImages],
  );

  useEffect(() => {
    if (!fullGallery.length) return;
    // Prefetch full hero + nearby slides; thumbs are tiny and load with the strip.
    prefetchMediaUrls([
      fullGallery[activePhoto],
      fullGallery[activePhoto + 1],
      fullGallery[activePhoto - 1],
      ...thumbGallery,
    ]);
  }, [fullGallery, thumbGallery, activePhoto]);

  const galleryHeight = useMemo(() => {
    const url = fullGallery[activePhoto];
    const aspect = url ? heroAspectByUrl[url] : undefined;
    if (!aspect || aspect <= 0) return GALLERY_HEIGHT_FALLBACK;
    const raw = Math.round(W / aspect);
    return Math.min(GALLERY_HEIGHT_MAX, Math.max(GALLERY_HEIGHT_MIN, raw));
  }, [fullGallery, activePhoto, heroAspectByUrl]);

  const handleHeroImageLoad = (url: string, width: number, height: number) => {
    if (!url || width <= 0 || height <= 0) return;
    const next = width / height;
    setHeroAspectByUrl((prev) => (prev[url] === next ? prev : { ...prev, [url]: next }));
  };

  const emiPlans = useMemo(() => {
    const raw = product?.emiPlans ?? [];
    const price = displayPrice || product?.price || 0;
    return raw.map((plan: any) => {
      if (plan.monthlyEmi != null && plan.upfrontPayment != null && plan.totalPayable != null) {
        return plan;
      }
      const down = plan.downPaymentAmount ?? plan.downPayment ?? 0;
      const fee = plan.processingFee ?? ((plan.serviceCharge || 0) + (plan.deliveryCharge || 0));
      const calc = calculateEmiBreakdown({
        productPrice: price,
        downPayment: down,
        processingFee: fee,
        tenureMonths: plan.months || 0,
      });
      return {
        ...plan,
        downPayment: calc.downPayment,
        downPaymentAmount: calc.downPayment,
        processingFee: calc.processingFee,
        loanAmount: calc.loanAmount,
        monthlyEmi: calc.monthlyEmi,
        upfrontPayment: calc.upfrontPayment,
        loanTotal: calc.loanTotal,
        grandTotal: calc.totalPayable,
        totalPayable: calc.totalPayable,
      };
    });
  }, [product, displayPrice]);
  const activePlan = useMemo(() =>
    emiPlans.find((p: any) => p.months === selectedPlanMonths) ?? emiPlans[0] ?? null,
    [emiPlans, selectedPlanMonths]);

  const keySpecs = useMemo(() => {
    return selectedVariant?.keySpecs?.length ? selectedVariant.keySpecs : product?.keySpecs ?? [];
  }, [selectedVariant, product]);

  const specificationRows = useMemo(() => {
    return selectedVariant?.specificationRows?.length ? selectedVariant.specificationRows : product?.specificationRows ?? [];
  }, [selectedVariant, product]);

  const attributeGroups = useMemo(() => product?.attributeGroups ?? [], [product]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  if (!product) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <MaterialIcons name="error-outline" size={56} color={Colors.border} />
      <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: Fonts.lg }}>Product not found</Text>
      <Pressable style={{ marginTop: 16, padding: 12 }} onPress={() => router.back()}>
        <Text style={{ color: Colors.primary, fontWeight: Fonts.semiBold }}>Go Back</Text>
      </Pressable>
    </View>
  );

  const handleAttributeSelect = (groupKey: string, optionValue: string) => {
    // Drop display-only attributes (e.g. colorHex) so exact-attribute matching
    // against other variants works.
    const selectable = new Set((product?.attributeGroups ?? []).map((g: any) => g.key));
    const nextAttrs: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...selectedAttributes, [groupKey]: optionValue })) {
      if (selectable.has(k)) nextAttrs[k] = v;
    }
    setSelectedAttributes(nextAttrs);
    const match = productVariantsList.find((v: any) =>
      Object.entries(nextAttrs).every(([k, val]) => v.attributes?.[k] === val)
    );
    if (match) {
      setSelectedVariantId(match.id);
      setActivePhoto(0);
    }
  };

  const handleApplyEMI = () => {
    if (!user) { Alert.alert('Login Required', 'Please log in to apply for EMI.'); return; }
    if (!activePlan) return;
    router.push({
      pathname: '/emi-apply' as any,
      params: {
        productId: product.id,
        productName: product.name,
        productImage: allImages[0] || '',
        price: String(displayPrice),
        variantId: selectedVariant?.id || '',
        planMonths: String(activePlan.months),
        downPaymentAmount: String(activePlan.downPaymentAmount),
        monthlyEmi: String(activePlan.monthlyEmi),
      },
    });
  };

  const handleBuyNow = () => {
    router.push({
      pathname: '/checkout',
      params: { buyNowId: product.id, variantId: selectedVariant?.id || '' },
    });
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Top Navbar */}
      <View style={s.header}>
        <Pressable style={s.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{product.name}</Text>
        <Pressable style={s.iconBtn} onPress={handleShare}>
          <MaterialIcons name="share" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Pressable style={s.iconBtn} onPress={toggleWishlist}>
          <MaterialIcons name={wishlisted ? 'favorite' : 'favorite-border'} size={20} color={wishlisted ? Colors.error : Colors.textPrimary} />
        </Pressable>
        <Pressable style={s.iconBtn} onPress={() => router.push('/(tabs)/cart' as any)}>
          <MaterialIcons name="shopping-cart" size={22} color={Colors.textPrimary} />
          {totalItems > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{totalItems}</Text></View>}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>

        {/* Product Photo Gallery — height follows active image aspect ratio */}
        <View style={[s.gallery, { height: galleryHeight }]}>
          {allImages.length > 0 ? (
            <>
              <ScrollView
                ref={scrollRef}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / W))}
              >
                {fullGallery.map((url: string, i: number) => (
                  <View key={url || i} style={{ width: W, height: galleryHeight, justifyContent: 'center', alignItems: 'center' }}>
                    <AppImage
                      uri={url}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                      transition={200}
                      priority={i === activePhoto ? 'high' : 'low'}
                      onLoad={(e) => {
                        const src = e?.source;
                        if (src?.width && src?.height) {
                          handleHeroImageLoad(url, src.width, src.height);
                        }
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
              {disc > 0 && <View style={s.discBadge}><Text style={s.discTxt}>{disc}% OFF</Text></View>}
              {allImages.length > 1 && (
                <View style={s.dots}>
                  {allImages.map((_: any, i: number) => <View key={i} style={[s.dot, i === activePhoto && s.dotOn]} />)}
                </View>
              )}
            </>
          ) : (
            <View style={{ width: W, height: galleryHeight, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="image-not-supported" size={48} color={Colors.border} />
            </View>
          )}
        </View>

        {/* Gallery Thumbnails */}
        {allImages.length > 1 && (
          <View style={s.thumbRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm }}>
              {thumbGallery.map((url: string, i: number) => (
                <Pressable key={i} style={[s.thumb, i === activePhoto && s.thumbOn]}
                  onPress={() => { setActivePhoto(i); scrollRef.current?.scrollTo({ x: W * i, animated: true }); }}>
                  <AppImage uri={url} style={{ flex: 1 }} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Product Basic Info & Price */}
        <View style={s.card}>
          <Text style={s.brandCat}>{product.brand} · {product.category}</Text>
          <Text style={s.pName}>{product.name}</Text>
          
          <View style={s.ratingRow}>
            <View style={s.ratingBox}>
              <MaterialIcons name="star" size={12} color="#fff" />
              <Text style={s.ratingN}>{product.rating}</Text>
            </View>
            <Text style={s.reviews}>{product.reviews?.toLocaleString('en-IN')} Reviews</Text>
            <Text style={s.questionsCount}>· {product.questions?.length || 0} answered questions</Text>
          </View>

          <View style={s.priceRow}>
            <Text style={s.price}>₹{displayPrice.toLocaleString('en-IN')}</Text>
            {disc > 0 && <Text style={s.origPrice}>MRP ₹{displayOriginal.toLocaleString('en-IN')}</Text>}
            <Text style={s.taxNotice}>Inclusive of all taxes</Text>
          </View>

          <View style={s.metaRow}>
            <View style={[s.stockBadge, { backgroundColor: product.inStock ? '#DCFCE7' : '#FEE2E2' }]}>
              <MaterialIcons name={product.inStock ? 'check-circle' : 'cancel'} size={12} color={product.inStock ? Colors.success : Colors.error} />
              <Text style={{ fontSize: Fonts.xs, fontWeight: Fonts.bold, color: product.inStock ? Colors.success : Colors.error }}>
                {product.inStock ? `In Stock (${product.stockQuantity} available)` : 'Out of Stock'}
              </Text>
            </View>
            <Text style={s.skuText}>SKU: {displaySku}</Text>
          </View>

          {/* Delivery & Warranty Line */}
          <View style={s.deliveryRow}>
            <MaterialIcons name="local-shipping" size={16} color={Colors.primary} />
            <Text style={s.deliveryText}>Deliver to: <Text style={{ fontWeight: Fonts.bold }}>560001</Text> (Standard Delivery in 3-5 days)</Text>
          </View>
          <View style={s.warrantyRow}>
            <MaterialIcons name="verified-user" size={16} color={Colors.success} />
            <Text style={s.warrantyText}>{product.warrantyLabel || '1 Year Brand Warranty'}</Text>
          </View>
        </View>

        {/* Attribute Groups / Variants (Swatches & Chips) */}
        {attributeGroups.length > 0 && (
          <View style={s.card}>
            <Text style={s.secTitle}>Configuration & Variants</Text>
            {attributeGroups.map((group: any) => (
              <View key={group.key} style={s.attrGroup}>
                <Text style={s.attrLabel}>{group.label}: <Text style={{ color: Colors.primary, fontWeight: Fonts.bold }}>{selectedAttributes[group.key] || ''}</Text></Text>
                
                {group.type === 'swatch' ? (
                  <View style={s.swatchRow}>
                    {group.options.map((opt: any) => {
                      const sel = selectedAttributes[group.key] === opt.value;
                      return (
                        <Pressable key={opt.value}
                          style={[s.swatchBtn, sel && s.swatchBtnSel, opt.disabled && { opacity: 0.5 }]}
                          onPress={() => handleAttributeSelect(group.key, opt.value)}
                        >
                          <View style={[s.swatchCircle, { backgroundColor: opt.hex || '#CCCCCC' }]} />
                          <Text style={[s.swatchLabel, sel && { color: Colors.primary, fontWeight: Fonts.bold }]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={s.chipRow}>
                    {group.options.map((opt: any) => {
                      const sel = selectedAttributes[group.key] === opt.value;
                      return (
                        <Pressable key={opt.value}
                          style={[s.chipBtn, sel && s.chipBtnSel, opt.disabled && { opacity: 0.5 }]}
                          onPress={() => handleAttributeSelect(group.key, opt.value)}
                        >
                          <Text style={[s.chipLabel, sel && { color: Colors.primary, fontWeight: Fonts.bold }]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Key Specs Badges Grid */}
        {keySpecs.length > 0 && (
          <View style={s.card}>
            <Text style={s.secTitle}>Key Specifications</Text>
            <View style={s.keySpecsGrid}>
              {keySpecs.map((ks: any, idx: number) => (
                <View key={idx} style={s.keySpecCard}>
                  <MaterialIcons name={ks.icon === 'pi pi-mobile' ? 'smartphone' : ks.icon === 'pi pi-microchip' ? 'memory' : ks.icon === 'pi pi-camera' ? 'camera-alt' : ks.icon === 'pi pi-database' ? 'storage' : 'tune'} size={22} color={Colors.primary} />
                  <Text style={s.keySpecLabel}>{ks.label}</Text>
                  <Text style={s.keySpecValue} numberOfLines={1}>{ks.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trust Badges */}
        <View style={s.trustSection}>
          {TRUST_BADGES.map(b => (
            <View key={b.id} style={s.trustItem}>
              <MaterialIcons name={b.icon as any} size={20} color={Colors.primary} />
              <View>
                <Text style={s.trustTitle}>{b.title}</Text>
                <Text style={s.trustSub}>{b.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* EMI Plans Section */}
        {product.emiAvailable && emiPlans.length > 0 && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Text style={s.secTitle}>Pay in Easy EMIs</Text>
              <View style={s.emiAvailableBadge}>
                <MaterialIcons name="check-circle" size={12} color={Colors.success} />
                <Text style={{ fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.semiBold }}>0% Interest Available</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
              {emiPlans.map((plan: any) => {
                const sel = plan.months === (selectedPlanMonths ?? emiPlans[0]?.months);
                return (
                  <Pressable key={plan.months} style={[s.planCard, sel && s.planSel]}
                    onPress={() => setSelectedPlanMonths(plan.months)}>
                    <Text style={[s.planNum, sel && { color: Colors.primary }]}>{plan.months}</Text>
                    <Text style={[s.planMo, sel && { color: Colors.primary }]}>Months Plan</Text>
                    <View style={[s.planDiv, sel && { backgroundColor: Colors.primary + '30' }]} />
                    <Text style={[s.planEMI, sel && { color: Colors.primary }]}>
                      ₹{plan.monthlyEmi.toLocaleString('en-IN')}
                    </Text>
                    <Text style={[s.planPer, sel && { color: Colors.primary }]}>/month</Text>
                    <Text style={s.planDp}>Down Payment ₹{plan.downPaymentAmount.toLocaleString('en-IN')}</Text>
                    <View style={[s.selDot, sel && s.selDotOn]}>
                      {sel && <MaterialIcons name="check" size={11} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activePlan && (
              <View style={s.sumBox}>
                <Text style={s.sumTitle}>EMI Breakdown</Text>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Product Price</Text>
                  <Text style={s.sumVal}>₹{displayPrice.toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Down Payment</Text>
                  <Text style={[s.sumVal, { color: Colors.primary, fontWeight: Fonts.bold }]}>₹{(activePlan.downPaymentAmount ?? activePlan.downPayment).toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Service Charge</Text>
                  <Text style={s.sumVal}>₹{Number(activePlan.serviceCharge || 0).toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Delivery Charge</Text>
                  <Text style={s.sumVal}>₹{Number(activePlan.deliveryCharge || 0).toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Principal Amount</Text>
                  <Text style={s.sumVal}>₹{(activePlan.loanAmount ?? (displayPrice - (activePlan.downPaymentAmount ?? activePlan.downPayment))).toLocaleString('en-IN')}</Text>
                </View>
                <View style={s.sumRow}>
                  <Text style={s.sumLabel}>Monthly EMI × {activePlan.months} months</Text>
                  <Text style={[s.sumVal, { fontWeight: Fonts.bold }]}>₹{activePlan.monthlyEmi.toLocaleString('en-IN')}/mo</Text>
                </View>
                <View style={[s.sumRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 6, marginTop: 4 }]}>
                  <Text style={[s.sumLabel, { fontWeight: Fonts.bold, color: Colors.textPrimary }]}>Total Payable</Text>
                  <Text style={[s.sumVal, { fontWeight: Fonts.bold, color: Colors.primary, fontSize: Fonts.md }]}>₹{(activePlan.totalPayable ?? activePlan.grandTotal).toLocaleString('en-IN')}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Lower Content Tabs (Overview / Specs / Q&A / Returns) */}
        <View style={s.card}>
          <View style={s.tabHeader}>
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'specs', label: 'Specifications' },
              { key: 'qa', label: `Q&A (${product.questions?.length || 0})` },
              { key: 'returns', label: 'Returns' },
            ].map(tab => (
              <Pressable key={tab.key}
                style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
                onPress={() => setActiveTab(tab.key as any)}
              >
                <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>

          {activeTab === 'overview' && (
            <View style={s.tabPanel}>
              <Text style={s.overviewTitle}>{product.overviewTitle || product.name}</Text>
              <Text style={s.overviewBody}>{product.overviewBody || product.description}</Text>
              {product.overviewHighlights?.length > 0 && (
                <View style={s.highlightsBox}>
                  <Text style={s.highlightsTitle}>Highlights & Features</Text>
                  {product.overviewHighlights.map((pt: string, i: number) => (
                    <View key={i} style={s.bulletRow}>
                      <MaterialIcons name="check-circle" size={14} color={Colors.primary} />
                      <Text style={s.bulletTxt}>{pt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'specs' && (
            <View style={s.tabPanel}>
              {specificationRows.length > 0 ? (
                <View style={s.specsTable}>
                  {specificationRows.map((row: any, i: number) => (
                    <View key={i} style={[s.tableRow, i % 2 === 1 && { backgroundColor: Colors.surfaceAlt }]}>
                      <Text style={s.tableLabel}>{row.label}</Text>
                      <Text style={s.tableVal}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: Colors.textTertiary, padding: 10 }}>Standard specifications apply.</Text>
              )}
            </View>
          )}

          {activeTab === 'qa' && (
            <View style={s.tabPanel}>
              {product.questions?.length > 0 ? (
                product.questions.map((q: any) => (
                  <View key={q.id} style={s.qaCard}>
                    <Text style={s.qTxt}>Q. {q.question}</Text>
                    <Text style={s.aTxt}>A. {q.answer}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: Colors.textTertiary, padding: 10 }}>No questions asked yet.</Text>
              )}
            </View>
          )}

          {activeTab === 'returns' && (
            <View style={s.tabPanel}>
              {product.returnsPolicy?.map((item: string, i: number) => (
                <View key={i} style={s.bulletRow}>
                  <MaterialIcons name="verified" size={14} color={Colors.success} />
                  <Text style={s.bulletTxt}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Delivery Timeline Steps */}
        <View style={s.card}>
          <Text style={s.secTitle}>How Delivery Works</Text>
          <View style={s.stepsList}>
            {DELIVERY_STEPS.map((step, idx) => (
              <View key={step.id} style={s.stepRow}>
                <View style={s.stepIconCircle}>
                  <MaterialIcons name={step.icon as any} size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>{step.label}</Text>
                  <Text style={s.stepDesc}>{step.description}</Text>
                </View>
                {idx < DELIVERY_STEPS.length - 1 && (
                  <View style={s.stepLine} />
                )}
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + Spacing.xs }]}>
        <Pressable style={s.cartBtn}
          onPress={() => {
            addItem(product, 1, undefined, selectedVariant?.id, selectedVariant?.sellingPrice);
            router.push('/(tabs)/cart' as any);
          }}>
          <MaterialIcons name="shopping-cart" size={18} color={Colors.primary} />
          <Text style={s.cartBtnTxt}>Cart</Text>
        </Pressable>

        <Pressable style={s.buyBtn} onPress={handleBuyNow}>
          <MaterialIcons name="bolt" size={18} color="#fff" />
          <Text style={s.buyBtnTxt}>Buy Now</Text>
        </Pressable>

        {product.emiAvailable && emiPlans.length > 0 && (
          <Pressable style={s.emiBtn} onPress={handleApplyEMI}>
            <MaterialIcons name="account-balance" size={18} color="#fff" />
            <View>
              <Text style={s.emiBtnTxt}>Apply for EMI</Text>
              {activePlan && (
                <Text style={s.emiBtnSub}>↓ ₹{activePlan.downPaymentAmount.toLocaleString('en-IN')} today</Text>
              )}
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  badge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: Fonts.bold },
  gallery: { backgroundColor: Colors.surfaceAlt, position: 'relative', overflow: 'hidden' },
  discBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: Colors.error, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, zIndex: 10 },
  discTxt: { color: '#fff', fontSize: Fonts.xs, fontWeight: Fonts.bold },
  dots: { position: 'absolute', bottom: 10, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotOn: { backgroundColor: '#fff', width: 18 },
  thumbRow: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  thumb: { width: 56, height: 56, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 2, borderColor: Colors.borderLight },
  thumbOn: { borderColor: Colors.primary },
  card: { backgroundColor: Colors.surface, padding: Spacing.lg, marginBottom: 8 },
  brandCat: { fontSize: Fonts.xs, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: Fonts.medium },
  pName: { fontSize: 20, fontWeight: Fonts.bold, color: Colors.textPrimary, lineHeight: 26, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ratingN: { color: '#fff', fontSize: Fonts.xs, fontWeight: Fonts.bold },
  reviews: { fontSize: Fonts.xs, color: Colors.textSecondary, fontWeight: Fonts.medium },
  questionsCount: { fontSize: Fonts.xs, color: Colors.textTertiary },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: 12, flexWrap: 'wrap' },
  price: { fontSize: 26, fontWeight: Fonts.bold, color: Colors.textPrimary },
  origPrice: { fontSize: Fonts.md, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  taxNotice: { fontSize: Fonts.xs, color: Colors.textTertiary },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  skuText: { fontSize: Fonts.xs, color: Colors.textTertiary },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: Colors.surfaceAlt, padding: 10, borderRadius: Radius.sm },
  deliveryText: { fontSize: Fonts.xs, color: Colors.textSecondary, flex: 1 },
  warrantyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 4 },
  warrantyText: { fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.semiBold },
  secTitle: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  // Variant Swatches & Chips
  attrGroup: { marginBottom: 14 },
  attrLabel: { fontSize: Fonts.sm, color: Colors.textSecondary, marginBottom: 8 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surface },
  swatchBtnSel: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  swatchCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  swatchLabel: { fontSize: Fonts.xs, color: Colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipBtn: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.surface },
  chipBtnSel: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipLabel: { fontSize: Fonts.xs, color: Colors.textPrimary },
  // Key Specs Grid
  keySpecsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keySpecCard: { width: (W - 48) / 2, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 10, gap: 4 },
  keySpecLabel: { fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase' },
  keySpecValue: { fontSize: Fonts.sm, fontWeight: Fonts.bold, color: Colors.textPrimary },
  // Trust Section
  trustSection: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.surface, padding: Spacing.md, marginBottom: 8, gap: Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderLight },
  trustItem: { width: (W - 48) / 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustTitle: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.textPrimary },
  trustSub: { fontSize: 10, color: Colors.textTertiary },
  // EMI Plans
  emiAvailableBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  planCard: { width: 130, backgroundColor: Colors.surfaceAlt, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: Colors.borderLight },
  planSel: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  planNum: { fontSize: 26, fontWeight: Fonts.extraBold, color: Colors.textPrimary },
  planMo: { fontSize: 10, color: Colors.textTertiary, marginBottom: 6 },
  planDiv: { width: '100%', height: 1, backgroundColor: Colors.borderLight, marginBottom: 6 },
  planEMI: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  planPer: { fontSize: 10, color: Colors.textTertiary },
  planDp: { fontSize: 9, color: Colors.textSecondary, marginTop: 4, fontWeight: Fonts.medium },
  selDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Colors.border, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  selDotOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sumBox: { marginTop: 12, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, gap: 4 },
  sumTitle: { fontSize: Fonts.sm, fontWeight: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumLabel: { fontSize: Fonts.xs, color: Colors.textSecondary },
  sumVal: { fontSize: Fonts.xs, color: Colors.textPrimary },
  // Tabs
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: Spacing.md },
  tabItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: Fonts.xs, color: Colors.textTertiary, fontWeight: Fonts.medium },
  tabTextActive: { color: Colors.primary, fontWeight: Fonts.bold },
  tabPanel: { gap: 10 },
  overviewTitle: { fontSize: Fonts.md, fontWeight: Fonts.bold, color: Colors.textPrimary },
  overviewBody: { fontSize: Fonts.sm, color: Colors.textSecondary, lineHeight: 20 },
  highlightsBox: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, gap: 6, marginTop: 6 },
  highlightsTitle: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.textPrimary },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bulletTxt: { fontSize: Fonts.xs, color: Colors.textSecondary, flex: 1 },
  specsTable: { borderRadius: Radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight },
  tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tableLabel: { width: '40%', fontSize: Fonts.xs, color: Colors.textTertiary, fontWeight: Fonts.medium },
  tableVal: { width: '60%', fontSize: Fonts.xs, color: Colors.textPrimary, fontWeight: Fonts.semiBold },
  qaCard: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, padding: 10, gap: 4 },
  qTxt: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.textPrimary },
  aTxt: { fontSize: Fonts.xs, color: Colors.textSecondary, lineHeight: 18 },
  // Steps Timeline
  stepsList: { gap: 12, marginTop: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, position: 'relative' },
  stepIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.textPrimary },
  stepDesc: { fontSize: 10, color: Colors.textTertiary },
  stepLine: { position: 'absolute', left: 15, top: 32, width: 2, height: 16, backgroundColor: Colors.borderLight },
  // Sticky Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, flexDirection: 'row', gap: 8, padding: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight, ...Shadow.lg as object },
  cartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, paddingVertical: 10 },
  cartBtnTxt: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: Colors.primary },
  buyBtn: { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.success, borderRadius: 12, paddingVertical: 10 },
  buyBtnTxt: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: '#fff' },
  emiBtn: { flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10 },
  emiBtnTxt: { fontSize: Fonts.xs, fontWeight: Fonts.bold, color: '#fff' },
  emiBtnSub: { fontSize: 9, color: 'rgba(255,255,255,0.85)' },
});
