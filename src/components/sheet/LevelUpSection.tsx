import { useState } from 'react';
import { Text, View } from 'react-native';
import { ScrollView } from '../Lists';
import { ALL_PROGRESSIONS } from '../../content/classes';
import { getProgressionForClass, mergeSubclassIntoProgression } from '../../content/classes/progressions';
import { spellRepo } from '../../content/spellRepo';
import { spellIdsOnEntity } from '../../content/spellRepo.types';
import { getSubclassEntryMerged } from '../../content/subclasses/subclassBrowse';
import { modifier } from '../../engine/abilityMath';
import { effectiveAbilityScores } from '../../engine/derivedStats';
import { levelUp, levelUpClass } from '../../engine/leveling';
import { isValidHpRoll, calculateLevelUpHpGain, rollDie } from '../../engine/levelingHp';
import { getClassLevels } from '../../engine/multiclass';
import { multiclassRequirementApplies, multiclassLacks } from '../../engine/multiclassPrerequisites';
import { pinnedLockOf } from '../../engine/ruleset/dnd5ePinning';
import { simulate } from '../../engine/simulate';
import { Ability, Entity, CampaignRules, CharClass, asClassId, matchesRuleset } from '../../engine/types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { pinGate, STEP_OPERATIONS } from '../../store/pinningService';
import { Colors } from '../../theme';
import { Alert, reportFailure } from '../../utils/alert';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { LevelUpPreviewModal } from './LevelUpPreviewModal';
import { MulticlassProgressionPlannerModal } from './MulticlassProgressionPlannerModal';
import { ProgressionPlannerModal } from './ProgressionPlannerModal';
import { styles } from './tabCharacterStyles';

