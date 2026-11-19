// app/(tabs)/compendium.tsx
// COMPENDIUM-2: the multi-type Compendium rewrite. Was Conditions-only
// (see this file's prior header comment, kept below in spirit) — now
// supports Race/Subrace/Class/Subclass/Background/Feat/Spell/Item/Monster/
// Condition, built entirely on the shared content-query/filter
// infrastructure (contentQuery.ts, SortControl, each type's own *Browse.ts
// module) rather than a second, parallel browsing system. Favorites are
// now generalized across every supported type (src/content/favorites.ts)
// instead of Condition-only, with the old Condition-only favorites
// migrated forward automatically. Search/filters/sort/content-type
// selection persist across navigation via browseStateStore (session-local,
// not app-restart-persisted — matches every other screen this pass).
import { gridKey, gridProps, withGridCell } from '../../src/components/GridCell';
import { useListColumns } from '../../src/platform/layout';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, InteractionManager } from 'react-native';
import { ScrollView, FlatList } from '../../src/components/Lists';
import { Pressable, TextInput } from '../../src/components/AccessibleControls';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { installedRulesReferences } from '../../src/content/rules/rulesReference';
import { useOfficialContentVersion } from '../../src/hooks/useOfficialContentVersion';
import { useBrowseStateStore } from '../../src/store/browseStateStore';
import { loadFavorites, saveFavorites, favoriteKey } from '../../src/content/favorites';
import { Colors } from '../../src/theme';
import { FilterSection, FilterChipRow, ActiveFilterChips, ZeroResultsState } from '../../src/components/FilterChipRow';
import { SortControl } from '../../src/components/SortControl';
import { NonSrdBadge, isNonSrd } from '../../src/components/NonSrdBadge';
import {
  ContentTypeId, CONTENT_TYPE_LABELS, BrowsableEntry, SortOption,
  nameSortOptions, sourceSortOption, contentTypeSortOption
  ,
} from '../../src/content/contentQuery';
import { matchesGame } from '../../src/content/rulesets';
import { isContentExposed } from '../../src/content/contentExposure';
import { GAMES, RULESETS, gameIdForRuleset } from '../../src/content/rulesets';
import { GameId, RulesetId, matchesRuleset } from '../../src/engine/types';
import {
  flattenSubraces, attachParentClassNames,


  summaryLine, entryDetail, entrySourceLabel, CONTENT_TYPE_VISUALS, SubraceWithParent, SubclassEntryWithParent,
} from '../../src/content/compendiumBrowse';
import { raceSortOptions } from '../../src/content/races/raceBrowse';
import { subraceSortOptions } from '../../src/content/races/subraceBrowse';
import { classSortOptions } from '../../src/content/classes/classBrowse';
import { subclassSortOptions } from '../../src/content/subclasses/subclassBrowse';
import { backgroundSortOptions } from '../../src/content/backgrounds/backgroundBrowse';
import { featSortOptions } from '../../src/content/feats/featBrowse';
import { CompendiumSpellDetail } from '../../src/components/compendium/CompendiumSpellDetail';
import { CompendiumItemDetail } from '../../src/components/compendium/CompendiumItemDetail';
import { EditionBadge } from '../../src/components/EditionBadge';
import { spellSortOptions } from '../../src/content/spells/spellBrowse';
import { itemSortOptions } from '../../src/content/items/itemBrowse';
import { monsterSortOptions } from '../../src/content/monsters/monsterBrowse';
import { conditionSortOptions } from '../../src/content/conditions/conditionBrowse';
import {
  officialContentDB, officialSpellIndex, officialItemIndex, officialMonsterTemplates, officialSubclassEntries,
} from '../../src/content/officialCatalog';
import { makeEmptyEntity } from '../../src/engine/defaults';
import { useCompendiumModeStore } from '../../src/store/compendiumModeStore';
import { CompendiumMode, parseCompendiumMode } from '../../src/content/compendiumModes';
import { CompendiumModeSwitch } from '../../src/components/compendium/CompendiumModeSwitch';
import { HomebrewLibraryView } from '../../src/components/compendium/HomebrewLibraryView';
import { InstalledPackagesView } from '../../src/components/compendium/InstalledPackagesView';
import { RecordIcon, RecordDetailPicture } from '../../src/components/RecordPicture';
import { styles } from '../../src/components/compendium/official/compendiumStyles';
import { SCREEN_KEY, EMPTY_CONTENT_DB, EMPTY_FEATS, EMPTY_RESULTS, notHomebrew, CONTENT_EXPOSURE, CONTENT_TYPE_ORDER } from '../../src/components/compendium/official/compendiumModel';
import { useCompendiumFilterState } from '../../src/components/compendium/official/useCompendiumFilterState';
import { useFilteredEntries } from '../../src/components/compendium/official/useFilteredEntries';
import { useAvailableFilterValues } from '../../src/components/compendium/official/useAvailableFilterValues';
import { RaceFilters } from '../../src/components/compendium/official/RaceFilters';
import { ClassFilters } from '../../src/components/compendium/official/ClassFilters';
import { BackgroundFeatFilters } from '../../src/components/compendium/official/BackgroundFeatFilters';
import { SpellFilters } from '../../src/components/compendium/official/SpellFilters';
import { ItemFilters } from '../../src/components/compendium/official/ItemFilters';
import { MonsterFilters } from '../../src/components/compendium/official/MonsterFilters';

