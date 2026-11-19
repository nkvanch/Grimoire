import { useState } from 'react';
import { ItemCategoryId } from '../../../content/items/itemBrowse';
import { SubraceOwnTrait } from '../../../content/races/subraceBrowse';
import { SubclassAddition } from '../../../content/subclasses/subclassBrowse';
import { GameId, RulesetId, Ability, SkillName } from '../../../engine/types';
import { BrowseState } from '../../../store/browseStateStore';

export function useCompendiumFilterState({ saved }: {
  saved: BrowseState;
}) {
  const f = saved.filters ?? {};
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [gameFilter, setGameFilter] = useState<GameId | null>((f.gameFilter as GameId) ?? null);
  const [rulesetFilter, setRulesetFilter] = useState<RulesetId | null>((f.rulesetFilter as RulesetId) ?? null);

  // Race
  const [raceSize, setRaceSize] = useState<string | null>((f.raceSize as string) ?? null);
  const [raceDarkvision, setRaceDarkvision] = useState(!!f.raceDarkvision);
  const [raceMovement, setRaceMovement] = useState<Set<string>>(new Set((f.raceMovement as string[]) ?? []));
  const [raceHasSubracesOnly, setRaceHasSubracesOnly] = useState(!!f.raceHasSubracesOnly);
  // Subrace
  const [subraceParent, setSubraceParent] = useState<string | null>((f.subraceParent as string) ?? null);
  const [subraceTraits, setSubraceTraits] = useState<Set<SubraceOwnTrait>>(new Set((f.subraceTraits as SubraceOwnTrait[]) ?? []));
  // Class
  const [classCaster, setClassCaster] = useState<string | null>((f.classCaster as string) ?? null);
  const [classHitDie, setClassHitDie] = useState<number | null>((f.classHitDie as number) ?? null);
  const [classSave, setClassSave] = useState<Set<Ability>>(new Set((f.classSave as Ability[]) ?? []));
  const [classArmor, setClassArmor] = useState<Set<string>>(new Set((f.classArmor as string[]) ?? []));
  const [classWeapon, setClassWeapon] = useState<Set<string>>(new Set((f.classWeapon as string[]) ?? []));
  // Subclass
  const [subclassParent, setSubclassParent] = useState<string | null>((f.subclassParent as string) ?? null);
  const [subclassAdds, setSubclassAdds] = useState<Set<SubclassAddition>>(new Set((f.subclassAdds as SubclassAddition[]) ?? []));
  // Background
  const [backgroundSkill, setBackgroundSkill] = useState<Set<SkillName>>(new Set((f.backgroundSkill as SkillName[]) ?? []));
  const [backgroundTool, setBackgroundTool] = useState<Set<string>>(new Set((f.backgroundTool as string[]) ?? []));
  // Feat
  const [featPrereqType, setFeatPrereqType] = useState<string | null>((f.featPrereqType as string) ?? null);
  const [featGrants, setFeatGrants] = useState<Set<'asi' | 'proficiency' | 'activation'>>(new Set((f.featGrants as ('asi' | 'proficiency' | 'activation')[]) ?? []));
  // Spell
  const [spellSchool, setSpellSchool] = useState<string | null>((f.spellSchool as string) ?? null);
  const [spellCast, setSpellCast] = useState<'all' | 'ritual' | 'concentration'>((f.spellCast as 'all' | 'ritual' | 'concentration') ?? 'all');
  const [spellAction, setSpellAction] = useState<string | null>((f.spellAction as string) ?? null);
  const [spellComponents, setSpellComponents] = useState<Set<string>>(new Set((f.spellComponents as string[]) ?? []));
  // Item
  const [itemCat, setItemCat] = useState<ItemCategoryId | null>((f.itemCat as ItemCategoryId) ?? null);
  const [itemMagical, setItemMagical] = useState<'all' | 'magical' | 'mundane'>((f.itemMagical as 'all' | 'magical' | 'mundane') ?? 'all');
  const [itemWeaponClass, setItemWeaponClass] = useState<'martial' | 'simple' | null>((f.itemWeaponClass as 'martial' | 'simple') ?? null);
  const [itemWeaponRange, setItemWeaponRange] = useState<'melee' | 'ranged' | null>((f.itemWeaponRange as 'melee' | 'ranged') ?? null);
  const [itemArmorWeightF, setItemArmorWeightF] = useState<'heavy' | 'medium' | 'light' | null>((f.itemArmorWeight as 'heavy' | 'medium' | 'light') ?? null);
  const [itemRarity, setItemRarity] = useState<Set<string>>(new Set((f.itemRarity as string[]) ?? []));
  // Monster
  const [monsterType, setMonsterType] = useState<string | null>((f.monsterType as string) ?? null);
  const [monsterSize, setMonsterSize] = useState<string | null>((f.monsterSize as string) ?? null);
  const [monsterAlignment, setMonsterAlignment] = useState<string | null>((f.monsterAlignment as string) ?? null);
  const [monsterCrMin, setMonsterCrMin] = useState((f.monsterCrMin as string) ?? '');
  const [monsterCrMax, setMonsterCrMax] = useState((f.monsterCrMax as string) ?? '');
  const [monsterMovement, setMonsterMovement] = useState<Set<string>>(new Set((f.monsterMovement as string[]) ?? []));
  const [monsterResistance, setMonsterResistance] = useState<Set<string>>(new Set((f.monsterResistance as string[]) ?? []));
  const [monsterImmunity, setMonsterImmunity] = useState<Set<string>>(new Set((f.monsterImmunity as string[]) ?? []));
  const [monsterCondImmunity, setMonsterCondImmunity] = useState<Set<string>>(new Set((f.monsterCondImmunity as string[]) ?? []));
  const [monsterLanguage, setMonsterLanguage] = useState<Set<string>>(new Set((f.monsterLanguage as string[]) ?? []));
  const [monsterLegendary, setMonsterLegendary] = useState(!!f.monsterLegendary);
  const [monsterLair, setMonsterLair] = useState(!!f.monsterLair);
  const [monsterDarkvision, setMonsterDarkvision] = useState(!!f.monsterDarkvision);
  const [monsterSpellcaster, setMonsterSpellcaster] = useState(!!f.monsterSpellcaster);
  return {
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
  };
}
