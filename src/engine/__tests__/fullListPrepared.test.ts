// A class that prepares from its whole list (2014 Paladin, Cleric, Druid; 2024 Cleric, Druid) gets no spells at
// creation: the Spells tab's "Prepare ... spells from the class list" records the spell as the class's and prepares it. Such a
// spell is castable; unprepared, it is not.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { grantEntitlement } from '../entitlements';
import { resolveSpellCastingContexts } from '../actionCards';
import type { Entity, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const paladin = (): Entity => recomputeDerived(createCharacter(provider, { id: 'p', name: 'P', classId: 'paladin', raceId: 'human',
  backgroundId: 'acolyte', stats: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 15 }, level: 5 }, DEFAULT_RULES), DEFAULT_RULES);
/** What the Prepare button does: the class's grant of the spell, and the spell prepared. */
const prepare = (e: Entity, id: string): Entity => {
  const g = grantEntitlement(e, { kind: 'spell_access', key: id, sourceKind: 'class', sourceId: 'paladin' });
  return recomputeDerived({ ...g, spellcasting: { ...g.spellcasting!, prepared: [...g.spellcasting!.prepared, id] } }, DEFAULT_RULES);
};

it('a 5th-level Paladin starts with slots and no spells (the gap the button fills)', () => {
  const p = paladin();
  expect(p.spellcasting?.slots['1'].total).toBeGreaterThan(0);
  expect([...p.spellcasting!.known, ...p.spellcasting!.prepared]).toEqual([]);
});

it('a spell prepared from the class list is castable through the class; unprepared it is not', () => {
  const p = prepare(paladin(), 'bless');
  const ctx = resolveSpellCastingContexts(p, 'bless').filter(c => c.sourceKind === 'class' && c.sourceId === 'paladin');
  expect(ctx.length).toBe(1);
  expect(ctx[0].legal).toBe(true);
  const unprepared = { ...p, spellcasting: { ...p.spellcasting!, prepared: [] } };
  expect(resolveSpellCastingContexts(unprepared, 'bless').find(c => c.sourceKind === 'class')?.legal).toBe(false);
});

describe('how many may be prepared (a warning on the sheet, never a block)', () => {
  const { preparedSpellCount } = require('../leveling') as typeof import('../leveling');
  const { buildSrd521Pack } = require('../../content/packs/srdPacks') as typeof import('../../content/packs/srdPacks');
  const p2014 = provider.classes();

  it('2014: casting ability modifier plus class level, half of it for a half caster, and what is prepared now', () => {
    expect(preparedSpellCount(paladin(), 'paladin', p2014)).toEqual({ prepared: 0, limit: 3 + 2 });   // CHA 15 + 1 (human) = +3, half of 5
    expect(preparedSpellCount(prepare(paladin(), 'bless'), 'paladin', p2014)).toEqual({ prepared: 1, limit: 5 });
    const cleric = recomputeDerived(createCharacter(provider, { id: 'c', name: 'C', classId: 'cleric', raceId: 'human', backgroundId: 'acolyte',
      stats: { str: 10, dex: 10, con: 14, int: 8, wis: 14, cha: 10 }, level: 5 }, DEFAULT_RULES), DEFAULT_RULES);
    expect(preparedSpellCount(cleric, 'cleric', p2014)?.limit).toBe(2 + 5);   // WIS 14 + 1 (human) = +2, full level
    expect(preparedSpellCount(cleric, 'sorcerer', p2014)).toBeNull();
  });

  it('2024: the class table', () => {
    const p24 = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())), JSON.parse(JSON.stringify(buildSrd521Pack()))] as InstalledPack[], 'dnd5e-2024' as RulesetId);
    const def = p24.classes().find(c => c.id === 'cleric_2024')!;
    expect(def.preparedSpellsByLevel?.length).toBe(20);
    const cleric = recomputeDerived(createCharacter(p24, { id: 'c', name: 'C', classId: 'cleric_2024', raceId: 'human_2024', backgroundId: 'acolyte_2024',
      stats: { str: 10, dex: 10, con: 14, int: 8, wis: 14, cha: 10 }, level: 5 }, DEFAULT_RULES), DEFAULT_RULES);
    expect(preparedSpellCount(cleric, 'cleric_2024', p24.classes())?.limit).toBe(def.preparedSpellsByLevel![4]);
  });
});
