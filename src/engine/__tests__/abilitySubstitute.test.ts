// ability_substitute: "use Constitution instead of Strength for ..." as a typed effect (a pattern several features share).
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { skillCheck } from '../skillCheck';
import type { Entity, Feature, Effect, AbilityUseKind, Ability } from '../types';

const sub = (from: Ability, to: Ability, kinds: AbilityUseKind[], extra: Partial<Effect> = {}): Effect =>
  ({ type: 'ability_substitute', target: '', operation: 'set', value: null, condition: null, substituteFrom: from, substituteTo: to, substituteFor: kinds, ...extra });
const feat = (effects: Effect[]): Feature & { isActive: boolean } => ({
  id: 'sub', name: 'Sub', description: '', source: { kind: 'feat', refId: 'sub' }, level: null, passive: true, actions: [], choices: [], effects, isActive: true,
} as never);
function character(stats: Partial<Entity['stats']>, effects: Effect[] = []): Entity {
  const e = makeEmptyEntity('s');
  const withStats = { ...e, stats: { ...e.stats, ...stats }, identity: { ...e.identity, level: 5 }, features: effects.length ? [feat(effects)] as never : [] };
  // a sword so there is a weapon attack to read
  return recomputeDerived(withStats, DEFAULT_RULES);
}
const unarmed = (e: Entity) => e.derived.attackBonuses.find(a => a.id === 'unarmed_strike')!;

describe('ability_substitute', () => {
  it('saving throws read the substituted score', () => {
    const e = character({ wis: 8, cha: 16 }, [sub('wis', 'cha', ['saving_throws'])]);
    expect(e.derived.savingThrows.wis).toBe(3);
    expect(e.derived.savingThrows.int).toBe(0);
  });
  it('is not applied to kinds it does not name', () => {
    const e = character({ wis: 8, cha: 16 }, [sub('wis', 'cha', ['weapon_attacks'])]);
    expect(e.derived.savingThrows.wis).toBe(-1);
  });
  it('weapon attacks read the substituted score (Strength replaced by Charisma)', () => {
    const plain = character({ str: 8, cha: 16 });
    const swapped = character({ str: 8, cha: 16 }, [sub('str', 'cha', ['weapon_attacks'])]);
    expect(unarmed(plain).bonus).toBe(unarmed(swapped).bonus - 4);       // -1 -> +3
    expect(unarmed(swapped).damageBonus).toBe(3);
  });
  it('ability checks, skills included, read the substituted score', () => {
    const e = character({ str: 8, con: 16 }, [sub('str', 'con', ['ability_checks'])]);
    expect(skillCheck(e, 'athletics', 'str').bonus).toBe(3);
    expect(skillCheck(e, 'athletics', 'str').bonus).toBeGreaterThan(skillCheck(character({ str: 8, con: 16 }), 'athletics', 'str').bonus);
  });
  it('never lowers: the better of the two scores is used', () => {
    const e = character({ str: 18, cha: 8 }, [sub('str', 'cha', ['weapon_attacks', 'ability_checks', 'saving_throws'])]);
    expect(e.derived.savingThrows.str).toBe(4);
    expect(skillCheck(e, 'athletics', 'str').bonus).toBe(4);
  });
  it('does not change the stored scores', () => {
    const e = character({ str: 8, cha: 16 }, [sub('str', 'cha', ['weapon_attacks', 'ability_checks', 'saving_throws'])]);
    expect(e.stats.str).toBe(8);
  });
  it('a conditional substitution applies only while its flag is on', () => {
    const fx = sub('str', 'cha', ['saving_throws'], { condition: 'pact_active' });
    const off = character({ str: 8, cha: 16 }, [fx]);
    expect(off.derived.savingThrows.str).toBe(-1);
    const on = recomputeDerived({ ...off, conditionMonitor: { ...off.conditionMonitor, flags: { ...off.conditionMonitor.flags, pact_active: true } } }, DEFAULT_RULES);
    expect(on.derived.savingThrows.str).toBe(3);
  });
});

describe('ability_substitute authored in the builder', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { newDraftTrait, buildTraitFeature, hasAdvancedFields } = require('../../content/traitCompiler');
  const opts = { idPrefix: 't', sourceKind: 'class' as const, sourceRefId: 'x', level: 3 };
  it('compiles the three fields into one typed effect', () => {
    const t = { ...newDraftTrait('Hex'), substituteFrom: 'str', substituteTo: 'cha', substituteFor: ['weapon_attacks'] };
    expect(hasAdvancedFields(t)).toBe(true);
    const { feature } = buildTraitFeature(t, opts);
    expect(feature.effects).toContainEqual(expect.objectContaining({ type: 'ability_substitute', substituteFrom: 'str', substituteTo: 'cha', substituteFor: ['weapon_attacks'] }));
  });
  it('an incomplete or pointless choice compiles to nothing', () => {
    expect(hasAdvancedFields({ ...newDraftTrait('x'), substituteFrom: 'str', substituteTo: 'str', substituteFor: ['saving_throws'] })).toBe(false);
    expect(hasAdvancedFields({ ...newDraftTrait('x'), substituteFrom: 'str', substituteTo: 'cha', substituteFor: [] })).toBe(false);
  });
});
