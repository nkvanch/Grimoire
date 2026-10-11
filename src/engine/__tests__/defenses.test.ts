// What the DM sees before damage lands: a creature's defenses and a preview of the result.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { defenseSummary, damagePreview, damageOutcome } from '../defenses';
import type { Entity, Effect } from '../types';

const withEffects = (effects: Effect[], hp = { current: 20, maximum: 30, temp: 0 }, extra: Partial<Entity> = {}): Entity => {
  const e = makeEmptyEntity('t');
  const f = { id: 'f', name: 'F', description: '', source: { kind: 'class', refId: 'x' }, level: null, effects, actions: [], choices: [], passive: true, isActive: true };
  return recomputeDerived({ ...e, features: [f] as never, resources: { ...e.resources, hp }, ...extra }, DEFAULT_RULES);
};
const res = (t: string): Effect => ({ type: 'grant_resistance', target: t, operation: 'resistance', value: null, condition: null });
const imm = (t: string): Effect => ({ type: 'grant_immunity', target: t, operation: 'immunity', value: null, condition: null });
const vul = (t: string): Effect => ({ type: 'grant_resistance', target: t, operation: 'vulnerability', value: null, condition: null });

describe('defense summary', () => {
  it('lists resistances, immunities and vulnerabilities, and keeps a damage type out of two lists', () => {
    const d = defenseSummary(withEffects([res('fire'), res('cold'), imm('cold'), vul('radiant'), imm('critical_hits_against')]));
    expect(d.resistances).toEqual(['fire']);
    expect(d.immunities).toEqual(['cold']);
    expect(d.vulnerabilities).toEqual(['radiant']);
    expect(d.critsNegated).toBe(true);
  });
  it('a flagged resistance appears only while its flag is on', () => {
    const e = withEffects([{ ...res('slashing'), condition: 'rage_active' }]);
    expect(defenseSummary(e).resistances).toEqual([]);
    const on = recomputeDerived({ ...e, conditionMonitor: { ...e.conditionMonitor, flags: { rage_active: true } } }, DEFAULT_RULES);
    expect(defenseSummary(on).resistances).toEqual(['slashing']);
  });
  it('condition immunities and flat per-hit reductions', () => {
    const d = defenseSummary(withEffects([
      { type: 'condition_immunity', target: 'frightened', operation: 'immunity', value: null, condition: null },
      { type: 'stat_modifier', target: 'damage_reduction:slashing', operation: 'add', value: 2, condition: null },
    ]));
    expect(d.conditionImmunities).toEqual(['frightened']);
    expect(d.flatReductions).toEqual([{ type: 'slashing', amount: 2 }]);
  });
});

describe('damage outcome and preview', () => {
  it('halves for resistance, doubles for vulnerability, nothing for immunity, takes flat reduction after', () => {
    const e = withEffects([res('fire'), vul('cold'), imm('poison'), { type: 'stat_modifier', target: 'damage_reduction:slashing', operation: 'add', value: 3, condition: null }]);
    expect(damageOutcome(e, 11, 'fire').dealt).toBe(5);
    expect(damageOutcome(e, 6, 'cold').dealt).toBe(12);
    expect(damageOutcome(e, 9, 'poison').dealt).toBe(0);
    expect(damageOutcome(e, 8, 'slashing').dealt).toBe(5);
    expect(damageOutcome(e, 8).dealt).toBe(8);
  });
  it('temp HP soaks first and the result is stated', () => {
    const e = withEffects([], { current: 20, maximum: 30, temp: 6 });
    const p = damagePreview(e, 10);
    expect(p).toMatchObject({ hpAfter: 16, tempAfter: 0, state: 'ok' });
    expect(p.line).toContain('16/30 HP');
  });
  it('says when it would drop the creature, and when it would kill outright', () => {
    const e = withEffects([], { current: 8, maximum: 30, temp: 0 });
    expect(damagePreview(e, 8).state).toBe('down');
    expect(damagePreview(e, 8).line).toContain('drops to 0 HP');
    expect(damagePreview(e, 38).state).toBe('dead');
    expect(damagePreview(e, 38).line).toContain('dies outright');
  });
  it('damage at 0 HP is a death save failure, and the third one is death', () => {
    const base = withEffects([], { current: 0, maximum: 30, temp: 0 });
    const two: Entity = { ...base, resources: { ...base.resources, deathSaves: { successes: 0, failures: 2, stable: false } } };
    expect(damagePreview(base, 4).state).toBe('dead_risk');
    expect(damagePreview(two, 4).state).toBe('dead');
  });
  it('resistance changes the preview', () => {
    const e = withEffects([res('fire')], { current: 10, maximum: 30, temp: 0 });
    expect(damagePreview(e, 20, 'fire').hpAfter).toBe(0);
    expect(damagePreview(e, 12, 'fire').hpAfter).toBe(4);
  });
  it('a Wild Shape form takes it first', () => {
    const e = withEffects([], { current: 20, maximum: 30, temp: 0 }, {
      wildShapeState: { active: true, formId: 'wolf', beastHp: 11, beastHpMax: 11, expiresAt: { unit: 'hours', remaining: 1 } as never },
    } as never);
    expect(damagePreview(e, 5).line).toContain('the form is left at 6/11');
    expect(damagePreview(e, 15).line).toContain('4 carries over');
  });
});
