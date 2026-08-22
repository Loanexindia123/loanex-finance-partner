import React, { memo } from 'react';
import { StyleProp, View, ViewStyle, StyleSheet } from 'react-native';
import { Image, ImageContentFit, ImageProps } from 'expo-image';
import { Colors } from '../../constants/theme';

type AppImageProps = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /** High for above-the-fold (first banner / PDP hero). */
  priority?: ImageProps['priority'];
  transition?: number;
  recyclingKey?: string;
  onLoad?: ImageProps['onLoad'];
};

/**
 * Shared product/banner image with disk+memory cache and a light placeholder.
 * Reuses the same URI cache key across screens so Home → Card → Cart don't re-download.
 */
export const AppImage = memo(function AppImage({
  uri,
  style,
  contentFit = 'cover',
  priority,
  transition = 200,
  recyclingKey,
  onLoad,
}: AppImageProps) {
  const sourceUri = (uri ?? '').trim();

  if (!sourceUri) {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <View style={[styles.placeholder, style]}>
      <Image
        source={{ uri: sourceUri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? sourceUri}
        transition={transition}
        priority={priority}
        onLoad={onLoad}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: { backgroundColor: Colors.surfaceAlt, overflow: 'hidden' },
});
