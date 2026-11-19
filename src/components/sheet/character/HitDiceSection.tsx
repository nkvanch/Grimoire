import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { bumpedHitDie } from '../../../engine/hitDieTier';
import { entityHitDieTier, currentHitDieSize } from '../../../engine/rest';
import { ResourceBlock, HitDicePool, Entity, CampaignRules } from '../../../engine/types';
import { Colors } from '../../../theme';
import { Pressable, TextInput } from '../../AccessibleControls';
import { styles } from '../tabCharacterStyles';

export function HitDiceSection({ resources, hitDieChoiceNeeded, hitDieEntry, spendableHitDice, selectedHitDieSize, setSelectedHitDieSize, entity, rules, effectiveHitDieSize, hitDieDraft, setHitDieDraft, submitHitDieEntry, setHitDieEntry, openHitDieEntry, handleRollHitDie, hitDieResult }: {
  resources: ResourceBlock;
  hitDieChoiceNeeded: boolean;
  hitDieEntry: boolean;
  spendableHitDice: HitDicePool[];
  selectedHitDieSize: number | null;
  setSelectedHitDieSize: Dispatch<SetStateAction<number | null>>;
  entity: Entity;
  rules: CampaignRules;
  effectiveHitDieSize: number | null;
  hitDieDraft: string;
  setHitDieDraft: Dispatch<SetStateAction<string>>;
  submitHitDieEntry: () => void;
  setHitDieEntry: Dispatch<SetStateAction<boolean>>;
  openHitDieEntry: () => void;
  handleRollHitDie: () => void;
  hitDieResult: string | null;
}) {
  return (
    <>
      {/* Hit Dice */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HIT DICE</Text>
          <Text style={styles.hitDiceCount}>
            {resources.hitDice.remaining}/{resources.hitDice.total}  ·  {
              // A mixed multiclass pool (see HitDiceBlock's doc comment)
              // can't be summarized by the single `die` field alone —
              // show each size's own remaining/total instead.
              resources.hitDice.pools
                ? resources.hitDice.pools.map(p => `${p.remaining}d${p.die}`).join(' + ')
                : `d${resources.hitDice.die}`
            }
          </Text>
        </View>
        {/* Rules-completeness batch (mixed hit-die pools), C2/C8: an
            explicit die-size picker, shown ONLY when 2+ distinct sizes are
            currently spendable — a single-pool character never sees this
            row at all, matching this app's "never ask when there's nothing
            to choose" convention elsewhere. Each spend clears the selection
            (see handleRollHitDie/submitHitDieEntry), so spending a d10 then
            a d6 then another d10 in the same rest each requires its own
            explicit tap — never assumes the previous choice still applies. */}
        {hitDieChoiceNeeded && !hitDieEntry && (
          <View style={styles.hitDieRow}>
            {spendableHitDice.map(p => (
              <Pressable
                key={p.die}
                style={[styles.hitDieBtn, selectedHitDieSize === p.die ? styles.hitDieUse : styles.hitDieRoll]}
                onPress={() => setSelectedHitDieSize(p.die)}
              >
                <Text style={selectedHitDieSize === p.die ? styles.hitDieUseTxt : styles.useHitDieTxt}>
                  d{bumpedHitDie(p.die, entityHitDieTier(entity, rules))} ({p.remaining} left)
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {hitDieEntry ? (
          <View style={styles.hitDieEntryRow}>
            <Text style={styles.hitDieEntryLabel}>Rolled (1–d{currentHitDieSize(entity, effectiveHitDieSize ?? undefined, rules)}):</Text>
            <TextInput
              style={styles.hitDieEntryInput}
              value={hitDieDraft}
              onChangeText={setHitDieDraft}
              keyboardType="number-pad"
              placeholder="e.g. 6"
              placeholderTextColor={Colors.textDim}
              autoFocus
              onSubmitEditing={submitHitDieEntry}
            />
            <Pressable style={styles.hitDieEntrySubmit} onPress={submitHitDieEntry}>
              <Text style={styles.hitDieEntrySubmitTxt}>Heal</Text>
            </Pressable>
            <Pressable style={styles.hitDieEntryCancel} onPress={() => setHitDieEntry(false)}>
              <Text style={styles.hitDieEntryCancelTxt}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.hitDieRow}>
            {/* Primary — table-first: the die was already rolled physically. */}
            <Pressable
              style={[styles.hitDieBtn, styles.hitDieUse, (resources.hitDice.remaining <= 0 || effectiveHitDieSize === null) && styles.useHitDieBtnDisabled]}
              onPress={openHitDieEntry}
              disabled={resources.hitDice.remaining <= 0 || effectiveHitDieSize === null}
            >
              <Text style={styles.hitDieUseTxt}>Use Hit Die</Text>
            </Pressable>
            {/* Secondary convenience — rolls, then the exact same mutation. */}
            <Pressable
              style={[styles.hitDieBtn, styles.hitDieRoll, (resources.hitDice.remaining <= 0 || effectiveHitDieSize === null) && styles.useHitDieBtnDisabled]}
              onPress={handleRollHitDie}
              disabled={resources.hitDice.remaining <= 0 || effectiveHitDieSize === null}
            >
              <Text style={styles.useHitDieTxt}>🎲 Roll in App</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.hitDieHint}>
          {hitDieChoiceNeeded ? 'Choose a die size above, then: ' : ''}Use: enter your table roll and heal.  Roll: app rolls and heals for you.
        </Text>
        {hitDieResult && (
          <Text style={styles.dieResultTxt}>{hitDieResult}</Text>
        )}
      </View>
    </>
  );
}
