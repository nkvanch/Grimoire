// Standalone subraces for the native-parity fixtures: what a draft compiles to, and a character made with one.
import type { Subrace } from '../types';
import { compileSubraceFields, type SubraceDraft } from '../../content/homebrewCompile';
import { validateRace } from '../homebrewValidator';
import { trait } from './parityHomebrewScenarios';

export type SubraceCase = { name: string; parentId: string; draft: SubraceDraft };

const none = { str: '', dex: '', con: '', int: '', wis: '', cha: '' };

export function buildSubraceCases(): SubraceCase[] {
  return [
    { name: 'minimal', parentId: 'elf', draft: { name: 'Ash Elf', abiBonuses: none, traits: [] } },
    { name: 'scores-and-traits', parentId: 'dwarf', draft: {
      name: ' Deep Dwarf ', abiBonuses: { ...none, str: '1', wis: '2', cha: '0' },
      traits: [
        trait('Stone Sense', { effectKind: 'sense', senseType: 'darkvision', senseRange: '120' }),
        trait('Stone Sense', { description: 'A second trait with the same name.' }),
        trait('Deep Reserves', { effectKind: 'resource_ability', limitedUse: true, uses: '2', recharge: 'long_rest' }),
      ],
      origin: { name: 'Underhall', link: 'https://example.test/deep' }, rulesetId: 'dnd5e-2014' as never,
    } },
    { name: 'with-choices', parentId: 'human', draft: {
      name: 'Wanderer', abiBonuses: { ...none, dex: '1' }, traits: [trait('Road Wise', { effectKind: 'skill_proficiency', skillTarget: 'survival' })],
      pendingChoices: [{ localId: 'p1', kind: 'language', count: '1', prompt: '', poolMode: 'all', categories: [], restrictedIds: [] }],
    } },
    { name: 'no-name', parentId: 'elf', draft: { name: ' ', abiBonuses: none, traits: [] } },
  ];
}

export function runSubraceCase(c: SubraceCase) {
  const fields: Subrace = compileSubraceFields(c.draft, c.parentId);
  return { fields, validation: validateRace(fields) };
}
