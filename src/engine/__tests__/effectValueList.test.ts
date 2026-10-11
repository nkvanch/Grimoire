// A character whose feature carries a list-valued effect (a spell_list:<class> effect adds spells) must validate, not be quarantined on load.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { validateEntityShape } from '../homebrewValidator';
import type { Entity, Feature } from '../types';

const withEffectValue = (value: unknown): Entity => {
  const e = makeEmptyEntity('list');
  const f = {
    id: 'expanded', name: 'Expanded Spell List', description: '', source: { kind: 'subclass', refId: 'x' }, level: 1,
    effects: [{ type: 'stat_modifier', target: 'spell_list:warlock', operation: 'add', value, condition: null }],
    actions: [], choices: [], passive: true, isActive: true,
  } as unknown as Feature;
  return recomputeDerived({ ...e, features: [f as never] }, DEFAULT_RULES);
};

describe('list-valued effects', () => {
  it('a list of spell ids validates', () => {
    expect(validateEntityShape(withEffectValue(['burning_hands', 'fireball'])).valid).toBe(true);
  });
  it('an empty list validates', () => {
    expect(validateEntityShape(withEffectValue([])).valid).toBe(true);
  });
  it('a list of anything else, or an object, is still refused', () => {
    expect(validateEntityShape(withEffectValue([1, 2])).valid).toBe(false);
    expect(validateEntityShape(withEffectValue({ ids: ['a'] })).valid).toBe(false);
  });
  it('a character with the real Zellorea Living Pyre expanded list loads', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs'); const path = require('path');
    const file = path.join(__dirname, '..', '..', '..', 'outreach', 'zell', 'zellorea-mechanics-test-pack.grimoire-pack');
    if (!fs.existsSync(file)) return;
    const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sub = pack.homebrew.subclasses.find((s: { id: string }) => s.id === 'zell_living_pyre');
    const feature = sub.entries.flatMap((en: { grants: { kind: string; value: Feature }[] }) => en.grants).find((g: { kind: string; value: Feature }) => g.kind === 'feature' && g.value.id === 'zell_living_pyre_expanded_spells').value;
    const e = recomputeDerived({ ...makeEmptyEntity('pyre'), features: [{ ...feature, isActive: true } as never] }, DEFAULT_RULES);
    expect(validateEntityShape(e).valid).toBe(true);
  });
});
