// src/components/homebrew/PictureField.tsx
// The picture of a homebrew record, in every builder: an icon (square crop) and, once there is one, an optional large picture.
// What they are and their size limits are in content/recordPictures.ts (the desktop's own rules).
// A picked picture is shrunk to the desktop's sizes (512 px icon, 1024 px detail) and saved as JPEG at quality 70 (PNG kept as PNG); over its
// byte limit it is saved again as JPEG at lower quality, and refused only when even that is too large. Any format the device reads (an
// iPhone's HEIC too) comes out as JPEG or PNG.
import { View, Text, Image, StyleSheet } from 'react-native';
import { Pressable } from '../AccessibleControls';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from '../../utils/alert';
import { RecordPictures, ICON_MAX_BYTES, DETAIL_MAX_BYTES, pictureBytes, replaceIcon, picturesOf, DISPLAY_MAX_BYTES } from '../../content/recordPictures';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

const ICON_SIDE = 512;
const DETAIL_SIDE = 1024;

async function pick(square: boolean, maxSide: number, maxBytes: number): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Grimoire needs photo library access to add a picture.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1,
    allowsEditing: square, ...(square ? { aspect: [1, 1] as [number, number] } : {}),
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.uri) return null;
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    let { width, height } = asset;
    if (square && width !== height) {   // the web picker cannot crop: an icon is the centre square
      const side = Math.min(width, height);
      ctx.crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side });
      width = height = side;
    }
    if (Math.max(width, height) > maxSide) ctx.resize(width >= height ? { width: maxSide } : { height: maxSide });
    const image = await ctx.renderAsync();
    const first = asset.mimeType === 'image/png' ? SaveFormat.PNG : SaveFormat.JPEG;
    for (const [format, compress] of [[first, 0.7], [SaveFormat.JPEG, 0.5], [SaveFormat.JPEG, 0.3]] as const) {
      const out = await image.saveAsync({ format, compress, base64: true });
      const uri = `data:image/${format};base64,${out.base64 ?? ''}`;
      if (out.base64 && picturesOf({ imageUri: uri }).imageUri && pictureBytes(uri) <= maxBytes) return uri;
    }
  } catch (e) {
    Alert.alert('Picture not read', `That picture could not be read: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  Alert.alert('Picture too large', `Even made smaller it is over ${maxBytes / 1024} KB. Pick a simpler picture.`);
  return null;
}

export function PictureField({ value, onChange, label = 'Picture (optional)', detail = true }: {
  value: RecordPictures; onChange: (p: RecordPictures) => void;
  label?: string;
  /** false: the icon only (a character's portrait). */
  detail?: boolean;
}) {
  value = picturesOf(value);   // what is shown and kept passes the format check, whoever passed it in
  const shown = (uri: string, style: object, alt: string) => (pictureBytes(uri) <= DISPLAY_MAX_BYTES
    ? <Image source={{ uri }} style={style} resizeMode="contain" accessibilityLabel={alt} />
    : <Text style={styles.remove}>Too large to show</Text>);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {value.imageUri ? (
        <View style={styles.row}>
          {shown(value.imageUri, styles.icon, 'Picture')}
          <Pressable onPress={() => { void pick(true, ICON_SIDE, ICON_MAX_BYTES).then(uri => uri && onChange(replaceIcon(value, uri))); }} hitSlop={6}>
            <Text style={styles.link}>Change</Text>
          </Pressable>
          <Pressable onPress={() => onChange({})} hitSlop={6}><Text style={styles.remove}>Remove</Text></Pressable>
        </View>
      ) : (
        <Pressable style={styles.add} onPress={() => { void pick(true, ICON_SIDE, ICON_MAX_BYTES).then(uri => uri && onChange(replaceIcon(value, uri))); }}>
          <Text style={styles.addTxt}>📷 Add Picture</Text>
        </Pressable>
      )}
      {detail && value.imageUri && (value.imageDetailUri ? (
        <View style={styles.row}>
          {shown(value.imageDetailUri, styles.detail, 'Large picture')}
          <Pressable onPress={() => onChange({ imageUri: value.imageUri })} hitSlop={6}><Text style={styles.remove}>Remove large picture</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={() => { void pick(false, DETAIL_SIDE, DETAIL_MAX_BYTES).then(uri => uri && onChange({ ...value, imageDetailUri: uri })); }} hitSlop={6}>
          <Text style={styles.link}>+ Large picture for the detail page</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs, marginBottom: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh },
  detail: { width: 120, height: 80, borderRadius: Radius.md, backgroundColor: Colors.surfaceHigh },
  link: { color: Colors.gold, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  remove: { color: Colors.red, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  add: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', padding: Spacing.md, alignItems: 'center',
  },
  addTxt: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
