// src/components/homebrew/TraitAdvancedEditor.tsx
// The "Advanced" part of the trait editor: bonus effects that ride attacks and spells (riders), timing (switch off on a damage type,
// uses an action and a bonus action), card effects (temp HP, heal from damage taken, a per-target effect), auras for allies and a few
// derived-stat rules. Every field is optional and compiles onto whatever effect kind the trait already has (traitCompiler.ts).
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ability, DraftTrait, DraftRider } from '../../engine/types';
import { hasAdvancedFields } from '../../content/traitCompiler';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

type Props = { trait: DraftTrait; set: (patch: Partial<DraftTrait>) => void };

const RIDER_ON: { key: DraftRider['on']; label: string }[] = [
  { key: 'weapon_attack', label: 'Weapon attack' }, { key: 'cantrip', label: 'Cantrip' }, { key: 'spell', label: 'Spell' },
  { key: 'spell_attack', label: 'Spell attack' }, { key: 'any_damage', label: 'Any damage' },
];
const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function Chips<T extends string>({ options, value, onPick }: { options: { key: T; label: string }[]; value: T | undefined; onPick: (k: T) => void }) {
  return (
    <View style={styles.chipWrap}>
      {options.map(o => (
        <Pressable key={o.key} style={[styles.chip, value === o.key && styles.chipActive]} onPress={() => onPick(o.key)} accessibilityLabel={o.label}>
          <Text style={[styles.chipTxt, value === o.key && styles.chipTxtActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]} />
      <Text style={styles.toggleTxt}>{label}</Text>
    </Pressable>
  );
}

const newRider = (): DraftRider => ({
  localId: `rd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
  name: '', on: 'weapon_attack', dice: '', damageType: '', note: '', limit: 'once_per_turn', requires: '', clears: '', usesPool: false,
});

export function TraitAdvancedEditor({ trait, set }: Props) {
  const [open, setOpen] = useState(hasAdvancedFields(trait));
  const riders = trait.riders ?? [];
  const updateRider = (id: string, patch: Partial<DraftRider>) => set({ riders: riders.map(r => (r.localId === id ? { ...r, ...patch } : r)) });
  const hasPool = trait.effectKind === 'resource_ability' || trait.limitedUse;

  return (
    <View style={styles.panel}>
      <Pressable style={styles.header} onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityLabel="Advanced: riders, timing, auras">
        <Text style={styles.headerTxt}>{open ? '▾' : '▸'} Advanced: riders, timing, per-target effects, auras</Text>
      </Pressable>
      {open && (
        <View style={{ gap: Spacing.sm }}>
          <Text style={styles.note}>
            Optional. These add to whatever the trait already does. The app tracks and reminds; you still resolve who is affected and what the dice say.
          </Text>

          <Text style={styles.section}>RIDERS ON ATTACKS AND SPELLS</Text>
          {riders.map(r => (
            <View key={r.localId} style={styles.rider}>
              <TextInput style={styles.input} value={r.name} onChangeText={v => updateRider(r.localId, { name: v })} placeholder="Rider name (e.g. Searing Strike)" placeholderTextColor={Colors.textDim} />
              <Text style={styles.label}>Rides</Text>
              <Chips options={RIDER_ON} value={r.on} onPick={k => updateRider(r.localId, { on: k })} />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} value={r.dice} onChangeText={v => updateRider(r.localId, { dice: v })} placeholder="Extra dice, e.g. 1d6" placeholderTextColor={Colors.textDim} />
                <TextInput style={[styles.input, { flex: 1 }]} value={r.damageType} onChangeText={v => updateRider(r.localId, { damageType: v })} placeholder="Damage type" placeholderTextColor={Colors.textDim} />
              </View>
              <TextInput style={styles.input} value={r.note} onChangeText={v => updateRider(r.localId, { note: v })} placeholder="What else it does (table-resolved)" placeholderTextColor={Colors.textDim} />
              <Chips
                options={[{ key: 'once_per_turn', label: 'Once per turn' }, { key: 'none', label: 'No limit' }]}
                value={r.limit} onPick={k => updateRider(r.localId, { limit: k })}
              />
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} value={r.requires} onChangeText={v => updateRider(r.localId, { requires: v })} placeholder="Needs flag (optional)" placeholderTextColor={Colors.textDim} autoCapitalize="none" />
                <TextInput style={[styles.input, { flex: 1 }]} value={r.clears} onChangeText={v => updateRider(r.localId, { clears: v })} placeholder="Clears flag (optional)" placeholderTextColor={Colors.textDim} autoCapitalize="none" />
              </View>
              {hasPool && <Toggle label="Spends one use of this trait's pool" value={r.usesPool} onPress={() => updateRider(r.localId, { usesPool: !r.usesPool })} />}
              <Pressable onPress={() => set({ riders: riders.filter(x => x.localId !== r.localId) })} accessibilityLabel={`Remove rider ${r.name}`}>
                <Text style={styles.remove}>Remove rider</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={() => set({ riders: [...riders, newRider()] })} accessibilityLabel="Add a rider">
            <Text style={styles.addTxt}>+ Add rider</Text>
          </Pressable>

          <Text style={styles.section}>TIMING</Text>
          <TextInput style={styles.input} value={trait.suspendDamageType ?? ''} onChangeText={v => set({ suspendDamageType: v })} placeholder="Switches off when you take this damage type (e.g. fire)" placeholderTextColor={Colors.textDim} autoCapitalize="none" />
          {!!trait.suspendDamageType?.trim() && (
            <Chips
              options={[{ key: 'end_of_this_turn', label: 'Until end of this turn' }, { key: 'end_of_next_turn', label: 'Until end of your next turn' }]}
              value={trait.suspendUntil ?? 'end_of_next_turn'} onPick={k => set({ suspendUntil: k })}
            />
          )}
          <Text style={styles.label}>Also uses your</Text>
          <Chips
            options={[{ key: 'none', label: 'Nothing else' }, { key: 'bonus_action', label: 'Bonus action' }, { key: 'action', label: 'Action' }]}
            value={trait.alsoCosts ?? 'none'} onPick={k => set({ alsoCosts: k === 'none' ? undefined : k })}
          />

          <Text style={styles.section}>CARD EFFECTS (make the trait a usable ability)</Text>
          <TextInput style={styles.input} value={trait.tempHpDice ?? ''} onChangeText={v => set({ tempHpDice: v })} placeholder="Temporary hit points, e.g. PBd6 or 2d6" placeholderTextColor={Colors.textDim} autoCapitalize="characters" />
          <Text style={styles.label}>Heal from damage you took</Text>
          <Chips
            options={[{ key: '', label: 'No' }, { key: '0.5', label: 'Half' }, { key: '1', label: 'All' }]}
            value={trait.healFromDamageFraction ?? ''} onPick={k => set({ healFromDamageFraction: k })}
          />
          {!!trait.healFromDamageFraction && (
            <Chips
              options={[{ key: '0', label: 'This turn only' }, { key: '1', label: 'Since your previous turn began' }, { key: '2', label: 'Last two turns' }]}
              value={trait.healFromDamageTurnsBack ?? '1'} onPick={k => set({ healFromDamageTurnsBack: k })}
            />
          )}
          <TextInput style={styles.input} value={trait.trackEffectName ?? ''} onChangeText={v => set({ trackEffectName: v })} placeholder="Puts this effect on a target (e.g. Marked)" placeholderTextColor={Colors.textDim} />
          {!!trait.trackEffectName?.trim() && (
            <>
              <Toggle label="Add up the damage the target takes" value={!!trait.trackRecords} onPress={() => set({ trackRecords: !trait.trackRecords })} />
              <Chips
                options={[{ key: 'none', label: 'Until I end it' }, { key: 'end_of_this_turn', label: 'End of this turn' }, { key: 'end_of_next_turn', label: 'End of my next turn' }]}
                value={trait.trackUntil ?? 'none'} onPick={k => set({ trackUntil: k })}
              />
              {!!trait.trackRecords && (
                <>
                  <Text style={styles.label}>Stop adding up damage</Text>
                  <Chips
                    options={[{ key: 'none', label: 'When it ends' }, { key: 'end_of_this_turn', label: 'End of this turn' }, { key: 'end_of_next_turn', label: 'End of my next turn' }]}
                    value={trait.trackRecordUntil ?? 'none'} onPick={k => set({ trackRecordUntil: k })}
                  />
                </>
              )}
            </>
          )}

          <Text style={styles.section}>AURA</Text>
          <Toggle label="This trait is an aura that benefits others" value={!!trait.auraEnabled} onPress={() => set({ auraEnabled: !trait.auraEnabled })} />
          {trait.auraEnabled && (
            <>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} value={trait.auraLabel ?? ''} onChangeText={v => set({ auraLabel: v })} placeholder="Label" placeholderTextColor={Colors.textDim} />
                <TextInput style={[styles.input, { flex: 1 }]} value={trait.auraRange ?? ''} onChangeText={v => set({ auraRange: v })} placeholder="Range (text)" placeholderTextColor={Colors.textDim} />
              </View>
              <Chips
                options={[{ key: 'allies', label: 'Allies' }, { key: 'allies_and_self', label: 'Allies and you' }, { key: 'enemies', label: 'Enemies' }]}
                value={trait.auraAffects ?? 'allies'} onPick={k => set({ auraAffects: k })}
              />
              <Text style={styles.label}>Gives</Text>
              <Chips
                options={[{ key: 'ac', label: 'AC' }, { key: 'saves', label: 'All saves' }, { key: 'speed', label: 'Speed' }, { key: 'initiative', label: 'Initiative' }, { key: 'resistance', label: 'Resistance' }]}
                value={trait.auraStat ?? 'ac'} onPick={k => set({ auraStat: k })}
              />
              {trait.auraStat === 'resistance' ? (
                <TextInput style={styles.input} value={trait.auraResistType ?? ''} onChangeText={v => set({ auraResistType: v })} placeholder="Damage type" placeholderTextColor={Colors.textDim} autoCapitalize="none" />
              ) : (
                <View style={styles.row}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={trait.auraAmount ?? ''} onChangeText={v => set({ auraAmount: v })} keyboardType="numbers-and-punctuation" placeholder="Bonus (+N)" placeholderTextColor={Colors.textDim} />
                </View>
              )}
              {trait.auraStat !== 'resistance' && (
                <>
                  <Text style={styles.label}>Plus the source's modifier</Text>
                  <Chips
                    options={[{ key: '' as Ability | '', label: 'None' }, ...ABILITIES.map(a => ({ key: a as Ability | '', label: a.toUpperCase() }))]}
                    value={(trait.auraAddAbility ?? '') as Ability | ''} onPick={k => set({ auraAddAbility: k })}
                  />
                </>
              )}
              <Text style={styles.note}>The table decides who is within range. Each player marks themselves inside on their own sheet.</Text>
            </>
          )}

          <Text style={styles.section}>DERIVED-STAT RULES</Text>
          <Toggle label="Full Dexterity bonus in medium armor" value={!!trait.armorDexCap} onPress={() => set({ armorDexCap: !trait.armorDexCap })} />
          <Toggle label="Critical hits against you are normal hits" value={!!trait.critImmune} onPress={() => set({ critImmune: !trait.critImmune })} />
          <TextInput style={styles.input} value={trait.critRange ?? ''} onChangeText={v => set({ critRange: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="Your attacks crit on this roll or higher (2 to 19)" placeholderTextColor={Colors.textDim} />
          <Toggle label="AC and speed bonuses also apply in a Wild Shape form" value={!!trait.appliesInBeastForm} onPress={() => set({ appliesInBeastForm: !trait.appliesInBeastForm })} />
          <Text style={styles.section}>A MOVEMENT SPEED FOR A WHILE</Text>
          <Chips
            options={[{ key: '' as 'fly' | 'swim' | 'climb' | 'walk' | '', label: 'None' }, { key: 'fly', label: 'Fly' }, { key: 'swim', label: 'Swim' }, { key: 'climb', label: 'Climb' }, { key: 'walk', label: 'Walking +' }]}
            value={trait.grantSpeedType ?? ''} onPick={k => set({ grantSpeedType: k })}
          />
          {!!trait.grantSpeedType && (
            <>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} value={trait.grantSpeedAmount ?? ''} onChangeText={v => set({ grantSpeedAmount: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="Feet" placeholderTextColor={Colors.textDim} />
                <TextInput style={[styles.input, { flex: 1 }]} value={trait.grantSpeedFor ?? ''} onChangeText={v => set({ grantSpeedFor: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="For how many" placeholderTextColor={Colors.textDim} />
              </View>
              <Chips
                options={[{ key: 'rounds', label: 'Rounds' }, { key: 'minutes', label: 'Minutes' }, { key: 'hours', label: 'Hours' }, { key: 'until_rest', label: 'Until a rest' }]}
                value={trait.grantSpeedUnit ?? 'rounds'} onPick={k => set({ grantSpeedUnit: k })}
              />
              <Text style={styles.label}>Rounds count down on End Turn and end by themselves. Minutes and hours stay on the sheet until you take them off, because the app keeps no clock.</Text>
            </>
          )}

          <Text style={styles.section}>AFTER IT IS USED</Text>
          <Chips
            options={[{ key: 'none', label: 'Nothing' }, { key: 'hit', label: 'If it hit' }, { key: 'miss', label: 'If it missed' }, { key: 'success', label: 'If the save succeeded' }, { key: 'failure', label: 'If the save failed' }]}
            value={trait.outcomeOn ?? 'none'} onPick={k => set({ outcomeOn: k })}
          />
          {!!trait.outcomeOn && trait.outcomeOn !== 'none' && (
            <>
              <TextInput style={styles.input} value={trait.outcomeRegain ?? ''} onChangeText={v => set({ outcomeRegain: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="Uses of this trait's pool it gives back" placeholderTextColor={Colors.textDim} />
              <Text style={styles.label}>Nothing happens until the player presses that outcome on the used card, and it applies once. This needs the trait to be a limited-use ability.</Text>
            </>
          )}

          <Text style={styles.section}>INFUSIONS</Text>
          <TextInput style={styles.input} value={trait.infusionBonus ?? ''} onChangeText={v => set({ infusionBonus: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="Extra items you can have infused at once" placeholderTextColor={Colors.textDim} />

          <Text style={styles.section}>USE ONE ABILITY INSTEAD OF ANOTHER</Text>
          <Text style={styles.label}>Instead of</Text>
          <Chips
            options={ABILITIES.map(a => ({ key: a, label: a.toUpperCase() }))}
            value={(trait.substituteFrom || undefined) as Ability | undefined} onPick={k => set({ substituteFrom: k })}
          />
          <Text style={styles.label}>Use</Text>
          <Chips
            options={ABILITIES.map(a => ({ key: a, label: a.toUpperCase() }))}
            value={(trait.substituteTo || undefined) as Ability | undefined} onPick={k => set({ substituteTo: k })}
          />
          <Text style={styles.label}>For</Text>
          <View style={styles.chipWrap}>
            {([['weapon_attacks', 'Weapon attacks and damage'], ['ability_checks', 'Ability checks'], ['saving_throws', 'Saving throws']] as const).map(([k, label]) => {
              const on = (trait.substituteFor ?? []).includes(k);
              return (
                <Pressable key={k} style={[styles.chip, on && styles.chipActive]} accessibilityLabel={label}
                  onPress={() => set({ substituteFor: on ? (trait.substituteFor ?? []).filter(x => x !== k) : [...(trait.substituteFor ?? []), k] })}>
                  <Text style={[styles.chipTxt, on && styles.chipTxtActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>The better of the two scores is used. Only the rolls you tick are affected; everything else about the trait stays as written.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel:   { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm, gap: Spacing.sm },
  header:  { paddingVertical: Spacing.xs },
  headerTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  section: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1, marginTop: Spacing.sm },
  label:   { color: Colors.textSecondary, fontSize: FontSize.sm },
  note:    { color: Colors.textSecondary, fontSize: FontSize.xs },
  input:   { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, color: Colors.textPrimary },
  row:     { flexDirection: 'row', gap: Spacing.sm },
  rider:   { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, gap: Spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:    { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  chipActive: { borderColor: Colors.gold, backgroundColor: Colors.surface },
  chipTxt: { color: Colors.textSecondary, fontSize: FontSize.xs },
  chipTxtActive: { color: Colors.gold, fontWeight: FontWeight.bold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: Colors.border, borderRadius: 4 },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  toggleTxt: { color: Colors.textPrimary, fontSize: FontSize.sm, flex: 1 },
  remove:  { color: Colors.red, fontSize: FontSize.xs, marginTop: Spacing.xs },
  addBtn:  { borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.xs, alignItems: 'center' },
  addTxt:  { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