// ── Table-first rolled-HP gate ────────────────────────────────────────────────
// Shared by both the single-class and multiclass branches of LevelUpSection
// below. Primary: enter the physically-rolled die result. Secondary: "Roll
// in App" rolls the same die via rollDie and resolves through the exact
// same onResolve callback — never a separate consequence path. Renders
// nothing (returns null) when `pending` is null, so mounting it
// unconditionally in both branches is cheap and safe.
function HpRollGate({
  pending, draft, onDraftChange, entity, rules, onCancel, onResolve,
}: {
  pending: { hpDie: number; hpAbility: Ability } | null;
  draft: string;
  onDraftChange: (s: string) => void;
  entity: Entity;
  rules: CampaignRules;
  onCancel: () => void;
  onResolve: (roll: number) => void;
}) {
  if (!pending) return null;
  const abilityMod = modifier(effectiveAbilityScores(entity)[pending.hpAbility]);
  // Closure 4C: strict, complete-integer validation (rejects "5abc", "5.5",
  // "0", and anything above the die size) — replaces a bare parseInt(draft)
  // check, which silently accepted a partial parse.
  const validRoll = isValidHpRoll(draft, pending.hpDie);
  const parsed = validRoll ? parseInt(draft.trim(), 10) : NaN;
  // Closure 4A/4B: the SAME pure calculation applyHP itself uses — this
  // preview can never disagree with what Confirm actually applies, and
  // correctly reflects the hpMinHalfDie house-rule floor (previously
  // missing from this preview entirely). HpRollGate only ever opens for
  // rules.hpMode === 'rolled' at a level that isn't the character's very
  // first (see pressLevelUp/pressLevelUpClass's own gating), so those are
  // fixed here rather than threaded through `pending`.
  const previewGain = validRoll
    ? calculateLevelUpHpGain(entity, pending.hpDie, 'rolled', rules, pending.hpAbility, false, parsed)
    : null;

  function submit() {
    if (validRoll) onResolve(parsed);
  }
  function rollInApp() {
    onResolve(rollDie(pending!.hpDie));
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.hpRollBackdrop} onPress={onCancel}>
        <Pressable style={styles.hpRollSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.hpRollTitle}>Hit Points for This Level</Text>
          <Text style={styles.hpRollLine}>Hit Die: d{pending.hpDie}</Text>
          <Text style={styles.hpRollLine}>{pending.hpAbility.toUpperCase()} modifier: {abilityMod >= 0 ? '+' : ''}{abilityMod}</Text>

          <View style={styles.hpRollInputRow}>
            <Text style={styles.hpRollInputLabel}>Rolled result</Text>
            <TextInput
              style={styles.hpRollInput}
              value={draft}
              onChangeText={onDraftChange}
              keyboardType="number-pad"
              placeholder={`1–${pending.hpDie}`}
              placeholderTextColor={Colors.textDim}
              autoFocus
              onSubmitEditing={submit}
            />
          </View>
          {previewGain !== null && (
            <Text style={styles.hpRollPreview}>HP increase: {previewGain}</Text>
          )}

          <Pressable style={[styles.hpRollSubmit, !validRoll && styles.btnDisabled]} disabled={!validRoll} onPress={submit}>
            <Text style={styles.hpRollSubmitTxt}>Confirm</Text>
          </Pressable>
          {/* Secondary convenience — same onResolve path as the manual entry above. */}
          <Pressable style={styles.hpRollAppBtn} onPress={rollInApp}>
            <Text style={styles.hpRollAppBtnTxt}>🎲 Roll in App</Text>
          </Pressable>
          <Pressable style={styles.closeBtnSm} onPress={onCancel}>
            <Text style={styles.closeBtnSmTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Level Up Button ───────────────────────────────────────────────────────────

export function LevelUpSection({
  entity, rules, onEntityUpdate, onLeveled,
}: {
  entity: Entity; rules: CampaignRules; onEntityUpdate: (u: Entity) => void; onLeveled: (u: Entity) => void;
}) {
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);
  const [addClassOpen, setAddClassOpen] = useState(false);
  // Set once levelUp()/levelUpClass() has been simulated but not yet
  // resolved — drives LevelUpPreviewModal. confirmPendingLevelUp() below
  // applies `after` verbatim; it must NEVER re-invoke levelUp()/
  // levelUpClass(), since CampaignRules.hpMode can be 'rolled'
  // (Math.random() inside applyHP) — a second call would apply a
  // DIFFERENT roll than the one just previewed.
  const [pendingLevelUp, setPendingLevelUp] = useState<{
    title: string; before: Entity; after: Entity;
  } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);

  // Table-first rolled HP: when rules.hpMode === 'rolled', pressing Level Up
  // (or Add/Level a class) opens this inline gate instead of immediately
  // rolling — the DM/player enters the physically-rolled die result (or
  // uses the secondary "Roll in App" convenience), and ONLY THEN does the
  // real level-up call run, with that exact result threaded through
  // levelUp/levelUpClass's manualHpRoll parameter. average/fixed/max modes
  // are entirely unaffected — this gate never opens for them.
  const [hpRollFor, setHpRollFor] = useState<
    | { kind: 'single'; hpDie: number; hpAbility: Ability }
    | { kind: 'class'; targetClassId: string; targetClass?: CharClass; overruled?: boolean; hpDie: number; hpAbility: Ability }
    | null
  >(null);
  const [hpRollDraft, setHpRollDraft] = useState('');

  // a pinned character whose versions cannot level up is told why before anything is rolled or previewed (LIFE-004)
  function levelUpRefused(): boolean {
    const refusal = pinGate(entity, STEP_OPERATIONS.levelUp);
    if (refusal) Alert.alert('Not done', refusal);
    return !!refusal;
  }

  function confirmPendingLevelUp() {
    if (!pendingLevelUp) return;
    onEntityUpdate(pendingLevelUp.after);
    onLeveled(pendingLevelUp.after);
    setPendingLevelUp(null);
  }

  // getMergedContentDB() so a homebrew class sharing an official id
  // correctly wins — feeds resolveProgression below, which governs actual
  // level-up mechanics (audit finding CONTENT-1/2/3/4 — this previously
  // spread official first, so .find() always returned the official entry).
  const allClasses = getMergedContentDB().classes;
  const maxLevel    = rules.maxLevel ?? 20;

  function classLabel(id: string) {
    return allClasses.find(c => c.id === id)?.name ?? id;
  }

  function resolveProgression(classId: string, subclassId: string | null) {
    const cls = allClasses.find(c => c.id === classId);
    let progression = cls ? getProgressionForClass(cls) : (ALL_PROGRESSIONS[classId] ?? null);
    // Once a subclass has been chosen (see SubclassPicker/applySubclassToEntity),
    // future level-ups must apply ITS entries too, not just the base class's.
    if (progression && subclassId) {
      const subEntry = getSubclassEntryMerged(classId, subclassId, homebrewSubclasses);
      if (subEntry) progression = mergeSubclassIntoProgression(progression, subEntry.progression);
    }
    return progression;
  }

  if (entity.identity.level >= maxLevel) return null;

  // ── Multiclassing off: exactly today's single-class behavior, unchanged. ──
  if (!rules.allowMulticlass) {
    const classId = entity.identity.classId;
    const progression = resolveProgression(classId, entity.identity.subclassId);
    if (!progression) return null;
    const nextLevel = entity.identity.level + 1;
    const nextEntry = progression.entries.find(e => e.level === nextLevel);

    async function doLevelUp(manualHpRoll?: number) {
      if (levelUpRefused()) return;
      const { before, after } = simulate(entity, e => levelUp(e, nextLevel, progression, rules, allClasses, manualHpRoll), rules);
      // levelUp() can grant fixed cantrips/spells for this level — warm Tier 2
      // for anything new before the entity reaches the engine pipeline.
      await spellRepo.ensureLoaded(spellIdsOnEntity(after));
      setPendingLevelUp({ title: `Level Up (→ ${nextLevel})`, before, after });
    }

    function pressLevelUp() {
      // Table-first: only rolled mode past the very first level needs a
      // result at all — max/fixed/average are already deterministic
      // (applyHP's own isVeryFirstLevel/mode branches), and gating those
      // would just be an extra tap for no reason.
      if (rules.hpMode === 'rolled' && entity.identity.level > 0 && nextEntry) {
        setHpRollDraft('');
        setHpRollFor({ kind: 'single', hpDie: nextEntry.hpDie, hpAbility: progression.hpAbility ?? 'con' });
      } else {
        void doLevelUp().catch(reportFailure('level up'));
      }
    }

    return (
      <>
        <Pressable style={styles.levelUpBtn} onPress={pressLevelUp}>
          <Text style={styles.levelUpBtnTxt}>⬆ Level Up (→ {nextLevel})</Text>
        </Pressable>
        <HpRollGate
          pending={hpRollFor?.kind === 'single' ? hpRollFor : null}
          draft={hpRollDraft}
          onDraftChange={setHpRollDraft}
          entity={entity}
          rules={rules}
          onCancel={() => setHpRollFor(null)}
          onResolve={roll => { setHpRollFor(null); void doLevelUp(roll).catch(reportFailure('level up')); }}
        />
        {entity.identity.level < maxLevel && (
          <Pressable style={styles.plannerBtn} onPress={() => setPlannerOpen(true)}>
            <Text style={styles.plannerBtnTxt}>🔭 Progression Planner</Text>
          </Pressable>
        )}
        <LevelUpPreviewModal
          visible={pendingLevelUp !== null}
          title={pendingLevelUp?.title ?? ''}
          before={pendingLevelUp?.before ?? null}
          after={pendingLevelUp?.after ?? null}
          onConfirm={confirmPendingLevelUp}
          onCancel={() => setPendingLevelUp(null)}
        />
        <ProgressionPlannerModal
          classDefinitions={allClasses}
          visible={plannerOpen}
          entity={entity}
          rules={rules}
          progression={progression}
          onClose={() => setPlannerOpen(false)}
        />
      </>
    );
  }

  // ── Multiclassing on: one "level up" button per class already taken, plus
  //    "+ Add a Class" to take a brand-new one. ──
  const classes = getClassLevels(entity);
  const takenIds = new Set(classes.map(c => c.classId));
  // LIVE-RULESET-2 (item 7): the "+ Add a Class" contextual picker is
  // filtered by the character's own entity.rulesetId — a genuinely NEW
  // pick, unlike allClasses itself (kept unfiltered above, since it's also
  // used to resolve/label classes the character ALREADY has, which must
  // keep working regardless of the character's current ruleset).
  const availableToAdd = allClasses.filter(c => !takenIds.has(asClassId(c.id)) && matchesRuleset(c.rulesetId, entity.rulesetId));
  // What a new class asks for and this character lacks (the desktop's ADR-014); nothing when the table turns it off or the character was
  // pinned before level-up revision 3. Overrule takes the class anyway, for that step only.
  const requirementApplies = multiclassRequirementApplies(rules, pinnedLockOf(entity)?.operations['dnd5e.level_up']);
  const lacksFor = (classId: string) => (requirementApplies ? multiclassLacks(entity, classId, allClasses) : []);

  function pressAddClass(c: CharClass) {
    const lacks = lacksFor(c.id);
    if (lacks.length === 0) { pressLevelUpClass(c.id, c); return; }
    Alert.alert(`Not enough for ${c.name}`, `${lacks.map(l => l.message).join('. ')}.

Overrule takes the class anyway.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Overrule', onPress: () => pressLevelUpClass(c.id, c, true) },
    ]);
  }

  async function doLevelUpClass(targetClassId: string, targetClass?: CharClass, manualHpRoll?: number, overruled = false) {
    const existing = classes.find(c => c.classId === targetClassId);
    const progression = resolveProgression(targetClassId, existing?.subclassId ?? null);
    if (!progression || levelUpRefused()) return;
    const { before, after } = simulate(entity, e => levelUpClass(e, targetClassId, progression, rules, targetClass, allClasses, manualHpRoll), rules);
    await spellRepo.ensureLoaded(spellIdsOnEntity(after));
    const title = existing
      ? `Level Up ${classLabel(targetClassId)} (→ ${existing.level + 1})`
      : `Add ${targetClass?.name ?? classLabel(targetClassId)} (level 1)${overruled ? ', requirements overruled' : ''}`;
    setPendingLevelUp({ title, before, after });
    setAddClassOpen(false); // close the "Add a Class" list modal now — preview takes over
  }

  // Table-first gate, multiclass version of pressLevelUp above — same
  // reasoning (only rolled mode needs a result; deterministic modes skip
  // straight to doLevelUpClass).
  function pressLevelUpClass(targetClassId: string, targetClass?: CharClass, overruled = false) {
    const existing = classes.find(c => c.classId === targetClassId);
    const progression = resolveProgression(targetClassId, existing?.subclassId ?? null);
    const newClassLevel = (existing?.level ?? 0) + 1;
    const entry = progression?.entries.find(e => e.level === newClassLevel);
    // Closure 4B: the character's TRUE very first level ever (a from-
    // scratch, level-0 character taking their first class) always gets max
    // die regardless of hpMode (see levelUpClass's own isVeryFirstLevel) —
    // HpRollGate's preview assumes isVeryFirstLevel:false (see its own doc
    // comment), so this must skip the gate entirely in that case, same as
    // the single-class path's pre-existing `entity.identity.level > 0`
    // guard above. Previously this gate DID open here, let the player enter
    // a value, and then silently discarded it (applyHP ignores manualRoll
    // when isVeryFirstLevel is true) — a real, if narrow, instance of the
    // "preview disagrees with what actually happens" bug this closure fixes.
    const isVeryFirstLevel = entity.identity.level === 0 && newClassLevel === 1;
    if (rules.hpMode === 'rolled' && entry && !isVeryFirstLevel) {
      setHpRollDraft('');
      setHpRollFor({ kind: 'class', targetClassId, targetClass, overruled, hpDie: entry.hpDie, hpAbility: progression.hpAbility ?? 'con' });
    } else {
      void doLevelUpClass(targetClassId, targetClass, undefined, overruled).catch(reportFailure('level up'));
    }
  }

  return (
    <View style={styles.levelUpMcWrap}>
      {classes.map(c => (
        <Pressable
          key={c.classId}
          style={styles.levelUpBtn}
          onPress={() => pressLevelUpClass(c.classId)}
        >
          <Text style={styles.levelUpBtnTxt}>⬆ Level Up {classLabel(c.classId)} (→ {c.level + 1})</Text>
        </Pressable>
      ))}

      <Pressable style={styles.addClassBtn} onPress={() => setAddClassOpen(true)}>
        <Text style={styles.addClassBtnTxt}>+ Add a Class</Text>
      </Pressable>

      <HpRollGate
        pending={hpRollFor?.kind === 'class' ? hpRollFor : null}
        draft={hpRollDraft}
        onDraftChange={setHpRollDraft}
        entity={entity}
        rules={rules}
        onCancel={() => setHpRollFor(null)}
        onResolve={roll => {
          const pending = hpRollFor;
          setHpRollFor(null);
          if (pending?.kind === 'class') void doLevelUpClass(pending.targetClassId, pending.targetClass, roll, pending.overruled).catch(reportFailure('level up'));
        }}
      />

      {entity.identity.level < maxLevel && (
        <Pressable style={styles.plannerBtn} onPress={() => setPlannerOpen(true)}>
          <Text style={styles.plannerBtnTxt}>🔭 Progression Planner</Text>
        </Pressable>
      )}

      <Modal visible={addClassOpen} animationType="slide" onRequestClose={() => setAddClassOpen(false)}>
        <View style={styles.addClassModalRoot}>
          <View style={styles.addClassHeaderRow}>
            <Text style={styles.addClassHeading}>Add a Class</Text>
            <Pressable onPress={() => setAddClassOpen(false)} hitSlop={8}>
              <Text style={styles.addClassClose}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.addClassSub}>
            Adding a class grants the reduced multiclass proficiencies
            instead of a fresh class's full starting kit.
            {requirementApplies ? ' A new class needs the ability scores both it and your present classes ask for.' : ''}
          </Text>
          <ScrollView contentContainerStyle={styles.addClassList}>
            {availableToAdd.length === 0 ? (
              <Text style={styles.addClassEmpty}>No other classes available to add.</Text>
            ) : availableToAdd.map(c => (
              <Pressable
                key={c.id}
                style={styles.addClassRow}
                onPress={() => pressAddClass(c)}
              >
                <Text style={styles.addClassRowTxt}>{c.name}</Text>
                {lacksFor(c.id).map(l => <Text key={l.classId} style={styles.addClassLack}>{l.message}</Text>)}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <LevelUpPreviewModal
        visible={pendingLevelUp !== null}
        title={pendingLevelUp?.title ?? ''}
        before={pendingLevelUp?.before ?? null}
        after={pendingLevelUp?.after ?? null}
        onConfirm={confirmPendingLevelUp}
        onCancel={() => setPendingLevelUp(null)}
      />
      <MulticlassProgressionPlannerModal
        classDefinitions={allClasses}
        visible={plannerOpen}
        entity={entity}
        rules={rules}
        availableToAdd={availableToAdd}
        resolveProgression={resolveProgression}
        classLabel={classLabel}
        onClose={() => setPlannerOpen(false)}
      />
    </View>
  );
}
