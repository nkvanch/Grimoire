// app/creation/feature-choices.tsx
// The creation hub's "Class features" step: resolves the feature picks (kind 'feature_pool') a class, subclass or species asks
// for, such as Fighting Style, Hunter's Prey, Defensive Tactics or Metamagic, one at a time with the same FeaturePoolPicker the
// Features tab uses, then returns to the hub. Without it a character made above 1st level could not make these picks while
// being created.
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '../../src/components/AccessibleControls';
import { useRouter } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { FeaturePoolPicker } from '../../src/components/FeaturePoolPicker';
import { pickableFeatureChoices } from '../../src/content/creationProgress';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../src/theme';

export default function FeatureChoicesScreen() {
  const router   = useRouter();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);

  const pending = draft ? pickableFeatureChoices(draft) : [];   // a pick with too few options left is left for the sheet
  const choice  = pending[0] ?? null;

  useEffect(() => {
    if (!draft) router.replace('/creation/name');
    else if (!choice) router.replace('/creation/hub');
  }, [draft, choice?.id]);

  if (!draft || !choice) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {pending.length === 1 ? 'Last feature pick' : `${pending.length} feature picks left`}
      </Text>
      <FeaturePoolPicker
        key={choice.id}
        entity={draft}
        choice={choice}
        rules={rules}
        onResolved={updated => setDraft(updated)}
        onClose={() => router.replace('/creation/hub')}
      />
      <Pressable style={styles.backBtn} onPress={() => router.replace('/creation/hub')}>
        <Text style={styles.backBtnText}>Back to the hub</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.lg },
  progress: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  backBtn: { marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.md, alignItems: 'center' },
  backBtnText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
