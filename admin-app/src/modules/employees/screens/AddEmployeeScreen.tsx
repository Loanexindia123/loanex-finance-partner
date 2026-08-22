import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '../../../components/ui/Input';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Button } from '../../../components/ui/Button';
import { createEmployee, updateEmployee, getEmployeeById } from '../../../services/employeeService';
import { uploadProductImage } from '../../../services/productService';
import { pickProductImage } from '../../products/utils/pickProductImage';
import {
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  SHIFT_OPTIONS,
  WORK_MODE_OPTIONS,
  type EmployeePayload,
} from '../../../types/employee';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEmployee'>;

type DocKey =
  | 'profilePhoto'
  | 'aadhaarCard'
  | 'panCard'
  | 'addressProof'
  | 'cancelledCheque'
  | 'signature';

const DOC_FIELDS: { key: DocKey; label: string }[] = [
  { key: 'profilePhoto', label: 'Profile Photo' },
  { key: 'aadhaarCard', label: 'Aadhaar Card' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'addressProof', label: 'Address Proof' },
  { key: 'cancelledCheque', label: 'Cancelled Cheque' },
  { key: 'signature', label: 'Signature' },
];

export function AddEmployeeScreen({ navigation, route }: Props) {
  const isEdit = route.params?.mode === 'edit';
  const employeeId = route.params?.employeeId;

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [branch, setBranch] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [reportingPerson, setReportingPerson] = useState('');
  const [shift, setShift] = useState('');
  const [monthlyCtc, setMonthlyCtc] = useState('');
  const [basicSalary, setBasicSalary] = useState('');
  const [salaryEffectiveFrom, setSalaryEffectiveFrom] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [docs, setDocs] = useState<Record<DocKey, string>>({
    profilePhoto: '',
    aadhaarCard: '',
    panCard: '',
    addressProof: '',
    cancelledCheque: '',
    signature: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [loading, setLoading] = useState(Boolean(isEdit && employeeId));

  React.useEffect(() => {
    if (!isEdit || !employeeId) return;
    getEmployeeById(employeeId)
      .then((e) => {
        setFullName(e.fullName);
        setDateOfBirth(e.dateOfBirth);
        setMobile(e.mobile);
        setEmail(e.email);
        setGender(e.gender);
        setDepartment(e.department);
        setDesignation(e.designation);
        setEmploymentType(e.employmentType);
        setDateOfJoining(e.dateOfJoining);
        setBranch(e.branch);
        setWorkMode(e.workMode);
        setReportingPerson(e.reportingPerson);
        setShift(e.shift);
        setMonthlyCtc(e.monthlyCtc);
        setBasicSalary(e.basicSalary);
        setSalaryEffectiveFrom(e.salaryEffectiveFrom);
        setAccountHolderName(e.accountHolderName);
        setAccountNumber(e.accountNumber);
        setIfscCode(e.ifscCode);
        setDocs({
          profilePhoto: e.profilePhoto,
          aadhaarCard: e.aadhaarCard,
          panCard: e.panCard,
          addressProof: e.addressProof,
          cancelledCheque: e.cancelledCheque,
          signature: e.signature,
        });
      })
      .catch(() => Alert.alert('Error', 'Failed to load employee'))
      .finally(() => setLoading(false));
  }, [isEdit, employeeId]);

  const uploadDoc = async (key: DocKey) => {
    try {
      const picked = await pickProductImage();
      if (!picked?.uri) return;
      setUploading(key);
      const uploaded = await uploadProductImage(picked);
      setDocs((prev) => ({ ...prev, [key]: uploaded.url }));
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message || 'Could not upload document');
    } finally {
      setUploading(null);
    }
  };

  const buildPayload = (formStatus: 'draft' | 'pending'): EmployeePayload => ({
    fullName: fullName.trim(),
    dateOfBirth: dateOfBirth.trim(),
    mobile: mobile.trim(),
    email: email.trim(),
    gender,
    department: department.trim(),
    designation: designation.trim(),
    employmentType,
    dateOfJoining: dateOfJoining.trim(),
    branch: branch.trim(),
    workMode,
    reportingPerson: reportingPerson.trim(),
    shift,
    monthlyCtc: monthlyCtc.trim(),
    basicSalary: basicSalary.trim(),
    salaryEffectiveFrom: salaryEffectiveFrom.trim(),
    accountHolderName: accountHolderName.trim(),
    accountNumber: accountNumber.trim(),
    ifscCode: ifscCode.trim().toUpperCase(),
    ...docs,
    formStatus,
  });

  const save = async (formStatus: 'draft' | 'pending') => {
    if (formStatus === 'pending' && !fullName.trim()) {
      Alert.alert('Required', 'Full Name is required for approval submission');
      return;
    }
    try {
      setSaving(true);
      const payload = buildPayload(formStatus);
      if (isEdit && employeeId) {
        await updateEmployee(employeeId, payload);
      } else {
        await createEmployee(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(
        'Save failed',
        err?.response?.data?.message || err?.message || 'Could not save employee',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{isEdit ? 'Edit Employee' : 'Add Employee'}</Text>
        </View>
        {loading ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>Personal</Text>
            <Input label="Full Name *" value={fullName} onChangeText={setFullName} />
            <Input
              label="Date of Birth (YYYY-MM-DD) *"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1990-01-15"
            />
            <Input
              label="Mobile *"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Dropdown
              label="Gender"
              value={gender}
              options={[...GENDER_OPTIONS]}
              onSelect={setGender}
            />

            <Text style={styles.section}>Job</Text>
            <Input label="Department *" value={department} onChangeText={setDepartment} />
            <Input label="Designation *" value={designation} onChangeText={setDesignation} />
            <Dropdown
              label="Employment Type *"
              value={employmentType}
              options={[...EMPLOYMENT_TYPE_OPTIONS]}
              onSelect={setEmploymentType}
            />
            <Input
              label="Date of Joining (YYYY-MM-DD) *"
              value={dateOfJoining}
              onChangeText={setDateOfJoining}
            />
            <Input label="Branch *" value={branch} onChangeText={setBranch} />
            <Dropdown
              label="Work Mode *"
              value={workMode}
              options={[...WORK_MODE_OPTIONS]}
              onSelect={setWorkMode}
            />
            <Input
              label="Reporting Person *"
              value={reportingPerson}
              onChangeText={setReportingPerson}
            />
            <Dropdown
              label="Shift *"
              value={shift}
              options={[...SHIFT_OPTIONS]}
              onSelect={setShift}
            />

            <Text style={styles.section}>Salary</Text>
            <Input
              label="Monthly CTC *"
              value={monthlyCtc}
              onChangeText={setMonthlyCtc}
              keyboardType="decimal-pad"
            />
            <Input
              label="Basic Salary *"
              value={basicSalary}
              onChangeText={setBasicSalary}
              keyboardType="decimal-pad"
            />
            <Input
              label="Salary Effective From *"
              value={salaryEffectiveFrom}
              onChangeText={setSalaryEffectiveFrom}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.section}>Documents</Text>
            {DOC_FIELDS.map((field) => {
              const uri = docs[field.key];
              const preview = resolveMediaUrl(uri);
              return (
                <View key={field.key} style={styles.docRow}>
                  <Text style={styles.docLabel}>{field.label} *</Text>
                  <TouchableOpacity
                    style={styles.docBtn}
                    onPress={() => uploadDoc(field.key)}
                    disabled={uploading === field.key}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={styles.docBtnText}>
                      {uploading === field.key ? 'Uploading…' : uri ? 'Replace' : 'Upload'}
                    </Text>
                  </TouchableOpacity>
                  {preview ? (
                    <Image source={{ uri: preview }} style={styles.docPreview} />
                  ) : null}
                </View>
              );
            })}

            <Text style={styles.section}>Bank</Text>
            <Input
              label="Account Holder Name *"
              value={accountHolderName}
              onChangeText={setAccountHolderName}
            />
            <Input
              label="Account Number *"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
            />
            <Input label="IFSC Code *" value={ifscCode} onChangeText={setIfscCode} autoCapitalize="characters" />

            <View style={styles.actions}>
              <Button
                title="Save Draft"
                onPress={() => save('draft')}
                loading={saving}
                variant="secondary"
              />
              <Button
                title="Save for Approval"
                onPress={() => save('pending')}
                loading={saving}
              />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  loading: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  docRow: { gap: 8 },
  docLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  docBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  docBtnText: { color: colors.primary, fontWeight: '600' },
  docPreview: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.border },
});
