// Leveling for the native-parity fixtures: characters built by the app's own creation path from the SRD packs, and sequences of
// level-ups (single class, subclass merged in, multiclass, every hit-point mode). Pure data plus the executor both engines are held to.
import type { CampaignRules, CharClass, Entity } from '../types';
import { DEFAULT_RULES } from '../defaults';
import { levelUpClass } from '../leveling';
import { getClassLevels } from '../multiclass';
import { createCharacter } from '../../content/provider/createCharacter';
import { packContentProvider, type InstalledPack } from '../../content/provider/contentProvider';
import { getProgressionForClass, mergeSubclassIntoProgression } from '../../content/classes/progressions';
import type { ContentProvider } from '../../content/provider/contentProvider';

export type LevelStep = { classId: string; roll?: number };
export type LevelRulesArg = { hpMode: 'fixed' | 'rolled' | 'max'; customRules: Record<string, unknown> };
export type LevelCase = { name: string; entity: Entity; rules: LevelRulesArg; steps: LevelStep[] };

const STATS = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 8 };

export type Providers = { p2014: ContentProvider; p2024: ContentProvider };

export function makeProviders(packs: InstalledPack[]): Providers {
  const copy = () => JSON.parse(JSON.stringify(packs)) as InstalledPack[];
  return {
    p2014: packContentProvider(copy(), 'dnd5e-2014' as never),
    p2024: packContentProvider(copy(), 'dnd5e-2024' as never),
  };
}

const rulesFor = (r: LevelRulesArg): CampaignRules => ({ ...DEFAULT_RULES, hpMode: r.hpMode, customRules: r.customRules });

export function providerFor(entity: Entity, providers: Providers): ContentProvider {
  return entity.rulesetId === 'dnd5e-2024' ? providers.p2024 : providers.p2014;
}

/** Runs the steps the way the sheet's Level up button does: progression from the class, the class's own subclass merged in. */
export type LevelExtras = { classes?: CharClass[]; subclasses?: { id: string; classId: string; entries: unknown[] }[] };

export function runLevelSteps(entity: Entity, steps: LevelStep[], rulesArg: LevelRulesArg, provider: ContentProvider, extras?: LevelExtras) {
  const rules = rulesFor(rulesArg);
  const defs = [...(provider.classes() as CharClass[]), ...(extras?.classes ?? [])];
  let e = entity;
  const log: unknown[] = [];
  for (const step of steps) {
    const cls = defs.find(c => c.id === step.classId);
    if (!cls) throw new Error(`class ${step.classId} is not in the packs`);
    const existing = getClassLevels(e).find(c => c.classId === step.classId);
    let progression = cls.rawProgression ?? getProgressionForClass(cls);
    if (existing?.subclassId) {
      const sub = provider.getSubclass(existing.subclassId) ?? extras?.subclasses?.find(x => x.id === existing.subclassId);
      if (sub) progression = mergeSubclassIntoProgression(progression, sub as never);
    }
    e = levelUpClass(e, step.classId, progression, rules, cls, defs, step.roll);
    log.push({
      classId: step.classId, level: e.identity.level,
      hp: e.resources.hp, hitDice: e.resources.hitDice,
      slots: e.spellcasting?.slots ?? null, pactSlots: e.spellcasting?.pactSlots ?? null,
    });
  }
  return { entity: e, log };
}

const repeat = (classId: string, n: number, rolls?: number[]): LevelStep[] =>
  Array.from({ length: n }, (_, i) => (rolls ? { classId, roll: rolls[i % rolls.length] } : { classId }));

const FIXED: LevelRulesArg = { hpMode: 'fixed', customRules: {} };
const MAX: LevelRulesArg = { hpMode: 'max', customRules: {} };
const ROLLED: LevelRulesArg = { hpMode: 'rolled', customRules: {} };

