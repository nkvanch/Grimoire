// src/components/sheet/AbilityModesEditor.tsx
// Ability changes as a form, and the modes built from them (engine/featureModes.ts): used by an item's Customize pop-up and by a
// custom feature on the sheet. Each row: no change, "Set to" (a floor, as the rules write Belt of Giant Strength), or "Add" with an
// optional minimum ("down by 10, never below 4"). The boxes take a minus sign (the numeric keyboard is signed).
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable, TextInput } from '../AccessibleControls';
import type { Ability } from '../../engine/types';
import { ITEM_ABILITIES, type AbilityChanges, type ModeEdits } from '../../engine/itemCustomize';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { NAME_INPUT } from '../nameInput';

const NAMES: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
type Op = 'none' | 'set' | 'add';
const num = (t: string) => { const n = parseInt(t, 10); return Number.isNaN(n) ? undefined : n; };

/** The six ability rows. Remount it (key) to start again from a new value. */
export function AbilityChangesEditor({ value, onChange, idPrefix }: { value: AbilityChanges; onChange: (v: AbilityChanges) => void; idPrefix: string }) {
  // what is typed; a box left blank or not a number is not a change
  const [text, setText] = useState(() => Object.fromEntries(ITEM_ABILITIES.map(ab => [ab, value[ab] ? String(value[ab].value) : ''])) as Record<Ability, string>);
  const [minText, setMinText] = useState(() => Object.fromEntries(ITEM_ABILITIES.map(ab => [ab, value[ab]?.min !== undefined ? String(value[ab].min) : ''])) as Record<Ability, string>);
  const opOf = (ab: Ability): Op => value[ab]?.operation ?? 'none';
  const write = (ab: Ability, op: Op, t: string, m: string) => {
    const next = { ...value };
    if (op === 'none') delete next[ab];
    else next[ab] = { operation: op, value: num(t) ?? NaN, ...(op === 'add' && num(m) !== undefined ? { min: num(m) } : {}) };
    onChange(next);
  };
  return (
    <View style={styles.rows}>
      {ITEM_ABILITIES.map(ab => (
        <View key={ab} style={styles.row}>
          <Text style={styles.name}>{NAMES[ab]}</Text>
          <View style={styles.segment}>
            {(['none', 'set', 'add'] as Op[]).map(op => (
              <Pressable key={op} accessibilityRole="radio" accessibilityState={{ selected: opOf(ab) === op }}
                accessibilityLabel={`${NAMES[ab]}: ${op === 'none' ? 'no change' : op === 'set' ? 'set to' : 'add'}`}
                style={[styles.segBtn, opOf(ab) === op && styles.segBtnOn]} onPress={() => write(ab, op, text[ab], minText[ab])}>
                <Text style={[styles.segTxt, opOf(ab) === op && styles.segTxtOn]}>{op === 'none' ? '—' : op === 'set' ? 'Set to' : 'Add'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID={`${idPrefix}-${ab}`} accessibilityLabel={`${NAMES[ab]} value`} editable={opOf(ab) !== 'none'} keyboardType="numeric"
            style={[styles.box, opOf(ab) === 'none' && styles.boxOff]} value={opOf(ab) === 'none' ? '' : text[ab]}
            onChangeText={t => { setText({ ...text, [ab]: t }); if (opOf(ab) !== 'none') write(ab, opOf(ab), t, minText[ab]); }}
          />
          {opOf(ab) === 'add' && (
            <TextInput
              testID={`${idPrefix}-${ab}-min`} accessibilityLabel={`${NAMES[ab]} minimum`} keyboardType="numeric" placeholder="min"
              placeholderTextColor={Colors.textDim} style={styles.box} value={minText[ab]}
              onChangeText={m => { setMinText({ ...minText, [ab]: m }); write(ab, 'add', text[ab], m); }}
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** The modes: each a name and its own ability changes. The first is active until the person switches on the sheet. */
export function ModesEditor({ modes, onChange, idPrefix }: { modes: ModeEdits[]; onChange: (m: ModeEdits[]) => void; idPrefix: string }) {
  const update = (i: number, patch: Partial<ModeEdits>) => onChange(modes.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <View style={styles.rows}>
      <Text style={styles.hint}>
        Modes are ways it can work that you switch between on the sheet. Each mode's changes apply on top of the ones above while it is the
        active one. The first mode is active to begin with.
      </Text>
      {modes.map((m, i) => (
        <View key={m.id} style={styles.mode}>
          <View style={styles.row}>
            <TextInput {...NAME_INPUT} testID={`${idPrefix}-mode-${i}-name`} accessibilityLabel={`Mode ${i + 1} name`} style={[styles.box, styles.modeName]}
              value={m.name} onChangeText={name => update(i, { name })} placeholder={`Mode ${i + 1}`} placeholderTextColor={Colors.textDim} maxLength={40} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove mode ${m.name || i + 1}`} hitSlop={8} onPress={() => onChange(modes.filter((_, j) => j !== i))}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
          <AbilityChangesEditor idPrefix={`${idPrefix}-mode-${i}`} value={m.abilities} onChange={abilities => update(i, { abilities })} />
        </View>
      ))}
      <Pressable testID={`${idPrefix}-add-mode`} accessibilityRole="button" style={styles.add}
        onPress={() => onChange([...modes, { id: `mode_${Date.now().toString(36)}_${modes.length}`, name: '', abilities: {} }])}>
        <Text style={styles.addTxt}>+ Add a mode</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  segBtn: { minHeight: 44, minWidth: 48, paddingHorizontal: Spacing.xs, justifyContent: 'center', alignItems: 'center' },
  segBtnOn: { backgroundColor: Colors.gold },
  segTxt: { color: Colors.textSecondary, fontSize: FontSize.sm },
  segTxtOn: { color: Colors.bg, fontWeight: FontWeight.bold },
  box: {
    minHeight: 44, width: 56, textAlign: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bg, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  boxOff: { opacity: 0.35 },
  mode: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, gap: Spacing.xs },
  modeName: { flex: 1, width: undefined, textAlign: 'left', paddingHorizontal: Spacing.sm },
  remove: { color: Colors.red, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  add: { minHeight: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
