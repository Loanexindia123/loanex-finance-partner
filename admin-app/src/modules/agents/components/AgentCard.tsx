import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Agent } from '../../../types/agent';
import { colors } from '../../../theme/colors';
import { radius, shadow, spacing } from '../../../theme/spacing';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';

interface AgentCardProps {
  agent: Agent;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AgentCard({ agent, onView, onEdit, onDelete }: AgentCardProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const active = agent.status === 'active';
  const formStatus = String(agent.formStatus || '').trim().toLowerCase();
  const formStatusLabel =
    formStatus === 'pending_approval'
      ? 'Pending Approval'
      : formStatus === 'approved'
        ? 'Approved'
        : formStatus === 'rejected'
          ? 'Rejected'
          : formStatus === 'draft'
            ? 'Draft'
            : '';

  return (
    <View style={[styles.card, shadow.sm, isTablet && styles.cardTablet]}>
      <View style={styles.content}>
        {agent.profilePhoto ? (
          <Image
            source={{ uri: resolveMediaUrl(agent.profilePhoto) }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person-outline" size={28} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {agent.fullName || 'Unnamed Agent'}
            </Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    formStatus === 'pending_approval'
                      ? colors.warningLight
                      : formStatus === 'approved' || active
                        ? colors.successLight
                        : formStatus === 'rejected'
                          ? colors.dangerLight
                          : colors.borderLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      formStatus === 'pending_approval'
                        ? colors.warning
                        : formStatus === 'approved' || active
                          ? colors.success
                          : formStatus === 'rejected'
                            ? colors.danger
                            : colors.textSecondary,
                  },
                ]}
              >
                {formStatusLabel || (active ? 'Active' : 'Inactive')}
              </Text>
            </View>
          </View>

          {agent.agentId ? (
            <Text style={styles.meta} numberOfLines={1}>
              {agent.agentId}
            </Text>
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {agent.mobile}
          </Text>
          {agent.email ? (
            <Text style={styles.meta} numberOfLines={1}>
              {agent.email}
            </Text>
          ) : null}
          {(agent.city || agent.state) && (
            <Text style={styles.meta} numberOfLines={1}>
              {[agent.city, agent.state].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onView} activeOpacity={0.7}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text style={styles.actionLabel}>View</Text>
        </TouchableOpacity>
        {onEdit ? (
          <>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionBtn} onPress={onEdit} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={18} color={colors.accentDark} />
              <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Edit</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {onDelete ? (
          <>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionBtn} onPress={onDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardTablet: { flex: 1, marginHorizontal: spacing.xs },
  content: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.borderLight,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textHeading,
  },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  actionDivider: { width: 1, backgroundColor: colors.borderLight },
  actionLabel: { fontSize: 13, fontWeight: '600', color: colors.primary },
  actionLabelPrimary: { color: colors.accentDark },
  actionLabelDanger: { color: colors.danger },
});
