import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { ProductCard } from '../../components/feature/ProductCard';
import { AppImage } from '../../components/ui/AppImage';
import { useAuth } from '../../hooks/useAuth';
import { getCategories } from '../../services/categoryService';
import { getProducts } from '../../services/productService';
import { getBanners } from '../../services/bannerService';
import { getUnreadCount } from '../../services/notificationService';
import { prefetchMediaUrls, withMediaSize } from '../../utils/mediaUrl';
import { Banner as BannerType, Category, Product } from '../../types';

const W = Dimensions.get('window').width;

const FALLBACK_BANNERS: BannerType[] = [
  { id: 'fb-1', title: 'Biggest Electronics Sale', subtitle: 'Up to 40% off premium gadgets', badgeText: '0% EMI Available', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80', isActive: true, position: 1, createdAt: '' },
  { id: 'fb-2', title: 'Fashion Forward', subtitle: 'New arrivals, fresh styles this season', badgeText: 'Flat 30% off', imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80', isActive: true, position: 2, createdAt: '' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count when the home tab is focused
  useFocusEffect(useCallback(() => {
    if (user) {
      getUnreadCount(user.id).then(setUnreadCount);
    }
  }, [user]));

  useEffect(() => {
    // One GET /products for all home sections (aliases previously each re-fetched the same list).
    Promise.all([
      getCategories().catch(() => [] as Category[]),
      getProducts().catch(() => [] as Product[]),
      getBanners().catch(() => [] as BannerType[]),
    ]).then(([cats, products, b]) => {
      const bannerList = b.length ? b : FALLBACK_BANNERS;
      setCategories(cats);
      setFeatured(products);
      setDeals(products.slice(0, 3));
      setBanners(bannerList);
      setTrending(products);
      setRecommended(products);
      setNewArrivals(products);
      // Warm disk+memory cache once so duplicate home sections / later screens reuse bytes.
      prefetchMediaUrls([
        ...bannerList.map((banner) => withMediaSize(banner.imageUrl, 'banner')),
        ...products.map((product) => withMediaSize(product.image, 'card')),
      ]);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'User'}</Text>
          <Text style={styles.subGreet}>What are you shopping for today?</Text>
        </View>
        <Pressable style={styles.notifBtn} onPress={() => router.push('/notifications' as any)}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
        <MaterialIcons name="search" size={20} color={Colors.textTertiary} />
        <Text style={styles.searchPlaceholder}>Search phones, TVs, fashion...</Text>
        <MaterialIcons name="tune" size={18} color={Colors.textTertiary} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: 195 }}>
          {(banners.length ? banners : []).map((b, index) => (
            <View key={b.id} style={[styles.banner, { width: W }]}>
              <AppImage
                uri={withMediaSize(
                  b.imageUrl || 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80',
                  'banner',
                )}
                style={styles.bannerImg}
                contentFit="cover"
                transition={300}
                priority={index === 0 ? 'high' : 'normal'}
              />
              <View style={styles.bannerOverlay} />
              <View style={styles.bannerContent}>
                {b.badgeText ? <View style={styles.bannerBadge}><Text style={styles.bannerBadgeTxt}>{b.badgeText}</Text></View> : null}
                <Text style={styles.bannerTitle}>{b.title}</Text>
                {b.subtitle ? <Text style={styles.bannerSub}>{b.subtitle}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.emiStrip}>
          <MaterialIcons name="account-balance" size={15} color={Colors.success} />
          <Text style={styles.emiStripTxt}>Easy EMI from 0% interest · No paperwork required</Text>
          <MaterialIcons name="chevron-right" size={15} color={Colors.success} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Pressable onPress={() => router.push('/(tabs)/categories')}><Text style={styles.seeAll}>See all</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.lg }}>
            {(loading ? [] : categories).map(cat => (
              <Pressable key={cat.id} style={styles.catChip} onPress={() => router.push({ pathname: '/search', params: { category: cat.name } })}>
                <View style={[styles.catIcon, { backgroundColor: cat.bgColor }]}>
                  <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                </View>
                <Text style={styles.catLabel}>{cat.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>EMI Deals</Text>
            <Pressable onPress={() => router.push('/search?emiOnly=true')}>
              <View style={styles.emiBadgeSmall}><Text style={styles.emiBadgeTxt}>0% interest</Text></View>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.xl }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
              {featured.map(p => <ProductCard key={p.id} product={p} />)}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>Deal of the Day</Text>
            <Pressable onPress={() => router.push('/search?sort=discount')}><Text style={styles.seeAll}>View all</Text></Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.xl }} />
          ) : (
            deals.map(p => <ProductCard key={p.id} product={p} horizontal />)
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>Trending Products</Text>
            <Pressable onPress={() => router.push('/search?sort=rating')}><Text style={styles.seeAll}>See all</Text></Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.xl }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
              {trending.map(p => <ProductCard key={p.id} product={p} />)}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>Recommended For You</Text>
            <Pressable onPress={() => router.push('/search')}><Text style={styles.seeAll}>See all</Text></Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.xl }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
              {recommended.map(p => <ProductCard key={p.id} product={p} />)}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHdr}>
            <Text style={styles.sectionTitle}>New Arrivals</Text>
            <Pressable onPress={() => router.push('/search?sort=newest')}><Text style={styles.seeAll}>See all</Text></Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.xl }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
              {newArrivals.map(p => <ProductCard key={p.id} product={p} />)}
            </ScrollView>
          )}
        </View>

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  greeting: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: Colors.textPrimary },
  subGreet: { fontSize: Fonts.sm, color: Colors.textSecondary, marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.background },
  notifBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: Fonts.bold },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.full, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm, ...Shadow.sm },
  searchPlaceholder: { flex: 1, fontSize: Fonts.md, color: Colors.textTertiary },
  banner: { height: 195, position: 'relative' },
  bannerImg: { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  bannerContent: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl },
  bannerBadge: { backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, marginBottom: 6 },
  bannerBadgeTxt: { color: '#fff', fontSize: Fonts.xs, fontWeight: Fonts.semiBold },
  bannerTitle: { fontSize: Fonts.xl, fontWeight: Fonts.bold, color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: Fonts.sm, color: 'rgba(255,255,255,0.8)' },
  emiStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.successLight, paddingHorizontal: Spacing.lg, paddingVertical: 10, marginHorizontal: Spacing.lg, borderRadius: Radius.md, marginVertical: Spacing.md, gap: Spacing.xs },
  emiStripTxt: { flex: 1, fontSize: Fonts.sm, color: Colors.success, fontWeight: Fonts.medium },
  section: { marginBottom: Spacing.xl },
  sectionHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: Fonts.lg, fontWeight: Fonts.bold, color: Colors.textPrimary },
  seeAll: { fontSize: Fonts.sm, color: Colors.primary, fontWeight: Fonts.medium },
  emiBadgeSmall: { backgroundColor: Colors.successLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  emiBadgeTxt: { fontSize: Fonts.xs, color: Colors.success, fontWeight: Fonts.semiBold },
  catChip: { alignItems: 'center', gap: Spacing.xs },
  catIcon: { width: 58, height: 58, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: Fonts.xs, color: Colors.textSecondary, fontWeight: Fonts.medium, textAlign: 'center', maxWidth: 58 },
});
