import { useMemo } from 'react';
import { backgroundSkillGrants } from '../../../content/backgrounds/backgroundBrowse';
import { CASTER_TYPE } from '../../../content/classes/classBrowse';
import { SubraceWithParent, SubclassEntryWithParent, raceToBrowsable, subraceToBrowsable, classToBrowsable, subclassToBrowsable, backgroundToBrowsable, featToBrowsable, spellToBrowsable, itemToBrowsable, monsterToBrowsable, conditionToBrowsable } from '../../../content/compendiumBrowse';
import { ContentTypeId, SortOption, BrowsableEntry, sortByOption, matchesSearchText } from '../../../content/contentQuery';
import { primaryPrereqCategory, featGrantsAsi, featGrantsProficiency, featGrantsActivation } from '../../../content/feats/featBrowse';
import { ItemIndexEntry } from '../../../content/itemRepo.types';
import { ItemCategoryId, itemCategory, isMagic, isMartialWeapon, isRangedWeapon, armorWeight, rarityOf } from '../../../content/items/itemBrowse';
import { monsterHasDarkvision, monsterIsSpellcaster, monsterMovementTypes, monsterResistances, monsterImmunities, monsterConditionImmunities } from '../../../content/monsters/monsterBrowse';
import { MonsterTemplate } from '../../../content/monsters/types';
import { hasDarkvision, raceMovementTypes, hasSubraces } from '../../../content/races/raceBrowse';
import { SubraceOwnTrait, subraceOwnTraits } from '../../../content/races/subraceBrowse';
import { actionType } from '../../../content/spellFilterUtils';
import { SpellIndexEntry } from '../../../content/spellRepo.types';
import { SubclassAddition, SubclassEntry, subclassAdditions } from '../../../content/subclasses/subclassBrowse';
import { Race, RulesetId, Subrace, CharClass, Ability, Background, SkillName, Feat, Condition } from '../../../engine/types';
import { EMPTY_RESULTS, CONTENT_TYPE_ORDER } from './compendiumModel';

