import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { NAME_INPUT } from '../../nameInput';
import { EFFECT_KIND_LABELS as TRAIT_KIND_LABELS } from '../TraitEditor';
import { LevelFeature } from './classBuilderModel';
import { styles } from './classBuilderStyles';
import { SectionHeader } from './SectionHeader';

export function LevelFeaturesSection({ sortedLevels, featuresByLevel, setOpenFeatureId, EFFECT_KIND_LABELS, deleteFeature, addLevel, setAddLevel, addName, setAddName, addFeature }: {
  sortedLevels: number[];
  featuresByLevel: Map<number, LevelFeature[]>;
  setOpenFeatureId: Dispatch<SetStateAction<string | null>>;
  EFFECT_KIND_LABELS: Record<string, string>;
  deleteFeature: (localId: string) => void;
  addLevel: string;
  setAddLevel: Dispatch<SetStateAction<string>>;
  addName: string;
  setAddName: Dispatch<SetStateAction<string>>;
  addFeature: () => void;
}) {
  return (
    <>
      {/* ── 5. Per-Level Features ─────────────────────────────────────── */}
      <View style={styles.divider} />
      <SectionHeader title="Per-Level Features" n={5} />
      <Text style={styles.hint}>
        Add the class features characters gain at each level. Tap "+ Add Feature" to begin.
      </Text>

      {sortedLevels.length === 0 ? (
        <Text style={styles.emptyNote}>No features added yet.</Text>
      ) : (
        sortedLevels.map(lvl => (
          <View key={lvl} style={styles.featureLevelGroup}>
            <Text style={styles.featureLevelLabel}>LEVEL {lvl}</Text>
            {featuresByLevel.get(lvl)!.map(f => (
              <Pressable key={f.localId} style={styles.featureItem} onPress={() => setOpenFeatureId(f.localId)}>
                <View style={styles.featureItemBody}>
                  <Text style={styles.featureItemName}>{f.name}</Text>
                  <Text style={styles.featureItemDesc} numberOfLines={1}>{EFFECT_KIND_LABELS[f.effectKind] ?? TRAIT_KIND_LABELS[f.effectKind]}</Text>
                </View>
                <Pressable
                  style={styles.featureDeleteBtn}
                  onPress={() => deleteFeature(f.localId)}
                  hitSlop={8}
                >
                  <Text style={styles.featureDeleteTxt}>✕</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))
      )}

      <Text style={styles.hint}>
        Add a feature by name and level, then tap it to optionally add a description and
        choose what it actually does — an ability score bonus, a skill proficiency, a sense,
        extra movement, or a limited-use ability.
      </Text>
      <View style={styles.inlineAddRow}>
        <TextInput
          style={[styles.input, styles.smallInput]}
          value={addLevel}
          onChangeText={setAddLevel}
          keyboardType="number-pad"
          placeholder="Lv"
          placeholderTextColor={Colors.textDim}
        />
        <TextInput {...NAME_INPUT}
          style={[styles.input, { flex: 1 }]}
          value={addName}
          onChangeText={setAddName}
          placeholder="Feature name (e.g. Second Wind)"
          placeholderTextColor={Colors.textDim}
          onSubmitEditing={addFeature}
        />
        <Pressable style={styles.inlineAddBtn} onPress={addFeature}>
          <Text style={styles.inlineAddTxt}>Add</Text>
        </Pressable>
      </View>
    </>
  );
}
