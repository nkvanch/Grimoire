// Defense ("while you are wearing armor, +1 AC") is answered from what the character wears, never asked: the question was a fact
// the engine already knows (pipeline.ts OBSERVED_SITUATIONALS). Works for a character built before, whose feature still asks.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import type { Entity, FeatureInstance, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const defense: FeatureInstance = {
  id: 'fighting_style_srd51_defense', name: 'Fighting Style: Defense', description: '', source: { kind: 'class', refId: 'fighter' },
  level: 1, actions: [], choices: [], passive: true, isActive: true,
  effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null,
    situational: { id: 'fighting_style_defense_armored', question: 'Are you wearing armor?' } }],
} as unknown as FeatureInstance;
const fighter = (): Entity => {
  const e = createCharacter(provider, { id: 'f', name: 'F', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte',
    stats: { str: 15, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, level: 1 }, DEFAULT_RULES);
  return { ...e, features: [...e.features, defense], inventory: { ...e.inventory, equipped: [], carried: [] } };
};
const wearing = (e: Entity, armorWeight: 'light' | 'medium' | 'heavy' | null, isShield = false): Entity => ({
  ...e, inventory: { ...e.inventory, equipped: [{ id: 'inst', itemId: 'not_in_catalog', quantity: 1, attuned: false, features: [], armorWeight, isShield } as never] },
});
const ac = (e: Entity) => recomputeDerived(e, DEFAULT_RULES).derived.ac;

it('counts with armor on and not without, whatever the old answer said', () => {
  const bare = ac(fighter());
  const noAnswer = ac(wearing(fighter(), 'light'));
  const saidNo = ac({ ...wearing(fighter(), 'light'), situationalAnswers: { fighting_style_defense_armored: false } });
  const plain = ac({ ...wearing(fighter(), 'light'), features: fighter().features.filter(f => f.id !== defense.id) });
  expect(noAnswer).toBe(plain + 1);
  expect(saidNo).toBe(plain + 1);
  expect(ac({ ...fighter(), situationalAnswers: { fighting_style_defense_armored: true } })).toBe(bare);   // no armor: no bonus
});

it('a shield alone is not armor', () => {
  const shieldOnly = wearing(fighter(), null, true);
  const withoutDefense = { ...shieldOnly, features: shieldOnly.features.filter(f => f.id !== defense.id) };
  expect(ac(shieldOnly)).toBe(ac(withoutDefense));
});