export function buildLevelCases(providers: Providers): LevelCase[] {
  const out: LevelCase[] = [];
  const spec = (p: ContentProvider, classId: string, level: number, subclassId?: string) => ({
    id: `c-${classId}-${level}`, name: `Test ${classId}`, classId,
    raceId: p.races()[0].id, backgroundId: p.backgrounds()[0].id, stats: STATS, level, subclassId,
  });
  const build = (p: ContentProvider, classId: string, level: number, subclassId?: string) =>
    createCharacter(p, spec(p, classId, level, subclassId), DEFAULT_RULES);

  for (const [tag, p] of [['5e', providers.p2014], ['5e24', providers.p2024]] as const) {
    for (const cls of p.classes()) {
      // from level 1 straight to 20: no subclass, so its choice just stays queued
      out.push({ name: `level-${tag}-${cls.id}-1-to-20`, entity: build(p, cls.id, 1), rules: FIXED, steps: repeat(cls.id, 19) });
      // from level 3 with the first subclass bound, so its own progression merges in
      const sub = p.subclassesOf(cls.id)[0];
      if (sub) {
        out.push({
          name: `level-${tag}-${cls.id}-sub-3-to-20`,
          entity: build(p, cls.id, 3, sub.id), rules: MAX, steps: repeat(cls.id, 17),
        });
      }
    }
  }

  // hit point modes, one step at a time on one class
  const p14 = providers.p2014;
  const fighter4 = build(p14, 'fighter', 4);
  out.push({ name: 'level-hp-fixed', entity: fighter4, rules: FIXED, steps: repeat('fighter', 1) });
  out.push({ name: 'level-hp-max', entity: fighter4, rules: MAX, steps: repeat('fighter', 1) });
  out.push({ name: 'level-hp-rolled', entity: fighter4, rules: ROLLED, steps: repeat('fighter', 3, [7, 1, 10]) });
  out.push({
    name: 'level-hp-rolled-min-half-die', entity: fighter4,
    rules: { hpMode: 'rolled', customRules: { hpMinHalfDie: true } }, steps: repeat('fighter', 4, [1, 2, 4, 9]),
  });
  out.push({
    name: 'level-bonus-feat-every-level', entity: fighter4,
    rules: { hpMode: 'fixed', customRules: { bonusFeatEveryLevel: true } }, steps: repeat('fighter', 3),
  });

  // multiclassing: a new class takes the reduced proficiency table; spell slots follow the combined caster level
  const wiz5 = build(p14, 'wizard', 5, 'evocation');
  out.push({
    name: 'level-mc-wizard-fighter', entity: wiz5, rules: FIXED,
    steps: [{ classId: 'fighter' }, { classId: 'fighter' }, { classId: 'wizard' }, { classId: 'fighter' }],
  });
  out.push({
    name: 'level-mc-wizard-cleric-rogue', entity: wiz5, rules: MAX,
    steps: [{ classId: 'cleric' }, { classId: 'cleric' }, { classId: 'rogue' }, { classId: 'wizard' }, { classId: 'cleric' }],
  });
  out.push({
    name: 'level-mc-warlock-sorcerer', entity: build(p14, 'warlock', 3), rules: FIXED,
    steps: [{ classId: 'sorcerer' }, { classId: 'sorcerer' }, { classId: 'warlock' }, { classId: 'warlock' }, { classId: 'sorcerer' }],
  });
  out.push({
    name: 'level-mc-paladin-ranger-druid', entity: build(p14, 'paladin', 5), rules: FIXED,
    steps: [{ classId: 'ranger' }, { classId: 'ranger' }, { classId: 'ranger' }, { classId: 'druid' }, { classId: 'paladin' }],
  });
  out.push({
    name: 'level-mc-monk-barbarian-bard', entity: build(p14, 'monk', 2), rules: ROLLED,
    steps: [{ classId: 'barbarian', roll: 5 }, { classId: 'bard', roll: 2 }, { classId: 'monk', roll: 6 }, { classId: 'bard', roll: 3 }],
  });
  const p24 = providers.p2024;
  out.push({
    name: 'level-mc-2024-wizard-cleric', entity: build(p24, 'wizard_2024', 4), rules: FIXED,
    steps: [{ classId: 'cleric_2024' }, { classId: 'cleric_2024' }, { classId: 'wizard_2024' }],
  });
  out.push({
    name: 'level-mc-2024-fighter-warlock', entity: build(p24, 'fighter_2024', 3), rules: FIXED,
    steps: [{ classId: 'warlock_2024' }, { classId: 'warlock_2024' }, { classId: 'fighter_2024' }],
  });
  return out;
}