export function useFilteredEntries({
  search, contentType, contentReady, races, matchesGlobal, matchesFav, raceSize, raceDarkvision, raceMovement, raceHasSubracesOnly,
  raceSorts, sort, subraces, subraceParent, subraceTraits, subraceSorts, classes, classCaster, classHitDie, classSave, classArmor,
  classWeapon, classSorts, subclassEntries, subclassParent, subclassAdds, subclassSorts, backgrounds, backgroundSkill, backgroundTool,
  backgroundSorts, feats, featPrereqType, featGrants, featSorts, spellIndex, spellSchool, spellCast, spellAction, spellComponents,
  spellSorts, itemIndex, itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeightF, itemRarity, itemSorts, monsterTemplates,
  monsterCrMin, monsterCrMax, monsterType, monsterSize, monsterAlignment, monsterLegendary, monsterLair, monsterDarkvision,
  monsterSpellcaster, monsterMovement, monsterResistance, monsterImmunity, monsterCondImmunity, monsterLanguage, monsterSorts, conditions,
  conditionSorts, mixedSorts,
}: {
  search: string;
  contentType: ContentTypeId | "all";
  contentReady: boolean;
  races: Race[];
  matchesGlobal: (rulesetId: RulesetId | undefined, isHomebrew: boolean, srd: boolean | undefined, type: ContentTypeId) => boolean;
  matchesFav: (type: ContentTypeId, id: string) => boolean;
  raceSize: string | null;
  raceDarkvision: boolean;
  raceMovement: Set<string>;
  raceHasSubracesOnly: boolean;
  raceSorts: SortOption<Race>[];
  sort: string;
  subraces: SubraceWithParent[];
  subraceParent: string | null;
  subraceTraits: Set<SubraceOwnTrait>;
  subraceSorts: SortOption<Subrace>[];
  classes: CharClass[];
  classCaster: string | null;
  classHitDie: number | null;
  classSave: Set<Ability>;
  classArmor: Set<string>;
  classWeapon: Set<string>;
  classSorts: SortOption<CharClass>[];
  subclassEntries: SubclassEntryWithParent[];
  subclassParent: string | null;
  subclassAdds: Set<SubclassAddition>;
  subclassSorts: SortOption<SubclassEntry>[];
  backgrounds: Background[];
  backgroundSkill: Set<SkillName>;
  backgroundTool: Set<string>;
  backgroundSorts: SortOption<Background>[];
  feats: Feat[];
  featPrereqType: string | null;
  featGrants: Set<"asi" | "proficiency" | "activation">;
  featSorts: SortOption<Feat>[];
  spellIndex: SpellIndexEntry[];
  spellSchool: string | null;
  spellCast: "all" | "ritual" | "concentration";
  spellAction: string | null;
  spellComponents: Set<string>;
  spellSorts: SortOption<SpellIndexEntry>[];
  itemIndex: ItemIndexEntry[];
  itemCat: ItemCategoryId | null;
  itemMagical: "all" | "magical" | "mundane";
  itemWeaponClass: "martial" | "simple" | null;
  itemWeaponRange: "melee" | "ranged" | null;
  itemArmorWeightF: "heavy" | "medium" | "light" | null;
  itemRarity: Set<string>;
  itemSorts: SortOption<ItemIndexEntry>[];
  monsterTemplates: MonsterTemplate[];
  monsterCrMin: string;
  monsterCrMax: string;
  monsterType: string | null;
  monsterSize: string | null;
  monsterAlignment: string | null;
  monsterLegendary: boolean;
  monsterLair: boolean;
  monsterDarkvision: boolean;
  monsterSpellcaster: boolean;
  monsterMovement: Set<string>;
  monsterResistance: Set<string>;
  monsterImmunity: Set<string>;
  monsterCondImmunity: Set<string>;
  monsterLanguage: Set<string>;
  monsterSorts: SortOption<MonsterTemplate>[];
  conditions: Condition[];
  conditionSorts: SortOption<Condition>[];
  mixedSorts: SortOption<BrowsableEntry>[];
}) {
  const q = search.trim().toLowerCase();

  // ── Per-type filtered + sorted raw arrays (type-specific filters only
  // apply in single-type mode — see the `single` guard on each). ──
  const single = contentType !== 'all';

  // PERF-COMPENDIUM-1 (item 2): a specific OTHER type being selected means
  // this type's rows are never read (`entriesByType[contentType]` picks
  // only the active type; 'all' mode is the only case that reads every
  // type) — skip the filter+sort pass entirely rather than computing rows
  // nobody will see. `single && contentType !== '<this type>'` is the
  // exact "some other type is exclusively active" condition.
  const skipRace = single && contentType !== 'race';
  const filteredRaces = useMemo(() => {
    if (!contentReady || skipRace) return EMPTY_RESULTS;
    return sortByOption(races.filter(r => {
    if (!matchesGlobal(r.rulesetId, false, r.srd, 'race') || !matchesFav('race', r.id)) return false;
    if (!matchesSearchText(r.name, [], q)) return false;
    if (single && contentType === 'race') {
      if (raceSize && r.size !== raceSize) return false;
      if (raceDarkvision && !hasDarkvision(r)) return false;
      if (raceMovement.size > 0 && !Array.from(raceMovement).some(m => raceMovementTypes(r).includes(m))) return false;
      if (raceHasSubracesOnly && !hasSubraces(r)) return false;
    }
    return true;
  }), raceSorts, sort);
  }, [contentReady, skipRace, races, q, single, contentType, raceSize, raceDarkvision, raceMovement, raceHasSubracesOnly, sort, raceSorts, matchesGlobal, matchesFav]);

  const skipSubrace = single && contentType !== 'subrace';
  const filteredSubraces = useMemo(() => {
    if (!contentReady || skipSubrace) return EMPTY_RESULTS;
    return sortByOption(subraces.filter(sr => {
    if (!matchesGlobal(sr.rulesetId, false, sr.srd, 'subrace')) return false;
    if (!matchesFav('subrace', sr.id)) return false;
    if (!matchesSearchText(sr.name, [sr.parentRaceName], q)) return false;
    if (single && contentType === 'subrace') {
      if (subraceParent && sr.parentRaceId !== subraceParent) return false;
      if (subraceTraits.size > 0) {
        const own = subraceOwnTraits(sr);
        if (!Array.from(subraceTraits).some(t => own.has(t))) return false;
      }
    }
    return true;
  }), subraceSorts, sort);
  }, [contentReady, skipSubrace, subraces, q, single, contentType, subraceParent, subraceTraits, sort, subraceSorts, matchesGlobal, matchesFav]);

  const skipClass = single && contentType !== 'class';
  const filteredClasses = useMemo(() => {
    if (!contentReady || skipClass) return EMPTY_RESULTS;
    return sortByOption(classes.filter(c => {
    if (!matchesGlobal(c.rulesetId, false, c.srd, 'class') || !matchesFav('class', c.id)) return false;
    if (!matchesSearchText(c.name, [], q)) return false;
    if (single && contentType === 'class') {
      if (classCaster && (CASTER_TYPE[c.id] ?? 'Martial') !== classCaster) return false;
      if (classHitDie && c.hitDie !== classHitDie) return false;
      if (classSave.size > 0 && !Array.from(classSave).some(a => c.savingThrows?.includes(a))) return false;
      if (classArmor.size > 0 && !Array.from(classArmor).some(a => c.armorProfs?.includes(a))) return false;
      if (classWeapon.size > 0 && !Array.from(classWeapon).some(w => c.weaponProfs?.includes(w))) return false;
    }
    return true;
  }), classSorts, sort);
  }, [contentReady, skipClass, classes, q, single, contentType, classCaster, classHitDie, classSave, classArmor, classWeapon, sort, classSorts, matchesGlobal, matchesFav]);

  const skipSubclass = single && contentType !== 'subclass';
  const filteredSubclasses = useMemo(() => {
    if (!contentReady || skipSubclass) return EMPTY_RESULTS;
    return sortByOption(subclassEntries.filter(s => {
    if (!matchesGlobal(s.progression.rulesetId, false, s.progression.srd, 'subclass') || !matchesFav('subclass', s.id)) return false;
    if (!matchesSearchText(s.name, [s.parentClassName], q)) return false;
    if (single && contentType === 'subclass') {
      if (subclassParent && s.classId !== subclassParent) return false;
      if (subclassAdds.size > 0) {
        const adds = subclassAdditions(s.progression);
        if (!Array.from(subclassAdds).some(a => adds.has(a))) return false;
      }
    }
    return true;
  }), subclassSorts, sort);
  }, [contentReady, skipSubclass, subclassEntries, q, single, contentType, subclassParent, subclassAdds, sort, subclassSorts, matchesGlobal, matchesFav]);

  const skipBackground = single && contentType !== 'background';
  const filteredBackgrounds = useMemo(() => {
    if (!contentReady || skipBackground) return EMPTY_RESULTS;
    return sortByOption(backgrounds.filter(b => {
    if (!matchesGlobal(b.rulesetId, false, b.srd, 'background') || !matchesFav('background', b.id)) return false;
    if (!matchesSearchText(b.name, [], q)) return false;
    if (single && contentType === 'background') {
      if (backgroundSkill.size > 0 && !Array.from(backgroundSkill).some(s => backgroundSkillGrants(b).includes(s))) return false;
      if (backgroundTool.size > 0 && !Array.from(backgroundTool).some(t => (b.toolProficiencies ?? []).includes(t))) return false;
    }
    return true;
  }), backgroundSorts, sort);
  }, [contentReady, skipBackground, backgrounds, q, single, contentType, backgroundSkill, backgroundTool, sort, backgroundSorts, matchesGlobal, matchesFav]);

  const skipFeat = single && contentType !== 'feat';
  const filteredFeats = useMemo(() => {
    if (!contentReady || skipFeat) return EMPTY_RESULTS;
    return sortByOption(feats.filter(ft => {
    if (!matchesGlobal(ft.rulesetId, false, ft.srd, 'feat') || !matchesFav('feat', ft.id)) return false;
    if (!matchesSearchText(ft.name, [], q)) return false;
    if (single && contentType === 'feat') {
      if (featPrereqType && primaryPrereqCategory(ft.prerequisite) !== featPrereqType) return false;
      if (featGrants.size > 0) {
        const grants = new Set<string>();
        if (featGrantsAsi(ft)) grants.add('asi');
        if (featGrantsProficiency(ft)) grants.add('proficiency');
        if (featGrantsActivation(ft)) grants.add('activation');
        if (!Array.from(featGrants).some(g => grants.has(g))) return false;
      }
    }
    return true;
  }), featSorts, sort);
  }, [contentReady, skipFeat, feats, q, single, contentType, featPrereqType, featGrants, sort, featSorts, matchesGlobal, matchesFav]);

  const skipSpell = single && contentType !== 'spell';
  const filteredSpells = useMemo(() => {
    if (!contentReady || skipSpell) return EMPTY_RESULTS;
    return sortByOption(spellIndex.filter(s => {
    if (!matchesGlobal(s.rulesetId, false, s.srd, 'spell') || !matchesFav('spell', s.id)) return false;
    if (!matchesSearchText(s.name, [s.school], q)) return false;
    if (single && contentType === 'spell') {
      if (spellSchool && s.school !== spellSchool) return false;
      if (spellCast !== 'all' && (spellCast === 'ritual' ? !s.ritual : !s.concentration)) return false;
      if (spellAction && actionType(s) !== spellAction) return false;
      if (spellComponents.size > 0 && !Array.from(spellComponents).some(c => (s.components ?? []).includes(c))) return false;
    }
    return true;
  }), spellSorts, sort);
  }, [contentReady, skipSpell, spellIndex, q, single, contentType, spellSchool, spellCast, spellAction, spellComponents, sort, spellSorts, matchesGlobal, matchesFav]);

  const skipItem = single && contentType !== 'item';
  const filteredItems = useMemo(() => {
    if (!contentReady || skipItem) return EMPTY_RESULTS;
    return sortByOption(itemIndex.filter(i => {
    if (!matchesGlobal(i.rulesetId, false, i.srd, 'item') || !matchesFav('item', i.id)) return false;
    if (!matchesSearchText(i.name, [], q)) return false;
    if (single && contentType === 'item') {
      if (itemCat && itemCategory(i) !== itemCat) return false;
      if (itemMagical !== 'all' && (itemMagical === 'magical') !== isMagic(i)) return false;
      if (itemWeaponClass && (itemCategory(i) !== 'weapon' || (itemWeaponClass === 'martial' ? !isMartialWeapon(i) : isMartialWeapon(i)))) return false;
      if (itemWeaponRange && (itemCategory(i) !== 'weapon' || (itemWeaponRange === 'ranged' ? !isRangedWeapon(i) : isRangedWeapon(i)))) return false;
      if (itemArmorWeightF && armorWeight(i) !== itemArmorWeightF) return false;
      if (itemRarity.size > 0 && (rarityOf(i) === null || !itemRarity.has(rarityOf(i)!))) return false;
    }
    return true;
  }), itemSorts, sort);
  }, [contentReady, skipItem, itemIndex, q, single, contentType, itemCat, itemMagical, itemWeaponClass, itemWeaponRange, itemArmorWeightF, itemRarity, sort, itemSorts, matchesGlobal, matchesFav]);

  const skipMonster = single && contentType !== 'monster';
  const filteredMonsters = useMemo(() => {
    if (!contentReady || skipMonster) return EMPTY_RESULTS;
    return sortByOption(monsterTemplates.filter(m => {
    if (!matchesGlobal(m.rulesetId, false, m.srd, 'monster') || !matchesFav('monster', m.id)) return false;
    if (!matchesSearchText(m.name, [m.type], q)) return false;
    if (single && contentType === 'monster') {
      const min = parseFloat(monsterCrMin), max = parseFloat(monsterCrMax);
      if (!isNaN(min) && m.cr < min) return false;
      if (!isNaN(max) && m.cr > max) return false;
      if (monsterType && m.type !== monsterType) return false;
      if (monsterSize && m.size !== monsterSize) return false;
      if (monsterAlignment && m.alignment !== monsterAlignment) return false;
      if (monsterLegendary && (m.legendaryActions ?? 0) === 0) return false;
      if (monsterLair && (m.lairActions?.length ?? 0) === 0) return false;
      if (monsterDarkvision && !monsterHasDarkvision(m)) return false;
      if (monsterSpellcaster && !monsterIsSpellcaster(m)) return false;
      if (monsterMovement.size > 0 && !Array.from(monsterMovement).some(mv => monsterMovementTypes(m).has(mv))) return false;
      if (monsterResistance.size > 0 && !Array.from(monsterResistance).some(r => monsterResistances(m).has(r))) return false;
      if (monsterImmunity.size > 0 && !Array.from(monsterImmunity).some(im => monsterImmunities(m).has(im))) return false;
      if (monsterCondImmunity.size > 0 && !Array.from(monsterCondImmunity).some(ci => monsterConditionImmunities(m).has(ci))) return false;
      if (monsterLanguage.size > 0 && !Array.from(monsterLanguage).some(l => m.languages.includes(l))) return false;
    }
    return true;
  }), monsterSorts, sort);
  }, [
    contentReady, skipMonster, monsterTemplates, q, single, contentType,
    monsterCrMin, monsterCrMax, monsterType, monsterSize, monsterAlignment, monsterLegendary, monsterLair, monsterDarkvision,
    monsterSpellcaster, monsterMovement, monsterResistance, monsterImmunity, monsterCondImmunity, monsterLanguage, sort, monsterSorts,
    matchesGlobal, matchesFav,
  ]);

  const skipCondition = single && contentType !== 'condition';
  const filteredConditions = useMemo(() => {
    if (!contentReady || skipCondition) return EMPTY_RESULTS;
    return sortByOption(conditions.filter(c => {
    if (!matchesGlobal(c.rulesetId, false, undefined, 'condition') || !matchesFav('condition', c.id)) return false;
    if (!matchesSearchText(c.name, [c.description], q)) return false;
    return true;
  }), conditionSorts, sort);
  }, [contentReady, skipCondition, conditions, q, sort, conditionSorts, matchesGlobal, matchesFav]);

  // ── Wrap into BrowsableEntry[] for rendering — single-type mode picks
  // just the active type's list; All mode concatenates every type (each
  // already global-filtered above, type-specific filters simply never
  // apply since contentType !== that type) and re-sorts with the mixed
  // A–Z/Content Type/Source sort options. ──
  const entriesByType: Record<ContentTypeId, BrowsableEntry[]> = {
    race:       filteredRaces.map(r => raceToBrowsable(r, false)),
    subrace:    filteredSubraces.map(s => subraceToBrowsable(s, false)),
    class:      filteredClasses.map(c => classToBrowsable(c, false)),
    subclass:   filteredSubclasses.map(s => subclassToBrowsable(s, false)),
    background: filteredBackgrounds.map(b => backgroundToBrowsable(b, false)),
    feat:       filteredFeats.map(ft => featToBrowsable(ft, false)),
    spell:      filteredSpells.map(s => spellToBrowsable(s, false)),
    item:       filteredItems.map(i => itemToBrowsable(i, false)),
    monster:    filteredMonsters.map(m => monsterToBrowsable(m, false)),
    condition:  filteredConditions.map(c => conditionToBrowsable(c, false)),
  };

  const results: BrowsableEntry[] = contentType === 'all'
    ? sortByOption(CONTENT_TYPE_ORDER.flatMap(t => entriesByType[t]), mixedSorts, sort)
    : entriesByType[contentType];
  return { single, results };
}
