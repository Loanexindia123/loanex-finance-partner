import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Input } from '../../components/ui/Input';
import { Dropdown } from '../../components/ui/Dropdown';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { ImagePlaceholder } from '../../components/ui/ImagePlaceholder';
import { MultiSelectChips } from './MultiSelectChips';
import {
  BrandMaster,
  CategoryMaster,
  DealerMaster,
  DeliveryPartnerMaster,
  DeliveryZoneMaster,
  BranchMaster,
  PincodeMaster,
  MasterStatus,
  SupplierMaster,
  WarehouseMaster,
  WholesalerMaster,
} from '../types/masterData';
import { PAYMENT_TERMS, SETTLEMENT_CYCLES } from '../../modules/products/data/constants';
import { pickProductImage } from '../../modules/products/utils/pickProductImage';
import {
  clearPendingImage,
  isLocalPendingImageUri,
} from '../../modules/products/utils/pendingImages';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

async function pickAndReplaceImage(
  previousUri: string | undefined,
  onPicked: (uri: string) => void,
): Promise<void> {
  const file = await pickProductImage();
  if (!file) return;
  if (previousUri && isLocalPendingImageUri(previousUri)) {
    clearPendingImage(previousUri);
  }
  onPicked(file.uri);
}

function StatusToggle({
  status,
  onChange,
  descriptionActive = 'Visible in product wizard dropdowns',
  descriptionInactive = 'Hidden from product wizard dropdowns',
}: {
  status: MasterStatus;
  onChange: (status: MasterStatus) => void;
  descriptionActive?: string;
  descriptionInactive?: string;
}) {
  return (
    <ToggleSwitch
      label="Status"
      description={status === 'active' ? descriptionActive : descriptionInactive}
      value={status === 'active'}
      onValueChange={(v) => onChange(v ? 'active' : 'inactive')}
    />
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// —— Brand ——
export type BrandFormState = Omit<BrandMaster, 'id'> & { id?: string };

export function emptyBrandForm(): BrandFormState {
  return { name: '', logoUri: '', description: '', status: 'active' };
}

export function BrandFormFields({
  value,
  onChange,
  error,
}: {
  value: BrandFormState;
  onChange: (next: BrandFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Brand Name"
        required
        placeholder="Enter brand name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <FieldLabel>Logo / Image</FieldLabel>
      <ImagePlaceholder
        size="md"
        label="Logo"
        subtitle={
          value.logoUri && isLocalPendingImageUri(value.logoUri)
            ? 'Selected — uploads on save'
            : 'Tap to upload'
        }
        imageUri={value.logoUri || null}
        onPress={() => {
          void pickAndReplaceImage(value.logoUri, (logoUri) =>
            onChange({ ...value, logoUri }),
          );
        }}
        style={styles.image}
      />
      <Input
        label="Description"
        placeholder="Optional description"
        value={value.description || ''}
        onChangeText={(description) => onChange({ ...value, description })}
        multiline
        numberOfLines={3}
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Supplier ——
export type SupplierFormState = Omit<SupplierMaster, 'id'> & { id?: string };

export function emptySupplierForm(): SupplierFormState {
  return {
    name: '',
    contact: '',
    email: '',
    status: 'active',
  };
}

export function SupplierFormFields({
  value,
  onChange,
  error,
}: {
  value: SupplierFormState;
  onChange: (next: SupplierFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Supplier Name"
        required
        placeholder="Enter supplier name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Input
        label="Contact Number"
        placeholder="Contact number"
        value={value.contact || ''}
        onChangeText={(contact) => onChange({ ...value, contact })}
        keyboardType="phone-pad"
      />
      <Input
        label="Email"
        placeholder="Email address"
        value={value.email || ''}
        onChangeText={(email) => onChange({ ...value, email })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Dealer ——
export type DealerFormState = Omit<DealerMaster, 'id'> & { id?: string };

export function emptyDealerForm(): DealerFormState {
  return {
    dealerCode: '',
    dealerName: '',
    name: '',
    mobile: '',
    email: '',
    status: 'active',
  };
}

export function DealerFormFields({
  value,
  onChange,
  error,
}: {
  value: DealerFormState;
  onChange: (next: DealerFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Dealer Code"
        required
        placeholder="Enter dealer code"
        value={value.dealerCode || ''}
        onChangeText={(dealerCode) => onChange({ ...value, dealerCode, name: dealerCode })} // Map name to dealerCode just for backwards compatibility if needed
        error={error}
      />
      <Input
        label="Dealer Name"
        required
        placeholder="Enter dealer name"
        value={value.dealerName || ''}
        onChangeText={(dealerName) => onChange({ ...value, dealerName })}
      />
      <Input
        label="Mobile Number"
        placeholder="Mobile number"
        value={value.mobile || ''}
        onChangeText={(mobile) => onChange({ ...value, mobile })}
        keyboardType="phone-pad"
      />
      <Input
        label="Email"
        placeholder="Email address"
        value={value.email || ''}
        onChangeText={(email) => onChange({ ...value, email })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Wholesaler ——
export type WholesalerFormState = Omit<WholesalerMaster, 'id'> & { id?: string };

export function emptyWholesalerForm(): WholesalerFormState {
  return {
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    status: 'active',
  };
}

export function WholesalerFormFields({
  value,
  onChange,
  error,
}: {
  value: WholesalerFormState;
  onChange: (next: WholesalerFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Wholesaler Name"
        required
        placeholder="Enter wholesaler name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Input
        label="Contact Person"
        placeholder="Contact person name"
        value={value.contactPerson || ''}
        onChangeText={(contactPerson) => onChange({ ...value, contactPerson })}
      />
      <Input
        label="Phone Number"
        placeholder="Phone number"
        value={value.phone || ''}
        onChangeText={(phone) => onChange({ ...value, phone })}
        keyboardType="phone-pad"
      />
      <Input
        label="Email"
        placeholder="Email address"
        value={value.email || ''}
        onChangeText={(email) => onChange({ ...value, email })}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="GSTIN"
        placeholder="GSTIN"
        value={value.gstin || ''}
        onChangeText={(gstin) => onChange({ ...value, gstin })}
        autoCapitalize="characters"
      />
      <Input
        label="Address"
        placeholder="Address"
        value={value.address || ''}
        onChangeText={(address) => onChange({ ...value, address })}
        multiline
        numberOfLines={3}
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Warehouse ——
export type WarehouseFormState = Omit<WarehouseMaster, 'id'> & { id?: string };

export function emptyWarehouseForm(): WarehouseFormState {
  return {
    name: '',
    location: '',
    status: 'active',
  };
}

export function WarehouseFormFields({
  value,
  onChange,
  error,
}: {
  value: WarehouseFormState;
  onChange: (next: WarehouseFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Warehouse Name"
        required
        placeholder="Enter warehouse name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Input
        label="Location"
        placeholder="Location"
        value={value.location || ''}
        onChangeText={(location) => onChange({ ...value, location })}
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Delivery Partner ——
export type DeliveryPartnerFormState = Omit<DeliveryPartnerMaster, 'id'> & { id?: string };

export function emptyDeliveryPartnerForm(): DeliveryPartnerFormState {
  return {
    name: '',
    contactPerson: '',
    phone: '',
    serviceableZones: [],
    deliverySlaDays: undefined,
    status: 'active',
  };
}

export function DeliveryPartnerFormFields({
  value,
  onChange,
  error,
  zoneOptions,
}: {
  value: DeliveryPartnerFormState;
  onChange: (next: DeliveryPartnerFormState) => void;
  error?: string;
  zoneOptions: string[];
}) {
  return (
    <View>
      <Input
        label="Partner Name"
        required
        placeholder="Enter partner name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Input
        label="Contact Person"
        placeholder="Contact person name"
        value={value.contactPerson || ''}
        onChangeText={(contactPerson) => onChange({ ...value, contactPerson })}
      />
      <Input
        label="Phone Number"
        placeholder="Phone number"
        value={value.phone || ''}
        onChangeText={(phone) => onChange({ ...value, phone })}
        keyboardType="phone-pad"
      />
      <MultiSelectChips
        label="Serviceable Zones"
        options={zoneOptions}
        value={value.serviceableZones || []}
        onChange={(serviceableZones) => onChange({ ...value, serviceableZones })}
        emptyHint="Add delivery zones in Masters first"
      />
      <Input
        label="Delivery SLA (days)"
        placeholder="e.g. 3"
        value={value.deliverySlaDays != null ? String(value.deliverySlaDays) : ''}
        onChangeText={(v) =>
          onChange({
            ...value,
            deliverySlaDays: v.trim() === '' ? undefined : Number(v) || 0,
          })
        }
        keyboardType="numeric"
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Delivery Zone ——
export type DeliveryZoneFormState = Omit<DeliveryZoneMaster, 'id'> & { id?: string };

export function emptyDeliveryZoneForm(): DeliveryZoneFormState {
  return {
    name: '',
    pinCodes: '',
    standardDeliveryDays: '',
    status: 'active',
  };
}

export function DeliveryZoneFormFields({
  value,
  onChange,
  error,
}: {
  value: DeliveryZoneFormState;
  onChange: (next: DeliveryZoneFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Zone Name"
        required
        placeholder="Enter zone name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Input
        label="Pin Codes Covered"
        placeholder="560001, 560002, 110001"
        value={value.pinCodes || ''}
        onChangeText={(pinCodes) => onChange({ ...value, pinCodes })}
        hint="Comma-separated pin codes"
      />
      <Input
        label="Standard Delivery Days"
        placeholder='e.g. "3-5"'
        value={value.standardDeliveryDays || ''}
        onChangeText={(standardDeliveryDays) =>
          onChange({ ...value, standardDeliveryDays })
        }
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Category (used by CategoriesMasterScreen) ——
export type CategoryFormState = Omit<CategoryMaster, 'id'> & { id?: string };

export function emptyCategoryForm(parentId: string | null = null): CategoryFormState {
  return {
    name: '',
    parentId,
    imageUri: '',
    displayOrder: undefined,
    status: 'active',
  };
}

export function CategoryFormFields({
  value,
  onChange,
  error,
  parentOptions,
}: {
  value: CategoryFormState;
  onChange: (next: CategoryFormState) => void;
  error?: string;
  /** Top-level category options: { id, name } — exclude self when editing */
  parentOptions: { id: string; name: string }[];
}) {
  const NONE_PARENT = 'None (top-level)';
  const parentValue =
    value.parentId == null
      ? NONE_PARENT
      : parentOptions.find((p) => p.id === value.parentId)?.name || NONE_PARENT;

  return (
    <View>
      <Input
        label="Category Name"
        required
        placeholder="Enter category name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Dropdown
        label="Parent Category"
        placeholder="None (top-level category)"
        value={parentValue}
        options={[NONE_PARENT, ...parentOptions.map((p) => p.name)]}
        onSelect={(selected) => {
          if (selected === NONE_PARENT) {
            onChange({ ...value, parentId: null });
            return;
          }
          const parent = parentOptions.find((p) => p.name === selected);
          onChange({ ...value, parentId: parent?.id ?? null });
        }}
      />
      <FieldLabel>Icon / Image</FieldLabel>
      <ImagePlaceholder
        size="md"
        label="Icon"
        subtitle={
          value.imageUri && isLocalPendingImageUri(value.imageUri)
            ? 'Selected — uploads on save'
            : 'Tap to upload'
        }
        imageUri={value.imageUri || null}
        onPress={() => {
          void pickAndReplaceImage(value.imageUri, (imageUri) =>
            onChange({ ...value, imageUri }),
          );
        }}
        style={styles.image}
      />
      <Input
        label="Display Order"
        placeholder="e.g. 1"
        value={value.displayOrder != null ? String(value.displayOrder) : ''}
        onChangeText={(v) =>
          onChange({
            ...value,
            displayOrder: v.trim() === '' ? undefined : Number(v) || 0,
          })
        }
        keyboardType="numeric"
        hint="Controls sort order in dropdowns/menus"
      />
      <StatusToggle status={value.status} onChange={(status) => onChange({ ...value, status })} />
    </View>
  );
}

// —— Branch ——
export type BranchFormState = Omit<BranchMaster, 'id'> & { id?: string };

export function emptyBranchForm(): BranchFormState {
  return {
    name: '',
    branchCode: '',
    city: '',
    state: '',
    branchManager: '',
    mobile: '',
    status: 'active',
  };
}

export function BranchFormFields({
  value,
  onChange,
  error,
}: {
  value: BranchFormState;
  onChange: (next: BranchFormState) => void;
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Branch Name"
        required
        placeholder="Enter branch name"
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        error={error}
      />
      <Input
        label="Branch Code"
        required
        placeholder="e.g. MUM-AND"
        value={value.branchCode}
        onChangeText={(branchCode) => onChange({ ...value, branchCode })}
        autoCapitalize="characters"
      />
      <Input
        label="City"
        required
        placeholder="Enter city"
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city })}
      />
      <Input
        label="State"
        required
        placeholder="Enter state"
        value={value.state}
        onChangeText={(state) => onChange({ ...value, state })}
      />
      <Input
        label="Branch Manager"
        required
        placeholder="Enter branch manager name"
        value={value.branchManager}
        onChangeText={(branchManager) => onChange({ ...value, branchManager })}
      />
      <Input
        label="Mobile Number"
        required
        placeholder="+91 98000 00000"
        value={value.mobile}
        onChangeText={(mobile) => onChange({ ...value, mobile })}
        keyboardType="phone-pad"
      />
      <StatusToggle
        status={value.status}
        onChange={(status) => onChange({ ...value, status })}
        descriptionActive="Available in User Branch Access"
        descriptionInactive="Hidden from User Branch Access"
      />
    </View>
  );
}

// —— Pincode ——
export type PincodeFormState = Omit<PincodeMaster, 'id' | 'name'> & {
  id?: string;
  name?: string;
};

export function emptyPincodeForm(): PincodeFormState {
  return {
    pincode: '',
    city: '',
    state: '',
    branchName: '',
    status: 'active',
  };
}

export function PincodeFormFields({
  value,
  onChange,
  branchOptions,
  error,
}: {
  value: PincodeFormState;
  onChange: (next: PincodeFormState) => void;
  branchOptions: string[];
  error?: string;
}) {
  return (
    <View>
      <Input
        label="Pincode"
        required
        placeholder="e.g. 400053"
        value={value.pincode}
        onChangeText={(pincode) => onChange({ ...value, pincode })}
        keyboardType="number-pad"
        error={error}
      />
      <Input
        label="City"
        required
        placeholder="Enter city"
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city })}
      />
      <Input
        label="State"
        required
        placeholder="Enter state"
        value={value.state}
        onChangeText={(state) => onChange({ ...value, state })}
      />
      <Dropdown
        label="Branch *"
        placeholder="Select branch"
        value={value.branchName}
        options={branchOptions}
        onSelect={(branchName) => onChange({ ...value, branchName })}
      />
      <StatusToggle
        status={value.status}
        onChange={(status) => onChange({ ...value, status })}
        descriptionActive="Available in User Pincode Mapping"
        descriptionInactive="Hidden from User Pincode Mapping"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  image: { marginBottom: spacing.lg },
});
