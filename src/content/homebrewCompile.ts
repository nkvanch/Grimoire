// src/content/homebrewCompile.ts
// The pure half of the feat, spell and item builders: what a builder's fields compile to. The builder screens call these (the React
// state stays in the screens), and the native desktop app is held to the same results by the parity fixtures
// (src/engine/__tests__/parityHomebrewScenarios.ts). No React, no stores: plain data in, plain data out.
import type {
  Ability, AbilityEffect, Condition, MulticlassPrerequisites, ContentOrigin, ResourceGrant, SpellList, DraftTrait, Effect, Feat, Feature, Grant, Item, RulesetId, SkillName, Spell, Subrace,
} from '../engine/types';
import {
  mergeSubclassEntries, serializeDraftTraits, serializeBackgroundFeatures, serializeLosslessChoices, serializeLeveledChoices,
  type SubclassFeatureEdit, type LosslessDraftChoice, type LeveledLosslessDraftChoice,
} from '../engine/homebrewNestedSerializers';
import { FEAT_CHOICE_PREFIX, RACE_CHOICE_PREFIX, BACKGROUND_CHOICE_PREFIX } from '../engine/types';
import type { CantripTierDraft } from '../engine/cantripScaling';
import { tiersFromDraft } from '../engine/cantripScaling';
import type { MonsterTemplate } from './monsters/types';
import { buildTraitFeature, buildSubrace, SENSE_TYPES, MOVE_TYPES, SKILLS, type DraftSubrace } from './traitCompiler';

/** The origin to save: trimmed, or undefined when there is nothing to record (components/homebrew/OriginFields.tsx's cleanOrigin). */
export function cleanOriginOf(origin: ContentOrigin | undefined): ContentOrigin | undefined {
  const name = (origin?.name ?? '').trim();
  const link = (origin?.link ?? '').trim();
  if (!name && !link) return undefined;
  return { name: name || link, ...(name && link ? { link } : {}) };
}

// ── feat ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FeatDraft = {
  name: string;
  prerequisite: string;
  source: string;
  sourceLink: string;
  description: string;
  trait: DraftTrait;
  abilityChoice: { options: Ability[]; amount: string; grantsSaveProficiency: boolean } | null;
  skillPicks: { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[];
  /** Choices the feat asks of the player (expertise, tool, language). */
  pendingChoices?: LosslessDraftChoice[];
  rulesetId?: RulesetId;
};

/** The fields a feat builder saves for a draft. `feature` overrides the compiled trait (an edit that kept the original mechanics). */
export function compileFeatFields(draft: FeatDraft, id: string, feature?: Feature): Feat {
  const compiled = feature ?? buildTraitFeature(draft.trait, { idPrefix: id, sourceKind: 'feat', sourceRefId: id, level: null }).feature;
  const source = draft.source.trim();
  return {
    id,
    name: draft.name.trim(),
    prerequisite: draft.prerequisite.trim() || null,
    description: draft.description.trim(),
    source: source || 'Homebrew',
    origin: cleanOriginOf(source && source !== 'Homebrew' || draft.sourceLink.trim()
      ? { name: source === 'Homebrew' ? '' : source, link: draft.sourceLink } : undefined),
    feature: { ...compiled, id: `feat_${id}`, description: draft.description.trim() },
    abilityChoice: draft.abilityChoice
      ? { options: draft.abilityChoice.options, amount: parseInt(draft.abilityChoice.amount, 10) || 1, grantsSaveProficiency: draft.abilityChoice.grantsSaveProficiency }
      : undefined,
    skillChoice: draft.skillPicks.length > 0 ? { picks: draft.skillPicks } : undefined,
    pendingChoices: serializeLosslessChoices(undefined, draft.pendingChoices ?? [], FEAT_CHOICE_PREFIX),
    rulesetId: draft.rulesetId,
  } as Feat;
}

// ── spell ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SpellDraft = {
  name: string;
  origin?: ContentOrigin;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: ('V' | 'S' | 'M')[];
  duration: string;
  description: string;
  upcast: string;
  tiers: CantripTierDraft[];
  ritual: boolean;
  concentration: boolean;
  spellTypes: string[];
  rulesetId?: RulesetId;
};

