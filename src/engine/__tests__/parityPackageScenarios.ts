// Package import for the native-parity fixtures: a .grimoire-pack file, the homebrew already on the device, the choices the person makes
// on the review screen, and what the app does with them (checks, conflicts, the plan that is saved). The executors are the app's own
// code (engine/packageValidation.ts, engine/packageConflicts.ts).
import type { DraftTrait } from '../types';
import {
  compileSpellFields, compileItemFields, compileFeatFields, compileRaceFields, compileBackgroundFields, compileConditionFields,
  compileClassFields, compileSubclassFields, compileSubraceFields, compileSpellListFields, compileMonsterFields,
} from '../../content/homebrewCompile';
import { validatePackageForImport } from '../packageValidation';
import { detectConflictsDetailed, planPackageImport, type ConflictResolution, type PackageConflict } from '../packageConflicts';
import type { GrimoirePack } from '../backup';
import { trait } from './parityHomebrewScenarios';
import { buildSpellCases, buildItemCases, buildFeatCases, buildRaceCases, buildBackgroundCases, buildConditionCases, buildClassCases, buildSubclassCases } from './parityHomebrewScenarios';
import { buildSubraceCases } from './paritySubraceScenarios';
import { buildSpellListCases } from './paritySpellListScenarios';
import { buildMonsterCases } from './parityMonsterScenarios';

type Rec = Record<string, unknown> & { id: string; name: string };
type Homebrew = Record<string, Rec[]>;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const pick = <T extends { name: string }>(cases: T[], name: string): T => {
  const c = cases.find(x => x.name === name);
  if (!c) throw new Error(`no case ${name}`);
  return c;
};

/** A family of records that refer to one another, built by the app's own compilers. */
export function familyRecords(): Homebrew {
  const spell = pick(buildSpellCases(), 'plain');
  const item = pick(buildItemCases(), 'weapon');
  const feat = pick(buildFeatCases(), 'plain');
  const race = pick(buildRaceCases(), 'full');
  const bg = pick(buildBackgroundCases(), 'full');
  const cond = pick(buildConditionCases(), 'one-trait');
  const cls = pick(buildClassCases(), 'full-caster-spellbook');
  const sub = pick(buildSubclassCases(), 'features');
  const subrace = pick(buildSubraceCases(), 'scores-and-traits');
  const list = pick(buildSpellListCases(), 'for-a-class');
  const monster = pick(buildMonsterCases(), 'minimal');

  const grant = (name: string, cantrip: string): DraftTrait => trait(name, { effectKind: 'spell_grant', spellGrantCantripId: cantrip, spellGrantAbility: 'cha' });
  const classFields = compileClassFields({
    ...cls.draft, startingEquipment: [item.id], spellSource: `list:${list.id}`,
    levelFeatures: [...(cls.draft.levelFeatures ?? []), { ...grant('Spark Lore', spell.id), level: 5 }],
  } as never, cls.id);
  const subclassFields = compileSubclassFields({
    ...sub.draft, classId: cls.id,
    levelFeatures: [{ ...grant('Ember Gift', spell.id), level: 3 }],
  } as never, sub.id, sub.hitDie);
  const raceFields = compileRaceFields({ ...race.draft, traits: [...race.draft.traits, grant('Inner Spark', spell.id)] } as never, race.id);
  const subraceFields = compileSubraceFields({ ...subrace.draft, traits: [...subrace.draft.traits, grant('Subtle Spark', spell.id)] } as never, race.id);
  const featFields = compileFeatFields({ ...feat.draft, trait: grant('Spark Feat', spell.id) } as never, feat.id);
  const listFields = compileSpellListFields({ ...list.draft, spellIds: [spell.id, 'fireball'] } as never, list.id);

  return {
    races: [raceFields as unknown as Rec],
    subraces: [subraceFields as unknown as Rec],
    // the class builder adds the (empty) feature list itself when it saves
    classes: [{ ...classFields, features: [] } as unknown as Rec],
    subclasses: [subclassFields as unknown as Rec],
    spells: [compileSpellFields(spell.draft, spell.id) as unknown as Rec],
    backgrounds: [compileBackgroundFields(bg.draft, bg.id) as unknown as Rec],
    items: [compileItemFields(item.draft, item.id) as unknown as Rec],
    feats: [featFields as unknown as Rec],
    monsters: [compileMonsterFields(monster.draft, monster.id) as unknown as Rec],
    conditions: [compileConditionFields(cond.draft, cond.id) as unknown as Rec],
    spellLists: [listFields as unknown as Rec],
  };
}

