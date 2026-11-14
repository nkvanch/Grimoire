// ============================================================================
// FILE: src/engine/campaignLock.ts
// A campaign locked to a ruleset (contract LIFE-004 step 6, the desktop app's campaignAdmission in core/live/Campaign): the characters admitted
// to its party must be of that ruleset. The revision the ruleset had when it was chosen is recorded beside it, so a later one can be told apart.
// ============================================================================

/** Why a character may not join this campaign's party; '' when it may: the campaign is not locked, the character is of the locked ruleset, or it
 *  names none (there is nothing to compare, so it is not refused). */
export function campaignAdmission(campaign: { rulesetId?: string }, character: { rulesetId?: string }): string {
  const locked = campaign.rulesetId, theirs = character.rulesetId;
  if (!locked || !theirs || theirs === locked) return '';
  return `This campaign is locked to ${locked}, and this character is ${theirs}.`;
}
