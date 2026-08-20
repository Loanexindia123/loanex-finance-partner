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
import { getMasterEntity } from '../data/masterEntities';
import { useMasterData } from '../context/MasterDataContext';
import { MasterStatus } from '../types/masterData';
import { MasterFormModal } from '../components/MasterFormModal';
import { MasterStatusBadge } from '../components/MasterStatusBadge';
import { isDealer } from '../../auth/rbacStore';
import {
  BrandFormFields,
  BrandFormState,
  DealerFormFields,
  DealerFormState,
  DeliveryPartnerFormFields,
  DeliveryPartnerFormState,
  DeliveryZoneFormFields,
  DeliveryZoneFormState,
  SupplierFormFields,
  SupplierFormState,
  WarehouseFormFields,
  WarehouseFormState,
  WholesalerFormFields,
  WholesalerFormState,
  emptyBrandForm,
  emptyDealerForm,
  emptyDeliveryPartnerForm,
  emptyDeliveryZoneForm,
  emptySupplierForm,
  emptyWarehouseForm,
  emptyWholesalerForm,
} from '../components/MasterEntityFormFields';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';
import { resolveMasterImageUri } from '../utils/resolveMasterImage';

type Props = NativeStackScreenProps<RootStackParamList, 'MasterList'>;

type ListItem = {
  id: string;
  name: string;
  status: MasterStatus;
  secondary?: string;
  tertiary?: string;
};

type FormState =
  | { entity: 'brands'; data: BrandFormState }
  | { entity: 'suppliers'; data: SupplierFormState }
  | { entity: 'dealers'; data: DealerFormState }
  | { entity: 'wholesalers'; data: WholesalerFormState }
  | { entity: 'warehouses'; data: WarehouseFormState }
  | { entity: 'deliveryPartners'; data: DeliveryPartnerFormState }
  | { entity: 'deliveryZones'; data: DeliveryZoneFormState };

