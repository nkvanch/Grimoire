// The SRD 5.1 Warlock's Eldritch Invocations and Mystic Arcanum are real picks (found 2026-11-13: both were text only, "note the
// ones you take", while the 2024 Warlock already offered them).
import { ALL_PROGRESSIONS } from '..';
import { ChoiceDefinition, ChoiceOption, Feature, ResourceGrant } from '../../../engine/types';

const entriesAt = (level: number) => ALL_PROGRESSIONS.warlock.entries.filter(e => e.level === level);
const invocationPickAt = (level: number): ChoiceDefinition | undefined =>
  entriesAt(level).flatMap(e => e.choices).find(c => c.kind === 'feature_pool' && c.id.includes('invocations'));
const optionsOf = (c: ChoiceDefinition | undefined): ChoiceOption[] => (Array.isArray(c?.pool) ? c.pool : []);
const option = (key: string): ChoiceOption => optionsOf(invocationPickAt(2)).find(o => o.id === `invocation_${key}`)!;

describe('SRD 5.1 Eldritch Invocations are a real pick', () => {
  it('two at 2nd level and one more at 5th, 7th, 9th, 12th, 15th and 18th: eight in all', () => {
    const counts = [2, 5, 7, 9, 12, 15, 18].map(l => invocationPickAt(l)?.count);
    expect(counts).toEqual([2, 1, 1, 1, 1, 1, 1]);
    for (const l of [3, 4, 6, 8, 10, 11, 13, 14, 16, 17, 19, 20]) expect(invocationPickAt(l)).toBeUndefined();
  });

  it('every pick offers the same 32 SRD 5.1 invocations, with the same feature, so one taken is not offered again', () => {
    const first = optionsOf(invocationPickAt(2));
    expect(first).toHaveLength(32);
    for (const l of [5, 7, 9, 12, 15, 18]) {
      expect(optionsOf(invocationPickAt(l)).map(o => (o.value as Feature).id)).toEqual(first.map(o => (o.value as Feature).id));
    }
  });

  it('prerequisites: the warlock level, a Pact Boon, the Eldritch Blast cantrip', () => {
    expect(option('thirsting_blade').requires).toEqual([
      { kind: 'level', min: 5 }, { kind: 'has_option', optionId: 'pact_of_the_blade', label: 'Pact of the Blade' }]);
    expect(option('agonizing_blast').requires).toEqual([{ kind: 'spell', spellId: 'eldritch_blast', label: 'the Eldritch Blast cantrip' }]);
    expect(option('chains_of_carceri').requires).toEqual([
      { kind: 'level', min: 15 }, { kind: 'has_option', optionId: 'pact_of_the_chain', label: 'Pact of the Chain' }]);
    expect(option('armor_of_shadows').requires).toBeUndefined();
    // the pact options the prerequisites name are the 3rd-level Pact Boon's own option ids
    const pacts = entriesAt(3).flatMap(e => e.choices).find(c => c.id === 'warlock_pact_boon');
    expect(optionsOf(pacts).map(o => o.id)).toEqual(['pact_of_the_chain', 'pact_of_the_blade', 'pact_of_the_tome']);
  });

  it('an invocation that casts a spell at will puts that spell on the sheet', () => {
    const fx = (option('armor_of_shadows').value as Feature).effects;
    expect(fx).toEqual([expect.objectContaining({ type: 'grant_spell', spellIds: ['mage_armor'] })]);
    expect((option('devils_sight').value as Feature).effects).toEqual([]);
  });

  it('Beguiling Influence makes the warlock proficient in Deception and Persuasion on the sheet', () => {
    expect((option('beguiling_influence').value as Feature).effects).toEqual([
      expect.objectContaining({ type: 'grant_proficiency', target: 'skill:deception' }),
      expect.objectContaining({ type: 'grant_proficiency', target: 'skill:persuasion' })]);
  });

  it('one invocation can be swapped at each warlock level', () => {
    expect(invocationPickAt(2)?.replace?.timing).toBe('level_up');
  });

  it('the feature no longer says to note the invocations by hand', () => {
    const f = entriesAt(2).flatMap(e => e.grants).map(g => g.value as Feature).find(v => v.id === 'eldritch_invocations')!;
    expect(f.description).not.toMatch(/not offered as a pick/);
  });
});

describe('SRD 5.1 Mystic Arcanum is a real pick with a free casting', () => {
  it.each([[11, 6], [13, 7], [15, 8], [17, 9]])('warlock level %i: one level %i warlock spell, cast once per long rest without a slot', (classLevel, spellLevel) => {
    const grants = entriesAt(classLevel).flatMap(e => e.grants);
    const feat = grants.map(g => g.value as Feature & { grantsChoices?: ChoiceDefinition[] }).find(v => v.id === `mystic_arcanum_${spellLevel}`)!;
    expect(feat.grantsChoices).toHaveLength(1);
    const pick = feat.grantsChoices![0];
    expect(pick).toMatchObject({ kind: 'spell', count: 1, spellFilter: { lists: ['warlock'], levels: [spellLevel] } });
    expect(feat.activation?.resourceCost?.resourceId).toBe(`mystic_arcanum_${spellLevel}`);
    const pool = grants.filter(g => g.kind === 'resource').map(g => g.value as ResourceGrant).find(r => r.resourceId === `mystic_arcanum_${spellLevel}`);
    expect(pool).toMatchObject({ maximum: 1, recharge: 'long_rest' });
  });
});