const TYPE_OF_KEY: Record<string, string> = {
  races: 'race', subraces: 'subrace', classes: 'class', subclasses: 'subclass', spells: 'spell', backgrounds: 'background',
  features: 'feature', items: 'item', feats: 'feat', monsters: 'monster', conditions: 'condition', spellLists: 'spellList',
};

function packOf(homebrew: Homebrew, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1, schemaVersion: 1, packType: 'content-pack', createdAt: 1, modifiedAt: 1, appVersion: '1.0.0', deviceId: null,
    characters: [], homebrew, packageId: 'pkg_fixture', name: 'Ash Kit', author: 'A. Smith', description: 'A little of everything.',
    packageVersion: '1.2.0', compatibleRulesets: [], contents: [], media: [], ...over,
  };
}

export type PackageCase = {
  name: string;
  pack: unknown;
  local: { type: string; item: Rec }[];
  official: { type: string; id: string }[];
  knownRulesets: string[];
  resolutions: Record<string, ConflictResolution>;
};

const KNOWN = ['dnd5e-2014', 'dnd5e-2024'];

export function buildPackageCases(): PackageCase[] {
  const family = familyRecords();
  const all = (): Homebrew => clone(family);
  const localOf = (hb: Homebrew) => Object.entries(hb).flatMap(([key, list]) => list.map(item => ({ type: TYPE_OF_KEY[key], item })));
  const key = (type: string, id: string) => `${type}:${id}`;
  const renamed = (hb: Homebrew, type: string): Homebrew => {
    const out = clone(hb);
    for (const [k, list] of Object.entries(out)) if (TYPE_OF_KEY[k] === type) for (const r of list) r.name = `${r.name} (local edit)`;
    return out;
  };
  const cases: PackageCase[] = [];
  const add = (name: string, pack: unknown, extra: Partial<PackageCase> = {}) =>
    cases.push({ name, pack, local: [], official: [], knownRulesets: KNOWN, resolutions: {}, ...extra });

  // ── what is checked ──
  add('fresh', packOf(all()));
  add('identical-reimport', packOf(all()), { local: localOf(all()) });
  add('mixed-conflicts', packOf(all()), {
    local: [...localOf(renamed(renamed(all(), 'class'), 'race')).filter(e => ['class', 'race'].includes(e.type)),
      ...localOf(all()).filter(e => e.type === 'spell' || e.type === 'subclass')],
    resolutions: { [key('class', 'glyphwright')]: 'copy', [key('race', 'pandafolk')]: 'replace', [key('subclass', 'order_of_embers')]: 'keep_local' },
  });
  {
    // every cross-reference in the family points at something that is itself copied
    const changed = all();
    for (const list of Object.values(changed)) for (const r of list) r.name = `${r.name} v0`;
    const resolutions: Record<string, ConflictResolution> = {};
    for (const [k, list] of Object.entries(family)) for (const r of list) resolutions[key(TYPE_OF_KEY[k], r.id)] = 'copy';
    add('copy-everything', packOf(all()), { local: localOf(changed), resolutions });
  }
  {
    const changed = all();
    for (const r of changed.spells) r.name = 'Local spark';
    const resolutions: Record<string, ConflictResolution> = { [key('spell', family.spells[0].id)]: 'copy' };
    add('copy-the-spell-only', packOf(all()), { local: localOf(changed), resolutions });
  }
  {
    // a class that carries its own progression: known spells, a starting item, a feature that casts and applies a condition
    const hb = all();
    const cls = hb.classes[0] as Record<string, unknown>;
    cls.rawProgression = {
      classId: cls.id, entries: [{ level: 1, hpDie: 8, grants: [
        { kind: 'known_spells', value: { spellIds: [family.spells[0].id, 'shield'], cantripIds: ['light'], note: 'dropped by a rewrite' } },
        { kind: 'starting_item', value: family.items[0].id },
        { kind: 'feature', value: {
          id: 'raw_feature', name: 'Raw Feature', description: 'x', source: { kind: 'class', refId: cls.id }, level: 1, actions: [], choices: [], passive: false,
          effects: [{ type: 'grant_spell', target: 'spells', operation: 'add', value: null, condition: null, spellIds: [family.spells[0].id], cantripIds: [] }],
          abilityEffects: [{ type: 'cast_spell', spellId: family.spells[0].id }, { type: 'apply_condition', conditionId: family.conditions[0].id }],
        } },
      ] }],
    };
    const changed = all();
    for (const r of [...changed.spells, ...changed.items, ...changed.conditions]) r.name = `${r.name} v0`;
    const resolutions: Record<string, ConflictResolution> = {};
    for (const r of family.spells) resolutions[key('spell', r.id)] = 'copy';
    for (const r of family.items) resolutions[key('item', r.id)] = 'copy';
    for (const r of family.conditions) resolutions[key('condition', r.id)] = 'copy';
    add('copy-through-raw-progression', packOf(hb), { local: localOf(changed), resolutions });
  }
  {
    const hb = all();
    const changed = all();
    for (const r of changed.races) r.name = 'Old Folk';
    const resolutions: Record<string, ConflictResolution> = { [key('race', family.races[0].id)]: 'copy' };
    add('copy-the-parent-race', packOf(hb), { local: localOf(changed), resolutions });
  }

  // ── what is warned about, and what is refused ──
  add('unsupported-ruleset', packOf(all(), { compatibleRulesets: ['dnd5e-2014', 'pf2e'] }));
  add('rulesets-derived-from-records', packOf({ spells: [{ ...clone(family.spells[0]), rulesetId: 'osr-1981' }] }));
  add('missing-dependency', packOf({
    subraces: [{ ...clone(family.subraces[0]), parentId: 'ghost_race' }],
    subclasses: [{ ...clone(family.subclasses[0]), classId: 'ghost_class' }],
    classes: [{ ...clone(family.classes[0]), startingEquipment: ['ghost_sword'], spellListSource: { kind: 'list', listId: 'ghost_list' } }],
  }));
  add('official-dependency-is-satisfied', packOf({
    subraces: [{ ...clone(family.subraces[0]), parentId: 'elf' }],
    subclasses: [{ ...clone(family.subclasses[0]), classId: 'fighter' }],
  }), { official: [{ type: 'race', id: 'elf' }, { type: 'class', id: 'fighter' }] });
  add('dependency-found-locally', packOf({ subraces: [clone(family.subraces[0])] }), { local: localOf({ races: clone(family.races) }) });
  add('blocked-newer-format', packOf(all(), { formatVersion: 2 }));
  add('blocked-newer-schema', packOf(all(), { schemaVersion: 9 }));
  add('blocked-wrong-type', packOf(all(), { packType: 'something-else' }));
  add('blocked-no-characters', packOf(all(), { characters: 'none' }));
  add('blocked-not-an-object', 'just text');
  add('blocked-unknown-content-key', packOf({ ...all(), vehicles: [{ id: 'cart', name: 'Cart' }] }));
  add('blocked-duplicate-ids', packOf({ spells: [clone(family.spells[0]), clone(family.spells[0])], items: [clone(family.items[0]), clone(family.items[0])] }));
  add('blocked-invalid-content', packOf({ items: [{ id: 'nameless_item', name: '', category: 'gear' }], spells: [{ id: 'broken_spell' } as never] }));
  add('blocked-subrace-without-parent', packOf({ subraces: [{ ...clone(family.subraces[0]), parentId: '' }], subclasses: [{ ...clone(family.subclasses[0]), classId: undefined } as never] }));
  add('blocked-too-many-entries', packOf({ spells: Array.from({ length: 2001 }, (_, i) => ({ id: `s${i}`, name: `S ${i}` })) }));
  return cases;
}

