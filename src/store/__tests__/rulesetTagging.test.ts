// src/store/__tests__/rulesetTagging.test.ts
// End-to-end proof for Phase 5 of the fundamental-changes migration: does
// the ruleset-tagging pipeline built in Phases 3/4 (branded RulesetId,
// Race.rulesetId/Background.rulesetId, matchesRuleset(),
// getMergedContentDB()'s ruleset filter) actually work, exercised by two
// real pieces of content (raceHuman2024 in src/content/races/index.ts,
// bgAcolyte2024 in src/content/backgrounds/index.ts) rather than just
// unit-tested in isolation? Lives here (not under content/races or
// content/backgrounds) because it's really testing homebrewStore's merge
// function, not any one content type.
import { useHomebrewStore } from '../homebrewStore';
import { asRulesetId } from '../../engine/types';

describe('ruleset tagging end-to-end (Phase 5 proof slice)', () => {

  it('an explicit dnd5e-2014-active view does NOT see 2024-tagged content, but still sees untagged/shared content', () => {
    const db = useHomebrewStore.getState().getMergedContentDB(asRulesetId('dnd5e-2014'));
    const raceIds = db.races.map(r => r.id);
    const bgIds   = db.backgrounds.map(b => b.id);
    expect(raceIds).not.toContain('human_2024');
    expect(raceIds).toContain('human');
    expect(raceIds).toContain('elf');
    expect(bgIds).not.toContain('acolyte_2024');
    expect(bgIds).toContain('acolyte');
  });
});
