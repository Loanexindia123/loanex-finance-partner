import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

export const WIZARD_STEPS = [
  'Basic Info',
  'Category',
  'Variants',
  'Images',
  'Pricing',
  'Inventory',
  'Supplier',
  'Delivery',
  'EMI',
  'SEO',
  'Review',
];

interface StepProgressProps {
  currentStep: number;
  steps?: readonly string[];
}

export function StepProgress({ currentStep, steps = WIZARD_STEPS }: StepProgressProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const emiIndex = steps.indexOf('EMI');
  const isEmiStep = emiIndex >= 0 && currentStep === emiIndex + 1;

  return (
    <View style={[styles.wrapper, isEmiStep && styles.wrapperFinance]}>
      {isEmiStep && (
        <View style={styles.financeBanner}>
          <Text style={styles.financeBannerText}>Finance · EMI Configuration</Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          const isEmiLabel = step === 'EMI';

          return (
            <View key={step} style={styles.stepItem}>
              <View
                style={[
                  styles.circle,
                  isActive && styles.circleActive,
                  isCompleted && styles.circleCompleted,
                  isActive && isEmiLabel && styles.circleFinance,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.check}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.stepNum,
                      (isActive || isCompleted) && styles.stepNumActive,
                      isActive && isEmiLabel && styles.stepNumFinance,
                    ]}
                  >
                    {stepNum}
                  </Text>
                )}
              </View>
              {isTablet && (
                <Text
                  style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                    isActive && isEmiLabel && styles.stepLabelFinance,
                  ]}
                  numberOfLines={1}
                >
                  {step}
                </Text>
              )}
              {index < WIZARD_STEPS.length - 1 && (
                <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />
              )}
            </View>
          );
        })}
      </ScrollView>
      <Text style={[styles.currentLabel, isEmiStep && styles.currentLabelFinance]}>
        Step {currentStep} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep - 1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.lg,
  },
  wrapperFinance: {
    borderBottomColor: colors.accent,
  },
  financeBanner: {
    backgroundColor: colors.accentLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  financeBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  circleActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  circleFinance: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  circleCompleted: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
  },
  stepNum: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  stepNumActive: { color: colors.primary },
  stepNumFinance: { color: colors.accentDark },
  check: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  stepLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    maxWidth: 70,
  },
  stepLabelActive: { color: colors.primary, fontWeight: '600' },
  stepLabelFinance: { color: colors.accentDark, fontWeight: '700' },
  connector: {
    width: 16,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  connectorCompleted: { backgroundColor: colors.accent },
  currentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  currentLabelFinance: {
    color: colors.accentDark,
  },
});
