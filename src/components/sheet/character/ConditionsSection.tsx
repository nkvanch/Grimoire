import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { toggleActionEconomy } from '../../../engine/combat';
import { actionSpent } from '../../../engine/combatState';
import { exhaustionEffectText } from '../../../engine/exhaustion';
import { Entity, ResourceBlock, ActiveCondition, DerivedStats } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { styles } from '../tabCharacterStyles';

export function ConditionsSection({ setCondModal, exhaustion, entity, resources, conditions, onRemoveCondition, onEntityUpdate, onEndTurn, derived }: {
  setCondModal: Dispatch<SetStateAction<boolean>>;
  exhaustion: number;
  entity: Entity;
  resources: ResourceBlock;
  conditions: ActiveCondition[];
  onRemoveCondition: (id: string) => void;
  onEntityUpdate: (updated: Entity) => void;
  onEndTurn: () => void;
  derived: DerivedStats;
}) {
  return (
    <>
      {/* Conditions + Exhaustion */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CONDITIONS</Text>
          <Pressable style={styles.addBtn} onPress={() => setCondModal(true)}>
            <Text style={styles.addBtnTxt}>+ Add</Text>
          </Pressable>
        </View>

        {/* Exhaustion badge + description */}
        {exhaustion > 0 && (
          <View style={styles.exhaustionBlock}>
            <View style={styles.condChip}>
              <Text style={styles.condChipTxt}>Exhaustion {exhaustion}</Text>
            </View>
            <Text style={styles.exhaustionDesc}>{exhaustionEffectText(exhaustion, entity)}</Text>
          </View>
        )}

        {/* Stabilized — shown when at 0 HP with 3 death save successes */}
        {entity.resources.hp.current <= 0 && resources.deathSaves.successes >= 3 && (
          <View style={styles.stabilizedChip}>
            <Text style={styles.stabilizedTxt}>♥ STABILIZED</Text>
          </View>
        )}

        {conditions.length === 0 && exhaustion === 0 ? (
          <Text style={styles.emptyNote}>No active conditions</Text>
        ) : (
          <View style={styles.condRow}>
            {conditions.map(c => (
              <View key={c.id} style={styles.condChip}>
                <Text style={styles.condChipTxt}>
                  {c.id}
                  {c.duration?.unit === 'rounds' && ` · ${c.duration.remaining}r`}
                  {c.duration?.unit === 'until_rest' && ' · until rest'}
                </Text>
                <Pressable onPress={() => onRemoveCondition(c.id)} hitSlop={8}>
                  <Text style={styles.condX}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* A-25: action/bonus-action/reaction pips — tap to correct manually
            (real play has actions the app never models as a card: Dash/
            Dodge/Help/Search, a reaction spent narratively). Auto-set when
            an actual action-type card gets used, via applyActionCardUse. */}
        <View style={styles.turnEconomyRow}>
          {(['action', 'bonus_action', 'reaction'] as const).map(slot => {
            const used = slot === 'action' ? (entity.turnState ? actionSpent(entity.turnState) : false)
              : slot === 'bonus_action' ? entity.turnState?.bonusActionUsed
              : entity.turnState?.reactionUsed;
            const extra = slot === 'action' ? entity.turnState?.extraActions ?? 0 : 0;   // Action Surge's further action
            const label = slot === 'action' ? (extra > 0 ? `Action +${extra}` : 'Action') : slot === 'bonus_action' ? 'Bonus' : 'Reaction';
            return (
              <Pressable
                key={slot}
                style={[styles.turnPip, used && styles.turnPipUsed]}
                onPress={() => onEntityUpdate(toggleActionEconomy(entity, slot))}
              >
                <Text style={[styles.turnPipTxt, used && styles.turnPipTxtUsed]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Closure item 16: calls the ONE shared onEndTurn handler
            (app/sheet/[id].tsx's handleEndTurn) rather than computing
            playerEndTurn() locally and routing it through THIS tab's own
            onEntityUpdate (which used a different label/category than the
            other two tabs) — guarantees identical timeline/sync/undo
            behavior regardless of which tab End Turn is pressed from.
            Always visible (action-economy reset is relevant every turn
            regardless). No preview gate: advancing a turn is expected/
            mundane, not a surprising commit. */}
        <Pressable
          style={styles.endTurnBtn}
          onPress={onEndTurn}
        >
          <Text style={styles.endTurnBtnTxt}>⏭ End Turn</Text>
        </Pressable>

        {/* Mechanical effect breakdown for active conditions — Automated
            (Grimoire enforces this right now) vs. Table reminder (context-
            dependent, the table/DM applies it) — see CONDITION_MECHANICS'
            own doc comment above. */}
        {conditions.filter(c => CONDITION_MECHANICS[c.id]).map(c => {
          const { automated, reminder } = CONDITION_MECHANICS[c.id];
          if (automated.length === 0 && reminder.length === 0) return null;
          return (
            <View key={`warn-${c.id}`} style={styles.condMechanicsBlock}>
              <Text style={styles.condWarningName}>{c.id}</Text>
              {automated.map((line, i) => (
                <Text key={`a-${i}`} style={[styles.condWarning, styles.condAutomated]}>✓ {line}</Text>
              ))}
              {reminder.map((line, i) => (
                <Text key={`r-${i}`} style={styles.condWarning}>⚠ {line}</Text>
              ))}
            </View>
          );
        })}

        {/* Advantage/Disadvantage grants from race/class traits, items, etc.
            Reminder only, same as condition warnings above — the app has no
            attack-roll automation anywhere, so this doesn't change how any
            roll button behaves, it just makes sure these aren't forgotten. */}
        {(derived.advantageStates?.length ?? 0) > 0 && (
          <View style={styles.advList}>
            {derived.advantageStates.map((a, i) => (
              <Text key={i} style={[styles.condWarning, a.state === 'advantage' ? styles.advTxt : styles.disadvTxt]}>
                {a.state === 'advantage' ? '↑ Advantage: ' : '↓ Disadvantage: '}{a.target}
              </Text>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

// Class progressions are looked up from the content library — no hardcoded names.
// ALL_PROGRESSIONS is a Record<classId, ClassProgression> covering all 12 classes.

/**
 * 2014 condition-mechanics closure, Part S: split per condition into what
 * Grimoire actually ENFORCES right now (`automated` — speed/action-economy
 * consequences; a condition's own roll-modifier consequence, if any, is
 * NOT repeated here since it already shows up in the Advantage/Disadvantage
 * list right below this block, driven by the same live derived.advantageStates
 * — listing it twice would be redundant, not clearer) versus what stays a
 * table/context-dependent judgment call (`reminder` — target-side facts,
 * auto-fail saves/checks, anything needing distance/visibility/source
 * identity this engine doesn't track). See content/conditions/index.ts's
 * own header comment for the full per-condition reasoning behind this split.
 */
export const CONDITION_MECHANICS: Record<string, { automated: string[]; reminder: string[] }> = {
  blinded:       { automated: [], reminder: ['Attacks against you have advantage', 'You automatically fail sight-based checks'] },
  charmed:       { automated: [], reminder: ["Can't attack the charmer or target them with harmful effects", 'The charmer has advantage on social checks against you'] },
  deafened:      { automated: [], reminder: ['You automatically fail hearing-based checks'] },
  frightened:    { automated: [], reminder: ['Disadvantage on checks and attacks while the source of fear is visible', "Can't willingly move closer to the source of fear"] },
  grappled:      { automated: ['Speed 0'], reminder: [] },
  incapacitated: { automated: ['Cannot take Actions or Reactions'], reminder: [] },
  invisible:     { automated: [], reminder: ['Attacks against you have disadvantage'] },
  paralyzed:     { automated: ['Speed 0', 'Cannot take Actions or Reactions'], reminder: ['You automatically fail STR and DEX saves', 'Attacks against you have advantage, and are critical hits within 5 feet'] },
  petrified:     { automated: ['Speed 0', 'Cannot take Actions or Reactions', 'Resistance to all damage'], reminder: ['You automatically fail STR and DEX saves', 'Attacks against you have advantage', 'Immune to poison and disease (not mechanically enforced)'] },
  poisoned:      { automated: [], reminder: [] },
  prone:         { automated: [], reminder: ['Attacks against you have advantage within 5 feet, disadvantage otherwise', 'Standing up costs half your movement (not tracked)'] },
  restrained:    { automated: ['Speed 0'], reminder: ['Attacks against you have advantage'] },
  stunned:       { automated: ['Speed 0', 'Cannot take Actions or Reactions'], reminder: ['You automatically fail STR and DEX saves', 'Attacks against you have advantage'] },
  unconscious:   { automated: ['Speed 0', 'Cannot take Actions or Reactions'], reminder: ["Falls prone and drops what it's holding", 'You automatically fail STR and DEX saves', 'Attacks against you have advantage, and are critical hits within 5 feet'] },
};