export function compileSpellFields(draft: SpellDraft, id: string): Spell {
  const tiers = draft.level === 0 ? tiersFromDraft(draft.tiers) : [];
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    level: draft.level,
    school: draft.school.trim(),
    castingTime: draft.castingTime.trim(),
    range: draft.range.trim(),
    components: [...draft.components],
    duration: draft.duration.trim(),
    description: draft.description.trim(),
    upcast: draft.upcast.trim() || null,
    cantripScaling: tiers.length > 0 ? tiers : undefined,
    ritual: draft.ritual,
    concentration: draft.concentration,
    spellType: draft.spellTypes.length > 0 ? draft.spellTypes : undefined,
    rulesetId: draft.rulesetId,
  } as Spell;
}

// ── item ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ItemDamageEntry = { dice: string; damageType: string };

export type ItemDraft = {
  name: string;
  origin?: ContentOrigin;
  cost: string;
  weight: string;
  description: string;
  category: string;
  rarity: string | null;
  armorCategory: string;
  weaponProps: string[];
  extraProps: string;
  weaponClass: 'simple' | 'martial' | null;
  weaponRangeSel: 'melee' | 'ranged' | null;
  weaponDamage: ItemDamageEntry[];
  acValue: string;
  acAddsDex: boolean;
  trait: DraftTrait;
  imageUri?: string;
  rulesetId?: RulesetId;
};

export function compileItemFeature(draft: ItemDraft, id: string): Feature {
  const name = draft.name.trim();
  const base: Feature = {
    id: id + '_feat',
    name: name || 'Item',
    description: draft.description.trim() || name,
    source: { kind: 'item', refId: id },
    level: null,
    effects: [],
    actions: [],
    choices: [],
    passive: true,
  };
  const weaponEffects: AbilityEffect[] = draft.category === 'weapon'
    ? draft.weaponDamage.filter(d => d.dice.trim()).map(d => ({ type: 'damage' as const, dice: d.dice.trim(), damageType: d.damageType }))
    : [];

  const effects: Effect[] = [];
  if (draft.category === 'armor') {
    const base10 = parseInt(draft.acValue, 10);
    if (!isNaN(base10)) {
      effects.push({
        type: 'base_ac_formula', target: 'ac', operation: 'set', value: base10, condition: null,
        formulaAbilities: draft.acAddsDex ? ['dex'] : [],
        ...(draft.acAddsDex && draft.armorCategory === 'medium armor' ? { formulaAbilityCap: { dex: 2 } } : {}),
      });
    }
  }
  const { feature: traitFeature } = buildTraitFeature(draft.trait, { idPrefix: id, sourceKind: 'item', sourceRefId: id, level: null });
  effects.push(...traitFeature.effects);

  if (weaponEffects.length > 0) {
    return {
      ...base, effects,
      abilityEffects: weaponEffects,
      activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    };
  }
  return { ...base, effects };
}

export function compileItemProperties(draft: ItemDraft): string[] {
  const props: string[] = [];
  if (draft.category === 'weapon') {
    props.push(...draft.weaponProps);
    if (draft.weaponClass) props.push(draft.weaponClass);
    if (draft.weaponRangeSel) props.push(draft.weaponRangeSel);
  }
  if (draft.category === 'armor') props.push(draft.armorCategory);
  if (draft.category === 'wondrous') props.push('wondrous item', 'magic item');
  if (draft.category === 'potion') props.push('potion');
  if (draft.category === 'scroll') props.push('scroll');
  if (draft.category === 'ring') props.push('ring', 'magic item');
  if (draft.category === 'wand') props.push('wand', 'magic item');
  if (draft.category === 'staff') props.push('staff', 'magic item');
  if (draft.category === 'rod') props.push('rod', 'magic item');
  if (draft.category === 'tool') props.push('tool');
  if (draft.rarity) props.push(draft.rarity, 'magic item');
  if (draft.extraProps.trim()) {
    props.push(...draft.extraProps.split(',').map(p => p.trim().toLowerCase()).filter(Boolean));
  }
  return Array.from(new Set(props));
}

/** The item a builder saves for a draft (a new item: no earlier version to merge with). */
export function compileItemFields(draft: ItemDraft, id: string): Item {
  const feature = compileItemFeature(draft, id);
  const stored = {
    description: draft.description, category: draft.category, rarity: draft.rarity, armorCategory: draft.armorCategory,
    weaponProps: draft.weaponProps, extraProps: draft.extraProps, weaponDamage: draft.weaponDamage, weaponClass: draft.weaponClass,
    weaponRangeSel: draft.weaponRangeSel, acValue: draft.acValue, acAddsDex: draft.acAddsDex, trait: draft.trait,
  };
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    weight: parseFloat(draft.weight) || 0,
    cost: draft.cost.trim() || '-',
    properties: compileItemProperties(draft),
    features: [feature],
    imageUri: draft.imageUri,
    rulesetId: draft.rulesetId,
    homebrewDraft: { ...stored, editorFeatureId: feature.id },
  } as Item;
}

