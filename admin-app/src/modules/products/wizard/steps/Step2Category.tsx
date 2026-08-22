import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWizard } from '../WizardContext';
import { useOptionsRegistry } from '../OptionsRegistryContext';
import { ManageableDropdown } from '../../components/ManageableDropdown';
import { Card } from '../../../../components/ui/Card';
import { useRbac, isFieldActor } from '../../../../auth/rbacStore';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';

export function Step2Category() {
  const { formData, updateForm } = useWizard();
  const options = useOptionsRegistry();
  useRbac();
  const dealerMode = isFieldActor();

  const categoryOptions = useMemo(() => Object.keys(options.categories), [options.categories]);
  const subCategoryOptions = useMemo(
    () => (formData.category ? Object.keys(options.categories[formData.category] || {}) : []),
    [formData.category, options.categories]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Category</Text>
      <Text style={styles.subheading}>Place this product in the catalogue taxonomy.</Text>

      <Card style={styles.card}>
        <ManageableDropdown
          label="Category"
          placeholder="Select main category"
          entityName="Category"
          entityNamePlural="Categories"
          value={formData.category}
          options={categoryOptions}
          allowManage={!dealerMode}
          onSelect={(v) =>
            updateForm({ category: v, subCategory: '', brand: '', childCategory: '' })
          }
          onValueSync={(v) => {
            if (!v) {
              updateForm({ category: '', subCategory: '', brand: '', childCategory: '' });
            } else {
              updateForm({ category: v });
            }
          }}
          onAdd={(name) => options.addCategory(name)}
          onRename={(from, to) => options.renameCategory(from, to)}
          onDelete={(name) => options.deleteCategory(name)}
        />

        <ManageableDropdown
          label="Sub Category"
          placeholder={formData.category ? 'Select sub category' : 'Select category first'}
          entityName="Sub Category"
          entityNamePlural="Sub Categories"
          value={formData.subCategory}
          options={subCategoryOptions}
          disabled={!formData.category}
          allowManage={!dealerMode}
          onSelect={(v) => updateForm({ subCategory: v, brand: '', childCategory: '' })}
          onValueSync={(v) => {
            if (!v) {
              updateForm({ subCategory: '', brand: '', childCategory: '' });
            } else {
              updateForm({ subCategory: v });
            }
          }}
          onAdd={(name) => (formData.category ? options.addSubCategory(formData.category, name) : false)}
          onRename={(from, to) =>
            formData.category ? options.renameSubCategory(formData.category, from, to) : false
          }
          onDelete={(name) => {
            if (formData.category) options.deleteSubCategory(formData.category, name);
          }}
        />

        <ManageableDropdown
          label="Brand"
          placeholder={formData.subCategory ? 'Select brand' : 'Select sub category first'}
          entityName="Brand"
          entityNamePlural="Brands"
          value={formData.brand}
          options={formData.subCategory ? options.brands : []}
          disabled={!formData.subCategory}
          allowManage={!dealerMode}
          onSelect={(v) => updateForm({ brand: v })}
          onAdd={(name) => options.addBrand(name)}
          onRename={(from, to) => options.renameBrand(from, to)}
          onDelete={(name) => options.deleteBrand(name)}
        />

        {dealerMode ? (
          <Text style={styles.hint}>
            Missing a category or brand? Add it under Masters, then return to Product Add.
          </Text>
        ) : null}
      </Card>

      {formData.category && (
        <Card style={styles.preview}>
          <Text style={styles.previewTitle}>Selected Path</Text>
          <Text style={styles.previewPath}>
            {formData.category}
            {formData.subCategory ? ` › ${formData.subCategory}` : ''}
            {formData.brand ? ` › ${formData.brand}` : ''}
          </Text>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textHeading, marginBottom: spacing.xs },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xxl },
  card: { marginBottom: spacing.lg },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  preview: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  previewTitle: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
  previewPath: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
});
