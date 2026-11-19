import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { LeveledLosslessDraftChoice } from '../../../engine/homebrewNestedSerializers';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { CHOICE_KIND_LABELS, summarizeDraftChoice } from '../ChoiceDefinitionEditor';
import { styles } from './classBuilderStyles';

export function LevelChoicesSection({ levelChoicesList, setOpenChoiceId, deleteLevelChoice, addChoiceLevel, setAddChoiceLevel, addLevelChoice }: {
  levelChoicesList: LeveledLosslessDraftChoice[];
  setOpenChoiceId: Dispatch<SetStateAction<string | null>>;
  deleteLevelChoice: (localId: string) => void;
  addChoiceLevel: string;
  setAddChoiceLevel: Dispatch<SetStateAction<string>>;
  addLevelChoice: () => void;
}) {
  return (
    <>
      {/* ── 5b. Per-Level Player Choices ──────────────────────────────── */}
      <View style={styles.divider} />
      <Text style={styles.fieldLabel}>Per-Level Player Choices</Text>
      <Text style={styles.hint}>
        A real choice the player resolves at a specific level — e.g. "at level 3,
        choose one tool proficiency." Distinct from a Feature above: this doesn't
        grant anything by itself, it queues a pick.
      </Text>
      {levelChoicesList.length === 0 ? (
        <Text style={styles.emptyNote}>No player choices added yet.</Text>
      ) : (
        Array.from(new Set(levelChoicesList.map(c => c.level))).sort((a, b) => a - b).map(lvl => (
          <View key={lvl} style={styles.featureLevelGroup}>
            <Text style={styles.featureLevelLabel}>LEVEL {lvl}</Text>
            {levelChoicesList.filter(c => c.level === lvl).map(c => (
              <Pressable key={c.localId} style={styles.featureItem} onPress={() => setOpenChoiceId(c.localId)}>
                <View style={styles.featureItemBody}>
                  <Text style={styles.featureItemName}>{CHOICE_KIND_LABELS[c.kind]} choice</Text>
                  <Text style={styles.featureItemDesc} numberOfLines={1}>{summarizeDraftChoice(c)}</Text>
                </View>
                <Pressable style={styles.featureDeleteBtn} onPress={() => deleteLevelChoice(c.localId)} hitSlop={8}>
                  <Text style={styles.featureDeleteTxt}>✕</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))
      )}
      <View style={styles.inlineAddRow}>
        <TextInput
          style={[styles.input, styles.smallInput]}
          value={addChoiceLevel}
          onChangeText={setAddChoiceLevel}
          keyboardType="number-pad"
          placeholder="Lv"
          placeholderTextColor={Colors.textDim}
        />
        <Pressable style={[styles.inlineAddBtn, { flex: 1 }]} onPress={addLevelChoice}>
          <Text style={styles.inlineAddTxt}>+ Add Player Choice</Text>
        </Pressable>
      </View>
    </>
  );
}