// ── class ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ClassDraft = {
  name: string;
  origin?: ContentOrigin;
  hitDie: 4 | 6 | 8 | 10 | 12;
  hpAbility: Ability;
  description: string;
  savingThrows: Ability[];
  armorProfs: string[];
  weaponProfs: string[];
  toolProfs: string[];
  /** What taking the class as a second (or later) class grants, the reduced table of the multiclassing rules; none authored: nothing. */
  multiclassArmor?: string[];
  multiclassWeapons?: string[];
  multiclassTools?: string[];
  /** The abilities a character needs to take the class, or leave it for another (the desktop's draft fields): all of them, or any one. */
  multiclassNeeds?: Ability[];
  multiclassNeedsMinimum?: number;
  multiclassNeedsAny?: boolean;
  startingEquipment: string[];
  equipmentNotes: string;
  isCaster: boolean;
  spellAbilities: Ability[];
  spellStyle: 'full' | 'half' | 'pact';
  spellPrepPolicy: 'known' | 'spellbook_prepared' | 'full_list_prepared';
  spellStartLevel: string;
  /** 'own', 'class:<id>' or 'list:<id>' */
  spellSource: string;
  levelFeatures: (DraftTrait & { level: number })[];
  /** Choices the class asks of the player at a level (expertise, tool, language). */
  levelChoices?: LeveledLosslessDraftChoice[];
  asiLevels: number[];
  rulesetId?: RulesetId;
};

export const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

/** The fields a class builder saves for a draft; what the builder cannot author (features, level choices, a full progression) is the caller's. */
export function compileClassFields(draft: ClassDraft, id: string) {
  const startLvl = parseInt(draft.spellStartLevel, 10);
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    hitDie: draft.hitDie,
    description: draft.description.trim() || undefined,
    savingThrows: draft.savingThrows.length > 0 ? draft.savingThrows : undefined,
    armorProfs: draft.armorProfs.length > 0 ? draft.armorProfs : undefined,
    weaponProfs: draft.weaponProfs.length > 0 ? draft.weaponProfs : undefined,
    toolProfs: draft.toolProfs.length > 0 ? draft.toolProfs : undefined,
    startingEquipment: draft.startingEquipment.length > 0 ? draft.startingEquipment : undefined,
    equipmentNotes: draft.equipmentNotes.trim() || undefined,
    hpAbility: draft.hpAbility !== 'con' ? draft.hpAbility : undefined,
    spellcastingAbility: draft.isCaster && draft.spellAbilities.length === 1 ? draft.spellAbilities[0] : undefined,
    spellcastingAbilityOptions: draft.isCaster && draft.spellAbilities.length >= 2 ? draft.spellAbilities : undefined,
    spellcastingStyle: draft.isCaster ? draft.spellStyle : undefined,
    spellPreparationPolicy: draft.isCaster && draft.spellPrepPolicy !== 'known' ? draft.spellPrepPolicy : undefined,
    spellcastingStartLevel: draft.isCaster && startLvl > 1 ? startLvl : undefined,
    spellListSource: draft.isCaster && draft.spellSource.startsWith('list:') ? { kind: 'list' as const, listId: draft.spellSource.slice(5) }
      : draft.isCaster && draft.spellSource.startsWith('class:') ? { kind: 'class' as const, classId: draft.spellSource.slice(6) }
      : undefined,
    multiclassProficiencies: (draft.multiclassArmor?.length || draft.multiclassWeapons?.length || draft.multiclassTools?.length)
      ? {
        ...(draft.multiclassArmor?.length ? { armor: draft.multiclassArmor } : {}),
        ...(draft.multiclassWeapons?.length ? { weapons: draft.multiclassWeapons } : {}),
        ...(draft.multiclassTools?.length ? { tools: draft.multiclassTools } : {}),
      }
      : undefined,
    multiclassPrerequisites: multiclassNeedsOf(draft),
    asiLevels: JSON.stringify(draft.asiLevels) !== JSON.stringify(DEFAULT_ASI_LEVELS) ? draft.asiLevels : undefined,
    levelFeatures: draft.levelFeatures.length > 0 ? draft.levelFeatures : undefined,
    levelChoices: serializeLeveledChoices(undefined, draft.levelChoices ?? [], id, { sourceKind: 'class', sourceRefId: id, classId: id }),
    rulesetId: draft.rulesetId,
  };
}

