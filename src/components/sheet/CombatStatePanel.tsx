// src/components/sheet/CombatStatePanel.tsx
// The sheet's short-term combat state, shown only when there is something to show:
//   - damage taken since the start of your previous turn (what rules like Reformation read),
//   - features switched off for a time, with a way to switch one back on,
//   - effects you have put on other creatures (marks, accepted challenges), each with a target, a damage record and End,
//   - auras of party members you can mark yourself as being inside.
// Everything here is bookkeeping the table drives: the app never decides who is in range or who is the target.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { Entity } from '../../engine/types';
import { damageTakenSince } from '../../engine/damageLog';
import { resumeFeature, isFeatureSuspended } from '../../engine/suspension';
import { endTrackedEffect, setTrackedTarget, trackedEffectStatus, recordDamageOnTarget, isRecording } from '../../engine/trackedEffects';
import { aurasOffered, setInAura, isInAura } from '../../engine/auras';
import { useCampaignStore } from '../../store/campaignStore';
import { useCharacterStore } from '../../store/characterStore';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';

export function hasCombatState(entity: Entity, party: Entity[]): boolean {
  return (entity.damageLog?.length ?? 0) > 0
    || (entity.suspensions?.some(s => isFeatureSuspended(entity, s.featureId)) ?? false)
    || (entity.trackedEffects?.length ?? 0) > 0
    || (entity.receivedAuras?.length ?? 0) > 0
    || aurasOffered(entity, party).length > 0;
}

// A selector must return the same value for the same state: a fresh `[]` each time made this panel re-render without end on any
// sheet with no active campaign ("Maximum update depth exceeded").
const NO_IDS: string[] = [];

