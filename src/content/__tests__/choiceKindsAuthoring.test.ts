// The choice kinds the builders gained for the desktop's builder parity: skill, ability improvement or feat, spell, feature pool.
// Each compiles to the shape official content uses, reopens as written, and survives a save of a record that holds it.
import { newDraftChoice, draftChoiceToDefinition, definitionToDraftChoice, validateDraftChoice } from '../choiceDefinitionCompiler';
import { serializeLeveledChoices, hydrateLeveledChoices } from '../../engine/homebrewNestedSerializers';
import { newDraftTrait } from '../traitCompiler';
import { ALL_SKILL_OPTIONS } from '../skills';
import type { ChoiceDefinition, Feature } from '../../engine/types';

const owner = { sourceKind: 'class' as const, sourceRefId: 'mystic', classId: 'mystic' };

it('a skill choice: any skill, or a restricted list', () => {
  const any = draftChoiceToDefinition({ ...newDraftChoice('skill'), localId: 'sk', count: '2' }, 'mystic_');
  expect(any).toMatchObject({ id: 'mystic_sk', kind: 'skill', count: 2, pool: 'all', prompt: 'Choose 2 skill proficiencies.' });
  const some = draftChoiceToDefinition({ ...newDraftChoice('skill'), localId: 'sk', poolMode: 'restricted', restrictedIds: ['arcana', 'history'] }, 'mystic_');
  expect((some.pool as { id: string }[]).map(o => o.id)).toEqual(['arcana', 'history']);
  expect(definitionToDraftChoice(some, 'mystic_')).toMatchObject({ kind: 'skill', poolMode: 'restricted', restrictedIds: ['arcana', 'history'] });
  expect(ALL_SKILL_OPTIONS.length).toBeGreaterThan(10);
});

it('an ability improvement or feat: the shape the class tables use', () => {
  const def = draftChoiceToDefinition({ ...newDraftChoice('asi'), localId: 'asi' }, 'mystic_l4_');
  expect(def).toEqual({ id: 'mystic_l4_asi', prompt: 'Ability Score Improvement or a feat.', kind: 'asi', count: 1, pool: 'all', grants: [], required: true, resolved: false });
  expect(definitionToDraftChoice(def, 'mystic_l4_')).toMatchObject({ kind: 'asi', count: '1' });
});

it('a spell choice carries its own filter, so it keeps its own row; none picked is the own list at castable levels', () => {
  const own = draftChoiceToDefinition({ ...newDraftChoice('spell'), localId: 'sp' }, 'mystic_');
  expect(own).toMatchObject({ kind: 'spell', pool: 'all', spellFilter: {} });
  const secrets = draftChoiceToDefinition({ ...newDraftChoice('spell'), localId: 'sp', count: '2', spellLists: ['any'], spellLevels: [3, 1, 12] }, 'mystic_');
  expect(secrets.spellFilter).toEqual({ lists: 'any', levels: [1, 3] });
  const cantrips = draftChoiceToDefinition({ ...newDraftChoice('spell'), localId: 'sp', spellLists: ['wizard', 'cleric'], spellLevels: [0] }, 'mystic_');
  expect(cantrips.spellFilter).toEqual({ lists: ['wizard', 'cleric'], levels: [0] });
  expect(definitionToDraftChoice(secrets, 'mystic_')).toMatchObject({ kind: 'spell', count: '2', spellLists: ['any'], spellLevels: [1, 3] });
});

it('a feature pool: options are traits, gated on the class level, swappable when said', () => {
  const style = (name: string) => ({ ...newDraftTrait(name), localId: `t_${name}`, effectKind: 'ac_bonus' as const, acBonusAmount: '1' });
  const draft = { ...newDraftChoice('feature_pool'), localId: 'styles', options: [{ trait: style('Guard'), minLevel: '' }, { trait: style('Ward'), minLevel: '5' }], replaceTiming: 'level_up' as const };
  expect(validateDraftChoice(draft)).toEqual([]);
  expect(validateDraftChoice({ ...draft, options: [] })).toEqual(['Add at least one option.']);
  const def = draftChoiceToDefinition(draft, 'mystic_l1_', owner);
  expect(def.kind).toBe('feature_pool');
  const pool = def.pool as { label: string; value: Feature; requires?: unknown }[];
  expect(pool.map(o => o.label)).toEqual(['Guard', 'Ward']);
  expect(pool[0].value.source).toMatchObject({ kind: 'class', refId: 'mystic' });
  expect(pool[1].requires).toEqual([{ kind: 'level', min: 5, classId: 'mystic' }]);
  expect(def.replace).toEqual({ timing: 'level_up', rule: 'Whenever you gain a level.' });
});

it('saving a class keeps what the editor does not author, and what it does, as written', () => {
  const classOwnSpells: ChoiceDefinition = { id: 'mystic_l1_cantrips', prompt: 'Cantrips', kind: 'spell', count: 2, pool: 'all', grants: [], required: true, resolved: false };
  const skill = draftChoiceToDefinition({ ...newDraftChoice('skill'), localId: 'sk' }, 'mystic_l1_');
  const original = [{ level: 1, choices: [classOwnSpells, skill] }];
  const drafts = hydrateLeveledChoices(original, 'mystic');
  expect(drafts.map(d => d.kind)).toEqual(['skill']);
  const saved = serializeLeveledChoices(original, [...drafts, { ...newDraftChoice('asi'), localId: 'asi', level: 4 }], 'mystic', owner);
  expect(saved).toEqual([{ level: 1, choices: [classOwnSpells, skill] }, { level: 4, choices: [expect.objectContaining({ id: 'mystic_l4_asi', kind: 'asi' })] }]);
});
