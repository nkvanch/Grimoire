// app/dm/encounter.tsx
// Initiative tracker + combat encounter manager (DM only).
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { identityLabelsFor } from '../../src/store/identityLabelsFor';
import { useState, useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../../src/components/Lists';
import { Pressable } from '../../src/components/AccessibleControls';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Alert } from '../../src/utils/alert';
import { pinGate, STEP_OPERATIONS } from '../../src/store/pinningService';
import { useCombatStore } from '../../src/store/combatStore';
import { useCampaignStore } from '../../src/store/campaignStore';
import { useCharacterStore } from '../../src/store/characterStore';
import { useDeviceStore } from '../../src/store/deviceStore';
import { useEncounterStore } from '../../src/store/encounterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { applyWildShapeDamage, endWildShape } from '../../src/engine/combatWildShape';
import { applyDamage, applyHealing } from '../../src/engine/combatDamage';
import { recordDamageOnTarget } from '../../src/engine/trackedEffects';
import { applyCondition, removeCondition } from '../../src/engine/conditions';
import { expireOverrides } from '../../src/engine/dmOverride';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { recomputeDerived } from '../../src/engine/pipeline';
import { Entity } from '../../src/engine/types';
import { deepDiff, deepMerge } from '../../src/engine/diff';
import { rollInitiativeValue } from '../../src/engine/combat';
import { DEFAULT_RULES } from '../../src/engine/defaults';
import { DmRulingModal } from '../../src/components/sheet/DmRulingModal';
import { instantiatePreparedEncounter, instantiateWave, startingCombatantCount, hasInvalidManualHp, invalidManualHpCombatants, combatantsWithInvalidManualHp } from '../../src/engine/preparedEncounter';
import { mergeMonsterIndex } from '../../src/content/contentResolution';
import { styles } from '../../src/components/dm/encounterStyles';
import { entityGroupName } from '../../src/components/dm/encounterEntity';
import { QuickPanel } from '../../src/components/dm/QuickPanel';
import { MultiTargetPanel } from '../../src/components/dm/MultiTargetPanel';
import { CombatantRow } from '../../src/components/dm/CombatantRow';

// ── Encounter Screen ──────────────────────────────────────────────────────────

