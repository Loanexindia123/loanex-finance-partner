import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useProductTypes,
  loadProductTypes,
} from '../../products/data/productTypeStore';
import { MasterFormModal } from '../../../settings/components/MasterFormModal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductTypesMaster'>;

export function ProductTypesMasterScreen({ navigation }: Props) {
  const {
    productTypes,
    loading,
    error: loadError,
    addProductType,
    renameProductType,
    deleteProductType,
    reload,
  } = useProductTypes();

  const [search, setSearch] = useState('');
  const [formName, setFormName] = useState('');
  const [editingFrom, setEditingFrom] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      void loadProductTypes();
    }, []),
  );

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('DealerTabs', { screen: 'Masters' });
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productTypes;
    return productTypes.filter((name) => name.toLowerCase().includes(q));
  }, [productTypes, search]);

  const openAdd = () => {
    setEditingFrom(null);
    setFormName('');
    setError('');
    setFormOpen(true);
  };

  const openEdit = (name: string) => {
    setEditingFrom(name);
    setFormName(name);
    setError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingFrom(null);
    setFormName('');
    setError('');
  };

  const handleSave = () => {
    const trimmed = formName.trim();
    if (!trimmed) {
      setError('Product type name is required');
      return;
    }
    const ok = editingFrom
      ? renameProductType(editingFrom, trimmed)
      : addProductType(trimmed);
    if (!ok) {
      setError('This product type already exists or is invalid');
      return;
    }
    closeForm();
  };

  const handleDelete = (name: string) => {
    Alert.alert('Delete Product Type?', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteProductType(name),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Types</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search product types"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.subtitle}>
                {loading ? 'Loading…' : `${filtered.length} type${filtered.length === 1 ? '' : 's'}`}
              </Text>
              <Button title="+ Add Product Type" onPress={openAdd} variant="accent" size="sm" />
            </View>
            {loadError ? (
              <Text style={styles.warn}>
                {loadError}{' '}
                <Text style={styles.link} onPress={() => void reload()}>
                  Retry
                </Text>
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Text style={styles.empty}>
              {search.trim()
                ? 'No product types match your search.'
                : 'No product types yet. Add one to get started.'}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>{item}</Text>
              <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={20} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
      />

      <MasterFormModal
        visible={formOpen}
        title={editingFrom ? 'Edit Product Type' : 'Add Product Type'}
        onClose={closeForm}
        onSave={handleSave}
      >
        <Input
          label="Product Type Name"
          required
          placeholder="e.g. Smartphone"
          value={formName}
          onChangeText={(v) => {
            setFormName(v);
            setError('');
          }}
          error={error}
        />
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
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  listHeader: { marginBottom: spacing.md },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subtitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  warn: { fontSize: 12, color: colors.danger, marginTop: spacing.sm },
  link: { color: colors.secondary, fontWeight: '700' },
  emptyCard: { marginTop: spacing.sm },
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  itemCard: { marginBottom: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  itemName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textHeading },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
