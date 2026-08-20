import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMasterData } from '../context/MasterDataContext';
import { CategoryMaster } from '../types/masterData';
import { MasterFormModal } from '../components/MasterFormModal';
import { MasterStatusBadge } from '../components/MasterStatusBadge';
import {
  CategoryFormFields,
  CategoryFormState,
  emptyCategoryForm,
} from '../components/MasterEntityFormFields';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';
import { isDealer } from '../../auth/rbacStore';
import { resolveMasterImageUri } from '../utils/resolveMasterImage';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoriesMaster'>;

export function CategoriesMasterScreen({ navigation }: Props) {
  const { categories, saveCategory, deleteCategory } = useMasterData();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const topLevel = useMemo(() => {
    return categories
      .filter((c) => !c.parentId)
      .sort(
        (a, b) =>
          (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name),
      );
  }, [categories]);

  const childrenOf = useCallback(
    (parentId: string) =>
      categories
        .filter((c) => c.parentId === parentId)
        .sort(
          (a, b) =>
            (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name),
        ),
    [categories],
  );

  const filteredTopLevel = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topLevel;
    return topLevel.filter((category) => {
      if (category.name.toLowerCase().includes(q)) return true;
      return childrenOf(category.id).some((sub) => sub.name.toLowerCase().includes(q));
    });
  }, [topLevel, search, childrenOf]);

  const parentOptions = useMemo(() => {
    return topLevel
      .filter((c) => c.id !== form?.id)
      .map((c) => ({ id: c.id, name: c.name }));
  }, [topLevel, form?.id]);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (isDealer()) {
      navigation.navigate('DealerTabs', { screen: 'Masters' });
      return;
    }
    navigation.navigate('MastersHome');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleGoBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleGoBack]),
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openAdd = (parentId: string | null = null) => {
    if (parentId) setExpanded((prev) => ({ ...prev, [parentId]: true }));
    setForm(emptyCategoryForm(parentId));
    setError('');
  };

  const openEdit = (item: CategoryMaster) => {
    setForm({ ...item });
    setError('');
  };

  const closeForm = () => {
    setForm(null);
    setError('');
  };

  const handleSave = async () => {
    if (!form || saving) return;
    if (!form.name.trim()) {
      setError('Category name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const imageUri = await resolveMasterImageUri(form.imageUri);
      const ok = saveCategory({ ...form, imageUri });
      if (!ok) {
        setError('This category already exists under the selected parent, or is invalid');
        setSaving(false);
        return;
      }
      closeForm();
    } catch (err) {
      console.warn('Failed to save category:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item: CategoryMaster) => {
    const kids = childrenOf(item.id);
    Alert.alert(
      'Delete Category?',
      kids.length > 0
        ? `Delete "${item.name}" and its ${kids.length} sub categor${kids.length === 1 ? 'y' : 'ies'}?`
        : `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(item.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categories</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.subtitle}>
            {filteredTopLevel.length} categor{filteredTopLevel.length === 1 ? 'y' : 'ies'}
          </Text>
          <Button title="+ Add Category" onPress={() => openAdd(null)} variant="accent" size="sm" />
        </View>

        {filteredTopLevel.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.empty}>
              {search.trim()
                ? 'No categories match your search.'
                : 'No categories yet. Add one to get started.'}
            </Text>
          </Card>
        ) : (
          filteredTopLevel.map((category) => {
            const subs = childrenOf(category.id);
            const isOpen = !!expanded[category.id] || !!search.trim();

            return (
              <Card key={category.id} style={styles.categoryCard}>
                <View style={styles.categoryRow}>
                  <TouchableOpacity
                    style={styles.categoryMain}
                    onPress={() => toggleExpand(category.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isOpen ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={colors.textMuted}
                    />
                    <View style={styles.categoryText}>
                      <View style={styles.nameRow}>
                        <Text style={styles.categoryTitle}>{category.name}</Text>
                        <MasterStatusBadge status={category.status} />
                      </View>
                      <Text style={styles.categoryMeta}>
                        {subs.length} sub categor{subs.length === 1 ? 'y' : 'ies'}
                        {category.displayOrder != null
                          ? ` · Order ${category.displayOrder}`
                          : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => openEdit(category)} style={styles.iconBtn}>
                      <Ionicons name="create-outline" size={20} color={colors.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(category)}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {isOpen && (
                  <View style={styles.subList}>
                    {subs.map((sub) => (
                      <View key={sub.id} style={styles.subRow}>
                        <View style={styles.subText}>
                          <View style={styles.nameRow}>
                            <Text style={styles.subLabel} numberOfLines={1}>
                              {sub.name}
                            </Text>
                            <MasterStatusBadge status={sub.status} />
                          </View>
                          {sub.displayOrder != null && (
                            <Text style={styles.subMeta}>Order {sub.displayOrder}</Text>
                          )}
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity
                            onPress={() => openEdit(sub)}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="create-outline" size={18} color={colors.secondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmDelete(sub)}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {subs.length === 0 && (
                      <Text style={styles.emptySub}>No sub categories yet</Text>
                    )}
                    <TouchableOpacity
                      style={styles.addSubBtn}
                      onPress={() => openAdd(category.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addSubText}>+ Add Sub Category</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <MasterFormModal
        visible={!!form}
        title={form?.id ? 'Edit Category' : 'Add Category'}
        onClose={closeForm}
        onSave={handleSave}
        saveDisabled={saving}
      >
        {form && (
          <CategoryFormFields
            value={form}
            parentOptions={parentOptions}
            onChange={(next) => {
              setForm(next);
              setError('');
            }}
            error={error}
          />
        )}
      </MasterFormModal>
    </SafeAreaView>
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
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textHeading },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  subtitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyCard: { marginBottom: spacing.md },
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  categoryCard: { marginBottom: spacing.md },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  categoryText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  categoryTitle: { fontSize: 16, fontWeight: '700', color: colors.textHeading },
  categoryMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  subList: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingLeft: spacing.lg,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  subText: { flex: 1 },
  subLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  subMeta: { fontSize: 11, color: colors.textMuted },
  emptySub: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm },
  addSubBtn: { paddingVertical: spacing.sm },
  addSubText: { fontSize: 13, fontWeight: '700', color: colors.secondary },
});