export function MasterListScreen({ navigation, route }: Props) {
  const { entity } = route.params;
  const def = getMasterEntity(entity);
  const entityName = def?.entityName ?? 'Item';
  const title = def?.title ?? 'Masters';
  const master = useMasterData();

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const zoneOptions = useMemo(
    () => master.deliveryZones.filter((z) => z.status === 'active').map((z) => z.name),
    [master.deliveryZones],
  );

  const items: ListItem[] = useMemo(() => {
    switch (entity) {
      case 'brands':
        return master.brands.map((b) => ({
          id: b.id,
          name: b.name,
          status: b.status,
          secondary: b.description || undefined,
        }));
      case 'suppliers':
        return master.suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          secondary: s.contact || undefined,
          tertiary: s.email || undefined,
        }));
      case 'dealers':
        return master.dealers.map((d) => ({
          id: d.id,
          name: d.dealerName || d.name || 'Unknown Dealer',
          status: d.status,
          secondary: d.dealerCode || undefined,
          tertiary: d.mobile || d.email || undefined,
        }));
      case 'wholesalers':
        return master.wholesalers.map((w) => ({
          id: w.id,
          name: w.name,
          status: w.status,
          secondary: w.contactPerson || undefined,
          tertiary: w.phone || undefined,
        }));
      case 'warehouses':
        return master.warehouses.map((w) => ({
          id: w.id,
          name: w.name,
          status: w.status,
          secondary: w.location || undefined,
        }));
      case 'deliveryPartners':
        return master.deliveryPartners.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          secondary: p.contactPerson || undefined,
          tertiary:
            p.deliverySlaDays != null
              ? `SLA ${p.deliverySlaDays}d`
              : (p.serviceableZones || []).length
                ? `${(p.serviceableZones || []).length} zones`
                : undefined,
        }));
      case 'deliveryZones':
        return master.deliveryZones.map((z) => ({
          id: z.id,
          name: z.name,
          status: z.status,
          secondary: z.standardDeliveryDays
            ? `${z.standardDeliveryDays} days`
            : undefined,
          tertiary: z.pinCodes || undefined,
        }));
      default:
        return [];
    }
  }, [entity, master]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.secondary || '').toLowerCase().includes(q) ||
        (item.tertiary || '').toLowerCase().includes(q),
    );
  }, [items, search]);

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

  const openAdd = () => {
    setError('');
    switch (entity) {
      case 'brands':
        setForm({ entity: 'brands', data: emptyBrandForm() });
        break;
      case 'suppliers':
        setForm({ entity: 'suppliers', data: emptySupplierForm() });
        break;
      case 'dealers':
        setForm({ entity: 'dealers', data: emptyDealerForm() });
        break;
      case 'wholesalers':
        setForm({ entity: 'wholesalers', data: emptyWholesalerForm() });
        break;
      case 'warehouses':
        setForm({ entity: 'warehouses', data: emptyWarehouseForm() });
        break;
      case 'deliveryPartners':
        setForm({ entity: 'deliveryPartners', data: emptyDeliveryPartnerForm() });
        break;
      case 'deliveryZones':
        setForm({ entity: 'deliveryZones', data: emptyDeliveryZoneForm() });
        break;
    }
  };

  const openEdit = (id: string) => {
    setError('');
    switch (entity) {
      case 'brands': {
        const item = master.brands.find((b) => b.id === id);
        if (item) setForm({ entity: 'brands', data: { ...item } });
        break;
      }
      case 'suppliers': {
        const item = master.suppliers.find((s) => s.id === id);
        if (item) setForm({ entity: 'suppliers', data: { ...item } });
        break;
      }
      case 'dealers': {
        const item = master.dealers.find((d) => d.id === id);
        if (item) setForm({ entity: 'dealers', data: { ...item } });
        break;
      }
      case 'wholesalers': {
        const item = master.wholesalers.find((w) => w.id === id);
        if (item) setForm({ entity: 'wholesalers', data: { ...item } });
        break;
      }
      case 'warehouses': {
        const item = master.warehouses.find((w) => w.id === id);
        if (item) setForm({ entity: 'warehouses', data: { ...item } });
        break;
      }
      case 'deliveryPartners': {
        const item = master.deliveryPartners.find((p) => p.id === id);
        if (item) {
          setForm({
            entity: 'deliveryPartners',
            data: { ...item, serviceableZones: [...(item.serviceableZones || [])] },
          });
        }
        break;
      }
      case 'deliveryZones': {
        const item = master.deliveryZones.find((z) => z.id === id);
        if (item) setForm({ entity: 'deliveryZones', data: { ...item } });
        break;
      }
    }
  };

  const closeForm = () => {
    setForm(null);
    setError('');
  };

  const handleSave = async () => {
    if (!form || saving) return;
    if (!form.data.name?.trim()) {
      setError(`${entityName} name is required`);
      return;
    }

    setSaving(true);
    setError('');
    let ok = false;
    try {
      switch (form.entity) {
        case 'brands': {
          const logoUri = await resolveMasterImageUri(form.data.logoUri);
          ok = master.saveBrand({ ...form.data, logoUri });
          break;
        }
        case 'suppliers':
          ok = master.saveSupplier(form.data);
          break;
        case 'dealers':
          ok = master.saveDealer(form.data);
          break;
        case 'wholesalers':
          ok = master.saveWholesaler(form.data);
          break;
        case 'warehouses':
          ok = master.saveWarehouse(form.data);
          break;
        case 'deliveryPartners':
          ok = master.saveDeliveryPartner(form.data);
          break;
        case 'deliveryZones':
          ok = master.saveDeliveryZone(form.data);
          break;
      }
    } catch (err) {
      console.warn('Failed to save master item:', err);
      setError('Failed to upload image. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);

    if (!ok) {
      setError(`This ${entityName.toLowerCase()} already exists or is invalid`);
      return;
    }
    closeForm();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(`Delete ${entityName}?`, `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          switch (entity) {
            case 'brands':
              master.deleteBrand(id);
              break;
            case 'suppliers':
              master.deleteSupplier(id);
              break;
            case 'dealers':
              master.deleteDealer(id);
              break;
            case 'wholesalers':
              master.deleteWholesaler(id);
              break;
            case 'warehouses':
              master.deleteWarehouse(id);
              break;
            case 'deliveryPartners':
              master.deleteDeliveryPartner(id);
              break;
            case 'deliveryZones':
              master.deleteDeliveryZone(id);
              break;
          }
        },
      },
    ]);
  };

  const formTitle = form?.data.id ? `Edit ${entityName}` : `Add ${entityName}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeaderBlock}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${title.toLowerCase()}`}
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <View style={styles.listHeader}>
              <Text style={styles.subtitle}>
                {filteredItems.length} {title.toLowerCase()}
              </Text>
              <Button title={`+ Add ${entityName}`} onPress={openAdd} variant="accent" size="sm" />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Text style={styles.empty}>
              {search.trim()
                ? `No ${title.toLowerCase()} match your search.`
                : `No ${title.toLowerCase()} yet. Add one to get started.`}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.rowCard}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <View style={styles.nameRow}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <MasterStatusBadge status={item.status} />
                </View>
                {!!item.secondary && (
                  <Text style={styles.secondary} numberOfLines={1}>
                    {item.secondary}
                  </Text>
                )}
                {!!item.tertiary && (
                  <Text style={styles.tertiary} numberOfLines={1}>
                    {item.tertiary}
                  </Text>
                )}
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEdit(item.id)} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={20} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.name)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
      />

      <MasterFormModal
        visible={!!form}
        title={formTitle}
        onClose={closeForm}
        onSave={handleSave}
        saveDisabled={saving}
      >
        {form?.entity === 'brands' && (
          <BrandFormFields
            value={form.data}
            onChange={(data) => {
              setForm({ entity: 'brands', data });
              setError('');
            }}
            error={error}
          />
        )}
        {form?.entity === 'suppliers' && (
          <SupplierFormFields
            value={form.data}
            onChange={(data) => {
              setForm({ entity: 'suppliers', data });
              setError('');
            }}
            error={error}
          />
        )}
        {form?.entity === 'dealers' && (
          <DealerFormFields
            value={form.data}
            onChange={(data) => {
              setForm({ entity: 'dealers', data });
              setError('');
            }}
            error={error}
          />
        )}
        {form?.entity === 'wholesalers' && (
          <WholesalerFormFields
            value={form.data}
            onChange={(data) => {
              setForm({ entity: 'wholesalers', data });
              setError('');
            }}
            error={error}
          />
        )}
        {form?.entity === 'warehouses' && (
          <WarehouseFormFields
            value={form.data}
            onChange={(data) => {
              setForm({ entity: 'warehouses', data });
              setError('');
            }}
            error={error}
          />
        )}
        {form?.entity === 'deliveryPartners' && (
          <DeliveryPartnerFormFields
            value={form.data}
            zoneOptions={zoneOptions}
            onChange={(data) => {
              setForm({ entity: 'deliveryPartners', data });
              setError('');
            }}
            error={error}
          />
        )}
        {form?.entity === 'deliveryZones' && (
          <DeliveryZoneFormFields
            value={form.data}
            onChange={(data) => {
              setForm({ entity: 'deliveryZones', data });
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
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  listHeaderBlock: { marginBottom: spacing.md },
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
    gap: spacing.md,
  },
  subtitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rowCard: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  rowLabel: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  secondary: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  tertiary: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.sm },
  emptyCard: { marginTop: spacing.sm },
  empty: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
});
