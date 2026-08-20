import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { registerPendingImage, type PendingImageFile } from './pendingImages';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export type PickedProductImage = PendingImageFile;

function guessName(uri: string, mimeType?: string | null): string {
  const fromUri = uri.split('/').pop()?.split('?')[0];
  if (fromUri && /\.(jpe?g|png|webp|gif)$/i.test(fromUri)) return fromUri;
  const ext =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/gif'
          ? 'gif'
          : 'jpg';
  return `product-${Date.now()}.${ext}`;
}

/**
 * Open device/library picker (Admin Web equivalent of file input).
 * Registers the local URI for deferred upload on product save.
 */
export async function pickProductImage(): Promise<PickedProductImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission required', 'Allow photo library access to upload product images.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 0.9,
    exif: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'image/jpeg';
  if (asset.fileSize != null && asset.fileSize > MAX_BYTES) {
    Alert.alert('Image too large', 'Images must be 5MB or smaller.');
    return null;
  }
  if (mimeType && !ACCEPT_TYPES.includes(mimeType) && Platform.OS !== 'web') {
    // Some Android assets omit mimeType; still allow common image URIs.
    if (!mimeType.startsWith('image/')) {
      Alert.alert('Unsupported file', 'Please choose a JPG, PNG, WEBP, or GIF image.');
      return null;
    }
  }

  const file: PendingImageFile = {
    uri: asset.uri,
    name: asset.fileName || guessName(asset.uri, mimeType),
    type: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
  };
  registerPendingImage(file);
  return file;
}
