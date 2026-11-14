// src/components/RecordPicture.tsx
// A content record's picture where the record is shown (content/recordPictures.ts): the icon beside its name in a list, and the large
// picture (or the icon when there is none) on its detail page. Nothing is drawn for a record without one.
import { Image, StyleSheet } from 'react-native';
import { picturesOf, pictureBytes, DISPLAY_MAX_BYTES } from '../content/recordPictures';
import { Colors, Radius, Spacing } from '../theme';

export function RecordIcon({ record, size = 28 }: { record: unknown; size?: number }) {
  const { imageUri } = picturesOf(record);
  if (!imageUri || pictureBytes(imageUri) > DISPLAY_MAX_BYTES) return null;
  return <Image source={{ uri: imageUri }} style={[styles.icon, { width: size, height: size }]} accessibilityIgnoresInvertColors />;
}

export function RecordDetailPicture({ record }: { record: unknown }) {
  const { imageUri, imageDetailUri } = picturesOf(record);
  const uri = imageDetailUri ?? imageUri;
  if (!uri || pictureBytes(uri) > DISPLAY_MAX_BYTES) return null;
  return <Image source={{ uri }} style={styles.detail} resizeMode="contain" accessibilityLabel="Picture" />;
}

const styles = StyleSheet.create({
  icon: { borderRadius: Radius.sm, backgroundColor: Colors.surfaceHigh },
  detail: { width: '100%', height: 200, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh, marginVertical: Spacing.sm },
});
