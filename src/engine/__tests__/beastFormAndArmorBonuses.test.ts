// Bonuses that apply in a Wild Shape form, and lifting the medium armor Dex cap.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { startWildShape } from '../combat';
import { ALL_BEAST_FORMS } from '../../content/beastforms';
import type { Entity, Feature, Effect } from '../types';

const feat = (id: string, effects: Effect[]): Feature & { isActive: boolean } => ({
  id, name: id, description: '', source: { kind: 'class', refId: 'x' }, level: null, effects, actions: [], choices: [], passive: true, isActive: true,
} as never);
const mod = (e: Entity, f: Feature[]) => recomputeDerived({ ...e, features: [...e.features, ...f] as never }, DEFAULT_RULES);
const stat = (target: string, value: number, o: Partial<Effect> = {}): Effect => ({ type: 'stat_modifier', target, operation: 'add', value, condition: null, ...o });

describe('Wild Shape form with bonuses', () => {
  const form = ALL_BEAST_FORMS[0];
  const shaped = (extra: Feature[]): Entity => {
    const base = mod({ ...makeEmptyEntity('t'), identity: { ...makeEmptyEntity('t').identity, level: 6, classId: 'druid' } }, extra);
    return startWildShape(base, form.id, DEFAULT_RULES);
  };
  it('an ordinary AC bonus stops while in the form', () => {
    const e = shaped([feat('plain', [stat('ac', 2)])]);
    expect(e.wildShapeState?.active).toBe(true);
    expect(e.derived.ac).toBe(form.ac);
  });
  it('an appliesInBeastForm AC bonus adds on top of the form', () => {
    const e = shaped([feat('oak', [stat('ac', 2, { appliesInBeastForm: true })])]);
    expect(e.derived.ac).toBe(form.ac + 2);
  });
  it('an appliesInBeastForm speed bonus adds to the form speed', () => {
    const e = shaped([feat('birch', [stat('speed', 10, { appliesInBeastForm: true })])]);
    expect(e.derived.speed).toBe(form.speed + 10);
  });
});

describe('armor_dex_cap', () => {
  const medium: Effect = { type: 'base_ac_formula', target: 'ac', operation: 'set', value: 14, condition: null, formulaAbilities: ['dex'], formulaAbilityCap: { dex: 2 } };
  const withDex = (dex: number, extra: Feature[] = []): Entity => {
    const e = makeEmptyEntity('t');
    return mod({ ...e, stats: { ...e.stats, dex } }, [feat('breastplate', [medium]), ...extra]);
  };
  it('medium armor caps the Dex bonus at +2 by default', () => {
    expect(withDex(18).derived.ac).toBe(16);          // 14 + min(+4, 2)
  });
  it('a raised cap lets the full Dex modifier count', () => {
    const e = withDex(18, [feat('shadow', [{ type: 'stat_modifier', target: 'armor_dex_cap', operation: 'set', value: 99, condition: null }])]);
    expect(e.derived.ac).toBe(18);                    // 14 + 4
  });
  it('does not lower anything, and a low Dex is unaffected', () => {
    const e = withDex(12, [feat('shadow', [{ type: 'stat_modifier', target: 'armor_dex_cap', operation: 'set', value: 99, condition: null }])]);
    expect(e.derived.ac).toBe(15);                    // 14 + 1
  });
});
