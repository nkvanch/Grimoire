// Auras that benefit allies: offered from party sheets, applied once the player marks themselves inside, numbers from the source.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { aurasOffered, setInAura, isInAura, refreshReceivedAuras } from '../auras';
import { suspendFeature } from '../suspension';
import type { Entity, Feature } from '../types';

const protection = (affects: 'allies' | 'allies_and_self' | 'enemies' = 'allies_and_self'): Feature & { isActive: boolean } => ({
  id: 'aura_prot', name: 'Aura of Protection', description: '', source: { kind: 'class', refId: 'paladin' }, level: null,
  effects: [], actions: [], choices: [], passive: true, isActive: true,
  aura: {
    label: 'Aura of Protection', range: '10 feet', affects,
    effects: [{ type: 'stat_modifier', target: 'savingThrows.str', operation: 'add', value: 0, addAbilityModifier: 'cha', condition: null }],
  },
}) as never;

const paladin = (cha: number): Entity => {
  const e = makeEmptyEntity('pal');
  return recomputeDerived({ ...e, identity: { ...e.identity, name: 'Aldric' }, stats: { ...e.stats, cha }, features: [protection()] as never }, DEFAULT_RULES);
};
const fighter = (): Entity => {
  const e = makeEmptyEntity('fig');
  return recomputeDerived({ ...e, identity: { ...e.identity, name: 'Brea' } }, DEFAULT_RULES);
};

describe('auras', () => {
  it('offers a party member\'s aura, with the source\'s numbers worked out', () => {
    const offers = aurasOffered(fighter(), [paladin(16), fighter()]);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ sourceName: 'Aldric', label: 'Aura of Protection', range: '10 feet' });
    expect(offers[0].effects[0]).toMatchObject({ value: 3 });         // +3 from Charisma 16
    expect(offers[0].effects[0].addAbilityModifier).toBeUndefined();
  });
  it('applies only once the player marks themselves inside, and stops when they leave', () => {
    const me = fighter();
    const base = me.derived.savingThrows.str;
    const offer = aurasOffered(me, [paladin(16)])[0];
    const inside = recomputeDerived(setInAura(me, offer, true), DEFAULT_RULES);
    expect(isInAura(inside, offer.sourceEntityId, offer.featureId)).toBe(true);
    expect(inside.derived.savingThrows.str).toBe(base + 3);
    const out = recomputeDerived(setInAura(inside, offer, false), DEFAULT_RULES);
    expect(out.derived.savingThrows.str).toBe(base);
  });
  it('your own aura is offered to you only when it includes you', () => {
    const pal = paladin(14);
    expect(aurasOffered(pal, [pal])).toHaveLength(1);
    const ally = { ...pal, features: [protection('allies')] as never };
    expect(aurasOffered(ally, [ally])).toHaveLength(0);
  });
  it('an enemies aura is not offered to allies, and a suspended feature offers nothing', () => {
    const foe = { ...paladin(14), features: [protection('enemies')] as never };
    expect(aurasOffered(fighter(), [foe])).toHaveLength(0);
    const off = suspendFeature(paladin(14), 'aura_prot', 'end_of_next_turn');
    expect(aurasOffered(fighter(), [off])).toHaveLength(0);
  });
  it('refreshing picks up a changed source number and drops an aura whose source is gone', () => {
    const me = fighter();
    let pal = paladin(14);
    const inside = setInAura(me, aurasOffered(me, [pal])[0], true);      // +2
    pal = paladin(20);                                                    // +5
    const refreshed = refreshReceivedAuras(inside, [pal]);
    expect(refreshed.receivedAuras![0].effects[0].value).toBe(5);
    expect(refreshReceivedAuras(inside, []).receivedAuras).toEqual([]);
  });
});
