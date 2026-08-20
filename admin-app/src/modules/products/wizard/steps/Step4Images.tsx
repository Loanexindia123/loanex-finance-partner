import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useWizard } from '../WizardContext';
import { ImagePlaceholder } from '../../../../components/ui/ImagePlaceholder';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { pickProductImage } from '../../utils/pickProductImage';
import { clearPendingImage, isLocalPendingImageUri } from '../../utils/pendingImages';
import { colors } from '../../../../theme/colors';
import { spacing } from '../../../../theme/spacing';

const GALLERY_LIMIT = 8;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || value.trim().startsWith('/api/');
}

export function Step4Images() {
  const { formData, updateForm } = useWizard();
  const [primaryUrlDraft, setPrimaryUrlDraft] = useState('');
  const [galleryUrlDraft, setGalleryUrlDraft] = useState('');

  const pickPrimary = async () => {
    const file = await pickProductImage();
    if (!file) return;
    if (formData.primaryImage && isLocalPendingImageUri(formData.primaryImage)) {
      clearPendingImage(formData.primaryImage);
    }
    updateForm({ primaryImage: file.uri });
  };

  const clearPrimary = () => {
    if (formData.primaryImage && isLocalPendingImageUri(formData.primaryImage)) {
      clearPendingImage(formData.primaryImage);
    }
    updateForm({ primaryImage: null });
  };

  const addGalleryFromPicker = async () => {
    if (formData.galleryImages.length >= GALLERY_LIMIT) return;
    const file = await pickProductImage();
    if (!file) return;
    updateForm({ galleryImages: [...formData.galleryImages, file.uri] });
  };

  const removeGalleryAt = (index: number) => {
    const uri = formData.galleryImages[index];
    if (uri && isLocalPendingImageUri(uri)) clearPendingImage(uri);
    updateForm({ galleryImages: formData.galleryImages.filter((_, i) => i !== index) });
  };

  const applyPrimaryUrl = () => {
    const url = primaryUrlDraft.trim();
    if (!url || !isHttpUrl(url)) return;
    if (formData.primaryImage && isLocalPendingImageUri(formData.primaryImage)) {
      clearPendingImage(formData.primaryImage);
    }
    updateForm({ primaryImage: url });
    setPrimaryUrlDraft('');
  };

  const addGalleryUrl = () => {
    const url = galleryUrlDraft.trim();
    if (!url || !isHttpUrl(url)) return;
    if (formData.galleryImages.length >= GALLERY_LIMIT) return;
    updateForm({ galleryImages: [...formData.galleryImages, url] });
    setGalleryUrlDraft('');
  };

  const setVariantImage = async (variantId: string) => {
    const file = await pickProductImage();
    if (!file) return;
    updateForm({
      variants: formData.variants.map((v) => {
        if (v.id !== variantId) return v;
        if (v.variantImage && isLocalPendingImageUri(v.variantImage)) {
          clearPendingImage(v.variantImage);
        }
        return { ...v, variantImage: file.uri, saved: false };
      }),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Images</Text>
      <Text style={styles.subheading}>Primary and gallery images used on the storefront.</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Primary Image</Text>
        <Text style={styles.sectionDesc}>
          {formData.primaryImage && isLocalPendingImageUri(formData.primaryImage)
            ? 'Preview only — uploads when you save the product'
            : 'Main product image shown in listings'}
        </Text>
        <ImagePlaceholder
          size="lg"
          imageUri={formData.primaryImage}
          label="Upload image"
          subtitle="Tap to select"
          onPress={() => void pickPrimary()}
        />
        {formData.primaryImage ? (
          <Button title="Remove primary" onPress={clearPrimary} variant="outline" style={styles.mt} />
        ) : null}
        <Text style={styles.urlLabel}>Or use image URL</Text>
        <View style={styles.urlRow}>
          <View style={styles.urlInputWrap}>
            <Input
              placeholder="https://..."
              value={primaryUrlDraft}
              onChangeText={setPrimaryUrlDraft}
              containerStyle={styles.urlInputContainer}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Button
            title="Apply"
            onPress={applyPrimaryUrl}
            size="md"
            variant="secondary"
            style={styles.urlBtn}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Gallery Images</Text>
        <Text style={styles.sectionDesc}>Additional product photos (up to {GALLERY_LIMIT})</Text>
        <View style={styles.grid}>
          {formData.galleryImages.map((uri, i) => (
            <ImagePlaceholder
              key={`${uri}-${i}`}
              size="md"
              imageUri={uri}
              onPress={() => removeGalleryAt(i)}
            />
          ))}
          {formData.galleryImages.length < GALLERY_LIMIT && (
            <ImagePlaceholder
              size="md"
              label="Add Photo"
              subtitle="Tap to add"
              onPress={() => void addGalleryFromPicker()}
            />
          )}
        </View>
        <Text style={styles.urlLabel}>Or add gallery URL</Text>
        <View style={styles.urlRow}>
          <View style={styles.urlInputWrap}>
            <Input
              placeholder="https://..."
              value={galleryUrlDraft}
              onChangeText={setGalleryUrlDraft}
              containerStyle={styles.urlInputContainer}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Button
            title="Add"
            onPress={addGalleryUrl}
            size="md"
            variant="secondary"
            style={styles.urlBtn}
          />
        </View>
      </Card>

      {formData.variantsEnabled && formData.variants.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Variant Images</Text>
          <Text style={styles.sectionDesc}>Assign images to specific variants</Text>
          {formData.variants.map((v) => (
            <View key={v.id} style={styles.variantRow}>
              <Text style={styles.variantLabel}>{v.name}</Text>
              <ImagePlaceholder
                size="sm"
                imageUri={v.variantImage}
                label="Upload"
                onPress={() => void setVariantImage(v.id)}
              />
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.previewSection}>
        <Text style={styles.sectionTitle}>Preview Grid</Text>
        <View style={styles.grid}>
          {formData.primaryImage && (
            <ImagePlaceholder size="md" imageUri={formData.primaryImage} />
          )}
          {formData.galleryImages.map((uri, i) => (
            <ImagePlaceholder key={`prev-${uri}-${i}`} size="md" imageUri={uri} />
          ))}
          {!formData.primaryImage && formData.galleryImages.length === 0 && (
            <Text style={styles.emptyPreview}>No images uploaded yet</Text>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxxl },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textHeading },
  subheading: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xxl },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  variantLabel: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  previewSection: { backgroundColor: colors.borderLight },
  emptyPreview: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
  urlLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  urlInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  urlInputContainer: {
    marginBottom: 0,
    width: '100%',
  },
  urlBtn: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  mt: { marginTop: spacing.md },
});
