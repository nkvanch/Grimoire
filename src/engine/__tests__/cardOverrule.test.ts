// Overrule on a card (the desktop's ADR-015): only the stops the person names are set aside, each with the desktop's meaning.
import { generateActionCard, generateSpellCard } from '../actionCards';
import { applyActionCardUse, cardOverrulable } from '../actionUse';
import { makeEmptyEntity, DEFAULT_RULES } from '../defaults';
import { startTurn, markActionSlotUsed } from '../combat';
import { toggleAttunement } from '../inventory';
import type { Entity, Feature, Spell, SpellSlots } from '../types';

const surge: Feature = {
  id: 'surge', name: 'Surge', description: '', source: { kind: 'class', refId: 'fighter' }, level: 1, effects: [], actions: [], choices: [], passive: false,
  activation: { actionType: 'bonus_action', resourceCost: { resourceId: 'surge_uses', quantity: 1 }, range: null, target: 'self' },
} as unknown as Feature;
const fighter = (current: number): Entity => {
  const e = makeEmptyEntity('f');
  return { ...e, features: [{ ...surge, isActive: true }] as never, resources: { ...e.resources,
    custom: [{ id: 'surge_uses', name: 'Surge', current, maximum: 1, recharge: 'short_rest' }] } };
};
const uses = (e: Entity) => e.resources.custom.find(r => r.id === 'surge_uses')!.current;

describe('a spent resource', () => {
  it('blocks, is named, and when overruled the ability is used and nothing goes below none', () => {
    const e = fighter(0);
    const card = generateActionCard(surge, e)!;
    expect(card.available).toBe(false);
    expect(cardOverrulable(e, card).map(r => r.id)).toEqual(['spent_resource']);
    expect(applyActionCardUse(e, card, DEFAULT_RULES)).toBe(e);                                   // refused without it
    const used = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, {}, undefined, undefined, undefined, new Set(['spent_resource']));
    expect(used).not.toBe(e);
    expect(uses(used)).toBe(0);
  });

  it('an overrule names only what it sets aside: the action already used still stops it', () => {
    const e = markActionSlotUsed(startTurn(fighter(0), DEFAULT_RULES), 'bonus_action');
    const card = generateActionCard(surge, e)!;
    expect(cardOverrulable(e, card).map(r => r.id).sort()).toEqual(['action_used', 'spent_resource']);
    expect(applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, {}, undefined, undefined, undefined, new Set(['spent_resource']))).toBe(e);
    const both = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, {}, undefined, undefined, undefined, new Set(['spent_resource', 'action_used']));
    expect(both).not.toBe(e);
    expect(both.turnState?.bonusActionUsed).toBe(true);                                          // stays used
  });
});

describe('no spell slot left', () => {
  const slots = (used: number): SpellSlots => {
    const s = {} as SpellSlots;
    for (const t of ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const) s[t] = { total: 0, used: 0 };
    return { ...s, '1': { total: 2, used } };
  };
  const bolt: Spell = { id: 'test_bolt', name: 'Test Bolt', level: 1, school: 'Evocation', castingTime: '1 action', range: '60 feet',
    components: ['V'], duration: 'Instantaneous', description: '', upcast: null, ritual: false, concentration: false };
  const caster = (used: number): Entity => ({
    ...makeEmptyEntity('w'),
    entitlements: [{ kind: 'spell_access', key: 'test_bolt', sourceKind: 'manual' }],
    spellcasting: { ability: 'int', slots: slots(used), cantrips: [], known: ['test_bolt'], prepared: ['test_bolt'], concentrating: null },
  } as unknown as Entity);

  it('when overruled the spell is cast and no slot is spent', () => {
    const e = caster(2);
    const card = generateSpellCard('test_bolt', e, { homebrewSpells: [bolt] })!;
    expect(cardOverrulable(e, card).map(r => r.id)).toEqual(['no_slot']);
    expect(applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, { homebrewSpells: [bolt] })).toBe(e);
    const cast = applyActionCardUse(e, card, DEFAULT_RULES, undefined, undefined, undefined, undefined, { homebrewSpells: [bolt] }, undefined, undefined, undefined, new Set(['no_slot']));
    expect(cast).not.toBe(e);
    expect(cast.spellcasting!.slots['1'].used).toBe(2);
  });

  it('nothing to overrule when a slot is left', () => {
    const e = caster(0);
    expect(cardOverrulable(e, generateSpellCard('test_bolt', e, { homebrewSpells: [bolt] })!)).toEqual([]);
  });
});

describe('the attunement limit', () => {
  it('a fourth item is refused, and attuned when overruled', () => {
    const inst = (id: string, attuned: boolean) => ({ id, itemId: `ring_${id}`, quantity: 1, attuned, features: [] });
    const e = { ...makeEmptyEntity('a') };
    const full: Entity = { ...e, inventory: { ...e.inventory, equipped: [inst('a', true), inst('b', true), inst('c', true), inst('d', false)] as never } };
    expect(toggleAttunement(full, 'ring_d', 'd')).toBe(full);
    const more = toggleAttunement(full, 'ring_d', 'd', true);
    expect(more.inventory.equipped.filter(i => i.attuned)).toHaveLength(4);
  });
});