function mockIds<T>(run: () => T): T {
  const now = Date.now;
  const random = Math.random;
  Date.now = () => 1000;
  Math.random = () => 0.5;
  try { return run(); } finally { Date.now = now; Math.random = random; }
}

export function runPackageCase(c: PackageCase) {
  const localMap = new Map(c.local.map(e => [`${e.type}:${e.item.id}`, e.item]));
  const lookup = (ref: { type: string; id: string }) => localMap.get(`${ref.type}:${ref.id}`) as never;
  const official = new Set(c.official.map(o => `${o.type}:${o.id}`));
  const validation = validatePackageForImport(c.pack, new Set(c.knownRulesets), lookup, ref => official.has(`${ref.type}:${ref.id}`));
  if (validation.blocking.length > 0) return { blocking: validation.blocking, issues: [], conflicts: [], identical: [], plan: null };

  const pack = c.pack as GrimoirePack;
  const { conflicts, identical } = detectConflictsDetailed(pack.homebrew, (type, id) => lookup({ type, id }));
  const resolutions = new Map(Object.entries(c.resolutions));
  const plan = mockIds(() => planPackageImport(pack, conflicts as PackageConflict[], resolutions as never, identical));
  const project = (e: (typeof plan.toSave)[number]) => ({ type: e.type, originalId: e.originalId, finalId: e.finalId, resolution: e.resolution, item: e.item });
  return {
    blocking: [],
    issues: validation.issues.map(i => ({ code: i.code, severity: i.severity, message: i.message, affectedId: i.affectedId ?? null })),
    conflicts,
    identical,
    plan: {
      toSave: plan.toSave.map(project),
      skipped: plan.skipped.map(e => ({ type: e.type, originalId: e.originalId, finalId: e.finalId, resolution: e.resolution })),
    },
  };
}
