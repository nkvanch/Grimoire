import { Dispatch, SetStateAction } from 'react';
import { Text, View } from 'react-native';
import type { RecordPictures } from '../../../content/recordPictures';
import { gameIdForRuleset } from '../../../content/rulesets';
import { type ContentOrigin, RulesetId, Ability } from '../../../engine/types';
import { Colors } from '../../../theme';
import { TextInput, Pressable } from '../../AccessibleControls';
import { NAME_INPUT } from '../../nameInput';
import { GameRulesetPicker } from '../GameRulesetPicker';
import { OriginFields } from '../OriginFields';
import { PictureField } from '../PictureField';
import { HIT_DICE, ABILITIES, ABILITY_LABELS } from './classBuilderModel';
import { styles } from './classBuilderStyles';
import { SectionHeader } from './SectionHeader';

export function BasicsSection({ pictures, setPictures, name, setName, origin, setOrigin, rulesetId, setRulesetId, draftRulesetId, hitDie, setHitDie, hpAbility, setHpAbility, description, setDescription }: {
  pictures: RecordPictures;
  setPictures: Dispatch<SetStateAction<RecordPictures>>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  origin: ContentOrigin | undefined;
  setOrigin: Dispatch<SetStateAction<ContentOrigin | undefined>>;
  rulesetId: RulesetId | undefined;
  setRulesetId: Dispatch<SetStateAction<RulesetId | undefined>>;
  draftRulesetId: RulesetId | undefined;
  hitDie: 4 | 6 | 8 | 10 | 12;
  setHitDie: Dispatch<SetStateAction<4 | 6 | 8 | 10 | 12>>;
  hpAbility: Ability;
  setHpAbility: Dispatch<SetStateAction<Ability>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
      {/* ── 1. Basics ─────────────────────────────────────────────────── */}
      <SectionHeader title="Basics" n={1} />

      <PictureField value={pictures} onChange={setPictures} />
      <Text style={styles.fieldLabel}>Class Name *</Text>
      <TextInput {...NAME_INPUT} style={styles.input} value={name} onChangeText={setName}
        placeholder="e.g. Runesmith" placeholderTextColor={Colors.textDim} />

      <OriginFields value={origin} onChange={setOrigin} />

      <Text style={styles.fieldLabel}>Game / Ruleset</Text>
      <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(draftRulesetId)} />

      <Text style={styles.fieldLabel}>Hit Die</Text>
      <View style={styles.chipRow}>
        {HIT_DICE.map(d => (
          <Pressable key={d} style={[styles.chip, hitDie === d && styles.chipActive]}
            onPress={() => setHitDie(d)}>
            <Text style={[styles.chipTxt, hitDie === d && styles.chipTxtActive]}>d{d}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>HP Ability</Text>
      <Text style={styles.hint}>Which ability's modifier adds to HP gain each level. Standard is Constitution.</Text>
      <View style={styles.chipRow}>
        {ABILITIES.map(ab => (
          <Pressable key={ab} style={[styles.chip, hpAbility === ab && styles.chipActive]}
            onPress={() => setHpAbility(ab)}>
            <Text style={[styles.chipTxt, hpAbility === ab && styles.chipTxtActive]}>{ABILITY_LABELS[ab]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe this class…"
        placeholderTextColor={Colors.textDim}
        multiline
        textAlignVertical="top"
      />
    </>
  );
}