export function CombatStatePanel({ entity, onEntityUpdate }: { entity: Entity; onEntityUpdate: (e: Entity) => void }) {
  const characterIds = useCampaignStore(s => s.activeCampaign?.characterIds) ?? NO_IDS;
  const characters = useCharacterStore(s => s.characters);
  const party = characters.filter(c => characterIds.includes(c.id));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hit, setHit] = useState<Record<string, string>>({});
  if (!hasCombatState(entity, party)) return null;

  const taken = damageTakenSince(entity, 1);
  const off = (entity.suspensions ?? []).filter(s => isFeatureSuspended(entity, s.featureId));
  const offers = aurasOffered(entity, party);

  return (
    <View style={styles.card} accessibilityLabel="Combat state">
      <Text style={styles.kicker}>COMBAT STATE</Text>

      {taken > 0 && (
        <Text style={styles.line} accessibilityLabel={`Damage taken since the start of your previous turn: ${taken}`}>
          Damage taken since the start of your previous turn: <Text style={styles.strong}>{taken}</Text> (half is {Math.floor(taken / 2)})
        </Text>
      )}

      {off.map(s => {
        const f = entity.features.find(x => x.id === s.featureId);
        return (
          <View key={s.featureId} style={styles.row}>
            <Text style={[styles.line, { flex: 1 }]}>
              <Text style={styles.strong}>{f?.name ?? s.featureId}</Text> is switched off{s.reason ? ` (${s.reason})` : ''} until the end of your next turn.
            </Text>
            <Pressable style={styles.btnGhost} onPress={() => onEntityUpdate(resumeFeature(entity, s.featureId))} accessibilityLabel={`Switch ${f?.name ?? 'feature'} back on`}>
              <Text style={styles.btnGhostTxt}>Back on</Text>
            </Pressable>
          </View>
        );
      })}

      {(entity.trackedEffects ?? []).length > 0 && <Text style={styles.sub}>EFFECTS YOU HAVE PLACED</Text>}
      {(entity.trackedEffects ?? []).map(x => {
        const status = trackedEffectStatus(entity, x);
        return (
          <View key={x.id} style={styles.effect}>
            <View style={styles.row}>
              <Text style={[styles.line, { flex: 1 }]}>
                <Text style={styles.strong}>{x.name}</Text>{x.targetName ? ` on ${x.targetName}` : ' (no target yet)'}{status === 'due' ? ' · due to end' : ''}
              </Text>
              <Pressable style={styles.btnGhost} onPress={() => onEntityUpdate(endTrackedEffect(entity, x.id))} accessibilityLabel={`End ${x.name}`}>
                <Text style={styles.btnGhostTxt}>End</Text>
              </Pressable>
            </View>
            {!x.targetName && (
              <View style={styles.row}>
                <TextInput
                  style={styles.input} placeholder="Target name" placeholderTextColor={Colors.textSecondary}
                  value={drafts[x.id] ?? ''} onChangeText={t => setDrafts(d => ({ ...d, [x.id]: t }))}
                />
                <Pressable style={styles.btn} onPress={() => (drafts[x.id] ?? '').trim() && onEntityUpdate(setTrackedTarget(entity, x.id, drafts[x.id].trim()))}>
                  <Text style={styles.btnTxt}>Set</Text>
                </Pressable>
              </View>
            )}
            {x.records && !isRecording(entity, x) && (
              <Text style={styles.line}>Recording closed. Damage recorded: <Text style={styles.strong}>{x.recordedDamage ?? 0}</Text> (half is {Math.floor((x.recordedDamage ?? 0) / 2)})</Text>
            )}
            {x.records && isRecording(entity, x) && (
              <View style={styles.row}>
                <Text style={[styles.line, { flex: 1 }]}>Damage recorded: <Text style={styles.strong}>{x.recordedDamage ?? 0}</Text> (half is {Math.floor((x.recordedDamage ?? 0) / 2)})</Text>
                <TextInput
                  style={[styles.input, { width: 64 }]} keyboardType="number-pad" placeholder="+ dmg" placeholderTextColor={Colors.textSecondary}
                  value={hit[x.id] ?? ''} onChangeText={t => setHit(h => ({ ...h, [x.id]: t.replace(/[^0-9]/g, '') }))}
                />
                <Pressable
                  style={styles.btn}
                  onPress={() => {
                    const n = parseInt(hit[x.id] ?? '', 10);
                    if (n > 0) { onEntityUpdate(recordDamageOnTarget(entity, { id: x.targetId, name: x.targetName }, n)); setHit(h => ({ ...h, [x.id]: '' })); }
                  }}
                >
                  <Text style={styles.btnTxt}>Add</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {offers.length > 0 && <Text style={styles.sub}>AURAS OF YOUR PARTY</Text>}
      {offers.map(o => {
        const inside = isInAura(entity, o.sourceEntityId, o.featureId);
        return (
          <View key={`${o.sourceEntityId}:${o.featureId}`} style={styles.row}>
            <Text style={[styles.line, { flex: 1 }]}>
              <Text style={styles.strong}>{o.label}</Text> from {o.sourceName}{o.range ? ` (${o.range})` : ''}
            </Text>
            <Pressable
              style={inside ? styles.btn : styles.btnGhost}
              onPress={() => onEntityUpdate(setInAura(entity, o, !inside))}
              accessibilityLabel={`${inside ? 'Leave' : 'Mark yourself inside'} ${o.label}`}
            >
              <Text style={inside ? styles.btnTxt : styles.btnGhostTxt}>{inside ? 'Inside' : 'Not inside'}</Text>
            </Pressable>
          </View>
        );
      })}
      {offers.length > 0 && <Text style={styles.hint}>The table decides who is within range. Marking yourself inside applies the aura's effect to you.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card:    { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  kicker:  { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1 },
  sub:     { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1, marginTop: Spacing.sm },
  line:    { color: Colors.textPrimary, fontSize: FontSize.sm },
  strong:  { fontWeight: FontWeight.bold, color: Colors.gold },
  hint:    { color: Colors.textSecondary, fontSize: FontSize.xs },
  row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  effect:  { gap: Spacing.xs },
  input:   { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, color: Colors.textPrimary },
  btn:     { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  btnTxt:  { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  btnGhost:    { borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  btnGhostTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
