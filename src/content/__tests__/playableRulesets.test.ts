// "Correct before broad": the engine runs 5e (2014 and 2024) only, so nothing offers to tag homebrew, base a rule
// profile, or switch a character to another game or edition. The registry keeps the other ids so content tagged with
// them is labelled, not misread.
import { PLAYABLE_RULESET_IDS, isPlayableRuleset, RULESETS, rulesetLabel } from '../rulesets';

describe('playable rulesets', () => {
  it('are the two 5e rulesets', () => {
    expect([...PLAYABLE_RULESET_IDS].sort()).toEqual(['dnd5e-2014', 'dnd5e-2024']);
    expect(isPlayableRuleset('pf2e' as never)).toBe(false);
    expect(isPlayableRuleset('dnd4e' as never)).toBe(false);
    expect(isPlayableRuleset(undefined)).toBe(false);
  });

  it('every playable ruleset is in the registry, and other registered ids still have a label', () => {
    for (const id of PLAYABLE_RULESET_IDS) expect(RULESETS[id]).toBeDefined();
    expect(rulesetLabel('pf2e' as never)).toBe('Pathfinder 2e');
  });
});