/** Official mode: the ordinary Compendium browser (search/filters/sort/favorites/detail, SRD exposure). Unchanged apart from the screen title/switch moving into CompendiumScreen below. */
function OfficialCompendiumView() {
  const columns = useListColumns(470, 32, 3);

  // ── Restore browse state (search/filters/sort/content type) — session-
  // local, survives navigating away (e.g. into a detail expand or a
  // homebrew builder) and back, since this reads a plain Zustand store, not
  // component state. Lazy initializers so the restore runs exactly once,
  // before the first render, not as a post-mount effect (which would flash
  // the default state first).
  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);

  const [contentType, setContentType] = useState<ContentTypeId | 'all'>((saved.contentType as ContentTypeId | 'all') ?? 'all');
  const [search, setSearch] = useState(saved.search ?? '');
  const [sort, setSort] = useState(saved.sort ?? 'name_asc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // PERF-COMPENDIUM-1 (item 1): the shell (header/search box/type chips/
  // Filters toggle) must be interactive on the very FIRST paint, before the
  // full content merge + filter + sort pass (the actually expensive part —
  // full spell/item/monster indices, 10 content types' worth of filtering)
  // ever runs. `contentReady` starts false so that first render commits
  // with the shell fully built and an empty/loading result list; the
  // effect below flips it on the very next tick (after the browser has
  // already painted the shell), which is what actually lets a user tap
  // into the search box or Filters toggle immediately instead of waiting
  // for one big synchronous first render to finish.
  const [contentReady, setContentReady] = useState(false);
  // Re-audit item 20: re-measured on the current build rather than
  // assuming the existing contentReady staging (above) had already closed
  // this — it hadn't fully. A bare `useEffect` still fires within the same
  // JS-thread turn React uses to finish mounting/registering touch
  // responders, so the ~10-content-type merge+filter+sort pass it
  // triggers (heaviest in the default "All Content" view, where every
  // category's skip flag is false — see the `single`/`skipX` values below)
  // could still run before the shell was genuinely touch-ready.
  // InteractionManager.runAfterInteractions is RN's own idiom for "wait
  // until touch/animation handling has actually settled" — a real fix for
  // time-to-interactive specifically, not a speculative cache.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setContentReady(true));
    return () => task.cancel();
  }, []);

  const {
    favoritesOnly, setFavoritesOnly, favorites, setFavorites, gameFilter, setGameFilter, rulesetFilter, setRulesetFilter, raceSize,
    setRaceSize, raceDarkvision, setRaceDarkvision, raceMovement, setRaceMovement, raceHasSubracesOnly, setRaceHasSubracesOnly,
    subraceParent, setSubraceParent, subraceTraits, setSubraceTraits, classCaster, setClassCaster, classHitDie, setClassHitDie, classSave,
    setClassSave, classArmor, setClassArmor, classWeapon, setClassWeapon, subclassParent, setSubclassParent, subclassAdds, setSubclassAdds,
    backgroundSkill, setBackgroundSkill, backgroundTool, setBackgroundTool, featPrereqType, setFeatPrereqType, featGrants, setFeatGrants,
    spellSchool, setSpellSchool, spellCast, setSpellCast, spellAction, setSpellAction, spellComponents, setSpellComponents, itemCat,
    setItemCat, itemMagical, setItemMagical, itemWeaponClass, setItemWeaponClass, itemWeaponRange, setItemWeaponRange, itemArmorWeightF,
    setItemArmorWeightF, itemRarity, setItemRarity, monsterType, setMonsterType, monsterSize, setMonsterSize, monsterAlignment,
    setMonsterAlignment, monsterCrMin, setMonsterCrMin, monsterCrMax, setMonsterCrMax, monsterMovement, setMonsterMovement,
    monsterResistance, setMonsterResistance, monsterImmunity, setMonsterImmunity, monsterCondImmunity, setMonsterCondImmunity,
    monsterLanguage, setMonsterLanguage, monsterLegendary, setMonsterLegendary, monsterLair, setMonsterLair, monsterDarkvision,
    setMonsterDarkvision, monsterSpellcaster, setMonsterSpellcaster,
  } = useCompendiumFilterState({
    saved,
  });

  // Favorites: loaded once on mount (async, SQLite-backed — no-op on web,
  // same limitation as every other SQLite-backed feature in this app).
  useEffect(() => {
    loadFavorites().then(setFavorites).catch(e => console.error('[compendium] loading favorites failed:', e));
  }, [setFavorites]);
  const toggleFavorite = useCallback((type: ContentTypeId, id: string) => {
    setFavorites(prev => {
      const key = favoriteKey(type, id);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveFavorites(next).catch(e => console.error('[compendium] saving favorites failed:', e));
      return next;
    });
  }, [setFavorites]);

  // Persist browse state whenever it changes — one write covers search,
  // sort, content type, and every filter (bundled into one object so a
  // single effect suffices instead of one per field).
  useEffect(() => {
    setBrowseState(SCREEN_KEY, {
      search, sort, contentType,
      filters: {
        gameFilter, rulesetFilter,
        raceSize, raceDarkvision, raceMovement: Array.from(raceMovement), raceHasSubracesOnly,
        subraceParent, subraceTraits: Array.from(subraceTraits),
        classCaster, classHitDie, classSave: Array.from(classSave), classArmor: Array.from(classArmor), classWeapon: Array.from(classWeapon),
        subclassParent, subclassAdds: Array.from(subclassAdds),
        backgroundSkill: Array.from(backgroundSkill), backgroundTool: Array.from(backgroundTool),
        featPrereqType, featGrants: Array.from(featGrants),
        spellSchool, spellCast, spellAction, spellComponents: Array.from(spellComponents),
        itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeight: itemArmorWeightF, itemRarity: Array.from(itemRarity),
        monsterType, monsterSize, monsterAlignment, monsterCrMin, monsterCrMax,
        monsterMovement: Array.from(monsterMovement), monsterResistance: Array.from(monsterResistance),
        monsterImmunity: Array.from(monsterImmunity), monsterCondImmunity: Array.from(monsterCondImmunity),
        monsterLanguage: Array.from(monsterLanguage), monsterLegendary, monsterLair, monsterDarkvision, monsterSpellcaster,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search, sort, contentType, gameFilter, rulesetFilter,
    raceSize, raceDarkvision, raceMovement, raceHasSubracesOnly, subraceParent, subraceTraits,
    classCaster, classHitDie, classSave, classArmor, classWeapon, subclassParent, subclassAdds,
    backgroundSkill, backgroundTool, featPrereqType, featGrants,
    spellSchool, spellCast, spellAction, spellComponents,
    itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeightF, itemRarity,
    monsterType, monsterSize, monsterAlignment, monsterCrMin, monsterCrMax,
    monsterMovement, monsterResistance, monsterImmunity, monsterCondImmunity, monsterLanguage,
    monsterLegendary, monsterLair, monsterDarkvision, monsterSpellcaster,
  ]);

  // ── Data sources — same paths every other screen already uses ──
  // PERF-COMPENDIUM-1: every one of these is the actually-expensive part
  // (full content merge, full spell/item/monster index build) — gated
  // behind `contentReady` so NONE of it runs during the first synchronous
  // render that paints the shell. Falls back to cheap, stable-reference
  // empty containers until the post-paint effect flips `contentReady`.
  const activeRuleset = rulesetFilter ?? undefined;
  // Official mode reads ONLY official content (see src/content/officialCatalog.ts):
  // nothing here depends on the homebrew store.
  const contentDB = useMemo(
    () => contentReady ? officialContentDB(activeRuleset) : EMPTY_CONTENT_DB,
    [contentReady, activeRuleset],
  );
  const races = contentDB.races;
  const classes = contentDB.classes;
  const backgrounds = contentDB.backgrounds;
  const feats = contentDB.feats ?? EMPTY_FEATS;
  const conditions = contentDB.conditions;
  const subraces: SubraceWithParent[] = useMemo(() => contentReady ? flattenSubraces(races) : EMPTY_RESULTS, [contentReady, races]);
  const subclassEntries: SubclassEntryWithParent[] = useMemo(() => {
    if (!contentReady) return EMPTY_RESULTS;
    return attachParentClassNames(officialSubclassEntries(classes), classes);
  }, [contentReady, classes]);
  const spellIndex = useMemo(() => contentReady ? officialSpellIndex(activeRuleset) : EMPTY_RESULTS, [contentReady, activeRuleset]);
  const itemIndex = useMemo(() => contentReady ? officialItemIndex(activeRuleset) : EMPTY_RESULTS, [contentReady, activeRuleset]);
  const monsterTemplates = useMemo(() => contentReady ? officialMonsterTemplates(activeRuleset) : EMPTY_RESULTS, [contentReady, activeRuleset]);

  const scratchEntity = useMemo(() => makeEmptyEntity('compendium'), []);

  // Available Game/Ruleset options — REAL, present-only, derived from
  // whatever's actually tagged across every content type right now, never
  // a hardcoded D&D-only list (GAME-AGNOSTIC-1).
  const availableRulesetIds = useMemo(() => {
    const set = new Set<RulesetId>();
    for (const arr of [races, classes, backgrounds, feats, conditions] as { rulesetId?: RulesetId }[][]) {
      for (const c of arr) if (c.rulesetId) set.add(c.rulesetId);
    }
    for (const s of spellIndex) if (s.rulesetId) set.add(s.rulesetId);
    for (const i of itemIndex) if (i.rulesetId) set.add(i.rulesetId);
    for (const m of monsterTemplates) if (m.rulesetId) set.add(m.rulesetId);
    for (const e of subclassEntries) if (e.progression.rulesetId) set.add(e.progression.rulesetId);
    return Array.from(set);
  }, [races, classes, backgrounds, feats, conditions, spellIndex, itemIndex, monsterTemplates, subclassEntries]);
  const availableGameIds = useMemo(() => Array.from(new Set(availableRulesetIds.map(gameIdForRuleset).filter((g): g is GameId => !!g))), [availableRulesetIds]);
  const availableGames = availableGameIds.map(id => ({ id, label: Object.values(GAMES).find(g => g.id === id)?.name ?? id }));
  const availableRulesets = availableRulesetIds
    .filter(r => !gameFilter || gameIdForRuleset(r) === gameFilter)
    .map(id => ({ id, label: RULESETS[id]?.name ?? id }));

  // ── Per-type sourceLabel-capable sort options (Official mode: nothing here is homebrew) ──
  const raceSorts = raceSortOptions(notHomebrew);
  const subraceSorts = subraceSortOptions(notHomebrew);
  const classSorts = classSortOptions(notHomebrew);
  const subclassSorts = subclassSortOptions(notHomebrew);
  const backgroundSorts = backgroundSortOptions(notHomebrew);
  const featSorts = featSortOptions(scratchEntity, notHomebrew);
  const spellSorts = spellSortOptions(notHomebrew);
  const itemSorts = itemSortOptions(notHomebrew);
  const monsterSorts = monsterSortOptions(notHomebrew);
  const conditionSorts = conditionSortOptions(notHomebrew);
  const mixedSorts: SortOption<BrowsableEntry>[] = [
    ...nameSortOptions<BrowsableEntry>(),
    contentTypeSortOption<BrowsableEntry>(),
    sourceSortOption<BrowsableEntry>(entrySourceLabel),
  ];

  // ── Global predicate (Game/Ruleset/Official-Homebrew) — same for every
  // type, applied before any type-specific filter. ──
  const matchesGlobal = useCallback((rulesetId: RulesetId | undefined, isHomebrew: boolean, srd: boolean | undefined, type: ContentTypeId): boolean => {
    if (!isContentExposed({ isHomebrew, srd, type }, CONTENT_EXPOSURE)) return false;
    if (!matchesGame(rulesetId, gameFilter ?? undefined)) return false;
    if (!matchesRuleset(rulesetId, rulesetFilter ?? undefined)) return false;
    return true;
  }, [gameFilter, rulesetFilter]);
  const matchesFav = useCallback((type: ContentTypeId, id: string): boolean => {
    return !favoritesOnly || favorites.has(favoriteKey(type, id));
  }, [favoritesOnly, favorites]);

  const { single, results } = useFilteredEntries({
    search, contentType, contentReady, races, matchesGlobal, matchesFav, raceSize, raceDarkvision, raceMovement, raceHasSubracesOnly,
    raceSorts, sort, subraces, subraceParent, subraceTraits, subraceSorts, classes, classCaster, classHitDie, classSave, classArmor,
    classWeapon, classSorts, subclassEntries, subclassParent, subclassAdds, subclassSorts, backgrounds, backgroundSkill, backgroundTool,
    backgroundSorts, feats, featPrereqType, featGrants, featSorts, spellIndex, spellSchool, spellCast, spellAction, spellComponents,
    spellSorts, itemIndex, itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeightF, itemRarity, itemSorts,
    monsterTemplates, monsterCrMin, monsterCrMax, monsterType, monsterSize, monsterAlignment, monsterLegendary, monsterLair,
    monsterDarkvision, monsterSpellcaster, monsterMovement, monsterResistance, monsterImmunity, monsterCondImmunity, monsterLanguage,
    monsterSorts, conditions, conditionSorts, mixedSorts,
  });

  // SortControl only ever reads `.id`/`.label` off these (the actual
  // per-type compare logic already ran above, inside each `filtered*`
  // useMemo) — cast through unknown since the branches are genuinely
  // heterogeneous SortOption<T> types with no shared T.
  const activeSortOptions = (contentType === 'all' ? mixedSorts
    : contentType === 'race' ? raceSorts
    : contentType === 'subrace' ? subraceSorts
    : contentType === 'class' ? classSorts
    : contentType === 'subclass' ? subclassSorts
    : contentType === 'background' ? backgroundSorts
    : contentType === 'feat' ? featSorts
    : contentType === 'spell' ? spellSorts
    : contentType === 'item' ? itemSorts
    : contentType === 'monster' ? monsterSorts
    : conditionSorts) as unknown as SortOption<unknown>[];

  // Reset to that type's default sort id when switching content type, so a
  // stale sort id from a different type's option list never silently no-ops.
  function changeContentType(next: ContentTypeId | 'all') {
    setContentType(next);
    setSort('name_asc');
    setExpandedId(null);
  }

  const {
    availableItemRarities, availableSpellSchools, availableSpellComponents, availableBgSkills, availableBgTools, availableClassHitDice,
    availableClassSaves, availableClassArmor, availableClassWeapon, availableRaceSizes, availableRaceMovement, availableMonsterTypes,
    availableMonsterSizes, availableMonsterAlignments, availableMonsterResistances, availableMonsterImmunities,
    availableMonsterCondImmunities, availableMonsterLanguages,
  } = useAvailableFilterValues({
    single, contentType, itemIndex, spellIndex, backgrounds, classes, races, monsterTemplates,
  });

  const globalFilterChips = [
    ...(gameFilter ? [{ key: 'game', label: Object.values(GAMES).find(g => g.id === gameFilter)?.name ?? gameFilter, onClear: () => { setGameFilter(null); setRulesetFilter(null); } }] : []),
    ...(rulesetFilter ? [{ key: 'ruleset', label: RULESETS[rulesetFilter]?.name ?? rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
  ];
  function clearAllFilters() {
    setGameFilter(null); setRulesetFilter(null);
    setRaceSize(null); setRaceDarkvision(false); setRaceMovement(new Set()); setRaceHasSubracesOnly(false);
    setSubraceParent(null); setSubraceTraits(new Set());
    setClassCaster(null); setClassHitDie(null); setClassSave(new Set()); setClassArmor(new Set()); setClassWeapon(new Set());
    setSubclassParent(null); setSubclassAdds(new Set());
    setBackgroundSkill(new Set()); setBackgroundTool(new Set());
    setFeatPrereqType(null); setFeatGrants(new Set());
    setSpellSchool(null); setSpellCast('all'); setSpellAction(null); setSpellComponents(new Set());
    setItemCat(null); setItemMagical('all'); setItemWeaponClass(null); setItemWeaponRange(null); setItemArmorWeightF(null); setItemRarity(new Set());
    setMonsterType(null); setMonsterSize(null); setMonsterAlignment(null); setMonsterCrMin(''); setMonsterCrMax('');
    setMonsterMovement(new Set()); setMonsterResistance(new Set()); setMonsterImmunity(new Set()); setMonsterCondImmunity(new Set());
    setMonsterLanguage(new Set()); setMonsterLegendary(false); setMonsterLair(false); setMonsterDarkvision(false); setMonsterSpellcaster(false);
  }

  // SCROLL-HEADER-1: see the creation-flow browse screens' identical
  // comment — heading/search/type-chips/filters used to sit in a plain View
  // above the results FlatList, pinned in place while only the results
  // scrolled beneath. Moved into ListHeaderComponent so the whole header —
  // including an open Filters panel, which can be tall — scrolls away with
  // the results instead of permanently eating screen space.
  const listHeader = (
    <>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{contentType === 'all' ? 'All Content' : CONTENT_TYPE_LABELS[contentType]}</Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <TextInput
            testID="compendium-search"
            accessibilityLabel="Compendium search"
            style={[styles.searchInput, styles.searchInputFlex]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search everything…"
            placeholderTextColor={Colors.textDim}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} contentContainerStyle={styles.typeRowContent}>
          <Pressable style={[styles.typeChip, contentType === 'all' && styles.typeChipActive]} onPress={() => changeContentType('all')}>
            <Text style={[styles.typeChipTxt, contentType === 'all' && styles.typeChipTxtActive]}>All</Text>
          </Pressable>
          {CONTENT_TYPE_ORDER.map(t => (
            <Pressable key={t} style={[styles.typeChip, contentType === t && styles.typeChipActive]} onPress={() => changeContentType(t)}>
              <Text style={[styles.typeChipTxt, contentType === t && styles.typeChipTxtActive]}>{CONTENT_TYPE_LABELS[t]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* PERF-SORT-1 (item 3): Filters + Sort share one row, pinned to
            opposite ends — the same layout ItemPickerModal.tsx already
            established, now applied consistently everywhere a browse
            screen has both controls, instead of Sort floating alone on its
            own left-aligned line. */}
        <View style={styles.controlsRow}>
          <Pressable testID="compendium-filters" accessibilityLabel="Compendium filters" style={[styles.favToggle, filtersOpen && styles.favToggleActive]} onPress={() => setFiltersOpen(v => !v)}>
            <Text style={[styles.favToggleTxt, filtersOpen && styles.favToggleTxtActive]}>Filters</Text>
          </Pressable>
          <SortControl options={activeSortOptions} value={sort} onChange={setSort} />
        </View>

        <Pressable style={[styles.favToggle, favoritesOnly && styles.favToggleActive]} onPress={() => setFavoritesOnly(v => !v)}>
          <Text style={[styles.favToggleTxt, favoritesOnly && styles.favToggleTxtActive]}>
            {favoritesOnly ? '⭐ Favorites only' : '☆ Favorites only'}
          </Text>
        </Pressable>

        {filtersOpen && (
          <View style={styles.filterPanel}>
            {availableGames.length > 1 && (
              <FilterSection label="Game">
                <FilterChipRow options={availableGames} value={gameFilter} onChange={v => { setGameFilter(v); setRulesetFilter(null); }} />
              </FilterSection>
            )}
            {availableRulesets.length > 1 && (
              <FilterSection label="Ruleset / Version">
                <FilterChipRow options={availableRulesets} value={rulesetFilter} onChange={setRulesetFilter} scrollable />
              </FilterSection>
            )}
            {contentType === 'all' && availableGames.length <= 1 && availableRulesets.length <= 1 && (
              <Text style={styles.filterHint}>Choose a content type above to see its filters.</Text>
            )}

            <RaceFilters
              contentType={contentType}
              availableRaceSizes={availableRaceSizes}
              raceSize={raceSize}
              setRaceSize={setRaceSize}
              availableRaceMovement={availableRaceMovement}
              raceMovement={raceMovement}
              setRaceMovement={setRaceMovement}
              raceHasSubracesOnly={raceHasSubracesOnly}
              setRaceHasSubracesOnly={setRaceHasSubracesOnly}
              raceDarkvision={raceDarkvision}
              setRaceDarkvision={setRaceDarkvision}
              races={races}
              subraceParent={subraceParent}
              setSubraceParent={setSubraceParent}
              subraceTraits={subraceTraits}
              setSubraceTraits={setSubraceTraits}
            />

            <ClassFilters
              contentType={contentType}
              classCaster={classCaster}
              setClassCaster={setClassCaster}
              availableClassHitDice={availableClassHitDice}
              classHitDie={classHitDie}
              setClassHitDie={setClassHitDie}
              availableClassSaves={availableClassSaves}
              classSave={classSave}
              setClassSave={setClassSave}
              availableClassArmor={availableClassArmor}
              classArmor={classArmor}
              setClassArmor={setClassArmor}
              availableClassWeapon={availableClassWeapon}
              classWeapon={classWeapon}
              setClassWeapon={setClassWeapon}
              classes={classes}
              subclassParent={subclassParent}
              setSubclassParent={setSubclassParent}
              subclassAdds={subclassAdds}
              setSubclassAdds={setSubclassAdds}
            />

            <BackgroundFeatFilters
              contentType={contentType}
              availableBgSkills={availableBgSkills}
              backgroundSkill={backgroundSkill}
              setBackgroundSkill={setBackgroundSkill}
              availableBgTools={availableBgTools}
              backgroundTool={backgroundTool}
              setBackgroundTool={setBackgroundTool}
              featPrereqType={featPrereqType}
              setFeatPrereqType={setFeatPrereqType}
              featGrants={featGrants}
              setFeatGrants={setFeatGrants}
            />

            <SpellFilters
              contentType={contentType}
              availableSpellSchools={availableSpellSchools}
              spellSchool={spellSchool}
              setSpellSchool={setSpellSchool}
              spellCast={spellCast}
              setSpellCast={setSpellCast}
              spellAction={spellAction}
              setSpellAction={setSpellAction}
              availableSpellComponents={availableSpellComponents}
              spellComponents={spellComponents}
              setSpellComponents={setSpellComponents}
            />

            <ItemFilters
              contentType={contentType}
              itemCat={itemCat}
              setItemCat={setItemCat}
              itemMagical={itemMagical}
              setItemMagical={setItemMagical}
              itemWeaponClass={itemWeaponClass}
              setItemWeaponClass={setItemWeaponClass}
              itemWeaponRange={itemWeaponRange}
              setItemWeaponRange={setItemWeaponRange}
              itemArmorWeightF={itemArmorWeightF}
              setItemArmorWeightF={setItemArmorWeightF}
              availableItemRarities={availableItemRarities}
              itemRarity={itemRarity}
              setItemRarity={setItemRarity}
            />

            <MonsterFilters
              contentType={contentType}
              monsterCrMin={monsterCrMin}
              setMonsterCrMin={setMonsterCrMin}
              monsterCrMax={monsterCrMax}
              setMonsterCrMax={setMonsterCrMax}
              availableMonsterTypes={availableMonsterTypes}
              monsterType={monsterType}
              setMonsterType={setMonsterType}
              availableMonsterSizes={availableMonsterSizes}
              monsterSize={monsterSize}
              setMonsterSize={setMonsterSize}
              availableMonsterAlignments={availableMonsterAlignments}
              monsterAlignment={monsterAlignment}
              setMonsterAlignment={setMonsterAlignment}
              monsterMovement={monsterMovement}
              setMonsterMovement={setMonsterMovement}
              availableMonsterResistances={availableMonsterResistances}
              monsterResistance={monsterResistance}
              setMonsterResistance={setMonsterResistance}
              availableMonsterImmunities={availableMonsterImmunities}
              monsterImmunity={monsterImmunity}
              setMonsterImmunity={setMonsterImmunity}
              availableMonsterCondImmunities={availableMonsterCondImmunities}
              monsterCondImmunity={monsterCondImmunity}
              setMonsterCondImmunity={setMonsterCondImmunity}
              availableMonsterLanguages={availableMonsterLanguages}
              monsterLanguage={monsterLanguage}
              setMonsterLanguage={setMonsterLanguage}
              monsterLegendary={monsterLegendary}
              setMonsterLegendary={setMonsterLegendary}
              monsterLair={monsterLair}
              setMonsterLair={setMonsterLair}
              monsterDarkvision={monsterDarkvision}
              setMonsterDarkvision={setMonsterDarkvision}
              monsterSpellcaster={monsterSpellcaster}
              setMonsterSpellcaster={setMonsterSpellcaster}
            />
          </View>
        )}
        <ActiveFilterChips chips={globalFilterChips} onClearAll={clearAllFilters} />
      </View>
    </>
  );

  return (
    <View style={styles.screen} testID="compendium-screen">
      {results.length === 0 ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {listHeader}
          <ZeroResultsState
            hasActiveFilters={globalFilterChips.length > 0 || filtersOpen}
            emptyMessage={favoritesOnly ? 'No favorites yet — tap ☆ on a result to add one.' : 'No results match your search.'}
            onClearFilters={clearAllFilters}
          />
        </ScrollView>
      ) : (
        // PERF-COMPENDIUM-1 (item 1, 17): virtualized — a plain `.map()`
        // inside a ScrollView used to mount every row (all of "All Content"
        // concatenated, in the worst case) as a real native view immediately.
        // FlatList only renders what's near the viewport.
        <FlatList
          key={gridKey(columns)}
          {...gridProps(columns)}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          data={results}
          keyExtractor={entry => `${entry.type}:${entry.id}:${entry.rulesetId ?? ""}`}
          ListHeaderComponent={listHeader}
          initialNumToRender={20}
          windowSize={7}
          maxToRenderPerBatch={20}
          removeClippedSubviews
          renderItem={withGridCell<(typeof results)[number]>(columns, ({ item: entry }) => {
            const isFavorite = favorites.has(favoriteKey(entry.type, entry.id));
            const expanded = expandedId === `${entry.type}:${entry.id}`;
            const visual = CONTENT_TYPE_VISUALS[entry.type];
            return (
              <Pressable
                style={[styles.row, { borderLeftColor: visual.accent }]}
                onPress={() => setExpandedId(expanded ? null : `${entry.type}:${entry.id}`)}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.rowNameLine}>
                    <View style={[styles.typeBadge, { borderColor: visual.accent + '88', backgroundColor: visual.accent + '22' }]}>
                      <Text style={[styles.typeBadgeTxt, { color: visual.accent }]}>{visual.icon} {CONTENT_TYPE_LABELS[entry.type]}</Text>
                    </View>
                    <RecordIcon record={entry.raw} size={22} />
                    <Text style={styles.rowName}>{entry.name}</Text>
                    <EditionBadge item={entry} official={!entry.isHomebrew} />
                    {!entry.isHomebrew && isNonSrd(entry.srd, entry.rulesetId) && <NonSrdBadge />}
                  </View>
                  <View style={styles.rowBadges}>
                    <View style={[styles.provBadge, entry.isHomebrew ? styles.provBadgeHomebrew : styles.provBadgeOfficial]}>
                      <Text style={styles.provBadgeTxt}>{entry.isHomebrew ? 'Homebrew' : 'Official'}</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={e => { e.stopPropagation(); toggleFavorite(entry.type, entry.id); }}>
                      <Text style={styles.starTxt}>{isFavorite ? '⭐' : '☆'}</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.rowSummary}>{summaryLine(entry)}</Text>
                {expanded && (() => {
                  const detail = entryDetail(entry);
                  return (
                  <View style={styles.rowDetail}>
                    <RecordDetailPicture record={entry.raw} />
                    {entry.type === 'feat' && (entry.raw as { prerequisite: string | null }).prerequisite && (
                      <Text style={styles.rowDesc}>Prerequisite: {(entry.raw as { prerequisite: string }).prerequisite}</Text>
                    )}
                    {entry.type === 'spell' && <CompendiumSpellDetail spellId={entry.id} rulesetId={rulesetFilter} />}
                    {entry.type === 'item' && <CompendiumItemDetail itemId={entry.id} />}
                    {detail.description && <Text style={styles.rowDesc}>{detail.description}</Text>}
                    {detail.features.length > 0 && (
                      <View style={styles.featureList}>
                        {detail.features.map((n, i) => <Text key={i} style={styles.featureTxt}>• {n}</Text>)}
                      </View>
                    )}
                    {entry.type !== 'spell' && entry.type !== 'item' && !detail.description && detail.features.length === 0 && (
                      <Text style={styles.rowDesc}>Nothing more is recorded for this entry.</Text>
                    )}
                  </View>
                  );
                })()}
              </Pressable>
            );
          })}
        />
      )}
    </View>
  );
}

// ── Compendium shell ─────────────────────────────────────────────────────────
// Official / Homebrew / Packages, switched in place (no navigation). Only the
// active mode is mounted, so the other two never load their data. Per-mode
// search/filter/sort state lives in browseStateStore (Official: 'compendium';
// Homebrew/Packages: their own keys) and the selected mode in
// compendiumModeStore, so both survive leaving and returning to this tab.
// `?mode=` deep links (e.g. the old Homebrew-tab library/packages links,
// redirected from app/(tabs)/homebrew.tsx) select a mode on arrival.
export default function CompendiumScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = useCompendiumModeStore(s => s.mode);
  const setMode = useCompendiumModeStore(s => s.setMode);
  const closePack = useCompendiumModeStore(s => s.closePack);
  const router = useRouter();
  useOfficialContentVersion();   // the Rules button appears when a pack with a rules reference is installed
  const hasRulesReference = installedRulesReferences().length > 0;

  const paramMode = parseCompendiumMode(params.mode);
  useEffect(() => {
    if (paramMode) setMode(paramMode);
  }, [paramMode, setMode]);

  const changeMode = useCallback((m: CompendiumMode) => {
    if (m !== 'packages') closePack();
    setMode(m);
  }, [setMode, closePack]);

  return (
    <View style={styles.screen}>
      <View style={styles.shellHeader}>
        <Text style={styles.shellTitle}>Compendium</Text>
        {hasRulesReference && (
          <Pressable style={styles.rulesBtn} onPress={() => router.push('/rules-reference')} accessibilityLabel="Open the Rules Reference" testID="open-rules-reference">
            <Text style={styles.rulesBtnTxt}>Rules</Text>
          </Pressable>
        )}
      </View>
      <CompendiumModeSwitch mode={mode} onChange={changeMode} />
      {mode === 'official' && <OfficialCompendiumView />}
      {mode === 'homebrew' && <HomebrewLibraryView />}
      {mode === 'packages' && <InstalledPackagesView />}
    </View>
  );
}
