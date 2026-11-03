// "Every number is explainable": the numbers players look at most in a fight — HP maximum, weapon to-hit and damage,
// and the numbers on action cards — each open a breakdown, and every breakdown adds up to exactly the number shown.
import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { explainValue, attackKey } from '../audit';
import { generateAllActionCards } from '../actionCards';
import type { Entity, Item, Effect, FeatureInstance, Ability, SkillName } from '../types';

const weapon = (id: string, name: string, properties: string[], dice: string, type: string): Item => ({
  id, name, weight: 1, cost: '1 gp', properties,
  features: [{
    id: `${id}_attack`, name, description: '', source: { kind: 'item', refId: id }, level: null,
    effects: [], actions: [], choices: [], passive: false,
    activation: { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null },
    abilityEffects: [{ type: 'damage', dice, damageType: type }],
  }],
} as Item);
const ITEMS = [
  weapon('test_longsword', 'Longsword', ['versatile'], '1d8', 'slashing'),
  weapon('test_rapier_1', 'Rapier +1', ['finesse'], '1d8', 'piercing'),
  weapon('test_longbow', 'Longbow', ['ammunition (range 150/600)', 'heavy', 'two-handed'], '1d8', 'piercing'),
];
const feature = (id: string, effects: Partial<Effect>[], kind: 'feat' | 'class' = 'feat'): FeatureInstance => ({
  id, name: id === 'tough' ? 'Tough' : id, description: '', source: { kind, refId: id }, level: null, passive: true,
  actions: [], choices: [], isActive: true,
  effects: effects.map(e => ({ type: 'stat_modifier', target: '', operation: 'add', value: null, condition: null, ...e })) as Effect[],
});

function fighter(overrides: Partial<Entity> = {}): Entity {
  const e = makeEmptyEntity('f1', 'character');
  const base: Entity = {
    ...e,
    identity: { ...e.identity, level: 5 },
    stats: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    proficiencies: { ...e.proficiencies, weapons: ['simple', 'martial'] },
    resources: { ...e.resources, hp: { current: 44, maximum: 44, temp: 0 }, hitDice: { die: 10, total: 5, remaining: 5 } },
    inventory: {
      ...e.inventory,
      equipped: ITEMS.map((it, i) => ({ id: `inst-${i}`, itemId: it.id, quantity: 1, attuned: false, features: it.features })),
    },
    ...overrides,
  };
  return recomputeDerived(base, DEFAULT_RULES, { items: ITEMS });
}

describe('HP maximum', () => {
  it('breaks down into hit dice and CON × level, adding up to the maximum', () => {
    const e = fighter();
    const trail = explainValue(e, 'hpMax');
    expect(trail.total).toBe(e.resources.hp.maximum);
    expect(trail.entries.map(x => x.label)).toEqual([
      expect.stringMatching(/^Hit dice \(5d10/),
      'CON modifier (+2) × 5 levels',
    ]);
    expect(trail.entries[1].value).toBe(10);
  });

  it('names a feature that raises it (Tough) on its own line, and still adds up', () => {
    const e = fighter({ features: [feature('tough', [{ target: 'max_hp', value: 10 }])] });
    expect(e.resources.hp.maximum).toBe(54);
    const trail = explainValue(e, 'hpMax');
    expect(trail.total).toBe(54);
    expect(trail.entries.find(x => x.label === 'Tough')?.value).toBe(10);
  });

  it('a monster explains its stat block hit points', () => {
    const m = makeEmptyEntity('m1', 'monster');
    const monster = recomputeDerived({ ...m, resources: { ...m.resources, hp: { current: 15, maximum: 15, temp: 0 } } }, DEFAULT_RULES);
    expect(explainValue(monster, 'hpMax').entries).toEqual([expect.objectContaining({ label: 'Stat block hit points', value: 15 })]);
  });
});

describe('weapon attacks', () => {
  const e = fighter();
  const byName = (name: string) => e.derived.attackBonuses.find(a => a.name === name)!;

  it.each(['Longsword', 'Rapier +1', 'Longbow', 'Unarmed Strike'])('%s: to hit and damage both add up to the numbers shown', name => {
    const atk = byName(name);
    expect(explainValue(e, `attack:${attackKey(atk)}`).total).toBe(atk.bonus);
    expect(explainValue(e, `damage:${attackKey(atk)}`).total).toBe(atk.damageBonus);
  });

  it('says where each part comes from', () => {
    const labels = (name: string) => explainValue(e, `attack:${attackKey(byName(name))}`).entries.map(x => x.label);
    expect(labels('Longsword')).toEqual(['STR modifier', 'Proficiency bonus']);
    expect(labels('Rapier +1')).toEqual(['STR modifier (finesse: the better of STR and DEX)', 'Proficiency bonus', 'Rapier +1 (magic weapon)']);
    expect(labels('Longbow')[0]).toBe('DEX modifier');
  });

  it('a weapon the character is not proficient with says so, and the bonus has no proficiency in it', () => {
    const untrained = fighter({ proficiencies: { ...makeEmptyEntity('x').proficiencies, weapons: [] } });
    const atk = untrained.derived.attackBonuses.find(a => a.name === 'Longsword')!;
    const trail = explainValue(untrained, `attack:${attackKey(atk)}`);
    expect(trail.total).toBe(atk.bonus);
    expect(trail.entries.map(x => x.label)).toContain('Not proficient with this weapon');
  });

  it('names the feature that swapped the ability in', () => {
    const swap = fighter({
      stats: { str: 8, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      features: [{ ...feature('pact', [{ type: 'ability_substitute', operation: 'set', substituteFrom: 'str', substituteTo: 'cha', substituteFor: ['weapon_attacks'] } as Partial<Effect>]), name: 'Pact Blade' }],
    });
    const atk = swap.derived.attackBonuses.find(a => a.name === 'Longsword')!;
    expect(explainValue(swap, `attack:${attackKey(atk)}`).entries[0].label).toBe('CHA modifier (Pact Blade, instead of STR)');
  });
});

describe('action cards', () => {
  it("every number a card offers to explain matches the card's own text", () => {
    const e = fighter();
    const cards = generateAllActionCards(e, DEFAULT_RULES, { items: ITEMS });
    const explained = cards.filter(c => c.explain && c.explain.length > 0);
    expect(explained.length).toBeGreaterThanOrEqual(4);   // three weapons and the unarmed strike
    for (const card of explained) {
      for (const ref of card.explain!) {
        const total = explainValue(e, ref.stat).total;
        const shown = ref.stat.startsWith('attack:') ? `${total >= 0 ? '+' : ''}${total} to hit` : `${total >= 0 ? '+' : ''}${total}`;
        expect(card.layer2).toContain(shown);
      }
    }
  });
});

describe('no empty breakdowns for the numbers the sheet shows', () => {
  const e = fighter();
  const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const skills = Object.keys(e.skills.skills) as SkillName[];
  const stats = [
    ...abilities, ...abilities.map(a => `save_${a}`), ...skills,
    'ac', 'initiative', 'speed', 'passivePerception', 'passiveInvestigation', 'passiveInsight', 'proficiencyBonus', 'hpMax',
  ];
  it.each(stats)('%s has at least one line', stat => {
    expect(explainValue(e, stat).entries.length).toBeGreaterThan(0);
  });
});
