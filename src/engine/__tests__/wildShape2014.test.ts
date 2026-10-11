// The 2014 Druid's Wild Shape: one card, a picker of the SRD 5.1 beasts the Druid level (and any feature that raises the limits) allows.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { generateActionCard } from '../actionCards';
import { applyActionCardUse } from '../actionUse';
import { migrateEntity } from '../multiclass';
import { wildShapeLimits, eligibleWildShapeForms } from '../wildShapeForms';
import { ALL_BEAST_FORMS } from '../../content/beastforms';
import { BEAST_FORMS_2014 } from '../../content/beastforms/beastforms2014Data';
import { WILD_SHAPE_2014 } from '../../content/beastforms/wildShape2014';
import { asClassId, asSubclassId } from '../types';
import type { Entity, Feature } from '../types';

// A feature that changes the limits does it through data: one stat_modifier on a wild_shape_* target (see engine/wildShapeForms.ts).
const limitFeature = (id: string, target: string, value: number, level: number): Feature & { isActive: boolean } => ({
  id, name: id, description: '', source: { kind: 'subclass', refId: 'test_circle' }, level,
  effects: [{ type: 'stat_modifier', target, operation: 'set', value, condition: null }], actions: [], choices: [], passive: true, isActive: true,
} as never);
/** 'raised' stands for a druid with features that give CR 1 from 2nd level, CR (level / 3) from 6th, and a bonus action. */
function druid(level: number, kind: 'raised' | null = null, uses = 2): Entity {
  const subclass = kind ? 'test_circle' : null;
  const raised = kind === 'raised'
    ? [limitFeature('raise_a', 'wild_shape_bonus_action', 1, 2), limitFeature('raise_b', 'wild_shape_cr_floor', 1, 2),
       ...(level >= 6 ? [limitFeature('raise_c', 'wild_shape_cr_divisor', 3, 6)] : [])]
    : [];
  const e = makeEmptyEntity('druid');
  const entity: Entity = {
    ...e,
    identity: { ...e.identity, level, classId: 'druid', subclassId: subclass, classes: [{ classId: asClassId('druid'), subclassId: subclass ? asSubclassId(subclass) : null, level }] },
    features: [{ ...WILD_SHAPE_2014, isActive: true }, ...raised],
    resources: { ...e.resources, custom: [{ id: 'wild_shape_pool', name: 'Wild Shape', current: uses, maximum: 2, recharge: 'short_rest' }] },
  };
  return recomputeDerived(entity, DEFAULT_RULES);
}
const ids = (e: Entity) => eligibleWildShapeForms(e).map(f => f.id);

describe('2014 beast forms from the SRD 5.1', () => {
  const form = (id: string) => BEAST_FORMS_2014.find(f => f.id === id)!;
  it('carry the stat blocks speeds, not just a walking speed', () => {
    expect(form('wolf')).toMatchObject({ speed: 40, ac: 13, hp: 11, challengeRating: 0.25 });
    expect(form('giant_eagle')).toMatchObject({ speed: 10, flySpeed: 80, challengeRating: 1 });
    expect(form('giant_octopus')).toMatchObject({ speed: 10, swimSpeed: 60 });
    expect(form('crocodile')).toMatchObject({ speed: 20, swimSpeed: 30 });
    expect(form('brown_bear')).toMatchObject({ speed: 40, climbSpeed: 30, hp: 34, ac: 11 });
    expect(form('giant_spider')).toMatchObject({ speed: 30, climbSpeed: 30, ac: 14 });
    expect(form('bat')).toMatchObject({ speed: 5, flySpeed: 30 });
  });
  it('are every SRD beast of CR 6 or lower, no swarms and no figurine stat blocks', () => {
    expect(BEAST_FORMS_2014.length).toBe(84);
    expect(BEAST_FORMS_2014.every(f => f.challengeRating <= 6)).toBe(true);
    expect(BEAST_FORMS_2014.some(f => f.id === 'giant_fly')).toBe(false);
    expect(new Set(BEAST_FORMS_2014.map(f => f.id)).size).toBe(BEAST_FORMS_2014.length);
  });
  it('are in the form library with the elementals kept apart from them', () => {
    expect(ALL_BEAST_FORMS.filter(f => f.creatureType === 'elemental').map(f => f.id).sort())
      .toEqual(['air_elemental', 'earth_elemental', 'fire_elemental', 'water_elemental']);
    expect(ALL_BEAST_FORMS.some(f => f.id === 'mammoth')).toBe(true);
  });
});