export default function EncounterScreen() {
  const router          = useRouter();
  const safeGoBack      = useSafeGoBack('/(tabs)');
  const { preparedId }  = useLocalSearchParams<{ preparedId?: string }>();
  const isDm            = useCampaignStore(s => s.isDm);
  const campaignRuleset = useCampaignStore(s => s.activeCampaign?.rulesetId);   // a 5.5e campaign applies the 2024 conditions
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const session         = useDeviceStore(s => s.session);
  const rules           = useCharacterStore(s => s.rules) ?? DEFAULT_RULES;
  const preparedEncounters = useEncounterStore(s => s.encounters);
  const saveEncounterDraft = useEncounterStore(s => s.saveEncounterDraft);
  const homebrewMonsters   = useHomebrewStore(s => s.monsters);
  // ENCOUNTER-PERF-1: was called fresh inside a .map() over prep-preview
  // combatants (once per row) — for an N-combatant prepared encounter, that
  // rebuilt the full official+homebrew monster index N times per render.
  // Memoized once per homebrewMonsters change instead.
  const allMonsterTemplates = useMemo(() => mergeMonsterIndex(homebrewMonsters), [homebrewMonsters]);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);

  const { combat, entities, startCombat, advanceTurn, endCombat, updateEntity, setInitiative, setOrder, addEntities, removeFromEncounter, rollAllInitiative, lastPersistError } =
    useCombatStore();

  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [setupMode,  setSetupMode]   = useState(!combat.active);

  // Closure fix (active-combat hydration race, defensive backstop): the
  // line above only reads combat.active ONCE, at mount — app/_layout.tsx
  // now awaits combat-state restore before releasing the boot screen (so
  // this store value is already current by the time this component can
  // possibly mount), but this stays as a defensive sync against any other
  // path that could land here before hydration (a future navigation
  // change, fast refresh in dev, etc.). Only syncs FORWARD, false→true's
  // local setupMode never re-derives backward: nothing in this screen ever
  // sets setupMode back to true once it's false (there's no "return to
  // setup while combat is active" UI action — setSetupMode(false) is the
  // only call site besides this one), so a real active encounter restored
  // late can never leave the DM stuck looking at a stale Setup screen, and
  // this can never undo any deliberate user navigation.
  useEffect(() => {
    if (combat.active && setupMode) setSetupMode(false);
  }, [combat.active, setupMode]);

  // Multi-target selection — separate from selectedId's single-select flow,
  // active only while multiMode is on. Toggling multiMode off clears the
  // set so re-entering starts fresh rather than reopening a stale panel.
  const [multiMode,   setMultiMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  function toggleSelected(id: string) {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  // DM temporary rulings — set to the resolved target list (one entity, the
  // current multi-selection, or every combatant) to open DmRulingModal;
  // null when closed.
  const [rulingTargets, setRulingTargets] = useState<Entity[] | null>(null);
  function applyRuling(updates: { before: Entity; after: Entity }[]) {
    for (const u of updates) {
      applyEntityUpdate(u.before, u.after, `${u.after.identity.name}: DM ruling applied`);
    }
    setRulingTargets(null);
  }

  // The PreparedEncounter this run either came from (via ?preparedId=, still
  // in setupMode/preview) or was instantiated from (combat.active, carries
  // its own sourcePreparedEncounterId — see CombatState's own doc comment).
  const previewSource = preparedId ? preparedEncounters.find(e => e.id === preparedId) ?? null : null;
  const activeSource   = combat.sourcePreparedEncounterId
    ? preparedEncounters.find(e => e.id === combat.sourcePreparedEncounterId) ?? null
    : null;

  // Audit finding: setupMode is only evaluated once, at mount, from the
  // GLOBAL combat.active flag — it has no idea whether ?preparedId= refers
  // to the encounter actually running. Navigating here for a DIFFERENT
  // prepared encounter while one is already active (without ending it first)
  // used to silently render that OTHER encounter's live combat view under
  // the new preparedId, with no indication anything was wrong. There's only
  // ever one CombatState globally (no concurrent-encounters architecture
  // exists, and building one is out of scope for this fix) — so the correct
  // behavior is a clear warning, not a silent wrong-encounter render.
  // Derived every render (not stateful) so it self-corrects regardless of
  // whether navigating here for a new preparedId actually remounts this
  // screen or just updates its route params.
  const encounterConflict = combat.active && !!preparedId && combat.sourcePreparedEncounterId !== preparedId;

  // Selected entity for the quick panel
  const selectedEntity = entities.find(e => e.id === selectedId);

  // Core apply-one-update logic, extracted so both the single-select
  // QuickPanel path and the multi-target path (which has its own `before`
  // per entity, not the single globally-selected one) share it.
  function applyEntityUpdate(before: Entity | undefined, updated: Entity, label?: string) {
    // Rules-engine blocker RE-AUDIT closure (1D/1E/1F): re-resolve derived
    // state against the SAME explicit merged content snapshot every other
    // application mutation boundary in this app uses (app/sheet/[id].tsx,
    // app/dm/character/[id].tsx) — QuickPanel/MultiTargetPanel call engine
    // mutators (applyDamage/applyWildShapeDamage/recomputeDerived) directly
    // and don't have this snapshot in scope themselves, so a homebrew
    // character mutated from this screen's DM tools could otherwise fall
    // back to official-only content. recomputeDerived is a pure, idempotent
    // full overwrite of .derived/.actionCards, so re-running it here — this
    // is the true choke point both the single-select and multi-target paths
    // funnel through — is always safe regardless of what already ran
    // upstream.
    const content = getMergedContentDB(updated.rulesetId);
    updated = recomputeDerived(updated, rules, {
      classDefs: content.classes, homebrewSpells: content.spells, races: content.races, items: content.items,
    });
    // Damage this action dealt is added to any effect that records damage on that target (a mark that remembers what the target
    // takes). The table named the target; the app only adds up what landed.
    if (before) {
      const prior = new Set(before.damageLog ?? []);
      const landed = (updated.damageLog ?? []).filter(x => !prior.has(x)).reduce((sum, x) => sum + x.amount, 0);
      if (landed > 0) {
        for (const c of useCharacterStore.getState().characters) {
          if (!c.trackedEffects?.some(x => x.records)) continue;
          const next = recordDamageOnTarget(c, { id: updated.id, name: updated.identity.name }, landed);
          if (next !== c) updateCharacter(c.id, () => next, `${c.identity.name}: ${landed} recorded on ${updated.identity.name}`, 'combat');
        }
      }
    }
    // If it's a player character, persist to characterStore too — the REAL
    // synced source of truth, not just this DM device's own combatStore
    // copy of it.
    if (updated.kind === 'character') {
      // Bug fix (architecture review U1/U2): this used to call
      // updateCharacter(id, () => updated, label) — the updater ignores the
      // fresh state updateCharacter hands it and always returns the
      // pre-baked `updated`, which was computed from combatStore's
      // possibly-stale copy. If a player made an independent change on
      // their own device (synced into characterStore) between the DM's
      // last combatStore snapshot and this action, that change was
      // silently reverted. Diff what the action actually changed
      // (`before` → `updated`) and merge just that patch onto whatever
      // characterStore's real current state is — the same deepDiff/
      // deepMerge machinery combatStore uses for the same "apply
      // what changed, not a wholesale snapshot" problem.
      // Item 17 (timeline improvements) — bug fix: this never passed a
      // category, so every action fired from this screen (damage/heal/
      // kill/condition/ruling/legendary-action use/wave deploy) landed
      // under "Other" instead of "Combat," the one category that's
      // actually always correct here (this function only ever runs from
      // the DM's live encounter/initiative tracker).
      if (before) {
        const patch = deepDiff(before, updated);
        if (patch !== undefined) {
          updateCharacter(updated.id, c => deepMerge(c, patch), label, 'combat');
        }
      } else {
        // No prior snapshot to diff against — fall back to a wholesale replace.
        updateCharacter(updated.id, () => updated, label, 'combat');
      }
      // Bug fix (audit finding SYNC-COMBAT-1, sub-paths a/b): combatStore's
      // own copy of this entity used to be overwritten with `updated` —
      // the RESULT of this action computed from combatStore's possibly-
      // stale `before` snapshot. That silently reverted combatStore's live
      // tracker away from whatever characterStore actually held for any
      // OTHER field the stale snapshot didn't have (e.g. a player equipped
      // an item on their own device between DM actions) — wrong AC/HP math
      // on this screen for the rest of the encounter, even though
      // characterStore/sync themselves stayed correct. Read characterStore
      // back out AFTER the merge above and use ITS state to refresh
      // combatStore, instead of the stale-baseline-derived `updated`.
      const merged = useCharacterStore.getState().characters.find(c => c.id === updated.id);
      updateEntity(updated.id, () => merged ?? updated);
    } else {
      updateEntity(updated.id, () => updated);
    }
  }

  function handleEntityUpdate(updated: Entity, label?: string) {
    // `before` is the combatStore snapshot QuickPanel's own action handlers
    // (submitDamage/submitHeal/etc.) actually computed `updated` FROM — it's
    // the `entity` prop QuickPanel was rendered with this same render pass,
    // closed over here via `selectedEntity`.
    applyEntityUpdate(selectedEntity, updated, label);
  }

  // Applies the same mutator to every currently multi-selected entity —
  // the "DM multi-target tools" entry point. Each entity's own `before` is
  // read fresh from combatStore.entities per-iteration (not the single
  // selectedEntity), so the character-patch diff above stays correct per
  // entity. Wild Shape branching is handled inline by the caller (same
  // per-entity check QuickPanel's own submitDamage/submitHeal already do)
  // since a mixed selection can include both transformed and normal entities.
  function handleBulkUpdate(mutate: (e: Entity) => Entity, labelFor: (e: Entity) => string) {
    for (const id of selectedIds) {
      const before = entities.find(e => e.id === id);
      if (!before) continue;
      applyEntityUpdate(before, mutate(before), labelFor(before));
    }
  }

  function bulkDamage(amount: number, damageType?: string, nonmagicalAttack?: boolean) {
    const dt = damageType?.trim() || undefined;
    handleBulkUpdate(
      e => e.wildShapeState?.active ? applyWildShapeDamage(e, amount, rules, dt, nonmagicalAttack) : applyDamage(e, amount, rules, dt),
      e => `${e.identity.name}: took ${amount}${dt ? ` ${dt}` : ''} damage`,
    );
  }
  function bulkHeal(amount: number) {
    handleBulkUpdate(
      e => e.wildShapeState?.active ? e : applyHealing(e, amount, rules),
      e => `${e.identity.name}: healed ${amount}`,
    );
  }
  function bulkKill() {
    // Rules-engine blocker fix (closure 3I) — same beastHpMax-as-damage bug
    // as the single-target Kill above, fixed the same way.
    handleBulkUpdate(
      e => e.wildShapeState?.active
        ? endWildShape(e, rules)
        : recomputeDerived({ ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 0 } } }, rules),
      e => `${e.identity.name}: set HP to 0 (Kill)`,
    );
  }
  function bulkAddCondition(conditionId: string) {
    const features = getMergedContentDB(campaignRuleset).conditions.find(c => c.id === conditionId)?.features;
    handleBulkUpdate(
      e => applyCondition(e, conditionId, 'dm', rules, features),
      e => `${e.identity.name}: added condition: ${conditionId}`,
    );
  }
  function bulkRemoveCondition(conditionId: string) {
    handleBulkUpdate(
      e => removeCondition(e, conditionId, rules),
      e => `${e.identity.name}: removed condition: ${conditionId}`,
    );
  }

  // ── Setup mode: add party characters ─────────────────────────────────────

  function handleStartCombat() {
    if (entities.length === 0) {
      Alert.alert('No combatants', 'Add at least one entity before starting.');
      return;
    }
    const encounterId = `enc_${Date.now()}`;
    startCombat(entities, encounterId);
    setSetupMode(false);
  }

  // Instantiate a PreparedEncounter into fresh runtime entities and start
  // combat — starting the same template twice always produces independent
  // entities (instantiatePreparedEncounter never touches the template), and
  // starting never mutates `previewSource` itself. Any party members already
  // added manually in setup mode (rare when arriving via a prepared
  // encounter, but not disallowed) come along too.
  function handleStartFromPrepared() {
    if (!previewSource) return;
    // Closure 1 (final runtime Start boundary): this is the ONE place every
    // route that can start a prepared encounter converges on — the
    // Encounter Library's "▶ Start" action and Builder's "Review & Start"
    // button both just navigate here (?preparedId=...) and this screen's
    // own "Start This Encounter" button is what actually calls this
    // function. Builder-level validation (Closure 3) only protects
    // encounters edited there — a LEGACY saved encounter (or one that
    // predates that validation) can still carry hpMode:'manual' with an
    // invalid/missing manualHp, and instantiatePreparedEncounter would
    // otherwise silently spawn it at the printed average with no
    // indication anything was wrong. Reuses the exact same
    // hasInvalidManualHp/invalidManualHpCombatants guard Builder's own
    // Save/Start actions already use (preparedEncounter.ts) — one
    // authoritative validity check, not a second implementation here.
    // Deliberately does NOT auto-fix or fall back to Average: the user is
    // told exactly which combatant(s) need attention and left to fix them
    // in the builder, same as Builder's own gate already does.
    if (hasInvalidManualHp(previewSource)) {
      const names = invalidManualHpCombatants(previewSource)
        .map(c => c.displayName?.trim() || allMonsterTemplates.find(t => t.id === c.monsterId)?.name || c.monsterId)
        .join(', ');
      Alert.alert(
        'Fix manual HP before starting',
        `"${previewSource.name}" can't be started: ${names} ${invalidManualHpCombatants(previewSource).length === 1 ? 'has' : 'have'} Manual/Table-Rolled HP selected with no valid HP entered. Edit the encounter and enter a whole number greater than 0, or choose a different HP method.`,
      );
      return;
    }
    const spawned = instantiatePreparedEncounter(previewSource, rules, homebrewMonsters);
    if (spawned.length === 0 && entities.length === 0) {
      Alert.alert('No combatants', 'This encounter has no combatants present at the start (check waves — they deploy later).');
      return;
    }
    const encounterId = `enc_${Date.now()}`;
    startCombat([...entities, ...spawned], encounterId, previewSource.id);
    void saveEncounterDraft({ ...previewSource, lastStartedAt: Date.now(), status: previewSource.status === 'draft' ? 'ready' : previewSource.status });
    setSetupMode(false);
  }

  function handleDeployWave(waveId: string) {
    if (!activeSource) return;
    const wave = activeSource.waves.find(w => w.id === waveId);
    // Final runtime boundary, wave-deploy case: the exact same guard
    // handleStartFromPrepared applies before an initial start must also
    // apply here — a mid-combat wave deploy is just as capable of
    // instantiating a legacy/invalid combatant, and instantiateWave would
    // otherwise silently spawn it at the printed average with no
    // indication anything was wrong. Scoped to just THIS wave's own
    // combatants (not the whole encounter) via combatantsWithInvalidManualHp
    // — the shared array-based primitive invalidManualHpCombatants/
    // hasInvalidManualHp already delegate to, so this is the same one
    // validation rule, not a second implementation. Deliberately checked
    // BEFORE instantiateWave runs: the deploy is all-or-nothing from the
    // DM's perspective — no partial deployment of only the valid members,
    // no RNG consumed, no average substituted.
    const waveCombatants = activeSource.combatants.filter(c => c.waveId === waveId);
    const invalid = combatantsWithInvalidManualHp(waveCombatants);
    if (invalid.length > 0) {
      const names = invalid
        .map(c => c.displayName?.trim() || allMonsterTemplates.find(t => t.id === c.monsterId)?.name || c.monsterId)
        .join(', ');
      Alert.alert(
        'Cannot deploy wave',
        `Manual HP is missing or invalid for: ${names}. Edit the prepared encounter and enter a whole number greater than 0, or choose a different HP method, before deploying "${wave?.name ?? 'this wave'}."`,
      );
      return;
    }
    const spawned = instantiateWave(activeSource, waveId, rules, homebrewMonsters);
    if (spawned.length === 0) {
      Alert.alert('Nothing to deploy', 'No combatants are assigned to this wave.');
      return;
    }
    addEntities(spawned);
    Alert.alert('Reinforcements deployed', `${wave?.name ?? 'Wave'}: ${spawned.length} combatant${spawned.length !== 1 ? 's' : ''} added to initiative.`);
  }

  // Closure 2E: adds to the pre-combat setup roster via combatStore's own
  // addToRoster action, which persists immediately (see its doc comment) —
  // this used to be a raw, unsaved setState (plus a redundant updateEntity
  // call that was always a no-op here, since the entity isn't in `entities`
  // yet for it to update).
  function addPartyMember(c: Entity) {
    // a combatant is worked out automatically: a pinned character whose pinned content cannot be had waits until it is pinned again (LIFE-004)
    const refusal = pinGate(c, STEP_OPERATIONS.derivedStats);
    if (refusal) { Alert.alert(`${c.identity.name} could not join`, refusal); return; }
    useCombatStore.getState().addToRoster(c);
  }

  function handleEndEncounter() {
    Alert.alert('End Encounter', 'End this encounter?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Encounter',
        onPress: () => {
          // Expire end_of_encounter DM overrides on all entities. Routed
          // through applyEntityUpdate (the same diff+merge path every other
          // mutation on this screen already uses) rather than calling
          // updateCharacter directly — a direct call here used to pass an
          // updater that ignored the fresh characterStore state it was
          // handed and always returned this combatStore-derived `updated`
          // wholesale, silently discarding any independent edit (e.g. a
          // player equipping an item on their own device) that landed in
          // characterStore after this combatStore snapshot was taken
          // (audit finding PERSIST-3).
          entities.forEach(e => {
            if (e.kind === 'character') {
              const updated = expireOverrides(e, 'end_of_encounter', rules);
              applyEntityUpdate(e, updated, 'End of encounter (override expiry)');
            }
          });
          // Mark the PreparedEncounter completed if this run came from one —
          // the template's own combatant list is left exactly as authored;
          // live HP/conditions are never copied back into it (see
          // PreparedEncounter's own doc comment).
          if (activeSource) {
            void saveEncounterDraft({ ...activeSource, status: 'completed', completedAt: Date.now() });
          }
          endCombat();
          safeGoBack();
        },
      },
    ]);
  }

  if (!isDm) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}><Text style={styles.errorTxt}>DM access only.</Text></View>
      </View>
    );
  }

  if (encounterConflict) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={safeGoBack}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Encounter Already Active</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>
            {activeSource ? `"${activeSource.name}"` : 'Another encounter'} is already running — end it before starting {previewSource ? `"${previewSource.name}"` : 'a new one'}.
          </Text>
          <Pressable style={styles.startBtn} onPress={() => router.replace('/dm/encounter')}>
            <Text style={styles.startBtnTxt}>Go to active encounter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Setup view ─────────────────────────────────────────────────────────────

  if (setupMode) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={safeGoBack}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Set Up Encounter</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {previewSource && (
            <View style={styles.prepPreview}>
              <Text style={styles.prepPreviewTitle}>📋 {previewSource.name}</Text>
              {!!previewSource.description && <Text style={styles.prepPreviewDesc}>{previewSource.description}</Text>}
              <Text style={styles.prepPreviewMeta}>
                {startingCombatantCount(previewSource)} combatant{startingCombatantCount(previewSource) !== 1 ? 's' : ''} present from the start
                {previewSource.waves.length > 0 ? ` · ${previewSource.waves.length} wave${previewSource.waves.length !== 1 ? 's' : ''} held in reserve` : ''}
              </Text>
              {previewSource.combatants.filter(c => !c.waveId).map(c => (
                <Text key={c.id} style={styles.prepPreviewRow}>
                  • {c.displayName?.trim() || allMonsterTemplates.find(t => t.id === c.monsterId)?.name || c.monsterId}
                  {c.quantity > 1 ? ` ×${c.quantity}` : ''}
                </Text>
              ))}
              <Pressable style={styles.prepStartBtn} onPress={handleStartFromPrepared}>
                <Text style={styles.prepStartBtnTxt}>▶ Start This Encounter</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionLabel}>ADD COMBATANTS</Text>
          {characters.map(c => {
            const inCombat = entities.some(e => e.id === c.id);
            return (
              <View key={c.id} style={styles.setupRow}>
                <Text style={styles.setupName}>
                  {c.identity.name} — Lv {c.identity.level} {identityLabelsFor(c).class || c.identity.classId}
                </Text>
                <Pressable
                  style={[styles.addBtn, inCombat && styles.addBtnAdded]}
                  onPress={() => inCombat ? removeFromEncounter(c.id) : addPartyMember(c)}
                >
                  <Text style={styles.addBtnTxt}>{inCombat ? 'Remove' : '+ Add'}</Text>
                </Pressable>
              </View>
            );
          })}

          {/* app/dm/monsters.tsx exists and is fully wired to spawn straight
              into combatStore + navigate back here — it just had no link
              pointing to it anywhere in the app until now. */}
          <Pressable style={styles.addMonsterBtn} onPress={() => router.push('/dm/monsters')}>
            <Text style={styles.addMonsterBtnTxt}>🐉 Add Monster</Text>
          </Pressable>

          <Pressable style={styles.startBtn} onPress={handleStartCombat}>
            <Text style={styles.startBtnTxt}>⚔️ Start Combat ({entities.length} combatants)</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Active combat view ─────────────────────────────────────────────────────

  const currentEntry = combat.order[combat.turnIndex];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={safeGoBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Round {combat.round}</Text>
          <Text style={styles.turnLabel}>
            Turn: {currentEntry?.name ?? '—'}
          </Text>
        </View>
        <Pressable style={styles.endBtn} onPress={handleEndEncounter}>
          <Text style={styles.endBtnTxt}>End</Text>
        </Pressable>
      </View>

      {/* Surfaces a failed combat-state save instead of only logging it
          (audit finding PERSIST-5) — clears itself on the next successful
          save. */}
      {lastPersistError && (
        <View style={styles.persistErrorBanner}>
          <Text style={styles.persistErrorTxt}>⚠️ {lastPersistError}</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Reinforcements — only meaningful when this run came from a
            PreparedEncounter with waves defined. Deployment is manual-only
            (a Deploy button), matching the "at minimum, manual deployment
            must work" scope — a 'round'/'descriptive' triggerKind is shown
            as a reminder, never auto-fired. */}
        {activeSource && activeSource.waves.length > 0 && (
          <View style={styles.waveSection}>
            <Text style={styles.sectionLabel}>REINFORCEMENTS</Text>
            {activeSource.waves.map(w => {
              const pendingCount = activeSource.combatants
                .filter(c => c.waveId === w.id)
                .reduce((sum, c) => sum + Math.max(1, c.quantity), 0);
              return (
                <View key={w.id} style={styles.waveRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waveName}>{w.name}</Text>
                    <Text style={styles.waveMeta}>
                      {w.triggerKind === 'round' && w.triggerRound ? `Reminder: round ${w.triggerRound}` : null}
                      {w.triggerKind === 'descriptive' && w.triggerNote ? w.triggerNote : null}
                      {w.triggerKind === 'manual' ? `${pendingCount} combatant${pendingCount !== 1 ? 's' : ''} ready` : null}
                    </Text>
                  </View>
                  <Pressable style={styles.waveDeployBtn} onPress={() => handleDeployWave(w.id)}>
                    <Text style={styles.waveDeployTxt}>Deploy</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Multi-target toggle + ruling-for-everyone */}
        <View style={styles.multiToggleRow}>
          <Pressable
            style={[styles.multiToggleBtn, multiMode && styles.multiToggleBtnActive]}
            onPress={() => {
              setMultiMode(m => !m);
              setSelectedIds([]);
              setSelectedId(null);
            }}
          >
            <Text style={styles.multiToggleTxt}>{multiMode ? '✓ Multi-select on' : '☐ Multi-select'}</Text>
          </Pressable>
          {entities.length > 0 && (
            <Pressable style={styles.multiToggleBtn} onPress={() => setRulingTargets(entities)}>
              <Text style={styles.multiToggleTxt}>🌍 Ruling for Everyone</Text>
            </Pressable>
          )}
          {/* Table-first: manual entry/reorder (per-row, above) is the
              primary way to set initiative. This is the secondary app-roll
              convenience for the whole order in one tap — never fired
              automatically, only on this explicit press. */}
          {combat.order.length > 0 && (
            <Pressable style={styles.multiToggleBtn} onPress={rollAllInitiative}>
              <Text style={styles.multiToggleTxt}>🎲 Roll All Initiative</Text>
            </Pressable>
          )}
        </View>

        {/* Group quick-select — first runtime consumer of PreparedEncounter's
            groupName metadata (see entityGroupName above). Only shown while
            multi-select is on and at least one live combatant carries a
            group tag. */}
        {multiMode && (() => {
          const groupNames = Array.from(new Set(
            combat.order
              .map(e => entities.find(x => x.id === e.entityId))
              .filter((e): e is Entity => !!e)
              .map(entityGroupName)
              .filter((g): g is string => !!g)
          ));
          if (groupNames.length === 0) return null;
          return (
            <View style={styles.groupChipRow}>
              {groupNames.map(g => (
                <Pressable
                  key={g}
                  style={styles.groupChip}
                  onPress={() => setSelectedIds(
                    combat.order
                      .map(e => entities.find(x => x.id === e.entityId))
                      .filter((e): e is Entity => !!e && entityGroupName(e) === g)
                      .map(e => e.id)
                  )}
                >
                  <Text style={styles.groupChipTxt}>Select group: {g}</Text>
                </Pressable>
              ))}
            </View>
          );
        })()}

        {/* Initiative order */}
        {combat.order.map((entry, idx) => {
          const ent = entities.find(e => e.id === entry.entityId);
          function swap(a: number, b: number) {
            const next = [...combat.order];
            [next[a], next[b]] = [next[b], next[a]];
            setOrder(next);
          }
          return (
            <CombatantRow
              key={entry.entityId}
              entry={entry}
              entity={ent}
              isCurrent={idx === combat.turnIndex}
              isSelected={multiMode && selectedIds.includes(entry.entityId)}
              onPress={() => multiMode
                ? toggleSelected(entry.entityId)
                : setSelectedId(selectedId === entry.entityId ? null : entry.entityId)
              }
              onMoveUp={idx > 0 ? () => swap(idx, idx - 1) : undefined}
              onMoveDown={idx < combat.order.length - 1 ? () => swap(idx, idx + 1) : undefined}
              onSetInitiative={value => setInitiative(entry.entityId, value)}
              onRollInitiative={ent ? () => setInitiative(entry.entityId, rollInitiativeValue(ent)) : undefined}
            />
          );
        })}

        {/* Quick panel for a single selected combatant (non-multi mode) */}
        {!multiMode && selectedEntity && (
          <QuickPanel
            entity={selectedEntity}
            rules={rules}
            onUpdate={handleEntityUpdate}
            onRuling={() => setRulingTargets([selectedEntity])}
            onClose={() => setSelectedId(null)}
          />
        )}

        {/* Multi-target panel */}
        {multiMode && selectedIds.length > 0 && (
          <MultiTargetPanel
            entities={selectedIds.map(id => entities.find(e => e.id === id)).filter((e): e is Entity => !!e)}
            onDamage={bulkDamage}
            onHeal={bulkHeal}
            onKill={bulkKill}
            onAddCondition={bulkAddCondition}
            onRemoveCondition={bulkRemoveCondition}
            onRuling={() => setRulingTargets(selectedIds.map(id => entities.find(e => e.id === id)).filter((e): e is Entity => !!e))}
            onClose={() => setSelectedIds([])}
          />
        )}

        {/* DM temporary ruling — targets resolved by whichever entry point
            opened it. Gated (was unconditionally mounted) — same
            lazy-mount pattern as ConcentrationModal just above and
            [id].tsx's preview modals. */}
        {rulingTargets !== null && (
          <DmRulingModal
            visible={rulingTargets !== null}
            entities={rulingTargets ?? []}
            rules={rules}
            onApply={applyRuling}
            onCancel={() => setRulingTargets(null)}
          />
        )}
      </ScrollView>

      {/* End Turn bar */}
      <SafeBottomView>
        <View style={styles.turnBar}>
          <Pressable style={styles.endTurnBtn} onPress={() => advanceTurn(rules)}>
            <Text style={styles.endTurnTxt}>End Turn →</Text>
          </Pressable>
        </View>
      </SafeBottomView>
    </View>
  );
}
