import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { colors } from '../../theme/colors';
import { radius, shadow, spacing } from '../../theme/spacing';

interface MultiSelectDropdownProps {
  label?: string;
  placeholder?: string;
  values: string[];
  options: readonly string[];
  onChange: (next: string[]) => void;
  error?: string;
}

/** Dropdown-style multi-select (Admin Web p-multiselect equivalent). */
export function MultiSelectDropdown({
  label,
  placeholder = 'Select...',
  values,
  options,
  onChange,
  error,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const display = useMemo(() => {
    if (!values.length) return '';
    if (values.length <= 2) return values.join(', ');
    return `${values.slice(0, 2).join(', ')} +${values.length - 2}`;
  }, [values]);

  const toggle = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((item) => item !== option));
      return;
    }
    onChange([...values, option]);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.trigger, error ? styles.triggerError : null]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.value, !display && styles.placeholder]} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={[styles.menu, shadow.lg]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuTitle}>{label || 'Select options'}</Text>
            <FlatList
              data={[...options]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = values.includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => toggle(item)}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {item}
                    </Text>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)} activeOpacity={0.85}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg, width: '100%', minWidth: 0 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
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
  value: { fontSize: 15, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  chevron: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing.xs },
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
  doneBtn: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.primaryLight,
  },
  doneText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
