// Monsters for the native-parity fixtures: what a monster draft compiles to, and the live entity a template spawns into. The executors
// are the app's own code (content/homebrewCompile.ts, engine/homebrewValidator.ts, engine/monsterFactory.ts).
import type { DraftTrait, Entity } from '../types';
import { compileMonsterFields, type MonsterDraft } from '../../content/homebrewCompile';
import type { MonsterTemplate } from '../../content/monsters/types';
import { validateMonster } from '../homebrewValidator';
import { spawnMonster } from '../monsterFactory';
import { DEFAULT_RULES } from '../defaults';
import { trait } from './parityHomebrewScenarios';

export type MonsterCase = { name: string; id: string; draft: MonsterDraft };

const stats = (over: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', string>> = {}) =>
  ({ str: '10', dex: '10', con: '10', int: '10', wis: '10', cha: '10', ...over });

export function buildMonsterCases(): MonsterCase[] {
  const base = (over: Partial<MonsterDraft> = {}): MonsterDraft => ({
    name: 'Ash Wretch', cr: 1, size: 'medium', type: 'undead', alignment: 'neutral evil', stats: stats(),
    hpDice: '2d8', hpAverage: '9', acValue: '12', acSource: 'natural armor', speed: '30', savingThrows: [], senses: '', languages: '',
    legendaryActions: '', traits: [], ...over,
  });
  const t = (name: string, over: Partial<DraftTrait> = {}) => trait(name, over);
  return [
    { name: 'minimal', id: 'ash_wretch', draft: base() },
    { name: 'full-stat-block', id: 'cinder_drake', draft: base({
      name: ' Cinder Drake ', cr: 5, size: 'large', type: ' dragon ', alignment: ' chaotic evil ',
      stats: stats({ str: '19', dex: '12', con: '17', int: '8', wis: '11', cha: '13' }),
      hpDice: '10d10+30', hpAverage: '85', acValue: '16', acSource: 'natural armor', speed: '40',
      savingThrows: ['dex', 'con'], senses: 'darkvision 60 ft, passive Perception 14', languages: 'Draconic, Common', legendaryActions: '3',
      origin: { name: 'Table book', link: 'https://example.test/drake' }, rulesetId: 'dnd5e-2014' as never,
      traits: [
        t('Heat Aura', { description: 'Creatures that start their turn within 5 feet take fire damage.' }),
        t('Scaled Hide', { effectKind: 'ac_bonus', acBonusAmount: '2' }),
        t('Fire Blood', { effectKind: 'damage_resistance', damageType: 'fire' }),
        t('Legendary Resistance', { effectKind: 'resource_ability', limitedUse: true, uses: '3', recharge: 'long_rest' }),
        t('Fire Breath (Recharge 5-6)', { description: 'The drake exhales fire in a 30-foot cone.' }),
        t('Cinder Cloud', { description: 'Recharge 6. A cloud of cinders fills the air.' }),
      ],
    }) },
    { name: 'senses-and-speed-traits', id: 'night_hound', draft: base({
      name: 'Night Hound', type: 'beast', speed: '50', senses: 'darkvision 120 ft',
      traits: [
        t('Keen Senses', { effectKind: 'sense', senseType: 'darkvision', senseRange: '120' }),
        t('Fleet', { effectKind: 'stat_bonus', statTarget: 'speed', statAmount: '10' }),
      ],
    }) },
    { name: 'empty-fields', id: 'odd', draft: base({ name: 'Odd', hpAverage: 'many', acValue: '', speed: '', stats: stats({ str: 'x', dex: '' }) }) },
    { name: 'no-name', id: 'nameless', draft: base({ name: ' ', type: '', alignment: '', hpDice: '' }) },
    { name: 'hp-dice-odd', id: 'blob', draft: base({ name: 'Blob', hpDice: 'a lot', hpAverage: '30' }) },
  ];
}

export function runMonsterCase(c: MonsterCase) {
  const fields = compileMonsterFields(c.draft, c.id);
  return { fields, validation: validateMonster(fields) };
}

/** The live entity a template spawns into, without what differs on every spawn (its generated id). */
export function spawnedEntity(template: MonsterTemplate): Omit<Entity, 'id'> {
  const { id: _id, actionCards: _cards, ...entity } = spawnMonster(template, DEFAULT_RULES) as Entity & { actionCards?: unknown };
  void _id; void _cards;
  return entity;
}
