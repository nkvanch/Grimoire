// ============================================================================
// FILE: src/components/homebrew/OriginFields.tsx
// "Where this came from": a name and an optional link for homebrew that was not made in Grimoire (a book, a Reddit post, a
// creator's PDF). Shared by every homebrew builder; the value is saved on the content as `origin` (see ContentOrigin).
// ============================================================================
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { ContentOrigin } from '../../engine/types';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function OriginFields({ value, onChange }: { value: ContentOrigin | undefined; onChange: (next: ContentOrigin | undefined) => void }) {
  const name = value?.name ?? '';
  const link = value?.link ?? '';
  const update = (patch: Partial<ContentOrigin>) => {
    const next = { name, link, ...patch };
    onChange(next.name === '' && next.link === '' ? undefined : { name: next.name, ...(next.link !== '' ? { link: next.link } : {}) });
  };
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Source (optional)</Text>
      <TextInput style={styles.input} value={name} onChangeText={v => update({ name: v })}
        placeholder="Where it came from: book, creator or post title" placeholderTextColor={Colors.textDim} />
      <TextInput style={styles.input} value={link} onChangeText={v => update({ link: v })}
        placeholder="Link (optional)" placeholderTextColor={Colors.textDim} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <Text style={styles.note}>Kept with the content and shown where it appears, so anyone it is shared with can trace it back.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { gap: Spacing.xs, marginTop: Spacing.md },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, fontWeight: FontWeight.bold },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  note:  { fontSize: FontSize.xs, color: Colors.textDim },
});

/** The origin to save: trimmed, or undefined when there is nothing to record. */
export function cleanOrigin(origin: ContentOrigin | undefined): ContentOrigin | undefined {
  const name = (origin?.name ?? '').trim();
  const link = (origin?.link ?? '').trim();
  if (!name && !link) return undefined;
  return { name: name || link, ...(name && link ? { link } : {}) };
}
