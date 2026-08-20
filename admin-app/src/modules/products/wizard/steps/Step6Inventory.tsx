import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWizard } from '../WizardContext';
import { useOptionsRegistry } from '../OptionsRegistryContext';
import { Input } from '../../../../components/ui/Input';
import { Dropdown } from '../../../../components/ui/Dropdown';
import { ToggleSwitch } from '../../../../components/ui/ToggleSwitch';
import { ManageableDropdown } from '../../components/ManageableDropdown';
import { Card } from '../../../../components/ui/Card';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';

export function Step6Inventory() {
  const { formData, updateForm } = useWizard();
  const options = useOptionsRegistry();

  const clearWarehouseEverywhere = (name: string) => {
    updateForm({
      warehouse: formData.warehouse === name ? '' : formData.warehouse,
      variants: formData.variants.map((v) =>
        v.warehouse === name ? { ...v, warehouse: '', saved: false } : v
      ),
    });
  };

  const renameWarehouseEverywhere = (from: string, to: string) => {
    updateForm({
      warehouse: formData.warehouse === from ? to : formData.warehouse,
      variants: formData.variants.map((v) =>
        v.warehouse === from ? { ...v, warehouse: to, saved: false } : v
      ),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Stock / Inventory</Text>
      <Text style={styles.subheading}>Manage stock quantity and warehouse allocation</Text>

      <Card>
        <ManageableDropdown
          label="Warehouse"
          placeholder="Select warehouse"
          entityName="Warehouse"
          value={formData.warehouse}
          options={options.warehouses}
          onSelect={(v) => updateForm({ warehouse: v })}
          onValueSync={(v) => {
            if (!v && formData.warehouse) clearWarehouseEverywhere(formData.warehouse);
            else if (v) updateForm({ warehouse: v });
          }}
          onAdd={(name) => options.addWarehouse(name)}
          onRename={(from, to) => {
            const ok = options.renameWarehouse(from, to);
            if (ok) renameWarehouseEverywhere(from, to);
            return ok;
          }}
          onDelete={(name) => {
            options.deleteWarehouse(name);
            clearWarehouseEverywhere(name);
          }}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Opening Stock"
              placeholder="Initial quantity"
              value={formData.openingStock}
              onChangeText={(v) => updateForm({ openingStock: v, availableStock: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Stock Quantity"
              placeholder="10"
              value={formData.availableStock}
              onChangeText={(v) => {
                const cleaned = v.replace(/[^\d]/g, '');
                updateForm({ availableStock: cleaned });
              }}
              keyboardType="number-pad"
              required
              hint="Required. Integer of 0 or more."
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Reserved Stock"
              placeholder="Reserved for orders"
              value={formData.reservedStock}
              onChangeText={(v) => updateForm({ reservedStock: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Minimum Quantity"
              placeholder="Reorder threshold"
              value={formData.minimumQuantity}
              onChangeText={(v) => updateForm({ minimumQuantity: v })}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Input
          label="Maximum Quantity"
          placeholder="Max stock capacity"
          value={formData.maximumQuantity}
          onChangeText={(v) => updateForm({ maximumQuantity: v })}
          keyboardType="numeric"
        />

        <ToggleSwitch
          label="Track Inventory"
          description="Enable stock tracking and low-stock alerts"
          value={formData.trackInventory}
          onValueChange={(v) => updateForm({ trackInventory: v })}
        />
      </Card>

      <Text style={styles.sectionHeading}>Customer Purchase Rules</Text>
      <Text style={styles.sectionSub}>Limits and eligibility for customer purchases</Text>

      <Card>
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Minimum Order Quantity"
              placeholder="1"
              value={formData.minOrderQuantity}
              onChangeText={(v) => updateForm({ minOrderQuantity: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Maximum Quantity per Customer"
              placeholder="e.g. 5"
              value={formData.maxQuantityPerCustomer}
              onChangeText={(v) => updateForm({ maxQuantityPerCustomer: v })}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Minimum Customer Age"
              placeholder="e.g. 18"
              value={formData.minimumCustomerAge}
              onChangeText={(v) => updateForm({ minimumCustomerAge: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Eligible Pin Codes"
              placeholder="560001, 560002, 110001"
              value={formData.eligiblePinCodes}
              onChangeText={(v) => updateForm({ eligiblePinCodes: v })}
              hint="Comma-separated pin codes"
            />
          </View>
        </View>

        <ToggleSwitch
          label="Cash Purchase"
          description="Allow customers to buy with full cash payment"
          value={formData.cashPurchase}
          onValueChange={(v) => updateForm({ cashPurchase: v })}
        />
        <Dropdown
          label="Invoice Setting"
          placeholder="Select invoice setting"
          value={formData.invoiceSetting}
          options={['Auto Generate', 'Manual', 'Disabled']}
          onSelect={(v) => updateForm({ invoiceSetting: v })}
        />
        <ToggleSwitch
          label="Requires Field Verification"
          description="Field agent verification required before approval"
          value={formData.requiresFieldVerification}
          onValueChange={(v) => updateForm({ requiresFieldVerification: v })}
        />
        <ToggleSwitch
          label="Requires Serial/IMEI Capture"
          description="Capture serial or IMEI at purchase"
          value={formData.requiresSerialImeiCapture}
          onValueChange={(v) => updateForm({ requiresSerialImeiCapture: v })}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textHeading },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xxl },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textHeading,
    marginTop: spacing.xxl,
  },
  sectionSub: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  half: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, maxWidth: '100%' },
});
