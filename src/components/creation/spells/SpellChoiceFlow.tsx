import { ImperativeRouter } from 'expo-router';
import { Dispatch, SetStateAction, JSX } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../../Lists';
import { spellRepo } from '../../../content/spellRepo';
import type { SpellIndexEntry } from '../../../content/spellRepo.types';
import { applySpellChoiceToEntity } from '../../../engine/levelingSpells';
import { Entity, ChoiceState, CampaignRules } from '../../../engine/types';
import { Alert } from '../../../utils/alert';
import { Pressable } from '../../AccessibleControls';
import { SafeBottomView } from '../../SafeBottomView';
import { SpellRow } from './SpellRow';
import { markVisited } from './spellsScreenModel';
import { styles } from './spellsScreenStyles';

export function SpellChoiceFlow({
  draft, spellChoices, classSpells, selections, setSelections, allSpells, rules, setDraft, router, homebrewSpellIds,
  renderAdditionalSpellSection,
}: {
  draft: Entity;
  spellChoices: ChoiceState[];
  classSpells: SpellIndexEntry[];
  selections: Record<string, string[]>;
  setSelections: Dispatch<SetStateAction<Record<string, string[]>>>;
  allSpells: SpellIndexEntry[];
  rules: CampaignRules;
  setDraft: (entity: Entity) => void;
  router: ImperativeRouter;
  homebrewSpellIds: Set<string>;
  renderAdditionalSpellSection: () => JSX.Element | null;
}) {
  const isCantripChoice = (id: string) => id.includes('cantrip');
  // BUGFIX-WARLOCK-SPELLS-1: a pure Warlock's castable level lives in
  // pactSlots, never sc.slots (see SpellcastingBlock's own doc comment —
  // pact slots are deliberately excluded from the regular multiclass slot
  // table). Reading only sc.slots left maxCastableLevel at 0 for a pure
  // Warlock, so every level-1+ "known spell" choice showed an empty pool
  // ("No available spells for this choice") even though cantrips worked
  // fine (cantrips don't depend on this at all). A Warlock multiclassed
  // into a full/half-caster class still gets the higher of the two tables.
  const maxCastableLevel = (() => {
    const sc = draft.spellcasting;
    if (!sc) return 0;
    const tiers = ['9', '8', '7', '6', '5', '4', '3', '2', '1'] as const;
    for (const t of tiers) {
      if ((sc.slots[t]?.total ?? 0) > 0 || (sc.pactSlots?.[t]?.total ?? 0) > 0) return Number(t);
    }
    return 0;
  })();
  const alreadyKnown = new Set([
    ...(draft.spellcasting?.cantrips ?? []),
    ...(draft.spellcasting?.known ?? []),
  ]);
  const poolForChoice = (choice: typeof spellChoices[number]): SpellIndexEntry[] => {
    const cantrip = isCantripChoice(choice.id);
    return classSpells
      .filter(s => !alreadyKnown.has(s.id))
      .filter(s => cantrip ? s.level === 0 : (s.level >= 1 && s.level <= maxCastableLevel))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  };
  // SPELL-ACCUMULATION-1: a class content author queues ONE small
  // ChoiceDefinition PER LEVEL that grants a new known spell/cantrip
  // (e.g. Warlock: one count-2 choice at level 1, then one count-1
  // choice at each of levels 2-9,19 — see src/content/classes/index.ts's
  // spellChoice() calls). Directly creating (or leveling straight to) a
  // high-level character queues all of those at once, and rendering
  // one UI block PER underlying choice object produced a stack of
  // separate "Choose 1 more spell" prompts instead of one cumulative
  // "Known Spells: X/Y" counter. Fixed here at the UI/aggregation layer
  // — grouping same-shape (cantrip vs known-spell) choices into ONE
  // combined pool/counter — rather than restructuring the underlying
  // per-level choice-queuing architecture, which many other systems
  // (resolveChoice, TabFeatures' pending-choices list, save/load) already
  // key off unchanged. Selections still fill each underlying choice
  // object in order (first-with-room), so confirming still resolves
  // each ChoiceState exactly the way it always did — see the invariant
  // note on canConfirm below.
  const cantripGroup = spellChoices.filter(c => isCantripChoice(c.id));
  const knownGroup   = spellChoices.filter(c => !isCantripChoice(c.id));

  function groupSelectedIds(group: typeof spellChoices): Set<string> {
    return new Set(group.flatMap(c => selections[c.id] ?? []));
  }
  function groupSelectedCount(group: typeof spellChoices): number {
    return group.reduce((sum, c) => sum + (selections[c.id]?.length ?? 0), 0);
  }
  function groupTotalCount(group: typeof spellChoices): number {
    return group.reduce((sum, c) => sum + c.definition.count, 0);
  }
  function toggleInGroup(group: typeof spellChoices, spellId: string) {
    setSelections(prev => {
      // Removing: find whichever underlying choice currently holds this
      // spell (unambiguous — a spell can only be selected into one slot)
      // and drop it from there.
      for (const choice of group) {
        const cur = prev[choice.id] ?? [];
        if (cur.includes(spellId)) {
          return { ...prev, [choice.id]: cur.filter(id => id !== spellId) };
        }
      }
      // Adding: fill the first underlying choice with room. Because this
      // is the ONLY path that ever adds, no choice's array can ever
      // exceed its own `count` — the invariant canConfirm below relies on.
      for (const choice of group) {
        const cur = prev[choice.id] ?? [];
        if (cur.length < choice.definition.count) {
          return { ...prev, [choice.id]: [...cur, spellId] };
        }
      }
      return prev; // group already full
    });
  }
  const handleConfirmChoices = async () => {
    try {
      const allChosen = Object.values(selections).flat();
      await spellRepo.ensureLoaded(allChosen);
      let updated = draft;
      for (const choice of spellChoices) {
        const chosen = selections[choice.id] ?? [];
        if (chosen.length === choice.definition.count) {
          updated = applySpellChoiceToEntity(updated, choice.id, chosen, id => allSpells.find(s => s.id === id)?.level, rules);
        }
      }
      updated = markVisited(updated);
      setDraft(updated);
      router.push('/creation/hub');
    } catch (e) {
      console.error('[spells] confirm failed:', e);
      Alert.alert('Couldn\'t confirm spells', e instanceof Error ? e.message : 'Something went wrong loading spell data. Check the console for details.');
    }
  };
  // Invariant: toggleInGroup's add path never lets any single choice's
  // selection array exceed that choice's own `count` — so if the GROUP's
  // total selected equals the GROUP's total count, every individual
  // choice must be exactly at its own count too (sum(x_i) = sum(cap_i)
  // with x_i <= cap_i for all i implies x_i = cap_i for all i). This is
  // what lets handleConfirmChoices' existing per-choice `=== count` check
  // keep working unchanged underneath the new aggregated UI.
  const canConfirm =
    groupSelectedCount(cantripGroup) === groupTotalCount(cantripGroup) &&
    groupSelectedCount(knownGroup) === groupTotalCount(knownGroup);

  const renderGroup = (group: typeof spellChoices, label: string) => {
    if (group.length === 0) return null;
    const pool = poolForChoice(group[0]);
    const selectedIds = groupSelectedIds(group);
    const total = groupTotalCount(group);
    const selectedCount = groupSelectedCount(group);
    const remaining = total - selectedCount;
    return (
      <View style={styles.choiceBlock}>
        <Text style={styles.choicePrompt}>{label}</Text>
        <Text style={styles.choiceCount}>
          Selected {selectedCount} / {total}{remaining > 0 ? ` · Remaining ${remaining}` : ''}
        </Text>
        {pool.length === 0
          ? <Text style={styles.emptyNote}>No available spells for this choice.</Text>
          : pool.map(spell => {
            const selected = selectedIds.has(spell.id);
            const disabled = !selected && selectedCount >= total;
            return (
              <SpellRow
                key={spell.id}
                spell={spell}
                selected={selected}
                disabled={disabled}
                isHomebrew={homebrewSpellIds.has(spell.id)}
                rulesetId={draft?.rulesetId}
                onToggle={() => toggleInGroup(group, spell.id)}
              />
            );
          })}
      </View>
    );
  };

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Spells</Text>
      {renderGroup(cantripGroup, 'Cantrips')}
      {renderGroup(knownGroup, 'Known Spells')}
      {renderAdditionalSpellSection()}
    </ScrollView>
    <SafeBottomView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, !canConfirm && styles.nextBtnDisabled]}
          onPress={() => { void handleConfirmChoices(); }}
          disabled={!canConfirm}
        >
          <Text style={styles.nextBtnText}>Confirm Spells →</Text>
        </Pressable>
      </View>
    </SafeBottomView>
    </>
  );
}