/** The draft's "Abilities needed" as the class record's multiclassPrerequisites, as the desktop compiles it; none named: undefined. */
function multiclassNeedsOf(draft: ClassDraft): MulticlassPrerequisites | undefined {
  const named = [...new Set((draft.multiclassNeeds ?? []).filter(a => ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(a)))];
  if (!named.length) return undefined;
  const asked = Math.trunc(Number(draft.multiclassNeedsMinimum ?? 13));
  const minimum = asked >= 1 && asked <= 30 ? asked : 13;
  return draft.multiclassNeedsAny ? named.map(ability => [{ ability, minimum }]) : [named.map(ability => ({ ability, minimum }))];
}

/** A class record's requirement read back into the builder (all of them, or any one; the first minimum). */
export function multiclassNeedsDraft(need: MulticlassPrerequisites | undefined): { abilities: Ability[]; minimum: number; any: boolean } {
  const options = (need ?? []).filter(o => Array.isArray(o) && o.length);
  return { abilities: [...new Set(options.flat().map(n => n.ability))], minimum: options[0]?.[0]?.minimum ?? 13, any: options.length > 1 };
}

// ── subclass ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SubclassDraft = {
  name: string;
  origin?: ContentOrigin;
  classId: string;
  levelFeatures: (DraftTrait & { level: number })[];
  rulesetId?: RulesetId;
};

/**
 * A new subclass for a draft (no earlier version to merge with): every authored feature compiled at its own level with the pools it
 * makes, and each entry carrying the parent class's hit die. The same compile the subclass builder runs for a new subclass.
 */
export function compileSubclassFields(draft: SubclassDraft, id: string, parentHitDie: 4 | 6 | 8 | 10 | 12) {
  const featureEdits: SubclassFeatureEdit[] = [];
  const localResources = new Map<string, string>();
  for (let level = 1; level <= 20; level++) {
    const usedIds = new Set<string>();
    for (const f of draft.levelFeatures.filter(x => x.level === level)) {
      const built = buildTraitFeature(f, { idPrefix: `${id}_l${level}`, sourceKind: 'subclass', sourceRefId: id, level, usedIds, localResources });
      const grants: Grant[] = [{ kind: 'feature', value: built.feature }];
      if (built.resource) grants.push({ kind: 'resource', value: built.resource });
      for (const feature of built.extraFeatures ?? []) grants.push({ kind: 'feature', value: feature });
      for (const resource of built.extraResources ?? []) grants.push({ kind: 'resource', value: resource });
      for (const upgrade of built.resourceUpgrades ?? []) grants.push({ kind: 'resource_upgrade', value: upgrade });
      featureEdits.push({ level, grants });
    }
  }
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    classId: draft.classId,
    entries: mergeSubclassEntries(undefined, featureEdits, [], parentHitDie, id),
    rulesetId: draft.rulesetId,
  };
}

// ── race and background ──────────────────────────────────────────────────────────────────────────────────────────────────

export type RaceDraft = {
  name: string;
  origin?: ContentOrigin;
  age: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large';
  speed: string;
  languages: string;
  description: string;
  abiBonuses: Record<Ability, string>;
  senses: { type: string; range: number; note?: string }[];
  movement: Record<string, number>;
  traits: DraftTrait[];
  subraces: DraftSubrace[];
  /** Choices the species asks of the player (expertise, tool, language). */
  pendingChoices?: LosslessDraftChoice[];
  rulesetId?: RulesetId;
};

