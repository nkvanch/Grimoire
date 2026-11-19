import { grantEntitlements, grantEntitlement, revokeEntitlementsFromChoice } from '../../src/engine/entitlements';
// app/creation/spells.tsx
// Step 8: Spell selection for spellcasting classes.
// Always renders — never auto-navigates during render.
// Sets spellsVisited flag on Continue so hub knows this step was reached.
//
// Two selection modes:
//   1. ChoiceDefinition-based (kind: 'spell') — if a class ever defines them.
//   2. Content-based — pull cantrips/level-1 spells straight from the content DB
//      and write the picks into entity.spellcasting.cantrips / .known.
import { useState, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../../src/components/Lists';
import { Pressable, TextInput } from '../../src/components/AccessibleControls';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { Entity } from '../../src/engine/types';
import { spellRepo } from '../../src/content/spellRepo';
import type { SpellIndexEntry } from '../../src/content/spellRepo.types';
import { mergeSpellIndex } from '../../src/content/contentResolution';
import { spellListsForClass, filterSpellsForClass, spellSourceLabel } from '../../src/content/spellLists';
import { extraClassSpellIds } from '../../src/engine/spellModifiers';
import { SortControl } from '../../src/components/SortControl';
import { Alert } from '../../src/utils/alert';
import { ActiveFilterChips } from '../../src/components/FilterChipRow';
import { Colors } from '../../src/theme';
import { SafeBottomView } from '../../src/components/SafeBottomView';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { SPELLS_AT_L1, readCreationPicks, writeCreationPicks, CreationSpellPicks } from '../../src/content/creationProgress';
import { styles } from '../../src/components/creation/spells/spellsScreenStyles';
import { AdditionalSpellFlow, SCREEN_KEY, markVisited } from '../../src/components/creation/spells/spellsScreenModel';
import { spellPoolsFor } from '../../src/components/creation/spells/spellPoolsFor';
import { useSpellFilterState } from '../../src/components/creation/spells/useSpellFilterState';
import { SpellPickLists } from '../../src/components/creation/spells/SpellPickLists';
import { SpellFilterPanel } from '../../src/components/creation/spells/SpellFilterPanel';
import { SpellChoiceFlow } from '../../src/components/creation/spells/SpellChoiceFlow';
import { AdditionalSpellSection } from '../../src/components/creation/spells/AdditionalSpellSection';

export default function SpellsScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const draft    = useCharacterStore(s => s.draft);
  const setDraft = useCharacterStore(s => s.setDraft);
  const rules    = useCharacterStore(s => s.rules);
  const homebrewSpells = useHomebrewStore(s => s.spells);
  const spellLists      = useHomebrewStore(s => s.spellLists);

  // ── ALL hooks first — before any conditional return ──
  // Redirect to name if no draft — must be in useEffect, not render
  useEffect(() => {
    if (!draft) router.replace('/creation/name');
  }, [draft?.id]);

  // CREATION-REVISIT-1: was filtered to only !resolved. For a class using
  // this ChoiceDefinition-based path (e.g. Wizard's cantrip/spellbook
  // choice), once resolved this screen fell through to the content-based
  // branch below — and Wizard is deliberately excluded from SPELLS_AT_L1
  // (see that table's own comment), so the player landed on "nothing to
  // pick" with no way back to their original choice. Same fix shape as
  // skills.tsx's startEditingSkills / equipment.tsx's startEditingEquipment.
  const allSpellChoicesForKind = draft ? draft.choices.filter(c => c.definition.kind === 'spell' && !c.definition.spellFilter) : [];
  const spellChoices        = allSpellChoicesForKind.filter(c => !c.resolved);
  const resolvedSpellChoices = allSpellChoicesForKind.filter(c =>  c.resolved);

  // ChoiceDefinition-based selections (legacy path)
  const [selections, setSelections] = useState<Record<string, string[]>>(
    Object.fromEntries(spellChoices.map(c => [c.id, []]))
  );

  // Content-based selections. pickedCantrips/pickedSpells track ONLY what's
  // picked on THIS screen, seeded from the persisted creationSpellPicks (see
  // readCreationPicks) rather than draft.spellcasting directly — that can
  // already be non-empty before the player ever gets here (e.g. every
  // Cleric Divine Domain grants 2 "always prepared" domain spells via a
  // known_spells Grant — see src/content/subclasses/cleric.ts — the moment
  // a domain is picked) or hold picks from a PREVIOUS visit to this exact
  // screen, and there's no marker distinguishing the two once merged into
  // one array. Seeding picked state straight from spellcasting.known used
  // to permanently break confirmation for prepared casters (Cleric/Druid,
  // targets.spells === 0): pickedSpells.length would never again equal 0
  // since there's no UI here that can ever clear it, so Confirm stayed
  // disabled forever regardless of cantrips. alreadyGrantedCantrips/Spells
  // is everything currently in spellcasting that ISN'T one of the player's
  // own tracked picks — i.e. purely external grants — computed once via a
  // lazy initializer so a re-render mid-screen doesn't re-read a
  // since-changed draft.
  const [initialPicks] = useState<CreationSpellPicks>(() => readCreationPicks(draft));
  const [alreadyGrantedCantrips] = useState<string[]>(() => {
    const own = new Set(initialPicks.cantrips);
    return (draft?.spellcasting?.cantrips ?? []).filter(id => !own.has(id));
  });
  const [alreadyGrantedSpells] = useState<string[]>(() => {
    const own = new Set(initialPicks.spells);
    return (draft?.spellcasting?.known ?? []).filter(id => !own.has(id));
  });
  const [pickedCantrips, setPickedCantrips] = useState<string[]>(initialPicks.cantrips);
  const [pickedSpells,   setPickedSpells]   = useState<string[]>(initialPicks.spells);
  // SAVE-AND-ADD-1: returning from "+ Create new homebrew spell" (content-
  // based picker only — the ChoiceDefinition-based branch above has no
  // simple "add to selection" slot to inject into). Adds the new spell if
  // it's eligible for THIS class/level/pick-count; otherwise explains why
  // instead of silently forcing or dropping it.
  // SPELL-ROUNDTRIP-1: uses useFocusEffect (not a plain useEffect keyed on
  // homebrewSpells) — same fix shape already proven by equipment.tsx's own
  // nested-builder round trip (STARTING-EQUIPMENT-2). A plain effect keyed
  // on the homebrewStore selector was found to be unreliable on return from
  // a pushed route: the store update and this screen regaining focus don't
  // reliably land in the same commit, so the effect could silently never
  // re-run and the pending selection would sit unconsumed forever. Reads
  // draft/homebrewSpells fresh via .getState() (not the render-time
  // closure) so the callback never acts on stale data; pickedCantrips/
  // pickedSpells.length stay in the dependency array since they're local
  // component state, not reachable via .getState().
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('spell_picker');
      const currentDraft = useCharacterStore.getState().draft;
      if (!newId || !currentDraft) return;
      const spell = mergeSpellIndex(useHomebrewStore.getState().spells).find(s => s.id === newId);
      if (!spell) return;
      const classId = currentDraft.identity.classId;
      const hb = useHomebrewStore.getState();
      const classSource = hb.getMergedContentDB().classes.find(c => c.id === classId)?.spellListSource;
      const eligibleForClass = filterSpellsForClass([spell], classId, null, hb.spellLists, classSource).length > 0
        || extraClassSpellIds(currentDraft, classId).includes(spell.id);
      const targets = SPELLS_AT_L1[classId] ?? { cantrips: 0, spells: 0 };
      if (!eligibleForClass) {
        Alert.alert('Not added', `"${spell.name}" isn't on ${classId}'s spell list, so it wasn't added to your picks. It's saved and available from "+ Add extra from another class."`);
      } else if (spell.level === 0) {
        if (pickedCantrips.length < targets.cantrips) setPickedCantrips(prev => [...prev, newId]);
        else Alert.alert('Not added', `"${spell.name}" was saved, but your cantrip picks are already full (${targets.cantrips}/${targets.cantrips}). Deselect one first if you want to add it.`);
      } else if (spell.level === 1) {
        if (pickedSpells.length < targets.spells) setPickedSpells(prev => [...prev, newId]);
        else Alert.alert('Not added', `"${spell.name}" was saved, but your spell picks are already full (${targets.spells}/${targets.spells}). Deselect one first if you want to add it.`);
      } else {
        Alert.alert('Saved', `"${spell.name}" was saved. This screen only picks cantrips and 1st-level spells — find it later via "+ Add Spell" on your character sheet.`);
      }
    }, [pickedCantrips.length, pickedSpells.length])
  );

  // "+ Add Additional Spell" flow — closed | menu | library | homebrew.
  // Whole-library browsing (AddSpellModal, unconstrained by class list),
  // lazily mounted (LAZY-MOUNT-1, matching equipment.tsx's own additional-
  // item flow) — only the chosen destination is ever actually mounted.
  const [additionalFlow, setAdditionalFlow] = useState<AdditionalSpellFlow>('closed');
  // ADDITIONAL-SPELL-2: ids added via "+ Add Additional Spell" this visit,
  // tracked separately from alreadyGrantedCantrips/Spells (which is frozen
  // at mount) so section 3's pool-exclusion and handleConfirm's final
  // spellcasting merge both see adds made mid-visit — see both use sites
  // below for why a live add would otherwise get silently dropped at
  // Confirm (handleConfirm rebuilds spellcasting.cantrips/known from
  // alreadyGranted+picked only) or double-offered in the required pool.
  const [additionalCantripIds, setAdditionalCantripIds] = useState<string[]>([]);
  const [additionalSpellIds,   setAdditionalSpellIds]   = useState<string[]>([]);

  // ADDITIONAL-SPELL-1: "+ Add Additional Spell" → "Create New Homebrew
  // Spell" round trip. Keyed separately from 'spell_picker' above (see
  // spell-builder.tsx's doSave) specifically so it can add UNCONDITIONALLY
  // — whole library, no class/level restriction, no eligibility check, and
  // critically no entitlement consumed (never touches creationSpellPicks) —
  // unlike the Required picker's own consumer above, which gates on
  // class/level/pick-count. SPELL-ROUNDTRIP-1: useFocusEffect, not a plain
  // effect — see the sibling consumer above for why.
  useFocusEffect(
    useCallback(() => {
      const newId = usePendingSelectionStore.getState().consumePending('spell_picker_additional');
      const currentDraft = useCharacterStore.getState().draft;
      if (!newId || !currentDraft?.spellcasting) return;
      const spell = mergeSpellIndex(useHomebrewStore.getState().spells).find(s => s.id === newId);
      if (!spell) return;
      const sc = currentDraft.spellcasting;
      if (spell.level === 0) {
        if (sc.cantrips.includes(newId)) return;
        useCharacterStore.getState().setDraft(grantEntitlement(currentDraft, { kind: 'cantrip_access', key: newId, sourceKind: 'manual' }));
        setAdditionalCantripIds(prev => [...prev, newId]);
      } else {
        if (sc.known.includes(newId)) return;
        useCharacterStore.getState().setDraft(grantEntitlement({ ...currentDraft, spellcasting: { ...sc, prepared: [...sc.prepared, newId] } }, { kind: 'spell_access', key: newId, sourceKind: 'manual' }));
        setAdditionalSpellIds(prev => [...prev, newId]);
      }
    }, [])
  );

  const {
    setBrowseState, savedFilters, search, setSearch, schoolFilter, setSchoolFilter, castFilter, setCastFilter, actionFilter,
    setActionFilter, officialFilter, setOfficialFilter, edition, componentFilter, setComponentFilter, spellSort, setSpellSort, filtersOpen,
    setFiltersOpen, cantripsOpen, setCantripsOpen, spellsOpen, setSpellsOpen,
  } = useSpellFilterState();
  // Off by default — the normal pool is restricted to this class's own spell
  // list. Toggling this widens the pool to every class's spells, for the
  // "pick an extra spell from another class" case (a feat, a homebrew rule,
  // etc.) rather than silently letting every class pick from everything.
  const [otherClasses,   setOtherClasses]   = useState(!!savedFilters.otherClasses);
  // Which spell list this picker draws from — null means the normal official
  // class-tag pool. Only meaningful when this class has at least one homebrew
  // SpellList suggested for it (see the Spell Source filter below).
  const [activeSpellListId, setActiveSpellListId] = useState<string | null>((savedFilters.activeSpellListId as string) ?? null);
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort: spellSort,
      filters: {
        schoolFilter, castFilter, actionFilter, officialFilter, ...edition.toSave,
        componentFilter: Array.from(componentFilter), otherClasses, activeSpellListId,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, spellSort, schoolFilter, castFilter, actionFilter, officialFilter, edition.choice, componentFilter, otherClasses, activeSpellListId]);

  if (!draft) return null;

  const classId       = draft.identity.classId;
  const isSpellcaster = !!draft.spellcasting || spellChoices.length > 0;
  // CREATION-FILTERS-4 (item 8/9): was a manually inline-duplicated
  // official+homebrew merge — replaced with the already-shared
  // mergeSpellIndex() (src/content/contentResolution.ts), the same
  // function the character sheet's AddSpellModal/SpellChoicePicker use,
  // instead of an independently-reimplemented copy of the same logic.
  const allSpells: SpellIndexEntry[] = mergeSpellIndex(homebrewSpells);
  const homebrewSpellIds = new Set(homebrewSpells.map(s => s.id));

  // Filter by class — only show spells tagged for this class, OR, if a homebrew Spell List is
  // active for this picker, exactly that list's spells instead (see content/spellLists.ts).
  // If a spell has no `classes` tag at all (legacy), include it so nothing disappears.
  // The "add extra from another class" toggle bypasses both of those restrictions entirely.
  const classSpellLists = spellListsForClass(spellLists, classId);
  // The class's own chosen default source (an existing Spell List, or another class's list).
  const classSpellSource = useHomebrewStore.getState().getMergedContentDB().classes.find(c => c.id === classId)?.spellListSource;
  const classSourceLabel = spellSourceLabel(classSpellSource, spellLists, useHomebrewStore.getState().getMergedContentDB().classes);
  // A feature can widen the class list for this character (a patron's expanded spells): those join the class's own spells.
  const extraSpellIds = extraClassSpellIds(draft, classId);
  const classSpells = otherClasses
    ? allSpells
    : (() => {
        const own = filterSpellsForClass(allSpells, classId, activeSpellListId, spellLists, classSpellSource);
        if (extraSpellIds.length === 0) return own;
        const have = new Set(own.map(s => s.id));
        return [...own, ...allSpells.filter(s => extraSpellIds.includes(s.id) && !have.has(s.id))];
      })();

  // "+ Add Additional Spell" — writes directly into spellcasting.cantrips/
  // .known (mirroring the pre-existing "externally granted" spell pattern
  // this screen already relies on for domain-granted spells, e.g.
  // alreadyGrantedCantrips/Spells above), WITHOUT going through
  // writeCreationPicks — so it never consumes cantrip/spell-known
  // allowance, prepared count, or any progression-required-selection
  // counter. Next visit correctly treats it as an external grant (excluded
  // from the pickable pool by alreadyGrantedCantrips/Spells).
  function handleAddAdditionalSpell(spellId: string, isCantrip: boolean) {
    if (!draft!.spellcasting) return;
    const sc = draft!.spellcasting;
    if (isCantrip) {
      if (sc.cantrips.includes(spellId)) return;
      setDraft(grantEntitlement(draft!, { kind: 'cantrip_access', key: spellId, sourceKind: 'manual' }));
      setAdditionalCantripIds(prev => [...prev, spellId]);
    } else {
      if (sc.known.includes(spellId)) return;
      setDraft(grantEntitlement({ ...draft!, spellcasting: { ...sc, prepared: [...sc.prepared, spellId] } }, { kind: 'spell_access', key: spellId, sourceKind: 'manual' }));
      setAdditionalSpellIds(prev => [...prev, spellId]);
    }
  }

  function renderAdditionalSpellSection() {
    return <AdditionalSpellSection
      draft={draft}
      setAdditionalFlow={setAdditionalFlow}
      additionalFlow={additionalFlow}
      handleAddAdditionalSpell={handleAddAdditionalSpell}
      insets={insets}
      router={router}
    />;
  }

  function startEditingSpellChoices() {
    let updated = draft!;
    for (const choice of resolvedSpellChoices) {
      updated = revokeEntitlementsFromChoice(updated, choice.id);
      updated = {
        ...updated,
        choices: updated.choices.map(c => c.id === choice.id ? { ...c, resolved: false, selections: [] } : c),
      };
      setSelections(prev => ({ ...prev, [choice.id]: [] }));
    }
    setDraft(updated);
  }

  // ── 1. Non-spellcaster ──────────────────────────────────────────────────────
  if (!isSpellcaster) {
    return (
      <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading}>Spells</Text>
        <Text style={styles.sub}>This class does not use spells.</Text>
      </ScrollView>
      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={styles.nextBtn} onPress={() => {
            setDraft(markVisited(draft));
            router.push('/creation/hub');
          }}>
            <Text style={styles.nextBtnText}>Continue →</Text>
          </Pressable>
        </View>
      </SafeBottomView>
      </>
    );
  }

  // ── 1b. ChoiceDefinition-based choices already resolved (re-entering) ──────
  if (spellChoices.length === 0 && resolvedSpellChoices.length > 0) {
    return (
      <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading}>Spells</Text>
        <Text style={styles.sub}>Spells already chosen:</Text>
        {resolvedSpellChoices.map(choice => (
          <View key={choice.id}>
            {choice.selections.map(selId => {
              const spell = allSpells.find(s => s.id === selId);
              return <Text key={selId} style={styles.ownedSpell}>✓ {spell?.name ?? selId}</Text>;
            })}
          </View>
        ))}
        <Pressable style={styles.changeBtn} onPress={startEditingSpellChoices}>
          <Text style={styles.changeBtnTxt}>✎ Change Spells</Text>
        </Pressable>
        {renderAdditionalSpellSection()}
      </ScrollView>
      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable style={styles.nextBtn} onPress={() => {
            setDraft(markVisited(draft));
            router.push('/creation/hub');
          }}>
            <Text style={styles.nextBtnText}>Continue →</Text>
          </Pressable>
        </View>
      </SafeBottomView>
      </>
    );
  }

  // ── 2. ChoiceDefinition-based selection (if a class defines spell choices) ───
  // Every real spellChoice() in class content uses the 'all' pool sentinel
  // (see src/content/classes/index.ts) — it means "any spell from this
  // class's list", not a literal array, so the pool is built dynamically
  // here exactly like SpellChoicePicker.tsx does for the level-up case
  // (same class/cantrip-vs-leveled filtering). resolveChoice() can't apply
  // these either — it silently skips any choice whose pool isn't a literal
  // array — so confirming uses applySpellChoiceToEntity() instead, same as
  // SpellChoicePicker.
  if (spellChoices.length > 0) {
    return <SpellChoiceFlow
      draft={draft}
      spellChoices={spellChoices}
      classSpells={classSpells}
      selections={selections}
      setSelections={setSelections}
      allSpells={allSpells}
      rules={rules}
      setDraft={setDraft}
      router={router}
      homebrewSpellIds={homebrewSpellIds}
      renderAdditionalSpellSection={renderAdditionalSpellSection}
    />;
  }

  const { targets, spellSortOpts, cantripPool, spellPool, availableComponents, availableSchools } = spellPoolsFor({
    classId, search, schoolFilter, castFilter, actionFilter, officialFilter, homebrewSpellIds, edition, componentFilter, spellSort, draft,
    alreadyGrantedCantrips, additionalCantripIds, alreadyGrantedSpells, additionalSpellIds, classSpells,
  });

  const toggleCantrip = (id: string) => {
    setPickedCantrips(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= targets.cantrips) return prev;
      return [...prev, id];
    });
  };
  const toggleSpell = (id: string) => {
    setPickedSpells(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= targets.spells) return prev;
      return [...prev, id];
    });
  };

  const cantripsDone = pickedCantrips.length === targets.cantrips;
  const spellsDone   = pickedSpells.length === targets.spells;
  const canConfirm   = cantripsDone && spellsDone;

  const handleConfirm = async () => {
    try {
      await spellRepo.ensureLoaded([...pickedCantrips, ...pickedSpells]);
      let updated: Entity = revokeEntitlementsFromChoice(draft, 'creation-spells');
      updated = grantEntitlements(updated, [
        ...pickedCantrips.map(key => ({ kind: 'cantrip_access' as const, key, sourceKind: 'class' as const, sourceId: classId, choiceId: 'creation-spells' })),
        ...pickedSpells.map(key => ({ kind: 'spell_access' as const, key, sourceKind: 'class' as const, sourceId: classId, choiceId: 'creation-spells' })),
      ]);
      if (updated.spellcasting) {
        // Merge back in whatever was already granted before this screen
        // (e.g. domain spells) plus anything added via "+ Add Additional
        // Spell" mid-visit — pickedCantrips/pickedSpells only ever held
        // what's newly chosen here, so overwriting instead of merging would
        // silently drop the rest.

        const finalSpells   = [...new Set([...alreadyGrantedSpells,   ...additionalSpellIds,   ...pickedSpells])];
        updated = {
          ...updated,
          spellcasting: {
            ...updated.spellcasting,

            // Known casters cast straight from `known`; mirror into prepared so the
            // sheet shows them as castable for prepared-style classes too.
            prepared: finalSpells,
          },
        };
      }
      // Persist what THIS screen picked, separate from spellcasting.known/
      // cantrips, so a later revisit can tell it apart from externally-
      // granted spells (domain grants, etc.) again — see readCreationPicks.
      updated = writeCreationPicks(updated, { cantrips: pickedCantrips, spells: pickedSpells });
      updated = markVisited(updated);
      setDraft(updated);
      router.push('/creation/hub');
    } catch (e) {
      console.error('[spells] confirm failed:', e);
      Alert.alert('Couldn\'t confirm spells', e instanceof Error ? e.message : 'Something went wrong loading spell data. Check the console for details.');
    }
  };

  const nothingToPick = targets.cantrips === 0 && targets.spells === 0;

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Spells</Text>

      {nothingToPick ? (
        <Text style={styles.sub}>
          Your spells are prepared from the full class list on the character sheet.
        </Text>
      ) : (
        <>
          <Text style={styles.sub}>Choose your starting cantrips and spells.</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={[styles.search, styles.searchFlex]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search spells…"
              placeholderTextColor={Colors.textDim}
            />
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.filtersToggle, filtersOpen && styles.filtersToggleActive]}
              onPress={() => setFiltersOpen(v => !v)}
            >
              <Text style={[styles.filtersToggleTxt, filtersOpen && styles.filtersToggleTxtActive]}>Filters</Text>
            </Pressable>
            <SortControl options={spellSortOpts} value={spellSort} onChange={setSpellSort} />
          </View>

          <SpellFilterPanel
            filtersOpen={filtersOpen}
            availableSchools={availableSchools}
            schoolFilter={schoolFilter}
            setSchoolFilter={setSchoolFilter}
            castFilter={castFilter}
            setCastFilter={setCastFilter}
            actionFilter={actionFilter}
            setActionFilter={setActionFilter}
            officialFilter={officialFilter}
            setOfficialFilter={setOfficialFilter}
            classSpellLists={classSpellLists}
            classSpellSource={classSpellSource}
            classSourceLabel={classSourceLabel}
            activeSpellListId={activeSpellListId}
            setActiveSpellListId={setActiveSpellListId}
            edition={edition}
            classSpells={classSpells}
            homebrewSpellIds={homebrewSpellIds}
            availableComponents={availableComponents}
            componentFilter={componentFilter}
            setComponentFilter={setComponentFilter}
          />
          <ActiveFilterChips
            chips={[
              ...(schoolFilter ? [{ key: 'school', label: schoolFilter, onClear: () => setSchoolFilter(null) }] : []),
              ...(castFilter !== 'all' ? [{ key: 'cast', label: castFilter === 'ritual' ? 'Ritual' : 'Concentration', onClear: () => setCastFilter('all') }] : []),
              ...(actionFilter ? [{ key: 'action', label: actionFilter, onClear: () => setActionFilter(null) }] : []),
              ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
              ...edition.chips,
              ...Array.from(componentFilter).map(c => ({ key: `comp_${c}`, label: c, onClear: () => setComponentFilter(prev => { const n = new Set(prev); n.delete(c); return n; }) })),
            ]}
            onClearAll={() => { setSchoolFilter(null); setCastFilter('all'); setActionFilter(null); setOfficialFilter('all'); edition.clear(); setComponentFilter(new Set()); }}
          />

          <View style={styles.spellActionRow}>
            <Pressable
              style={styles.createSpellBtn}
              onPress={() => router.push('/homebrew/spell-builder')}
            >
              <Text style={styles.createSpellTxt}>+ Create new homebrew spell</Text>
            </Pressable>
            <Pressable
              style={[styles.createSpellBtn, otherClasses && styles.createSpellBtnActive]}
              onPress={() => setOtherClasses(v => !v)}
            >
              <Text style={[styles.createSpellTxt, otherClasses && styles.createSpellTxtActive]}>
                {otherClasses ? '✓ Showing every class’s spells' : '+ Add extra from another class'}
              </Text>
            </Pressable>
          </View>

          <SpellPickLists
            targets={targets}
            setCantripsOpen={setCantripsOpen}
            cantripsDone={cantripsDone}
            pickedCantrips={pickedCantrips}
            cantripsOpen={cantripsOpen}
            cantripPool={cantripPool}
            homebrewSpellIds={homebrewSpellIds}
            draft={draft}
            toggleCantrip={toggleCantrip}
            setSpellsOpen={setSpellsOpen}
            spellsDone={spellsDone}
            pickedSpells={pickedSpells}
            spellsOpen={spellsOpen}
            spellPool={spellPool}
            toggleSpell={toggleSpell}
          />
        </>
      )}

      {renderAdditionalSpellSection()}
    </ScrollView>
    <SafeBottomView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, !nothingToPick && !canConfirm && styles.nextBtnDisabled]}
          onPress={() => { void handleConfirm(); }}
          disabled={!nothingToPick && !canConfirm}
        >
          <Text style={styles.nextBtnText}>{nothingToPick ? 'Continue →' : 'Confirm Spells →'}</Text>
        </Pressable>
      </View>
    </SafeBottomView>
    </>
  );
}
