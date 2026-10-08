// Engine additions: an expanded class spell list, typed spell damage type/die changes, and the worn-gear
// condition "not in medium or heavy armor". Authored as ordinary stat_modifier effects on a feature.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived, effectConditionActive } from '../pipeline';
import { extraClassSpellIds, spellDamageDieOverride, spellDamageTypeOverride } from '../spellModifiers';
import { candidateSpellsForChoice } from '../../content/spellChoiceFilter';
import type { Entity, Feature, Effect } from '../types';

const withEffects = (effects: Effect[]): Entity => {
  const f = { id: 'f', name: 'F', description: '', source: { kind: 'class', refId: 'f' }, level: null, effects, actions: [], choices: [], passive: true, isActive: true } as Feature & { isActive: boolean };
  const e = makeEmptyEntity('t');
  return recomputeDerived({ ...e, features: [f] }, DEFAULT_RULES);
};
const eff = (target: string, operation: Effect['operation'], value: Effect['value']): Effect => ({ type: 'stat_modifier', target, operation, value, condition: null });

describe('expanded class spell list', () => {
  const e = withEffects([eff('spell_list:warlock', 'add', ['fireball', 'burning_hands'])]);
  it('names the extra spells for that class only', () => {
    expect(extraClassSpellIds(e, 'warlock').sort()).toEqual(['burning_hands', 'fireball']);
    expect(extraClassSpellIds(e, 'wizard')).toEqual([]);
    expect(extraClassSpellIds(withEffects([]), 'warlock')).toEqual([]);
  });
  it('a choice offers the extra spells on top of the class list, and nothing else changes', () => {
    const all = [
      { id: 'fireball', level: 3, school: 'Evocation', ritual: false, classes: ['wizard', 'sorcerer'] },
      { id: 'hex', level: 1, school: 'Enchantment', ritual: false, classes: ['warlock'] },
      { id: 'light', level: 0, school: 'Evocation', ritual: false, classes: ['wizard'] },
    ];
    const def = { id: 'warlock_spells', spellFilter: undefined };
    const ids = (extra?: string[]) => candidateSpellsForChoice(all, def, { ownClassId: 'warlock', maxCastableLevel: 5, extraSpellIds: extra }).map(s => s.id);
    expect(ids()).toEqual(['hex']);
    expect(ids(['fireball']).sort()).toEqual(['fireball', 'hex']);
  });
});

describe('typed spell damage changes', () => {
  const e = withEffects([eff('spell_damage_type:eldritch_blast', 'set', 'fire'), eff('spell_damage_die:eldritch_blast', 'set', 12)]);
  it('reports the new type and die for that spell only', () => {
    expect(spellDamageTypeOverride(e, 'eldritch_blast')).toBe('fire');
    expect(spellDamageDieOverride(e, 'eldritch_blast')).toBe(12);
    expect(spellDamageTypeOverride(e, 'fire_bolt')).toBeNull();
    expect(spellDamageDieOverride(withEffects([]), 'eldritch_blast')).toBeNull();
  });
});

describe('worn:no_medium_or_heavy', () => {
  const e = makeEmptyEntity('t');
  const active = (armor: 'none' | 'light' | 'medium' | 'heavy', shield = false) =>
    effectConditionActive('worn:no_medium_or_heavy', {}, new Set(), e, { armor, shield });
  it('is true with no armor or light armor, and a shield does not matter', () => {
    expect(active('none')).toBe(true);
    expect(active('light')).toBe(true);
    expect(active('none', true)).toBe(true);
  });
  it('is false in medium or heavy armor', () => {
    expect(active('medium')).toBe(false);
    expect(active('heavy')).toBe(false);
  });
});
