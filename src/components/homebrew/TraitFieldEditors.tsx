import { View, Text } from 'react-native';
import type { ResourceChoice } from '../../content/classes/knownResources';
import { Ability, DraftTrait } from '../../engine/types';
import { Colors, Spacing } from '../../theme';
import { TextInput, Pressable } from '../AccessibleControls';
import { ABILITIES, ACTION_TYPES } from '../../content/traitCompiler';
import { styles } from './traitEditorStyles';

// ── Reusable: ability score grid ──────────────────────────────────────────────

export function AbilityScoreGrid({ values, onChange }: {
  values: Record<Ability, string>;
  onChange: (a: Ability, v: string) => void;
}) {
  return (
    <View style={styles.abiGrid}>
      {ABILITIES.map(a => (
        <View key={a} style={styles.abiBox}>
          <Text style={styles.abiLabel}>{a.toUpperCase()}</Text>
          <TextInput
            style={styles.abiInput}
            value={values[a]}
            onChangeText={v => onChange(a, v)}
            keyboardType="numbers-and-punctuation"
            placeholder="0"
            placeholderTextColor={Colors.textDim}
            textAlign="center"
          />
        </View>
      ))}
    </View>
  );
}

// ── Trait editor modal — the "droppable window" ───────────────────────────────

/**
 * "Forces a saving throw" for a limited-use ability. The DC scales with the character by default (8 + proficiency +
 * an ability modifier, the way class features do); it can instead follow their spell save DC, or be a fixed number.
 */
