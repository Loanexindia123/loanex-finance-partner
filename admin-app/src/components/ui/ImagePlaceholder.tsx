import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface ImagePlaceholderProps {
  label?: string;
  subtitle?: string;
  imageUri?: string | null;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  style?: object;
}

export function ImagePlaceholder({
  label = 'Upload Image',
  subtitle = 'Tap to upload',
  imageUri,
  onPress,
  size = 'md',
  style,
}: ImagePlaceholderProps) {
  const sizes = { sm: 80, md: 120, lg: 160 };
  const dim = sizes[size];

  return (
    <TouchableOpacity
      style={[styles.container, { width: dim, height: dim }, style]}
      onPress={onPress || (() => console.log('Upload image'))}
      activeOpacity={0.7}
    >
      {imageUri ? (
        <Image
          source={{ uri: resolveMediaUrl(imageUri) }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.label}>{label}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  icon: { fontSize: 24, marginBottom: spacing.xs },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  subtitle: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
});
