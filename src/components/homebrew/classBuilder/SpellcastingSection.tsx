import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { Ability, type SpellList, CharClass } from '../../../engine/types';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { SPELL_ABILITIES, ABILITY_LABELS, SPELL_STYLES, SPELL_PREP_POLICIES } from './classBuilderModel';
import { styles } from './classBuilderStyles';
import { SectionHeader } from './SectionHeader';

export function SpellcastingSection({ setIsCaster, isCaster, spellAbilities, toggleSpellAbility, spellStyle, setSpellStyle, spellPrepPolicy, setSpellPrepPolicy, spellSource, setSpellSource, savedSpellLists, borrowableClasses, spellStartLevel, setSpellStartLevel }: {
  setIsCaster: Dispatch<SetStateAction<boolean>>;
  isCaster: boolean;
  spellAbilities: Ability[];
  toggleSpellAbility: (ab: Ability) => void;
  spellStyle: "full" | "half" | "pact";
  setSpellStyle: Dispatch<SetStateAction<"full" | "half" | "pact">>;
  spellPrepPolicy: "known" | "spellbook_prepared" | "full_list_prepared";
  setSpellPrepPolicy: Dispatch<SetStateAction<"known" | "spellbook_prepared" | "full_list_prepared">>;
  spellSource: string;
  setSpellSource: Dispatch<SetStateAction<string>>;
  savedSpellLists: SpellList[];
  borrowableClasses: CharClass[];
  spellStartLevel: string;
  setSpellStartLevel: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
      {/* ── 4. Spellcasting ───────────────────────────────────────────── */}
      <View style={styles.divider} />
      <SectionHeader title="Spellcasting" n={4} />

      <Pressable style={styles.toggleRow} onPress={() => setIsCaster(v => !v)}>
        <View style={[styles.toggle, isCaster && styles.toggleOn]}>
          <View style={[styles.toggleThumb, isCaster && styles.toggleThumbOn]} />
        </View>
        <Text style={styles.toggleLabel}>
          {isCaster ? 'Spellcasting class' : 'Non-spellcasting (martial)'}
        </Text>
      </Pressable>

      {isCaster && (
        <View style={styles.spellConfig}>
          <Text style={styles.fieldLabel}>Spellcasting Ability</Text>
          <Text style={styles.hint}>
            Select one for a fixed ability, or two+ for a rare case where the
            player chooses their casting ability at creation.
          </Text>
          <View style={styles.chipRow}>
            {SPELL_ABILITIES.map(ab => {
              const active = spellAbilities.includes(ab);
              return (
                <Pressable key={ab}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSpellAbility(ab)}
                >
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                    {ABILITY_LABELS[ab]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {spellAbilities.length >= 2 && (
            <Text style={styles.warn}>
              ℹ Player will choose between {spellAbilities.map(a => a.toUpperCase()).join(', ')} at creation.
            </Text>
          )}

          <Text style={styles.fieldLabel}>Slot Table</Text>
          {SPELL_STYLES.map(s => {
            const active = spellStyle === s.key;
            return (
              <Pressable key={s.key}
                style={[styles.styleRow, active && styles.styleRowActive]}
                onPress={() => setSpellStyle(s.key)}
              >
                <View style={[styles.styleRadio, active && styles.styleRadioActive]}>
                  {active && <View style={styles.styleRadioDot} />}
                </View>
                <View>
                  <Text style={[styles.styleLabel, active && styles.styleLabelActive]}>
                    {s.label}
                  </Text>
                  <Text style={styles.styleSub}>{s.sub}</Text>
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.fieldLabel}>Preparation Model</Text>
          <Text style={styles.hint}>
            How this class's LEVELED spells (not cantrips) become castable —
            independent of Slot Table above (Wizard and Sorcerer are both
            Full Caster but opposite preparation models).
          </Text>
          {SPELL_PREP_POLICIES.map(p => {
            const active = spellPrepPolicy === p.key;
            return (
              <Pressable key={p.key}
                style={[styles.styleRow, active && styles.styleRowActive]}
                onPress={() => setSpellPrepPolicy(p.key)}
              >
                <View style={[styles.styleRadio, active && styles.styleRadioActive]}>
                  {active && <View style={styles.styleRadioDot} />}
                </View>
                <View>
                  <Text style={[styles.styleLabel, active && styles.styleLabelActive]}>
                    {p.label}
                  </Text>
                  <Text style={styles.styleSub}>{p.sub}</Text>
                </View>
              </Pressable>
            );
          })}

          <Text style={styles.fieldLabel}>Spell List</Text>
          <Text style={styles.hint}>
            Which spells this class picks from by default. Choose one of your saved Spell Lists or borrow
            another class's list. (A player can still switch to a different list while picking.)
          </Text>
          <View style={styles.chipRow}>
            <Pressable style={[styles.chip, spellSource === 'own' && styles.chipActive]} onPress={() => setSpellSource('own')}>
              <Text style={[styles.chipTxt, spellSource === 'own' && styles.chipTxtActive]}>This class's own</Text>
            </Pressable>
          </View>
          {savedSpellLists.length > 0 && (
            <>
              <Text style={styles.hint}>Your Spell Lists</Text>
              <View style={styles.chipRow}>
                {savedSpellLists.map(l => (
                  <Pressable key={l.id} style={[styles.chip, spellSource === `list:${l.id}` && styles.chipActive]} onPress={() => setSpellSource(`list:${l.id}`)}>
                    <Text style={[styles.chipTxt, spellSource === `list:${l.id}` && styles.chipTxtActive]}>{l.name} ({l.spellIds.length})</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={styles.hint}>Another class's list</Text>
          <View style={styles.chipRow}>
            {borrowableClasses.map(c => (
              <Pressable key={c.id} style={[styles.chip, spellSource === `class:${c.id}` && styles.chipActive]} onPress={() => setSpellSource(`class:${c.id}`)}>
                <Text style={[styles.chipTxt, spellSource === `class:${c.id}` && styles.chipTxtActive]}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
          {savedSpellLists.length === 0 && (
            <Text style={styles.hint}>No saved Spell Lists yet. Create one under Homebrew, then pick it here.</Text>
          )}

          <Text style={styles.fieldLabel}>Spellcasting Begins at Level</Text>
          <TextInput
            style={[styles.input, styles.smallInput]}
            value={spellStartLevel}
            onChangeText={setSpellStartLevel}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={Colors.textDim}
          />
          <Text style={styles.hint}>
            Set to 2+ for classes where slots begin later (e.g. Paladin starts at level 2).
          </Text>
        </View>
      )}
    </>
  );
}
