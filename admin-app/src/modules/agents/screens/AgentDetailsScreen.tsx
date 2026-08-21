import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DetailRow } from '../../../components/ui/DetailRow';
import { SectionTitle } from '../../../components/ui/SectionTitle';
import { Button } from '../../../components/ui/Button';
import { getAgentById } from '../../../services/agentService';
import type { Agent } from '../../../types/agent';
import { can } from '../../../auth/rbacStore';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AgentDetails'>;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === false) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

export function AgentDetailsScreen({ navigation, route }: Props) {
  const agentId = route.params.agentId;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAgentById(agentId);
      setAgent(data);
    } catch (error) {
      console.error('[AgentDetails] load failed', error);
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.goBack();
        return true;
      });
      return () => sub.remove();
    }, [load, navigation]),
  );

  const active = agent?.status === 'active';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent Details</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !agent ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Agent not found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, shadow.sm]}>
            {agent.profilePhoto ? (
              <Image
                source={{ uri: resolveMediaUrl(agent.profilePhoto) }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="person-outline" size={40} color={colors.textMuted} />
              </View>
            )}
            <Text style={styles.name}>{agent.fullName}</Text>
            {agent.agentId ? <Text style={styles.agentId}>{agent.agentId}</Text> : null}
            <View
              style={[
                styles.statusPill,
                { backgroundColor: active ? colors.successLight : colors.borderLight },
              ]}
            >
              <Text style={{ color: active ? colors.success : colors.textSecondary, fontWeight: '700' }}>
                {active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <SectionTitle title="Personal" />
          <DetailRow label="Father / Husband" value={display(agent.fatherHusbandName)} />
          <DetailRow label="Mobile" value={display(agent.mobile)} />
          <DetailRow label="WhatsApp" value={display(agent.whatsapp)} />
          <DetailRow label="Email" value={display(agent.email)} />
          <DetailRow label="Gender" value={display(agent.gender)} />
          <DetailRow label="Date of Birth" value={display(agent.dateOfBirth)} />
          <DetailRow label="Education" value={display(agent.education)} />
          <DetailRow label="Occupation" value={display(agent.occupation)} />

          <SectionTitle title="Address" />
          <DetailRow label="Address" value={display(agent.currentAddress)} />
          <DetailRow label="City" value={display(agent.city)} />
          <DetailRow label="State" value={display(agent.state)} />
          <DetailRow label="Pincode" value={display(agent.pincode)} />
          <DetailRow label="Google Location" value={display(agent.googleLocation)} />
          <DetailRow label="Preferred Work Area" value={display(agent.preferredWorkArea)} />
          <DetailRow label="Work Mode" value={display(agent.workMode)} />
          <DetailRow label="Emergency Contact" value={display(agent.emergencyContactName)} />
          <DetailRow label="Emergency Mobile" value={display(agent.emergencyContactMobile)} />

          <SectionTitle title="KYC" />
          <DetailRow label="PAN" value={display(agent.panNumber)} />
          <DetailRow label="Aadhaar" value={display(agent.aadhaarNumber)} />
          <DetailRow label="Aadhaar Front" value={agent.aadhaarFront ? 'Uploaded' : '—'} />
          <DetailRow label="Aadhaar Back" value={agent.aadhaarBack ? 'Uploaded' : '—'} />
          <DetailRow label="PAN Card" value={agent.panCard ? 'Uploaded' : '—'} />
          <DetailRow label="Cancelled Cheque" value={agent.cancelledCheque ? 'Uploaded' : '—'} />
          <DetailRow label="Signature" value={agent.signature ? 'Uploaded' : '—'} />

          <SectionTitle title="Work" />
          <DetailRow label="Agent Type" value={display(agent.agentType)} />
          <DetailRow label="Departments" value={display(agent.preferredDepartments)} />
          <DetailRow label="Allowed Work" value={display(agent.allowedWork)} />
          <DetailRow label="Branch" value={display(agent.branch)} />
          <DetailRow label="Training" value={display(agent.trainingStatus)} />

          <SectionTitle title="Bank & Payout" />
          <DetailRow label="Account Number" value={display(agent.accountNumber)} />
          <DetailRow label="IFSC" value={display(agent.ifscCode)} />
          <DetailRow label="Policy Accepted" value={display(agent.policyAccepted)} />

          {can('freelancers.edit') ? (
            <Button
              title="Edit Agent"
              onPress={() => navigation.navigate('AddAgent', { mode: 'edit', agentId: agent.id })}
              style={styles.editBtn}
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textSecondary, fontSize: 15 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.borderLight,
  },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '800', color: colors.textHeading },
  agentId: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  editBtn: { marginTop: spacing.xl },
});
