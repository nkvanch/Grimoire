// A campaign locked to a ruleset (LIFE-004 step 6, the desktop app's campaignAdmission): only characters of that ruleset join its party.
import { campaignAdmission } from '../campaignLock';

it('admits a character of the locked ruleset, refuses another, and says why', () => {
  expect(campaignAdmission({ rulesetId: 'dnd5e-2014' }, { rulesetId: 'dnd5e-2014' })).toBe('');
  expect(campaignAdmission({ rulesetId: 'dnd5e-2014' }, { rulesetId: 'dnd5e-2024' })).toBe('This campaign is locked to dnd5e-2014, and this character is dnd5e-2024.');
});

it('a campaign that is not locked, or a character that names no ruleset, is not refused', () => {
  expect(campaignAdmission({}, { rulesetId: 'dnd5e-2024' })).toBe('');
  expect(campaignAdmission({ rulesetId: 'dnd5e-2014' }, {})).toBe('');
});
