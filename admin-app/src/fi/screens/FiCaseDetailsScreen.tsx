import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DetailRow } from '../../components/ui/DetailRow';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { FiPhotoSlots } from '../../components/fi/FiPhotoSlots';
import { FiVisitSection } from '../../components/fi/FiVisitSection';
import { FiGpsSection } from '../../components/fi/FiGpsSection';
import { FiChecklistSection } from '../../components/fi/FiChecklistSection';
import { FiRemarksSection } from '../../components/fi/FiRemarksSection';
import {
  FiChecklistState,
  FiPhotoKey,
  FiWorkflowDraft,
  getFiCaseById,
  getFiStatusLabel,
  getFiWorkflowDraft,
  MOCK_GPS,
  saveFiDraft,
  submitFiCase,
  setLocalFiCase,
} from '../data/fiWorkflowStore';
import { getFiCaseById as fetchFiCaseById, updateFiCase } from '../../services/emiService';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';
import { FiCase, FiCaseStatus } from '../../types/fiCase';

type Props = NativeStackScreenProps<RootStackParamList, 'FiCaseDetails'>;

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function FiCaseDetailsScreen({ navigation, route }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fiCaseId = route.params.fiCaseId;

  const [fiCase, setFiCase] = useState<FiCase | null>(() => getFiCaseById(fiCaseId) || null);
  const [fiStatus, setFiStatus] = useState<FiCaseStatus>(
    () => fiCase?.status ?? 'pending',
  );
  const [draft, setDraft] = useState<FiWorkflowDraft>(() => getFiWorkflowDraft(fiCaseId, fiCase || undefined));
  const [loading, setLoading] = useState<boolean>(!fiCase);

  const isCompleted = fiStatus === 'completed';
  const isRejected = fiStatus === 'hold';
  const readOnly = isCompleted || isRejected;
  const showPerformActions = !readOnly;
  const showSubmittedActions = readOnly;

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      fetchFiCaseById(fiCaseId)
        .then((fetched) => {
          if (!isMounted) return;
          if (fetched) {
            setLocalFiCase(fetched);
            setFiCase(fetched);
            setFiStatus(fetched.status);
            setDraft(getFiWorkflowDraft(fiCaseId, fetched));
          }
        })
        .catch((err) => console.error(err))
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }, [fiCaseId]),
  );

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Dashboard');
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

  const updateDraft = (patch: Partial<FiWorkflowDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleCapturePhoto = (key: FiPhotoKey) => {
    setDraft((prev) => ({
      ...prev,
      photos: { ...prev.photos, [key]: true },
    }));
  };

  const handleRetakePhoto = (key: FiPhotoKey) => {
    setDraft((prev) => ({
      ...prev,
      photos: { ...prev.photos, [key]: false },
    }));
  };

  const handleCaptureGps = () => {
    updateDraft({
      gpsCaptured: true,
      latitude: MOCK_GPS.latitude,
      longitude: MOCK_GPS.longitude,
      address: MOCK_GPS.address,
    });
  };

  const handleToggleChecklist = (key: keyof FiChecklistState) => {
    setDraft((prev) => ({
      ...prev,
      checklist: { ...prev.checklist, [key]: !prev.checklist[key] },
    }));
  };

  const handleSaveDraft = () => {
    saveFiDraft(fiCaseId, draft);
    const latest = getFiCaseById(fiCaseId);
    if (latest) setFiStatus(latest.status);
    updateFiCase(fiCaseId, {
      remarks: draft.remarks,
      gpsLocation: draft.gpsCaptured ? draft.address || MOCK_GPS.address : '',
      photoCount: Object.values(draft.photos).filter(Boolean).length,
    })
      .then((updated) => {
        setLocalFiCase(updated);
        setFiStatus(updated.status);
      })
      .catch((err) => console.warn('[FI] Failed to save draft to API:', err));
    Alert.alert('Draft Saved', 'Field Investigation draft saved.');
  };

  const handleSubmitFi = () => {
    Alert.alert(
      'FI Accept',
      'Accept this Field Investigation? This confirms FI completed successfully and returns the EMI application to Admin for Credit Review — it is not final application approval.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'FI Accept',
          onPress: () => {
            submitFiCase(fiCaseId, draft);
            const latest = getFiCaseById(fiCaseId);
            if (latest) setFiStatus(latest.status);
            updateFiCase(fiCaseId, {
              status: 'completed',
              remarks: draft.remarks,
              gpsLocation: draft.gpsCaptured ? draft.address || MOCK_GPS.address : '',
              photoCount: Object.values(draft.photos).filter(Boolean).length,
            })
              .then((updated) => {
                setLocalFiCase(updated);
                setFiStatus(updated.status);
              })
              .catch((err) => console.warn('[FI] Failed to submit FI to API:', err));
            setDraft(getFiWorkflowDraft(fiCaseId));
            Alert.alert(
              'FI Accepted',
              'Field Investigation accepted. Application is back with Admin for Credit Review.',
            );
          },
        },
      ],
    );
  };

  const handleRejectFi = () => {
    const reason = draft.remarks.trim();
    if (!reason) {
      Alert.alert('Remarks required', 'Enter the FI rejection reason in Remarks before rejecting.');
      return;
    }
    Alert.alert(
      'FI Reject',
      'Reject this Field Investigation? The EMI application will move to Rejected with this reason.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'FI Reject',
          style: 'destructive',
          onPress: () => {
            updateFiCase(fiCaseId, {
              status: 'hold',
              remarks: reason,
              gpsLocation: draft.gpsCaptured ? draft.address || MOCK_GPS.address : '',
              photoCount: Object.values(draft.photos).filter(Boolean).length,
            })
              .then((updated) => {
                setLocalFiCase(updated);
                setFiStatus(updated.status);
              })
              .catch((err) => console.warn('[FI] Failed to reject FI to API:', err));
            setFiStatus('hold');
            Alert.alert('FI Rejected', 'Field Investigation rejected. Admin can see the reason.');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FI Details</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.notFound}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.notFoundText}>Loading FI Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!fiCase) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FI Details</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>FI case not found</Text>
          <Button title="Back" variant="outline" onPress={handleGoBack} style={styles.backAction} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FI Details</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <SectionTitle title="Field Investigation Information" />
          <DetailRow label="FI Case ID" value={fiCase.id} />
          <DetailRow label="Customer" value={fiCase.customerName} />
          <DetailRow label="Mobile" value={fiCase.mobile} />
          <DetailRow label="Product" value={fiCase.productName} />
          <DetailRow label="Assigned Executive" value={fiCase.assignedExecutive} />
          <DetailRow label="Assigned Date" value={formatDate(fiCase.assignedDate)} />
          <DetailRow label="Current Status" value={getFiStatusLabel(fiStatus)} isLast />
        </Card>

        <FiPhotoSlots
          photos={draft.photos}
          readOnly={readOnly}
          onCapture={handleCapturePhoto}
          onRetake={handleRetakePhoto}
        />

        <FiVisitSection
          visitDate={draft.visitDate}
          visitTime={draft.visitTime}
          readOnly={readOnly}
          onChangeDate={(text) => updateDraft({ visitDate: text })}
          onChangeTime={(text) => updateDraft({ visitTime: text })}
          onFillMock={() =>
            updateDraft({
              visitDate: new Date().toISOString().slice(0, 10),
              visitTime: new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })
          }
        />

        <FiGpsSection
          gpsCaptured={draft.gpsCaptured}
          latitude={draft.latitude}
          longitude={draft.longitude}
          address={draft.address}
          readOnly={readOnly}
          onCapture={handleCaptureGps}
        />

        <FiChecklistSection
          checklist={draft.checklist}
          readOnly={readOnly}
          onToggle={handleToggleChecklist}
        />

        <FiRemarksSection
          remarks={draft.remarks}
          readOnly={readOnly}
          onChange={(text) => updateDraft({ remarks: text })}
        />
      </ScrollView>

      <View style={styles.footer}>
        {showPerformActions && (
          <>
            <Button
              title="Save Draft"
              variant="outline"
              onPress={handleSaveDraft}
              style={styles.footerBtn}
            />
            <Button
              title="FI Accept"
              onPress={handleSubmitFi}
              style={styles.footerBtn}
            />
            <Button
              title="FI Reject"
              variant="outline"
              onPress={handleRejectFi}
              style={styles.footerBtn}
            />
          </>
        )}
        {showSubmittedActions && (
          <>
            <Button
              title={isRejected ? 'View Rejected FI' : 'View Accepted FI'}
              variant="outline"
              onPress={() => {
                Alert.alert(
                  isRejected ? 'Rejected FI' : 'Accepted FI',
                  isRejected
                    ? 'This Field Investigation was rejected and is displayed in read-only mode.'
                    : 'This Field Investigation was accepted. The EMI application is with Admin for Credit Review.',
                );
              }}
              style={styles.footerBtn}
            />
            <Button title="Back" variant="secondary" onPress={handleGoBack} style={styles.footerBtn} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
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
    scroll: { padding: spacing.lg, paddingBottom: spacing.lg },
    section: { marginBottom: spacing.md },
    footer: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    footerBtn: { flex: 1 },
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: spacing.lg,
    },
    notFoundText: { fontSize: 16, color: colors.textSecondary },
    backAction: { minWidth: 140 },
  });
}