export function SaveDcEditor({ trait, set }: { trait: DraftTrait; set: (patch: Partial<DraftTrait>) => void }) {
  const on = !!trait.saveEnabled;
  const mode = trait.saveDcMode ?? 'ability';
  return (
    <View style={{ gap: Spacing.xs }}>
      <Pressable style={styles.toggleRow} onPress={() => set({ saveEnabled: !on })}>
        <View style={[styles.checkbox, on && styles.checkboxChecked]} />
        <Text style={styles.toggleTxt}>Targets make a saving throw against this</Text>
      </Pressable>
      {on && (
        <>
          <Text style={styles.inlineLabel}>They save with</Text>
          <View style={styles.chipWrap}>
            {ABILITIES.map(a => (
              <Pressable key={a} style={[styles.chip, (trait.saveAbility ?? 'wis') === a && styles.chipActive]} onPress={() => set({ saveAbility: a })}>
                <Text style={[styles.chipTxt, (trait.saveAbility ?? 'wis') === a && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.inlineLabel}>Save DC</Text>
          <View style={styles.chipWrap}>
            {([['ability', '8 + proficiency + ability'], ['spell', 'Spell save DC'], ['fixed', 'Fixed number']] as const).map(([k, label]) => (
              <Pressable key={k} style={[styles.chip, mode === k && styles.chipActive]} onPress={() => set({ saveDcMode: k })}>
                <Text style={[styles.chipTxt, mode === k && styles.chipTxtActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {mode === 'ability' && (
            <View style={styles.chipWrap}>
              {ABILITIES.map(a => (
                <Pressable key={a} style={[styles.chip, (trait.saveDcAbility ?? 'cha') === a && styles.chipActive]} onPress={() => set({ saveDcAbility: a })}>
                  <Text style={[styles.chipTxt, (trait.saveDcAbility ?? 'cha') === a && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {mode === 'fixed' && (
            <View style={styles.rowInline}>
              <Text style={styles.inlineLabel}>DC:</Text>
              <TextInput style={[styles.input, styles.smallInput]} value={trait.saveDcFixed ?? ''} onChangeText={v => set({ saveDcFixed: v })} keyboardType="number-pad" />
            </View>
          )}
          <Text style={styles.effectNote}>
            {mode === 'ability' ? 'Grows with the character: their proficiency bonus and that ability modifier are added automatically.'
              : mode === 'spell' ? "Uses the character's own spell save DC." : 'Never changes with level.'}
          </Text>
        </>
      )}
    </View>
  );
}

/** One line under the recharge chips saying what the app will and won't do for the chosen trigger. */
export function RechargeHint({ recharge }: { recharge: 'short_rest' | 'long_rest' | 'dawn' | 'monthly' | 'yearly' | 'other' }) {
  if (recharge === 'dawn') return <Text style={styles.chipTxt}>Restored by the sheet's ☀ Dawn button, not by a rest.</Text>;
  if (recharge === 'monthly' || recharge === 'yearly') return <Text style={styles.chipTxt}>The app keeps no calendar: reset it by hand with + on the sheet when the time comes.</Text>;
  if (recharge === 'other') return <Text style={styles.chipTxt}>Not restored automatically: tap + on the sheet when it recharges.</Text>;
  return null;
}

/** Action, bonus action, reaction (or free text) for a card. */
export function ActionTypePicker({ trait, set }: { trait: DraftTrait; set: (patch: Partial<DraftTrait>) => void }) {
  return (
    <>
      <Text style={styles.inlineLabel}>Action type</Text>
      <View style={styles.chipWrap}>
        {ACTION_TYPES.map(a => (
          <Pressable key={a.key} style={[styles.chip, trait.actionType === a.key && styles.chipActive]} onPress={() => set({ actionType: a.key })}>
            <Text style={[styles.chipTxt, trait.actionType === a.key && styles.chipTxtActive]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      {trait.actionType === 'other' && (
        <TextInput style={styles.input} value={trait.actionTypeOther} onChangeText={v => set({ actionTypeOther: v })}
          placeholder="e.g. Reflexive, Special" placeholderTextColor={Colors.textDim} />
      )}
    </>
  );
}

/** What a pool of this trait's own maximum follows: fixed, the proficiency bonus, an ability modifier, or level times a number. */
export function UsesScalingEditor({ trait, set }: { trait: DraftTrait; set: (patch: Partial<DraftTrait>) => void }) {
  const mode = trait.usesScaling ?? 'none';
  const options = [['none', 'Fixed'], ['proficiency', 'Proficiency bonus'], ['ability', 'Ability modifier'], ['level', 'Level × number']] as const;
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={styles.inlineLabel}>Maximum uses</Text>
      <View style={styles.chipWrap}>
        {options.map(([k, label]) => (
          <Pressable key={k} style={[styles.chip, mode === k && styles.chipActive]} onPress={() => set({ usesScaling: k })}>
            <Text style={[styles.chipTxt, mode === k && styles.chipTxtActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'ability' && (
        <View style={styles.chipWrap}>
          {ABILITIES.map(a => (
            <Pressable key={a} style={[styles.chip, (trait.usesScalingAbility ?? 'cha') === a && styles.chipActive]} onPress={() => set({ usesScalingAbility: a })}>
              <Text style={[styles.chipTxt, (trait.usesScalingAbility ?? 'cha') === a && styles.chipTxtActive]}>{a.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {mode === 'level' && (
        <View style={styles.rowInline}>
          <Text style={styles.inlineLabel}>Per level:</Text>
          <TextInput style={[styles.input, styles.smallInput]} value={trait.usesPerLevel ?? '1'} onChangeText={v => set({ usesPerLevel: v })} keyboardType="number-pad" />
        </View>
      )}
      <Text style={styles.effectNote}>
        {mode === 'none' ? 'The number above, always. To make a pool grow in steps (4 dice, then 5 at 7th level), add a later feature that raises it.'
          : mode === 'proficiency' ? 'Equals the character\u2019s proficiency bonus, and grows with it. The number above is only the starting value.'
          : mode === 'ability' ? 'Equals that ability modifier (at least 1). The number above is only the starting value.'
          : 'Equals the character\u2019s level times this number. The number above is only the starting value.'}
      </Text>
    </View>
  );
}

/** Spend from a resource that already exists (a class's Ki, Rage ... or another feature's pool in this build) instead of a pool of its own. */
export function SpendsFromEditor({ trait, set, choices }: { trait: DraftTrait; set: (patch: Partial<DraftTrait>) => void; choices: ResourceChoice[] }) {
  if (choices.length === 0) return null;
  const current = (trait.spendsResourceId ?? '').trim();
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={styles.inlineLabel}>Spends from</Text>
      <View style={styles.chipWrap}>
        <Pressable style={[styles.chip, !current && styles.chipActive]} onPress={() => set({ spendsResourceId: '' })}>
          <Text style={[styles.chipTxt, !current && styles.chipTxtActive]}>Nothing existing</Text>
        </Pressable>
        {choices.map(c => (
          <Pressable key={c.id} style={[styles.chip, current === c.id && styles.chipActive]} onPress={() => set({ spendsResourceId: c.id })}>
            <Text style={[styles.chipTxt, current === c.id && styles.chipTxtActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {!!current && (
        <View style={styles.rowInline}>
          <Text style={styles.inlineLabel}>Spends per use:</Text>
          <TextInput style={[styles.input, styles.smallInput]} value={trait.spendsQuantity ?? '1'} onChangeText={v => set({ spendsQuantity: v })} keyboardType="number-pad" />
        </View>
      )}
      {!!current && <ActionTypePicker trait={trait} set={set} />}
      {!!current && <Text style={styles.effectNote}>Uses that resource's own pool and recharge, so there is nothing new to track. Any uses and recharge set on this trait are ignored.</Text>}
    </View>
  );
}

/** Raise an existing resource's maximum at this feature's level (class and subclass features). */
export function RaiseResourceEditor({ trait, set, choices }: { trait: DraftTrait; set: (patch: Partial<DraftTrait>) => void; choices: ResourceChoice[] }) {
  if (choices.length === 0) return null;
  const current = (trait.raiseResourceId ?? '').trim();
  return (
    <View style={styles.effectPanel}>
      <Text style={styles.inlineLabel}>Raises a resource at this level</Text>
      <View style={styles.chipWrap}>
        <Pressable style={[styles.chip, !current && styles.chipActive]} onPress={() => set({ raiseResourceId: '' })}>
          <Text style={[styles.chipTxt, !current && styles.chipTxtActive]}>None</Text>
        </Pressable>
        {choices.map(c => (
          <Pressable key={c.id} style={[styles.chip, current === c.id && styles.chipActive]} onPress={() => set({ raiseResourceId: c.id })}>
            <Text style={[styles.chipTxt, current === c.id && styles.chipTxtActive]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      {!!current && (
        <View style={styles.rowInline}>
          <Text style={styles.inlineLabel}>New maximum:</Text>
          <TextInput style={[styles.input, styles.smallInput]} value={trait.raiseResourceTo ?? ''} onChangeText={v => set({ raiseResourceTo: v })} keyboardType="number-pad" />
        </View>
      )}
      <Text style={styles.effectNote}>
        The pool's maximum becomes this number once the character reaches this feature's level (for example Superiority Dice 4, then 5 at 7th level, then 6 at 15th). Spent uses stay spent.
      </Text>
    </View>
  );
}
