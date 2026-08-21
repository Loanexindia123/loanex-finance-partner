import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { MultiSelectDropdown } from '../../../components/ui/MultiSelectDropdown';
import { Button } from '../../../components/ui/Button';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { pickProductImage } from '../../products/utils/pickProductImage';
import { uploadProductImage } from '../../../services/productService';
import { createAgent, getAgentById, updateAgent } from '../../../services/agentService';
import { getRbacState, isAgent } from '../../../auth/rbacStore';
import {
  AADHAAR_PATTERN,
  ACCOUNT_NUMBER_PATTERN,
  AGENT_TYPE_OPTIONS,
  ALLOWED_WORK_OPTIONS,
  DEPARTMENT_OPTIONS,
  DOCUMENT_FIELDS,
  EDUCATION_OPTIONS,
  EMAIL_PATTERN,
  GENDER_OPTIONS,
  IFSC_PATTERN,
  MOBILE_PATTERN,
  OCCUPATION_OPTIONS,
  ONBOARDING_STEPS,
  PAN_PATTERN,
  PINCODE_PATTERN,
  TRAINING_STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  emptyAgentForm,
  type AgentPayload,
  type DocumentFieldKey,
} from '../../../types/agent';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddAgent'>;
type FormState = ReturnType<typeof emptyAgentForm>;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateYmd(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return new Date(1990, 0, 1);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? new Date(1990, 0, 1) : date;
}