const ABILITY_KEYS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** The features a race builder makes itself (ability bonuses, speed, senses, movement) before the authored traits. */
export function raceGeneratedFeatures(draft: Pick<RaceDraft, 'abiBonuses' | 'speed' | 'senses' | 'movement'>, id: string): Feature[] {
  const features: Feature[] = [];
  const asiEffects = ABILITY_KEYS
    .filter(a => parseInt(draft.abiBonuses[a], 10) > 0)
    .map(a => ({ type: 'stat_modifier' as const, target: a, operation: 'add' as const, value: parseInt(draft.abiBonuses[a], 10), condition: null }));
  if (asiEffects.length > 0) {
    features.push({
      id: `${id}_asi`, name: 'Ability Score Increase', description: 'Your ability scores increase as shown.',
      source: { kind: 'race', refId: id }, level: null, actions: [], choices: [], passive: true, effects: asiEffects,
    });
  }
  const speedVal = parseInt(draft.speed, 10) || 30;
  if (speedVal !== 30) {
    features.push({
      id: `${id}_speed`, name: 'Speed', description: `Your base walking speed is ${speedVal} feet.`,
      source: { kind: 'race', refId: id }, level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: speedVal, condition: null }],
    });
  }
  if (draft.senses.length > 0) {
    features.push({
      id: `${id}_senses`, name: 'Senses',
      description: draft.senses.map(s => `${SENSE_TYPES.find(t => t.key === s.type)?.label ?? s.type} ${s.range} ft` + (s.note ? ` (${s.note})` : '')).join('; '),
      source: { kind: 'race', refId: id }, level: null, actions: [], choices: [], passive: true,
      effects: draft.senses.map(s => ({
        type: 'grant_sense' as const, target: 'senses', operation: 'add' as const, value: null, condition: null,
        senseType: s.type as never, senseRange: s.range, senseNote: s.note,
      })),
    });
  }
  const moveEntries = Object.entries(draft.movement).filter(([, v]) => v > 0);
  if (moveEntries.length > 0) {
    features.push({
      id: `${id}_movement`, name: 'Movement',
      description: moveEntries.map(([t, v]) => `${MOVE_TYPES.find(m => m.key === t)?.label ?? t} ${v} ft`).join('; '),
      source: { kind: 'race', refId: id }, level: null, actions: [], choices: [], passive: true,
      effects: moveEntries.map(([t, v]) => ({
        type: 'grant_movement' as const, target: 'movement', operation: 'add' as const, value: null, condition: null,
        movementType: t as never, movementRange: v,
      })),
    });
  }
  return features;
}

/** A new race for a draft (no earlier version to merge with). Choices a race asks of the player are not authored here. */
export function compileRaceFields(draft: RaceDraft, id: string) {
  const generated = raceGeneratedFeatures(draft, id);
  const serialized = serializeDraftTraits({
    originalFeatures: [], originalDrafts: [], editedDrafts: draft.traits,
    idPrefix: id, sourceKind: 'race', sourceRefId: id, generatedFeatures: generated, generatedResources: [], generatedIds: generated.map(f => f.id),
  });
  const subraces: Subrace[] = draft.subraces.map(sr => buildSubrace(sr, id));
  const languages = draft.languages.trim() ? draft.languages.split(',').map(l => l.trim()).filter(Boolean) : undefined;
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    features: serialized.features,
    resources: serialized.resources.length > 0 ? serialized.resources : undefined,
    subraces: subraces.length > 0 ? subraces : undefined,
    age: draft.age.trim() || undefined,
    size: draft.size,
    languages,
    pendingChoices: serializeLosslessChoices(undefined, draft.pendingChoices ?? [], RACE_CHOICE_PREFIX),
    rulesetId: draft.rulesetId,
    homebrewDraft: {
      speed: draft.speed, description: draft.description, abiBonuses: draft.abiBonuses, senses: draft.senses, movement: draft.movement,
      traits: draft.traits, subraces: draft.subraces, pendingChoices: draft.pendingChoices ?? [], traitOwners: serialized.owners,
    },
  };
}

export type BackgroundDraft = {
  name: string;
  origin?: ContentOrigin;
  skills: SkillName[];
  toolProfs: string[];
  languages: string;
  equipmentNote: string;
  features: { localId: string; name: string; description: string }[];
  /** Choices the background asks of the player (expertise, tool, language). */
  pendingChoices?: LosslessDraftChoice[];
  rulesetId?: RulesetId;
};

