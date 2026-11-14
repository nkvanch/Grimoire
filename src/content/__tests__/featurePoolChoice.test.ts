import { makeEmptyEntity, DEFAULT_RULES } from '../../store/characterStore';
import { applyPoolChoiceToEntity, queueChoice, replacePoolOption, replaceableOptions } from '../../engine/leveling';
import { newDraftTrait } from '../traitCompiler';
import {
  featurePoolDraftToDefinition, definitionToFeaturePoolDraft, validateFeaturePoolDraft, newFeaturePoolDraft, type FeaturePoolDraft,
} from '../featurePoolChoice';
import { definitionToDraftChoice } from '../choiceDefinitionCompiler';

const trait = (name: string, over: object = {}) => ({ ...newDraftTrait(name), localId: `t_${name}`, ...over });
const draft = (over: Partial<FeaturePoolDraft> = {}): FeaturePoolDraft => ({
  ...newFeaturePoolDraft(), localId: 'styles', count: '1', replaceTiming: 'level_up',
  options: [
    { trait: trait('Iron Skin', { effectKind: 'ac_bonus', acBonusAmount: '1' }), minLevel: '' },
    { trait: trait('Quick Feet', { effectKind: 'stat_bonus', statTarget: 'speed', statOperation: 'add', statAmount: '10' }), minLevel: '' },
  ],
  ...over,
});
const owner = { sourceKind: 'class' as const, sourceRefId: 'hb_class', classId: 'hb_class' };

describe('feature pool authoring', () => {
  it('compiles to a pool the engine resolves, and the held option can be swapped', () => {
    const def = featurePoolDraftToDefinition(draft(), 'hb_class_l1_', owner);
    expect(def.kind).toBe('feature_pool');
    expect(def.replace).toEqual({ timing: 'level_up', rule: 'Whenever you gain a level.' });
    const options = def.pool as { id: string; label: string }[];
    expect(options.map(o => o.label)).toEqual(['Iron Skin', 'Quick Feet']);

    const queued = queueChoice(makeEmptyEntity('t'), def, 1, 'homebrew');
    const choiceId = queued.choices[0].id;
    const picked = applyPoolChoiceToEntity(queued, choiceId, [options[0].id], DEFAULT_RULES);
    expect(picked.features.map(f => f.id)).toContain(options[0].id);
    expect(picked.features.find(f => f.id === options[0].id)?.source).toEqual({ kind: 'class', refId: 'hb_class' });

    expect(replaceableOptions(picked, choiceId)[0].candidates.map(c => c.id)).toEqual([options[1].id]);
    const swapped = replacePoolOption(picked, choiceId, options[0].id, options[1].id, DEFAULT_RULES);
    expect(swapped.features.map(f => f.id)).toContain(options[1].id);
    expect(swapped.features.map(f => f.id)).not.toContain(options[0].id);
  });

  it('reopens as written, in the phone editor too; a pool no editor wrote is left untouched', () => {
    const def = featurePoolDraftToDefinition(draft({ replaceRule: 'Each dawn.' }), 'hb_class_l1_', owner);
    const back = definitionToFeaturePoolDraft(def, 'hb_class_l1_');
    expect(back).toEqual(draft({ replaceRule: 'Each dawn.', prompt: 'Choose one option.' }));
    expect(definitionToDraftChoice(def, 'hb_class_l1_')).toMatchObject({ kind: 'feature_pool', localId: 'styles', options: back!.options, replaceTiming: 'level_up' });
    const { authoredOptions: _, ...official } = def;
    expect(definitionToDraftChoice(official, 'hb_class_l1_')).toBeNull();
  });

  it('refuses what the engine would silently lose', () => {
    expect(validateFeaturePoolDraft(draft({ options: [] }))).toEqual(['Add at least one option.']);
    const own = draft({ options: [{ trait: trait('Limited', { limitedUse: true }), minLevel: '' }] });
    expect(validateFeaturePoolDraft(own)[0]).toMatch(/own use counter/);
    const spells = draft({ options: [{ trait: trait('Spells', { effectKind: 'spell_grant' }), minLevel: '' }] });
    expect(validateFeaturePoolDraft(spells)[0]).toMatch(/limited-use ability or grant spells/);
  });

  it('gates an option on the owning class level', () => {
    const gated = draft({ options: [{ trait: trait('Late'), minLevel: '5' }, { trait: trait('Early'), minLevel: '' }] });
    const def = featurePoolDraftToDefinition(gated, 'hb_class_l1_', owner);
    expect((def.pool as { requires?: unknown }[])[0].requires).toEqual([{ kind: 'level', min: 5, classId: 'hb_class' }]);
    expect((def.pool as { requires?: unknown }[])[1].requires).toBeUndefined();
  });
});
