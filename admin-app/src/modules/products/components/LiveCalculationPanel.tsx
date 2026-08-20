import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ProductFormData } from '../types/product';
import {
  computePricing,
  computeCompleteness,
  computeValidationAlerts,
  computeOverallCompleteness,
  formatCurrency,
  formatPercent,
  getSelectedEmiPlan,
  parseAmount,
} from '../utils/productCalculations';
import { computeEmiRowCalculations } from '../utils/emiCalculations';
import { ProductCompleteness } from './ProductCompleteness';
import { ValidationAlerts } from './ValidationAlerts';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';

interface LiveCalculationPanelProps {
  formData: ProductFormData;
  collapsed?: boolean;
}

export function LiveCalculationPanel({ formData, collapsed: defaultCollapsed = false }: LiveCalculationPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const calc = computePricing(formData);
  const completeness = computeCompleteness(formData);
  const overall = computeOverallCompleteness(completeness);
  const alerts = computeValidationAlerts(formData, calc);
  const selectedPlan = getSelectedEmiPlan(formData);
  const emiCalcs = selectedPlan
    ? computeEmiRowCalculations(calc.sellingPrice, selectedPlan)
    : null;
  const docCharge = parseAmount(formData.documentationCharge);
  const verifyCharge = parseAmount(formData.verificationCharge);
  const emiTotalPayable = emiCalcs
    ? emiCalcs.totalPayable + docCharge + verifyCharge
    : 0;
  const emiSaleMargin =
    emiTotalPayable > 0 && calc.landingCost > 0
      ? ((emiTotalPayable - calc.landingCost) / emiTotalPayable) * 100
      : 0;

  const panelContent = (
    <>
      <Text style={styles.sectionLabel}>Cash Sale Summary</Text>
      <CalcRow label="Customer Pays" value={formatCurrency(calc.sellingPrice)} highlight />
      <CalcRow label="Landing Cost" value={formatCurrency(calc.landingCost)} />
      <CalcRow label="Margin" value={formatPercent(calc.margin)} highlight />
      <CalcRow label="Discount" value={formatPercent(calc.discount)} />

      <Text style={[styles.sectionLabel, styles.sectionGap]}>Selected EMI Plan Breakdown</Text>
      {selectedPlan && emiCalcs ? (
        <>
          <CalcRow
            label="Plan"
            value={selectedPlan.planName || `${selectedPlan.months} months`}
          />
          <CalcRow label="Down Payment" value={formatCurrency(parseAmount(selectedPlan.downPayment))} />
          <CalcRow label="Service Charge" value={formatCurrency(parseAmount(selectedPlan.serviceCharge))} />
          <CalcRow label="Delivery Charge" value={formatCurrency(parseAmount(selectedPlan.deliveryCharge))} />
          <CalcRow label="EMI Principal" value={formatCurrency(emiCalcs.loanAmount)} />
          <CalcRow label="Monthly EMI" value={formatCurrency(emiCalcs.monthlyEmi)} />
          <CalcRow label="Down Payment (Upfront)" value={formatCurrency(emiCalcs.upfrontPayment)} />
          <CalcRow label="Documentation Charge" value={formatCurrency(docCharge)} />
          <CalcRow label="Verification Charge" value={formatCurrency(verifyCharge)} />
          <CalcRow label="Total Payable" value={formatCurrency(emiTotalPayable)} highlight />
          <CalcRow label="EMI Sale Margin" value={formatPercent(emiSaleMargin)} highlight />
        </>
      ) : (
        <Text style={styles.emptyEmi}>No EMI plan selected — enable a visible plan in Step 9</Text>
      )}

      <Text style={[styles.sectionLabel, styles.sectionGap]}>Dealer</Text>
      <CalcRow label="Payment Schedule" value={calc.dealerSchedule} />

      <View style={styles.divider} />
      <ValidationAlerts alerts={alerts} />
      <ProductCompleteness sections={completeness} overall={overall} />
    </>
  );

  return (
    <View style={[styles.panel, shadow.md]}>
      <TouchableOpacity style={styles.panelHeader} onPress={() => setCollapsed(!collapsed)} activeOpacity={0.8}>
        <View>
          <Text style={styles.panelTitle}>Live Product Calculation</Text>
          <Text style={styles.panelSubtitle}>Margin {formatPercent(calc.margin)} · Complete {overall}%</Text>
        </View>
        <Text style={styles.chevron}>{collapsed ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <ScrollView style={styles.panelBody} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {panelContent}
        </ScrollView>
      )}
    </View>
  );
}

function CalcRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.calcRow}>
      <Text style={styles.calcLabel}>{label}</Text>
      <Text style={[styles.calcValue, highlight && styles.calcHighlight]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitle: { fontSize: 14, fontWeight: '800', color: colors.primary },
  panelSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  panelBody: { maxHeight: 520, padding: spacing.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  sectionGap: { marginTop: spacing.md },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2,
    gap: spacing.md,
  },
  calcLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  calcValue: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'right' },
  calcHighlight: { color: colors.primary },
  emptyEmi: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md },
});
