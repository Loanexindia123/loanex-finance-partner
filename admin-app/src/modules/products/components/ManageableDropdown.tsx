import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { ManageOptionsModal } from './ManageOptionsModal';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';

interface ManageableDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  /** Used when rename/delete updates the current selection without treating it as a fresh pick. */
  onValueSync?: (value: string) => void;
  entityName: string;
  entityNamePlural?: string;
  onAdd: (name: string) => boolean;
  onRename: (from: string, to: string) => boolean;
  onDelete: (name: string) => void;
  error?: string;
  disabled?: boolean;
  /** When false, renders as a plain dropdown (no inline + / manage footer). */
  allowManage?: boolean;
}

export function ManageableDropdown({
  label,
  placeholder = 'Select...',
  value,
  options,
  onSelect,
  onValueSync,
  entityName,
  entityNamePlural,
  onAdd,
  onRename,
  onDelete,
  error,
  disabled,
  allowManage = true,
}: ManageableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [clearedNote, setClearedNote] = useState('');
  const plural = entityNamePlural || `${entityName}s`;
  const canManage = allowManage && !disabled;

  const syncValue = (next: string) => {
    if (onValueSync) onValueSync(next);
    else onSelect(next);
  };

  const handleRename = (from: string, to: string) => {
    const ok = onRename(from, to);
    if (ok && value === from) {
      syncValue(to);
      setClearedNote('');
    }
    return ok;
  };

  const handleDelete = (name: string) => {
    onDelete(name);
    if (value === name) {
      syncValue('');
      setClearedNote(`Selected ${entityName.toLowerCase()} was deleted and cleared.`);
    }
  };

  const handleAddFromManage = (name: string) => onAdd(name);

  const openAddNew = () => {
    setOpen(false);
    setAddOpen(true);
  };

  const openManage = () => {
    setOpen(false);
    setManageOpen(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {label ? (
          <Text style={styles.label}>
            {label}
          </Text>
        ) : (
          <View />
        )}
        {canManage ? (
          <TouchableOpacity
            style={styles.inlineAddBtn}
            onPress={openAddNew}
            accessibilityLabel={`Add ${entityName}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.inlineAddText}>+</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
      {!!clearedNote && <Text style={styles.note}>{clearedNote}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, shadow.lg]}>
            <Text style={styles.menuTitle}>{label || `Select ${entityName}`}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              style={styles.optionsList}
              ListEmptyComponent={
                <Text style={styles.empty}>No {plural.toLowerCase()} available</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && styles.optionSelected]}
                  onPress={() => {
                    onSelect(item);
                    setClearedNote('');
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, value === item && styles.optionTextSelected]}>
                    {item}
                  </Text>
                  {value === item && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            {canManage ? (
              <View style={styles.footer}>
                <TouchableOpacity style={styles.footerBtn} onPress={openAddNew}>
                  <Text style={styles.addText}>+ Add New {entityName}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerBtn} onPress={openManage}>
                  <Text style={styles.manageText}>Manage {plural}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <ManageOptionsModal
        visible={addOpen}
        title={`Add New ${entityName}`}
        entityName={entityName}
        options={options}
        startInAddMode
        onClose={() => setAddOpen(false)}
        onAdd={(name) => {
          const ok = onAdd(name);
          if (ok) {
            onSelect(name);
            setClearedNote('');
            setAddOpen(false);
          }
          return ok;
        }}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <ManageOptionsModal
        visible={manageOpen}
        title={`Manage ${plural}`}
        entityName={entityName}
        options={options}
        onClose={() => setManageOpen(false)}
        onAdd={handleAddFromManage}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg, width: '100%', minWidth: 0 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  inlineAddBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAddText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
    lineHeight: 20,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 48,
    width: '100%',
  },
  triggerError: { borderColor: colors.danger },
  triggerDisabled: { opacity: 0.55 },
  value: { fontSize: 15, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  chevron: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
  note: { fontSize: 12, color: colors.warning, marginTop: spacing.xs },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: 420,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionsList: { maxHeight: 260 },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    padding: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionSelected: { backgroundColor: colors.primaryLight },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  check: { color: colors.primary, fontWeight: '700' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  footerBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  addText: { fontSize: 14, fontWeight: '700', color: colors.accentDark },
  manageText: { fontSize: 14, fontWeight: '600', color: colors.secondary },
});