export function AddAgentScreen({ navigation, route }: Props) {
  const isEditMode = route.params?.mode === 'edit';
  const agentId = route.params?.agentId;
  const rbac = getRbacState();
  const user = rbac.user;

  /** Dealer Referred By — UI shows Dealer/Agent; payload still sends Direct (server derives creatorId/dealerId). */
  const referredBy = useMemo(
    () => ({
      creatorTypeDisplay: isAgent() ? 'Agent' : 'Dealer',
      searchCreator: user?.email || user?.phone || (isAgent() ? 'Agent' : 'Dealer'),
      creatorId: user?.id ?? '',
      creatorName: user?.email || user?.phone || (isAgent() ? 'Agent' : 'Dealer'),
    }),
    [user?.email, user?.id, user?.phone],
  );

  const managerOptions = useMemo(() => {
    const options: Array<{ label: string; value: string }> = [];
    const selfId = referredBy.creatorId;
    const selfName = referredBy.creatorName;
    if (selfId) options.push({ label: selfName, value: selfId });
    return options;
  }, [referredBy.creatorId, referredBy.creatorName]);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => {
    const empty = emptyAgentForm();
    if (isEditMode) return empty;
    const name = user?.email || user?.phone || 'Dealer';
    return {
      ...empty,
      assignedManager: name,
      assignedManagerId: user?.id ?? '',
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDobPicker, setShowDobPicker] = useState(false);

  const managerSelectOptions = useMemo(() => {
    const options = [...managerOptions];
    if (
      form.assignedManagerId &&
      !options.some((o) => o.value === form.assignedManagerId)
    ) {
      options.push({
        label: form.assignedManager || form.assignedManagerId,
        value: form.assignedManagerId,
      });
    }
    return options;
  }, [form.assignedManager, form.assignedManagerId, managerOptions]);

  const managerLabel = useMemo(() => {
    const match = managerSelectOptions.find((o) => o.value === form.assignedManagerId);
    return match?.label || form.assignedManager || '';
  }, [form.assignedManager, form.assignedManagerId, managerSelectOptions]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  useEffect(() => {
    if (!isEditMode || !agentId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const agent = await getAgentById(agentId);
        if (cancelled) return;
        setForm({
          fullName: agent.fullName,
          fatherHusbandName: agent.fatherHusbandName,
          dateOfBirth: agent.dateOfBirth,
          mobile: agent.mobile,
          whatsapp: agent.whatsapp,
          email: agent.email,
          gender: agent.gender,
          education: agent.education,
          occupation: agent.occupation,
          currentAddress: agent.currentAddress,
          city: agent.city,
          state: agent.state,
          pincode: agent.pincode,
          googleLocation: agent.googleLocation,
          preferredWorkArea: agent.preferredWorkArea,
          workMode: agent.workMode,
          emergencyContactName: agent.emergencyContactName,
          emergencyContactMobile: agent.emergencyContactMobile,
          profilePhoto: agent.profilePhoto,
          aadhaarFront: agent.aadhaarFront,
          aadhaarBack: agent.aadhaarBack,
          aadhaarNumber: agent.aadhaarNumber,
          panCard: agent.panCard,
          panNumber: agent.panNumber,
          addressProof: agent.addressProof,
          cancelledCheque: agent.cancelledCheque,
          signature: agent.signature,
          agentType: agent.agentType,
          preferredDepartments: agent.preferredDepartments,
          allowedWork: agent.allowedWork,
          assignedManager: agent.assignedManager,
          assignedManagerId: agent.assignedManagerId,
          branch: agent.branch,
          branchId: agent.branchId,
          trainingStatus: agent.trainingStatus || 'Pending',
          accountNumber: agent.accountNumber,
          confirmAccountNumber: agent.accountNumber,
          ifscCode: agent.ifscCode,
          policyAccepted: agent.policyAccepted,
          status: agent.status,
        });
      } catch (error) {
        console.error('[AddAgent] load failed', error);
        Alert.alert('Error', 'Could not load agent details.');
        navigation.goBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, agentId, navigation]);

  const validateStep = (index: number): boolean => {
    const next: Record<string, string> = {};
    const mobile = digitsOnly(form.mobile).slice(-10);
    const whatsapp = digitsOnly(form.whatsapp).slice(-10);
    const emergency = digitsOnly(form.emergencyContactMobile).slice(-10);
    const pin = digitsOnly(form.pincode).slice(0, 6);
    const pan = form.panNumber.trim().toUpperCase().replace(/\s+/g, '');
    const aadhaar = digitsOnly(form.aadhaarNumber);
    const account = digitsOnly(form.accountNumber);
    const confirm = digitsOnly(form.confirmAccountNumber);
    const ifsc = form.ifscCode.trim().toUpperCase();

    // Step 0 — Referred By (dealer autofill; must be present, never editable)
    if (index === 0) {
      if (!referredBy.creatorTypeDisplay) next.creatorType = 'Creator Type is required';
      if (!referredBy.creatorId.trim()) next.creatorId = 'Creator ID is required';
      if (!referredBy.searchCreator.trim()) next.creatorName = 'Search Creator is required';
    }
    if (index === 1) {
      if (!form.fullName.trim()) next.fullName = 'Full Name is required';
      if (!form.dateOfBirth.trim()) next.dateOfBirth = 'Date of Birth is required';
      if (!mobile) next.mobile = 'Mobile Number is required';
      else if (!MOBILE_PATTERN.test(mobile)) next.mobile = 'Enter a valid 10-digit mobile number';
      if (whatsapp && !MOBILE_PATTERN.test(whatsapp)) {
        next.whatsapp = 'Enter a valid 10-digit WhatsApp number';
      }
      if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
        next.email = 'Enter a valid email address';
      }
    }
    if (index === 2) {
      if (!form.currentAddress.trim()) next.currentAddress = 'Current Address is required';
      if (!pin) next.pincode = 'Pincode is required';
      else if (!PINCODE_PATTERN.test(pin)) next.pincode = 'Enter a valid 6-digit Indian pincode';
      if (!form.preferredWorkArea.trim()) next.preferredWorkArea = 'Preferred Work Area is required';
      if (!form.workMode) next.workMode = 'Work Mode is required';
      if (emergency && !MOBILE_PATTERN.test(emergency)) {
        next.emergencyContactMobile = 'Enter a valid 10-digit emergency mobile number';
      }
    }
    if (index === 3) {
      for (const doc of DOCUMENT_FIELDS) {
        if (doc.required && !String(form[doc.key] ?? '').trim()) {
          next[doc.key] = `${doc.label} is required`;
        }
      }
      if (aadhaar && !AADHAAR_PATTERN.test(aadhaar)) {
        next.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number';
      }
      if (pan && !PAN_PATTERN.test(pan)) next.panNumber = 'Enter a valid PAN (e.g. ABCDE1234F)';
    }
    if (index === 4) {
      if (!form.agentType) next.agentType = 'Agent Type is required';
      if (!form.preferredDepartments.length) {
        next.preferredDepartments = 'Preferred Department is required';
      }
      if (!form.allowedWork.length) next.allowedWork = 'Allowed Work is required';
      if (!form.assignedManagerId.trim()) {
        next.assignedManagerId = 'Assigned Manager is required';
      }
    }
    if (index === 5) {
      if (!account) next.accountNumber = 'Account Number is required';
      else if (!ACCOUNT_NUMBER_PATTERN.test(account)) {
        next.accountNumber = 'Account number must be 8–18 digits';
      }
      if (!confirm) next.confirmAccountNumber = 'Confirm Account Number is required';
      else if (confirm !== account) {
        next.confirmAccountNumber = 'Account number and confirmation must match';
      }
      if (!ifsc) next.ifscCode = 'IFSC Code is required';
      else if (!IFSC_PATTERN.test(ifsc)) next.ifscCode = 'Enter a valid IFSC code (e.g. SBIN0001234)';
    }
    if (index === 6) {
      if (!form.policyAccepted) next.policyAccepted = 'Policy acceptance is required';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const pickDoc = async (field: DocumentFieldKey) => {
    const file = await pickProductImage();
    if (!file) return;
    try {
      setSaving(true);
      const uploaded = await uploadProductImage(file);
      patch(field, uploaded.url);
    } catch (error) {
      console.error('[AddAgent] doc upload failed', error);
      Alert.alert('Upload failed', `Could not upload ${field}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const buildPayload = (formStatus: 'draft' | 'pending_approval' = 'pending_approval'): AgentPayload => {
    const account = digitsOnly(form.accountNumber);
    return {
      // Same shape as Admin Web / existing dealer create; server overrides creator + dealerId.
      creatorType: 'Direct',
      creatorId: referredBy.creatorId,
      creatorName: referredBy.creatorName,
      fullName: form.fullName.trim(),
      fatherHusbandName: form.fatherHusbandName.trim(),
      dateOfBirth: form.dateOfBirth.trim(),
      mobile: digitsOnly(form.mobile).slice(-10),
      whatsapp: digitsOnly(form.whatsapp).slice(-10),
      email: form.email.trim().toLowerCase(),
      gender: form.gender,
      education: form.education,
      occupation: form.occupation,
      currentAddress: form.currentAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: digitsOnly(form.pincode).slice(0, 6),
      googleLocation: form.googleLocation.trim(),
      preferredWorkArea: form.preferredWorkArea.trim(),
      workMode: form.workMode,
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactMobile: digitsOnly(form.emergencyContactMobile).slice(-10),
      profilePhoto: form.profilePhoto.trim(),
      aadhaarFront: form.aadhaarFront.trim(),
      aadhaarBack: form.aadhaarBack.trim(),
      aadhaarCard: form.aadhaarFront.trim(),
      aadhaarNumber: digitsOnly(form.aadhaarNumber),
      panCard: form.panCard.trim(),
      panNumber: form.panNumber.trim().toUpperCase().replace(/\s+/g, ''),
      addressProof: form.addressProof.trim(),
      cancelledCheque: form.cancelledCheque.trim(),
      signature: form.signature.trim(),
      agentType: form.agentType,
      preferredDepartments: form.preferredDepartments,
      allowedWork: form.allowedWork,
      assignedManager: form.assignedManager.trim() || referredBy.creatorName,
      assignedManagerId: form.assignedManagerId.trim() || referredBy.creatorId,
      branch: form.branch.trim(),
      branchId: form.branchId.trim(),
      trainingStatus: form.trainingStatus || 'Pending',
      accountNumber: account,
      confirmAccountNumber: digitsOnly(form.confirmAccountNumber),
      ifscCode: form.ifscCode.trim().toUpperCase(),
      policyAccepted: form.policyAccepted,
      status: 'inactive',
      formStatus,
    };
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, ONBOARDING_STEPS.length - 1));
  };

  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSave = async (formStatus: 'draft' | 'pending_approval' = 'pending_approval') => {
    for (let i = 0; i < ONBOARDING_STEPS.length; i += 1) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    try {
      setSaving(true);
      const payload = buildPayload(formStatus);
      if (isEditMode && agentId) {
        await updateAgent(agentId, payload);
      } else {
        await createAgent(payload);
      }
      Alert.alert(
        formStatus === 'pending_approval' ? 'Submitted for approval' : 'Draft saved',
        formStatus === 'pending_approval'
          ? 'Agent profile sent for admin approval. Agent ID is issued only after approval.'
          : 'Draft saved. You can submit for approval when ready.',
      );
      navigation.goBack();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Could not save agent. Please try again.';
      Alert.alert('Save failed', String(message));
    } finally {
      setSaving(false);
    }
  };

  const stepMeta = ONBOARDING_STEPS[step];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Agent' : 'Add Agent'}</Text>
          <Text style={styles.headerSub}>
            Step {step + 1}/{ONBOARDING_STEPS.length}: {stepMeta.title}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.stepRow}>
        {ONBOARDING_STEPS.map((item, index) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.stepDot, index === step && styles.stepDotActive, index < step && styles.stepDotDone]}
            onPress={() => {
              if (index <= step) setStep(index);
            }}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepDesc}>{stepMeta.description}</Text>

          {step === 0 && (
            <>
              <Input
                label="Creator Type"
                required
                value={referredBy.creatorTypeDisplay}
                editable={false}
                error={errors.creatorType}
              />
              <Input
                label="Search Creator"
                required
                value={referredBy.searchCreator}
                editable={false}
                error={errors.creatorName}
              />
              <Input
                label="Creator ID"
                value={referredBy.creatorId}
                editable={false}
                error={errors.creatorId}
                hint="Auto-filled from the logged-in dealer. Never edited manually."
              />
            </>
          )}

          {step === 1 && (
            <>
              <Input label="Full Name" required value={form.fullName} onChangeText={(v) => patch('fullName', v)} error={errors.fullName} />
              <Input label="Father / Husband Name" value={form.fatherHusbandName} onChangeText={(v) => patch('fatherHusbandName', v)} />
              <Text style={styles.fieldLabel}>
                Date of Birth <Text style={styles.requiredMark}>*</Text>
              </Text>
              {Platform.OS === 'web' ? (
                // @react-native-community/datetimepicker is not supported on web
                <View style={[styles.dateTrigger, errors.dateOfBirth ? styles.dateTriggerError : null]}>
                  {/* eslint-disable-next-line react/no-unknown-property */}
                  <input
                    type="date"
                    value={form.dateOfBirth || ''}
                    max={formatDateYmd(new Date())}
                    onChange={(e: any) => patch('dateOfBirth', String(e?.target?.value ?? ''))}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 15,
                      color: form.dateOfBirth ? colors.text : colors.textMuted,
                      fontFamily: 'inherit',
                    }}
                  />
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTrigger, errors.dateOfBirth ? styles.dateTriggerError : null]}
                    onPress={() => setShowDobPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dateValue, !form.dateOfBirth && styles.datePlaceholder]}>
                      {form.dateOfBirth || 'Select date of birth'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  {showDobPicker ? (
                    <DateTimePicker
                      value={parseDateYmd(form.dateOfBirth)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={(event: DateTimePickerEvent, selected?: Date) => {
                        if (Platform.OS !== 'ios') setShowDobPicker(false);
                        if (event.type === 'dismissed') return;
                        if (selected) patch('dateOfBirth', formatDateYmd(selected));
                      }}
                    />
                  ) : null}
                  {Platform.OS === 'ios' && showDobPicker ? (
                    <TouchableOpacity style={styles.dateDoneBtn} onPress={() => setShowDobPicker(false)}>
                      <Text style={styles.dateDoneText}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
              {errors.dateOfBirth ? <Text style={styles.fieldError}>{errors.dateOfBirth}</Text> : null}
              <Input label="Mobile Number" required value={form.mobile} onChangeText={(v) => patch('mobile', v)} error={errors.mobile} keyboardType="phone-pad" maxLength={10} />
              <View style={styles.inlineRow}>
                <View style={{ flex: 1 }}>
                  <Input label="WhatsApp" value={form.whatsapp} onChangeText={(v) => patch('whatsapp', v)} error={errors.whatsapp} keyboardType="phone-pad" maxLength={10} />
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => patch('whatsapp', digitsOnly(form.mobile).slice(-10))}
                >
                  <Text style={styles.copyBtnText}>Same as mobile</Text>
                </TouchableOpacity>
              </View>
              <Input label="Email" value={form.email} onChangeText={(v) => patch('email', v)} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
              <Dropdown label="Gender" value={form.gender} options={[...GENDER_OPTIONS]} onSelect={(v) => patch('gender', v)} placeholder="Select gender" />
              <Dropdown label="Education" value={form.education} options={[...EDUCATION_OPTIONS]} onSelect={(v) => patch('education', v)} placeholder="Select education" />
              <Dropdown label="Occupation" value={form.occupation} options={[...OCCUPATION_OPTIONS]} onSelect={(v) => patch('occupation', v)} placeholder="Select occupation" />
            </>
          )}

          {step === 2 && (
            <>
              <Input label="Current Address" required value={form.currentAddress} onChangeText={(v) => patch('currentAddress', v)} error={errors.currentAddress} multiline />
              <Input label="City" value={form.city} onChangeText={(v) => patch('city', v)} />
              <Input label="State" value={form.state} onChangeText={(v) => patch('state', v)} />
              <Input label="Pincode" required value={form.pincode} onChangeText={(v) => patch('pincode', v)} error={errors.pincode} keyboardType="number-pad" maxLength={6} />
              <Input label="Google Location" value={form.googleLocation} onChangeText={(v) => patch('googleLocation', v)} placeholder="Optional map link / landmark" />
              <Input label="Preferred Work Area" required value={form.preferredWorkArea} onChangeText={(v) => patch('preferredWorkArea', v)} error={errors.preferredWorkArea} placeholder="Pincode / city / district" />
              <Dropdown label="Work Mode *" value={form.workMode} options={[...WORK_MODE_OPTIONS]} onSelect={(v) => patch('workMode', v)} error={errors.workMode} placeholder="Select work mode" />
              <Input label="Emergency Contact Name" value={form.emergencyContactName} onChangeText={(v) => patch('emergencyContactName', v)} />
              <Input label="Emergency Contact Mobile" value={form.emergencyContactMobile} onChangeText={(v) => patch('emergencyContactMobile', v)} error={errors.emergencyContactMobile} keyboardType="phone-pad" maxLength={10} />
            </>
          )}

          {step === 3 && (
            <>
              {DOCUMENT_FIELDS.map((doc) => {
                const uri = String(form[doc.key] ?? '');
                return (
                  <TouchableOpacity
                    key={doc.key}
                    style={[styles.docBox, shadow.sm]}
                    onPress={() => pickDoc(doc.key)}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {uri ? (
                      <Image
                        source={{ uri: resolveMediaUrl(uri) }}
                        style={styles.docImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.docPlaceholder}>
                        <Ionicons name="cloud-upload-outline" size={22} color={colors.textMuted} />
                        <Text style={styles.docLabel}>
                          {doc.label}
                          {doc.required ? ' *' : ''}
                        </Text>
                      </View>
                    )}
                    {uri ? <Text style={styles.docDone}>{doc.label} uploaded</Text> : null}
                    {errors[doc.key] ? <Text style={styles.fieldError}>{errors[doc.key]}</Text> : null}
                  </TouchableOpacity>
                );
              })}
              <Input
                label="Aadhaar Number"
                value={form.aadhaarNumber}
                onChangeText={(v) => patch('aadhaarNumber', v)}
                error={errors.aadhaarNumber}
                keyboardType="number-pad"
                maxLength={12}
              />
              <Input
                label="PAN Number"
                value={form.panNumber}
                onChangeText={(v) => patch('panNumber', v.toUpperCase())}
                error={errors.panNumber}
                autoCapitalize="characters"
                maxLength={10}
              />
            </>
          )}

          {step === 4 && (
            <>
              <Dropdown
                label="Agent Type *"
                value={form.agentType}
                options={[...AGENT_TYPE_OPTIONS]}
                onSelect={(v) => patch('agentType', v)}
                error={errors.agentType}
              />
              <MultiSelectDropdown
                label="Preferred Department *"
                placeholder="Select departments"
                values={form.preferredDepartments}
                options={DEPARTMENT_OPTIONS}
                onChange={(v) => patch('preferredDepartments', v)}
                error={errors.preferredDepartments}
              />
              <MultiSelectDropdown
                label="Allowed Work *"
                placeholder="Select allowed work"
                values={form.allowedWork}
                options={ALLOWED_WORK_OPTIONS}
                onChange={(v) => patch('allowedWork', v)}
                error={errors.allowedWork}
              />
              <Dropdown
                label="Assigned Manager *"
                placeholder="Select manager"
                value={managerLabel}
                options={managerSelectOptions.map((o) => o.label)}
                onSelect={(label) => {
                  const match = managerSelectOptions.find((o) => o.label === label);
                  if (!match) return;
                  setForm((prev) => ({
                    ...prev,
                    assignedManagerId: match.value,
                    assignedManager: match.label,
                  }));
                  setErrors((prev) => {
                    if (!prev.assignedManagerId) return prev;
                    const next = { ...prev };
                    delete next.assignedManagerId;
                    return next;
                  });
                }}
                error={errors.assignedManagerId}
              />
              <Input label="Branch" value={form.branch} onChangeText={(v) => patch('branch', v)} />
              <Dropdown
                label="Training Status"
                value={form.trainingStatus}
                options={[...TRAINING_STATUS_OPTIONS]}
                onSelect={(v) => patch('trainingStatus', v)}
              />
            </>
          )}

          {step === 5 && (
            <>
              <Input
                label="Account Number"
                required
                value={form.accountNumber}
                onChangeText={(v) => patch('accountNumber', v)}
                error={errors.accountNumber}
                keyboardType="number-pad"
              />
              <Input
                label="Confirm Account Number"
                required
                value={form.confirmAccountNumber}
                onChangeText={(v) => patch('confirmAccountNumber', v)}
                error={errors.confirmAccountNumber}
                keyboardType="number-pad"
              />
              <Input
                label="IFSC Code"
                required
                value={form.ifscCode}
                onChangeText={(v) => patch('ifscCode', v.toUpperCase())}
                error={errors.ifscCode}
                autoCapitalize="characters"
                maxLength={11}
              />
              <Text style={styles.notice}>
                Incentive / commission payout only. This person is not an employee.
              </Text>
            </>
          )}

          {step === 6 && (
            <>
              <ToggleSwitch
                label="I accept the incentive / commission payout policy"
                description="Required before submitting for admin approval"
                value={form.policyAccepted}
                onValueChange={(v) => patch('policyAccepted', v)}
              />
              {errors.policyAccepted ? (
                <Text style={styles.fieldError}>{errors.policyAccepted}</Text>
              ) : null}
              <Text style={styles.notice}>
                Submitting sends this profile for admin approval. Agent ID is issued only after an
                authorized admin approves it. Catalog status stays inactive until then.
              </Text>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < ONBOARDING_STEPS.length - 1 ? (
            <Button title="Next" onPress={handleNext} loading={saving} />
          ) : (
            <View style={styles.footerActions}>
              <Button
                title="Save Draft"
                variant="outline"
                onPress={() => handleSave('draft')}
                loading={saving}
                style={{ flex: 1 }}
              />
              <Button
                title="Submit for Approval"
                onPress={() => handleSave('pending_approval')}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textHeading },
  headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: spacing.sm,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary, width: 22 },
  stepDotDone: { backgroundColor: colors.primaryLight },
  form: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  stepDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: spacing.xs,
  },
  requiredMark: { color: colors.danger },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  dateTriggerError: { borderColor: colors.danger },
  dateValue: { fontSize: 15, color: colors.text, fontWeight: '500' },
  datePlaceholder: { color: colors.textMuted },
  dateDoneBtn: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateDoneText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  fieldError: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  copyBtn: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  copyBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  docBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    minHeight: 88,
  },
  docImage: { width: '100%', height: 120 },
  docPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: 6,
  },
  docLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  docDone: {
    padding: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  notice: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