/** The features a background builder makes itself: skills, tools, languages and equipment. */
export function backgroundGeneratedFeatures(draft: Pick<BackgroundDraft, 'skills' | 'toolProfs' | 'languages' | 'equipmentNote'>, id: string): Feature[] {
  const out: Feature[] = [];
  const base = { source: { kind: 'background' as const, refId: id }, level: null, actions: [], choices: [], passive: true };
  if (draft.skills.length > 0) {
    out.push({
      ...base, id: `${id}_skills`, name: 'Skill Proficiencies',
      description: `You are proficient in ${draft.skills.map(s => SKILLS.find(x => x.id === s)?.label ?? s).join(' and ')}.`,
      effects: draft.skills.map(s => ({ type: 'grant_proficiency' as const, target: `skill:${s}`, operation: 'add' as const, value: null, condition: null })),
    });
  }
  if (draft.toolProfs.length > 0) {
    out.push({
      ...base, id: `${id}_tools`, name: 'Tool Proficiencies',
      description: `You are proficient with ${draft.toolProfs.join(', ')}.`,
      effects: [{ type: 'grant_proficiency', target: 'tools', operation: 'add', value: draft.toolProfs, condition: null }],
    });
  }
  if (draft.languages.trim()) {
    out.push({ ...base, id: `${id}_languages`, name: 'Languages', description: `You know ${draft.languages.trim()}.`, effects: [] });
  }
  if (draft.equipmentNote.trim()) {
    out.push({ ...base, id: `${id}_equipment`, name: 'Equipment', description: draft.equipmentNote.trim(), effects: [] });
  }
  return out;
}

export function compileBackgroundFields(draft: BackgroundDraft, id: string) {
  const generated = backgroundGeneratedFeatures(draft, id);
  const serialized = serializeBackgroundFeatures(undefined, [], draft.features, id, generated, generated.map(f => f.id));
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    features: serialized.features,
    pendingChoices: serializeLosslessChoices(undefined, draft.pendingChoices ?? [], BACKGROUND_CHOICE_PREFIX),
    rulesetId: draft.rulesetId,
    homebrewDraft: {
      skills: draft.skills, toolProfs: draft.toolProfs, languages: draft.languages, equipmentNote: draft.equipmentNote,
      features: draft.features, pendingChoices: draft.pendingChoices ?? [], traitOwners: serialized.owners,
    },
  };
}

// ── condition ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ConditionDraft = {
  name: string;
  origin?: ContentOrigin;
  description: string;
  traits: DraftTrait[];
  rulesetId?: RulesetId;
};

/**
 * The fields a condition builder saves for a draft: id, name, description and one feature per trait (a trait's own extra features
 * follow it). A condition has no resource pools, so a trait that would make one makes none here. `features` replaces the compiled
 * traits (an edit that kept the record's own mechanics).
 */
export function compileConditionFields(draft: ConditionDraft, id: string, features?: Condition['features']) {
  let compiled: Condition['features'] = features ?? [];
  if (!features) {
    const usedIds = new Set<string>();
    for (const t of draft.traits) {
      const { feature, extraFeatures } = buildTraitFeature(t, { idPrefix: id, sourceKind: 'condition', sourceRefId: id, level: null, usedIds });
      compiled.push(feature, ...(extraFeatures ?? []));
      usedIds.add(feature.id);
    }
  }
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    description: draft.description.trim(),
    features: compiled,
    rulesetId: draft.rulesetId,
  };
}

// ── spell list ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SpellListDraft = {
  name: string;
  description: string;
  /** The class this list is suggested for; null or absent for none. */
  classId: string | null;
  spellIds: string[];
  rulesetId?: RulesetId;
};

/** The fields a spell list builder saves for a draft. */
export function compileSpellListFields(draft: SpellListDraft, id: string): SpellList {
  return {
    id,
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    classId: draft.classId ?? undefined,
    spellIds: draft.spellIds,
    rulesetId: draft.rulesetId,
  };
}

// ── monster ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type MonsterDraft = {
  name: string;
  origin?: ContentOrigin;
  cr: number;
  size: MonsterTemplate['size'];
  type: string;
  alignment: string;
  stats: Record<Ability, string>;
  hpDice: string;
  hpAverage: string;
  acValue: string;
  acSource: string;
  speed: string;
  savingThrows: Ability[];
  senses: string;
  languages: string;
  legendaryActions: string;
  traits: DraftTrait[];
  rulesetId?: RulesetId;
};

/** What an edit keeps of the record it opened: traits not touched pass through as they were, and what the builder has no field for. */
export type MonsterKept = {
  /** The compiled feature an untouched trait stands for (its own effects), or none to compile the trait. */
  featureFor?: (trait: DraftTrait) => Feature | undefined;
  skills?: MonsterTemplate['skills'];
  resources?: ResourceGrant[];
};