describe('what the level allows', () => {
  it('is nothing before 2nd level and for other classes', () => {
    expect(wildShapeLimits(druid(1))).toBeNull();
    expect(wildShapeLimits(makeEmptyEntity('fighter'))).toBeNull();
  });
  it('2nd level: CR 1/4 or lower, no swimming or flying speed', () => {
    const l = wildShapeLimits(druid(2))!;
    expect(l).toMatchObject({ maxCr: 0.25, swim: false, fly: false, bonusAction: false });
    const f = ids(druid(2));
    expect(f).toContain('wolf');
    expect(f).not.toContain('crocodile');       // CR 1/2 and swims
    expect(f).not.toContain('giant_frog');      // CR 1/4 but swims
    expect(f).not.toContain('eagle');           // flies
    expect(f).not.toContain('brown_bear');      // CR 1
  });
  it('4th level: CR 1/2, swimming allowed, still no flying', () => {
    const f = ids(druid(4));
    expect(f).toContain('crocodile');
    expect(f).toContain('giant_frog');
    expect(f).toContain('ape');
    expect(f).not.toContain('giant_wasp');      // flies
    expect(f).not.toContain('brown_bear');
  });
  it('8th level: CR 1 with flying; nothing above CR 1 for a druid without such a feature', () => {
    const f = ids(druid(8));
    expect(f).toContain('giant_eagle');
    expect(f).toContain('brown_bear');
    expect(f).toContain('giant_octopus');
    expect(f).not.toContain('polar_bear');      // CR 2
    expect(ids(druid(20))).not.toContain('mammoth');
  });
  it('A feature that raises the limits: CR 1 from 2nd level, still without flying or swimming until the level allows, and a bonus action', () => {
    const e = druid(2, 'raised');
    expect(wildShapeLimits(e)).toMatchObject({ maxCr: 1, bonusAction: true });
    const f = ids(e);
    expect(f).toContain('brown_bear');
    expect(f).toContain('tiger');
    expect(f).not.toContain('giant_eagle');     // flies
    expect(f).not.toContain('giant_octopus');   // swims
    expect(f).not.toContain('polar_bear');      // CR 2
  });
  it('A feature that raises the limits: CR is the druid level divided by 3 from 6th level', () => {
    expect(wildShapeLimits(druid(6, 'raised'))!.maxCr).toBe(2);
    expect(ids(druid(6, 'raised'))).toContain('polar_bear');
    expect(wildShapeLimits(druid(9, 'raised'))!.maxCr).toBe(3);
    expect(ids(druid(18, 'raised'))).toContain('mammoth');
    expect(wildShapeLimits(druid(18, 'raised'))!.maxCr).toBe(6);
  });
  it('never offers the elementals or the 2024 forms', () => {
    const f = ids(druid(20, 'raised'));
    expect(f.some(i => i.endsWith('_elemental'))).toBe(false);
    expect(f.some(i => i.endsWith('_2024'))).toBe(false);
  });
});

