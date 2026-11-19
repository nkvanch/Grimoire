import { useMemo } from 'react';
import { backgroundSkillGrants } from '../../../content/backgrounds/backgroundBrowse';
import { ContentTypeId } from '../../../content/contentQuery';
import { ItemIndexEntry } from '../../../content/itemRepo.types';
import { RARITY_TIERS, rarityOf } from '../../../content/items/itemBrowse';
import { MONSTER_SIZE_ORDER, monsterResistances, monsterImmunities, monsterConditionImmunities } from '../../../content/monsters/monsterBrowse';
import { MonsterTemplate } from '../../../content/monsters/types';
import { RACE_SIZE_ORDER, RACE_MOVEMENT_TYPES, raceMovementTypes } from '../../../content/races/raceBrowse';
import { SpellIndexEntry } from '../../../content/spellRepo.types';
import { Background, CharClass, Race } from '../../../engine/types';
import { EMPTY_RESULTS, skillLabel } from './compendiumModel';

export function useAvailableFilterValues({ single, contentType, itemIndex, spellIndex, backgrounds, classes, races, monsterTemplates }: {
  single: boolean;
  contentType: ContentTypeId | "all";
  itemIndex: ItemIndexEntry[];
  spellIndex: SpellIndexEntry[];
  backgrounds: Background[];
  classes: CharClass[];
  races: Race[];
  monsterTemplates: MonsterTemplate[];
}) {
  // PERF-COMPENDIUM-1 (item 2): these are the actual "type-specific filter
  // MODEL" the spec asks to defer — every one of them is now (a) memoized
  // (previously recomputed on every render for ANY reason, including
  // renders triggered by an entirely different tab's state changing) and
  // (b) gated to only build for the currently-selected single type, so
  // e.g. `availableMonsterResistances` never runs a full monster-catalog
  // flatMap while the user is on the Race tab.
  const availableItemRarities = useMemo(
    () => (single && contentType === 'item') ? RARITY_TIERS.filter(r => itemIndex.some(i => rarityOf(i) === r)) : EMPTY_RESULTS,
    [single, contentType, itemIndex],
  );
  const availableSpellSchools = useMemo(
    () => (single && contentType === 'spell') ? Array.from(new Set(spellIndex.map(s => s.school))).sort() : EMPTY_RESULTS,
    [single, contentType, spellIndex],
  );
  const availableSpellComponents = useMemo(
    () => (single && contentType === 'spell') ? Array.from(new Set(spellIndex.flatMap(s => s.components ?? []))) : EMPTY_RESULTS,
    [single, contentType, spellIndex],
  );
  const availableBgSkills = useMemo(
    () => (single && contentType === 'background') ? Array.from(new Set(backgrounds.flatMap(backgroundSkillGrants))).sort().map(s => ({ id: s, label: skillLabel(s) })) : EMPTY_RESULTS,
    [single, contentType, backgrounds],
  );
  const availableBgTools = useMemo(
    () => (single && contentType === 'background') ? Array.from(new Set(backgrounds.flatMap(b => b.toolProficiencies ?? []))).sort() : EMPTY_RESULTS,
    [single, contentType, backgrounds],
  );
  const availableClassHitDice = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.map(c => c.hitDie))).sort((a, b) => a - b) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableClassSaves = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.flatMap(c => c.savingThrows ?? []))) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableClassArmor = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.flatMap(c => c.armorProfs ?? []))) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableClassWeapon = useMemo(
    () => (single && contentType === 'class') ? Array.from(new Set(classes.flatMap(c => c.weaponProfs ?? []))) : EMPTY_RESULTS,
    [single, contentType, classes],
  );
  const availableRaceSizes = useMemo(
    () => (single && contentType === 'race') ? RACE_SIZE_ORDER.filter(s => races.some(r => r.size === s)) : EMPTY_RESULTS,
    [single, contentType, races],
  );
  const availableRaceMovement = useMemo(
    () => (single && contentType === 'race') ? RACE_MOVEMENT_TYPES.filter(m => races.some(r => raceMovementTypes(r).includes(m))) : EMPTY_RESULTS,
    [single, contentType, races],
  );
  const availableMonsterTypes = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.map(m => m.type))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterSizes = useMemo(
    () => (single && contentType === 'monster') ? MONSTER_SIZE_ORDER.filter(s => monsterTemplates.some(m => m.size === s)) : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterAlignments = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.map(m => m.alignment))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterResistances = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => Array.from(monsterResistances(m))))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterImmunities = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => Array.from(monsterImmunities(m))))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterCondImmunities = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => Array.from(monsterConditionImmunities(m))))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  const availableMonsterLanguages = useMemo(
    () => (single && contentType === 'monster') ? Array.from(new Set(monsterTemplates.flatMap(m => m.languages))).sort() : EMPTY_RESULTS,
    [single, contentType, monsterTemplates],
  );
  return {
    availableItemRarities, availableSpellSchools, availableSpellComponents, availableBgSkills, availableBgTools, availableClassHitDice,
    availableClassSaves, availableClassArmor, availableClassWeapon, availableRaceSizes, availableRaceMovement, availableMonsterTypes,
    availableMonsterSizes, availableMonsterAlignments, availableMonsterResistances, availableMonsterImmunities,
    availableMonsterCondImmunities, availableMonsterLanguages,
  };
}
