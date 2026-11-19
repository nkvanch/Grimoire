// A character with no ruleset (the sample character, characters saved before characters had one) is a 2014 character
// (found 2026-11-17: its condition picker listed every condition twice, the 2014 and the 2024 record, because content looked up
// for "no ruleset" covers every edition).
import { buildSrd51Pack, buildSrd521Pack } from '../../content/packs/srdPacks';
import { conditionsForRuleset } from '../../content/conditions/resolve';
import { makeEmptyEntity, withDefaultRuleset, LEGACY_RULESET_ID } from '../defaults';
import type { Condition } from '../types';

const records = [...(buildSrd51Pack().homebrew?.conditions ?? []), ...(buildSrd521Pack().homebrew?.conditions ?? [])] as Condition[];

it('with no ruleset the content covers both editions, so each condition came twice', () => {
  const ids = conditionsForRuleset(records, makeEmptyEntity('e').rulesetId).map(c => c.id);
  expect(ids.length).toBe(2 * new Set(ids).size);
});

it('a character with no ruleset gets the 2014 rules, so each condition once, in its 2014 version; a set ruleset is kept', () => {
  const e = withDefaultRuleset(makeEmptyEntity('e'));
  expect(e.rulesetId).toBe(LEGACY_RULESET_ID);
  const list = conditionsForRuleset(records, e.rulesetId);
  expect(list.length).toBe(new Set(list.map(c => c.id)).size);
  expect(list.every(c => c.rulesetId !== 'dnd5e-2024')).toBe(true);
  const modern = { ...makeEmptyEntity('m'), rulesetId: 'dnd5e-2024' as never };
  expect(withDefaultRuleset(modern)).toBe(modern);
});