describe('the Wild Shape card', () => {
  const cardOf = (e: Entity) => generateActionCard(e.features[0], e)!;
  it('is one card whose options are the forms the level allows', () => {
    const e = druid(4);
    const card = cardOf(e);
    expect(card.activation.options!.map(o => o.transformFormId)).toEqual(ids(e));
    expect(card.activation.actionType).toBe('action');
    const wolf = card.activation.options!.find(o => o.transformFormId === 'wolf')!;
    expect(wolf.label).toMatch(/Wolf \(CR 1\/4/);
    expect(wolf.description).toMatch(/AC 13 · HP 11 · 40 ft\./);
  });
  it('is a bonus action when a feature grants it', () => {
    expect(cardOf(druid(2, 'raised')).activation.actionType).toBe('bonus_action');
  });
  it('using an option spends a use and transforms into that form', () => {
    const e = druid(2);
    const card = cardOf(e);
    const opt = card.activation.options!.find(o => o.transformFormId === 'wolf')!;
    const used = applyActionCardUse(e, card, DEFAULT_RULES, opt);
    expect(used.wildShapeState).toMatchObject({ active: true, formId: 'wolf', beastHp: 11 });
    expect(used.resources.custom.find(r => r.id === 'wild_shape_pool')!.current).toBe(1);
    expect(used.derived.ac).toBe(13);
    expect(used.derived.speed).toBe(40);
  });
  it('lasts half the druid level in hours', () => {
    const e = druid(8);
    const card = cardOf(e);
    const used = applyActionCardUse(e, card, DEFAULT_RULES, card.activation.options!.find(o => o.transformFormId === 'giant_eagle')!);
    expect(used.wildShapeState?.expiresAt).toMatchObject({ unit: 'hours', remaining: 4 });
    expect(used.derived.movement.fly).toBe(80);
  });
  it('refuses a form the level does not allow, with nothing spent', () => {
    const e = druid(2);
    const card = cardOf(e);
    const eagle = { id: 'form:giant_eagle', label: 'Giant Eagle', transformFormId: 'giant_eagle' };
    const out = applyActionCardUse(e, card, DEFAULT_RULES, eagle);
    expect(out).toBe(e);
    expect(e.resources.custom[0].current).toBe(2);
  });
  it('refuses to start a second form while already transformed', () => {
    const e = druid(2);
    const card = cardOf(e);
    const once = applyActionCardUse(e, card, DEFAULT_RULES, card.activation.options!.find(o => o.transformFormId === 'wolf')!);
    const twice = applyActionCardUse(once, cardOf(once), DEFAULT_RULES, card.activation.options!.find(o => o.transformFormId === 'boar')!);
    expect(twice).toBe(once);
    expect(twice.resources.custom[0].current).toBe(1);
  });
});

describe('a druid saved with the three single-form features', () => {
  it('is migrated to the one picker feature on load', () => {
    const e = druid(2);
    const legacy = ['wild_shape_wolf', 'wild_shape_giant_spider', 'wild_shape_brown_bear'].map(id => ({ ...WILD_SHAPE_2014, id, isActive: true }));
    const saved: Entity = { ...e, features: legacy };
    const loaded = migrateEntity(saved);
    expect(loaded.features.map(f => f.id)).toEqual(['wild_shape']);
    expect(migrateEntity(loaded).features.map(f => f.id)).toEqual(['wild_shape']);
  });
});

describe('the shaped form\'s attacks', () => {
  it('appear as cards with the stat block\'s to-hit while transformed, and not before', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateAllActionCards } = require('../actionCards');
    const e = druid(2);
    const before = generateAllActionCards(e).map((c: { name: string }) => c.name);
    expect(before.some((n: string) => /Bite/.test(n))).toBe(false);
    const card = generateActionCard(e.features[0], e)!;
    const shaped = applyActionCardUse(e, card, DEFAULT_RULES, card.activation.options!.find(o => o.transformFormId === 'wolf')!);
    const cards = generateAllActionCards(shaped) as { name: string; layer2: string; isWeaponAttack?: boolean }[];
    const bite = cards.find(c => c.name === 'Bite (Wolf)')!;
    expect(bite).toBeDefined();
    expect(bite.layer2).toBe('+4 to hit • 2d4+2 Piercing');
    expect(bite.isWeaponAttack).toBe(true);
  });
  it('a form with no printed to-hit uses its best of Strength and Dexterity plus proficiency', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateAllActionCards } = require('../actionCards');
    const e = druid(2);
    // The 2024 forms carry no printed to-hit: Wolf has Dex 15 (+2); the druid's proficiency bonus at level 2 is +2.
    const shaped = { ...e, wildShapeState: { active: true, formId: 'wolf_2024', beastHp: 11, beastHpMax: 11, expiresAt: { unit: 'hours', remaining: 1 } } } as Entity;
    const cards = generateAllActionCards(shaped) as { name: string; layer2: string }[];
    const bite = cards.find(c => c.name === 'Bite (Wolf)')!;
    expect(bite.layer2).toBe('+4 to hit • 1d6+2 Piercing');
  });
});
