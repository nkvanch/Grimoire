// Contracts CREATE-032 (unknown fields are preserved) and DATA-007 on this side: real characters, made from the SRD packs, carry a
// member this build does not know on EVERY record, and go through every state-changing engine operation. Two things must hold:
//  1. every record that still exists afterwards still carries its unknown member (nothing is dropped by rebuilding a record);
//  2. the unknown members change nothing: with them taken off, the result equals the result of the same operation without them.
// (The desktop app's test of the same requirement is tests/test_unknown_fields.cpp; the two apps open each other's characters.)
import { buildSrd51Pack, buildSrd521Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { getProgressionForClass } from '../../content/classes/progressions';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { applyDamage, applyHealing, recordDeathSave, startWildShape, endWildShape, playerEndTurn, startTurn, dropConcentration } from '../combat';
import { applyCondition, removeCondition } from '../conditions';
import { equipItem, unequipItem } from '../inventory';
import { takeRest, takeDawn, spendHitDie } from '../rest';
import { levelUpClass, addGold } from '../leveling';
import type { Entity, RulesetId } from '../types';

const MARK = 'x-unknown';
const file = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const packs = (): InstalledPack[] => [file(buildSrd521Pack()), file(buildSrd51Pack())] as InstalledPack[];
const R2014 = 'dnd5e-2014' as RulesetId;
const R2024 = 'dnd5e-2024' as RulesetId;
const STATS = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 10 };

type Made = { label: string; entity: Entity; ruleset: RulesetId };

function characters(): Made[] {
  const make = (ruleset: RulesetId, classId: string, raceId: string, backgroundId: string, level: number): Made => {
    const p = packContentProvider(packs(), ruleset);
    const entity = createCharacter(p, { id: `${classId}-${level}`, name: classId, classId, raceId, backgroundId, stats: STATS, level }, DEFAULT_RULES);
    return { label: `${classId} ${level}`, entity, ruleset };
  };
  return [
    make(R2014, 'fighter', 'human', 'acolyte', 5),
    make(R2014, 'wizard', 'elf', 'acolyte', 5),
    make(R2014, 'cleric', 'dwarf', 'acolyte', 3),
    make(R2014, 'druid', 'halfling', 'acolyte', 4),
    make(R2014, 'monk', 'human', 'acolyte', 5),
    make(R2024, 'fighter_2024', 'dwarf_2024', 'soldier_2024', 3),
  ];
}

// every object, by a path in which array entries are named by their id (as the desktop's test and nativeRoundTrip.test.ts name them)
function records(node: unknown, at: string, out: Map<string, Record<string, unknown>>): Map<string, Record<string, unknown>> {
  if (Array.isArray(node)) {
    node.forEach((el, i) => {
      const id = el && typeof el === 'object' ? ['id', 'instanceId', 'key', 'resourceId', 'itemId'].map(k => (el as Record<string, unknown>)[k]).find(v => typeof v === 'string') : undefined;
      records(el, at + (id !== undefined ? `[${id}]` : `[${i}]`), out);
    });
  } else if (node && typeof node === 'object') {
    let key = at;
    for (let n = 2; out.has(key); n++) key = `${at}#${n}`;
    out.set(key, node as Record<string, unknown>);
    for (const [k, v] of Object.entries(node)) if (k !== MARK) records(v, `${key}/${k}`, out);
  }
  return out;
}

const marked = (e: Entity): Entity => {
  const copy = file(e);
  for (const [path, rec] of records(copy, '', new Map())) rec[MARK] = path || '/';
  return copy;
};
const unmarked = (x: unknown): unknown => JSON.parse(JSON.stringify(x, (k, v) => (k === MARK ? undefined : v)));

