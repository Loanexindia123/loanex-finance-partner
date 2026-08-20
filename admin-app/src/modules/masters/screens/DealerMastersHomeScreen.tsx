import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { DealerTabParamList, RootStackParamList } from '../../../navigation/types';

type MasterCard = {
  id: 'categories' | 'brands' | 'productTypes';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CARDS: MasterCard[] = [
  {
    id: 'categories',
    title: 'Categories',
    description: 'Search, add, and edit product categories',
    icon: 'folder-outline',
  },
  {
    id: 'brands',
    title: 'Brands',
    description: 'Search, add, and edit brands',
    icon: 'pricetag-outline',
  },
  {
    id: 'productTypes',
    title: 'Product Types',
    description: 'Search, add, and edit product types',
    icon: 'shapes-outline',
  },
];

type MastersNav = CompositeNavigationProp<
  BottomTabNavigationProp<DealerTabParamList, 'Masters'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DealerMastersHomeScreen() {
  const navigation = useNavigation<MastersNav>();

  const openCard = (id: MasterCard['id']) => {
    if (id === 'categories') {
      navigation.navigate('CategoriesMaster');
      return;
    }
    if (id === 'brands') {
      navigation.navigate('MasterList', { entity: 'brands' });
      return;
    }
    navigation.navigate('ProductTypesMaster');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Masters</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Manage catalogue options used in Product Add. Add missing values here, then return to the
          product wizard.
        </Text>

        {CARDS.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.75} onPress={() => openCard(item.id)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textHeading },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  card: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
