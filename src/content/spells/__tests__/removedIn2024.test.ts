// Branding Smite is in SRD 5.1 but not in SRD 5.2.1: it is shown to 2014 characters and hidden from 2024 browsing.
import { FULL_SPELL_LIBRARY } from '../index';
import { matchesRuleset } from '../../../engine/types';

describe('spells the 2024 rules dropped', () => {
  const s = FULL_SPELL_LIBRARY.find(x => x.id === 'branding_smite')!;
  it('is a 2014 spell', () => {
    expect(s.rulesetId).toBe('dnd5e-2014');
    expect(matchesRuleset(s.rulesetId, 'dnd5e-2014' as never)).toBe(true);
  });
  it('is not offered under the 2024 ruleset', () => {
    expect(matchesRuleset(s.rulesetId, 'dnd5e-2024' as never)).toBe(false);
  });
  it('Shining Smite, its 2024 replacement, is offered', () => {
    const shining = FULL_SPELL_LIBRARY.find(x => x.id === 'shining_smite')!;
    expect(matchesRuleset(shining.rulesetId, 'dnd5e-2024' as never)).toBe(true);
  });
});