// randomness and time pinned, so the run with unknown members and the run without them can be compared exactly
function deterministic<T>(run: () => T): T {
  let seed = 1;
  const random = jest.spyOn(Math, 'random').mockImplementation(() => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  try { return run(); } finally { random.mockRestore(); now.mockRestore(); }
}

// Two kinds of record are rebuilt by design and are not data: the computed blocks every recompute makes again from the character
// (`derived`, `actionCards`), and what a feature upgraded by its class (`upgradeOf`) takes from its new definition (its effects and
// source). The upgraded feature itself keeps the members of the earlier record the new definition does not set.
function rebuiltByDesign(path: string, before: Entity, after: Entity): boolean {
  if (/^\/(derived|actionCards)(\/|\[|$)/.test(path)) return true;
  const m = /^\/features\[([^\]]+)\]\/./.exec(path);
  if (!m) return false;
  const was = before.features.find(f => f.id === m[1]);
  const now = after.features.find(f => f.id === m[1]);
  return !!was && !!now && was.level !== now.level;   // the feature was replaced by a later level's definition
}

type Op = { name: string; run: (e: Entity, m: Made) => Entity };
const firstCarried = (e: Entity) => e.inventory.carried[0];
const OPS: Op[] = [
  { name: 'recompute', run: e => recomputeDerived(e, DEFAULT_RULES) },
  { name: 'damage', run: e => applyDamage(e, 5) },
  { name: 'healing', run: e => applyHealing(applyDamage(e, 5), 3) },
  { name: 'down, then death saves', run: e => recordDeathSave(recordDeathSave(applyDamage(e, 999), 'success'), 'failure') },
  { name: 'condition on', run: e => applyCondition(e, 'poisoned', 'test') },
  { name: 'condition on and off', run: e => removeCondition(applyCondition(e, 'poisoned', 'test'), 'poisoned') },
  { name: 'short rest', run: e => takeRest(applyDamage(e, 5), 'short') },
  { name: 'long rest', run: e => takeRest(applyDamage(e, 5), 'long') },
  { name: 'dawn', run: e => takeDawn(e) },
  { name: 'spend a hit die', run: e => spendHitDie(applyDamage(e, 5)) },
  { name: 'equip the first carried item', run: e => (firstCarried(e) ? equipItem(e, firstCarried(e).itemId, undefined, DEFAULT_RULES, firstCarried(e).id) : e) },
  { name: 'unequip the first equipped item', run: e => (e.inventory.equipped[0] ? unequipItem(e, e.inventory.equipped[0].itemId, DEFAULT_RULES, e.inventory.equipped[0].id) : e) },
  { name: 'gold', run: e => addGold(e, 7) },
  { name: 'start and end a turn', run: e => playerEndTurn(startTurn(e)) },
  { name: 'drop concentration', run: e => dropConcentration(e) },
  { name: 'wild shape on and off', run: e => endWildShape(startWildShape(e, 'wolf')) },
  { name: 'wild shape on', run: e => startWildShape(e, 'wolf') },
  {
    name: 'level up', run: (e, m) => {
      const p = packContentProvider(packs(), m.ruleset);
      const cls = p.getClass(e.identity.classId)!;
      return levelUpClass(e, cls.id, cls.rawProgression ?? getProgressionForClass(cls), DEFAULT_RULES, cls, p.classes());
    },
  },
];

describe('unknown members survive every engine operation and change nothing (CREATE-032)', () => {
  const made = characters();

  it('every character and operation runs, so the sweep covers what it claims', () => {
    expect(made).toHaveLength(6);
    for (const m of made) for (const op of OPS) expect(() => op.run(m.entity, m)).not.toThrow();
  });

  it('a record that is still there keeps its unknown member', () => {
    const lost: string[] = [];
    for (const m of made) {
      for (const op of OPS) {
        const before = marked(m.entity);
        const after = deterministic(() => op.run(file(before), m));
        for (const [path, rec] of records(after, '', new Map())) {
          const was = records(before, '', new Map()).get(path);
          if (was && was[MARK] !== undefined && rec[MARK] !== was[MARK] && !rebuiltByDesign(path, before, after)) lost.push(`${m.label} / ${op.name}: ${path || '/'}`);
        }
      }
    }
    expect(lost).toEqual([]);
  });

  it('with the unknown members taken off, the result is the same as without them', () => {
    const differ: string[] = [];
    for (const m of made) {
      for (const op of OPS) {
        const plain = deterministic(() => op.run(file(m.entity), m));
        const withUnknown = deterministic(() => op.run(marked(m.entity), m));
        if (JSON.stringify(unmarked(withUnknown)) !== JSON.stringify(unmarked(plain))) differ.push(`${m.label} / ${op.name}`);
      }
    }
    expect(differ).toEqual([]);
  });
});