const toInt = (text: string, fallback: number) => parseInt(text, 10) || fallback;
const splitList = (text: string) => (text.trim() ? text.split(',').map(s => s.trim()).filter(Boolean) : []);

/** The fields a monster builder saves for a draft: a stat block, with each trait compiled to a feature and its limited-use pools. */
export function compileMonsterFields(draft: MonsterDraft, id: string, kept: MonsterKept = {}): MonsterTemplate {
  const features: Feature[] = [];
  const resources: ResourceGrant[] = [];
  const usedIds = new Set<string>();
  for (const t of draft.traits) {
    const original = kept.featureFor?.(t);
    if (original) {
      features.push(original);
      usedIds.add(original.id);
      continue;
    }
    const { feature, resource, extraFeatures, extraResources } = buildTraitFeature(t, { idPrefix: id, sourceKind: 'campaign', sourceRefId: id, level: null, usedIds });
    features.push(feature, ...(extraFeatures ?? []));
    if (resource) resources.push(resource);
    resources.push(...(extraResources ?? []));
  }
  return {
    id,
    name: draft.name.trim(),
    origin: cleanOriginOf(draft.origin),
    cr: draft.cr,
    size: draft.size,
    type: draft.type.trim(),
    alignment: draft.alignment.trim(),
    stats: {
      str: toInt(draft.stats.str, 10), dex: toInt(draft.stats.dex, 10), con: toInt(draft.stats.con, 10),
      int: toInt(draft.stats.int, 10), wis: toInt(draft.stats.wis, 10), cha: toInt(draft.stats.cha, 10),
    },
    hp: { dice: draft.hpDice.trim(), average: toInt(draft.hpAverage, 1) },
    ac: { value: toInt(draft.acValue, 10), source: draft.acSource.trim() },
    speed: parseInt(draft.speed, 10) || 0,
    features,
    savingThrows: draft.savingThrows,
    skills: kept.skills ?? {},
    senses: splitList(draft.senses),
    languages: splitList(draft.languages),
    legendaryActions: draft.legendaryActions.trim() ? parseInt(draft.legendaryActions, 10) : undefined,
    resources: resources.length > 0 ? resources : kept.resources,
    rulesetId: draft.rulesetId,
  };
}

// ── subrace (a standalone one, attached to an existing species) ───────────────────────────────────────────────────────────

export type SubraceDraft = {
  name: string;
  abiBonuses: Record<Ability, string>;
  traits: DraftTrait[];
  pendingChoices?: LosslessDraftChoice[];
  origin?: ContentOrigin;
  rulesetId?: RulesetId;
};

/** The first of a species' own traits is a generated Ability Score Increase; a standalone subrace's id is the species' id and its name. */
export function compileSubraceFields(draft: SubraceDraft, parentId: string, editing?: Subrace | null): Subrace {
  const named = { localId: 'draft', name: draft.name.trim(), abiBonuses: draft.abiBonuses, traits: draft.traits };
  const compiled = buildSubrace(named, parentId);
  const originalDraft = editing?.homebrewDraft as (Record<string, unknown> & { traitOwners?: never[] }) | undefined;
  const generatedIds = compiled.features.filter(f => f.id.endsWith('_asi')).map(f => f.id);
  const generated = compiled.features.filter(f => generatedIds.includes(f.id));
  const serialized = serializeDraftTraits({
    originalFeatures: editing?.features ?? [], originalResources: editing?.resources,
    originalDrafts: (originalDraft?.traits as DraftTrait[] | undefined) ?? [], editedDrafts: draft.traits, idPrefix: compiled.id,
    sourceKind: 'race', sourceRefId: compiled.id, generatedFeatures: generated, generatedIds, owners: originalDraft?.traitOwners,
  });
  return {
    ...compiled,
    rulesetId: draft.rulesetId,
    origin: cleanOriginOf(draft.origin),
    features: serialized.features,
    resources: serialized.resources.length ? serialized.resources : undefined,
    pendingChoices: serializeLosslessChoices(editing?.pendingChoices, draft.pendingChoices ?? [], RACE_CHOICE_PREFIX),
    homebrewDraft: { abiBonuses: draft.abiBonuses, traits: draft.traits, pendingChoices: draft.pendingChoices ?? [], traitOwners: serialized.owners },
  };
}
