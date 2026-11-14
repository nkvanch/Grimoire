// ============================================================================
// FILE: src/engine/abilityTotal.ts
// Setting an ability score by its TOTAL. The person types the number they want to see on the sheet; the base score is moved by the
// difference, so race, background, class, feat and item bonuses keep applying and are never added a second time on top of the typed
// number. When something else decides the score outright (an item that sets it, a manual override), moving the base would change
// nothing on the sheet: that is reported instead of changing the base behind the person's back.
// ============================================================================
import { Ability, Entity } from './types';
import { effectiveAbilityScores } from './pipeline';

export const BASE_ABILITY_MIN = 1;
export const BASE_ABILITY_MAX = 30;

export type AbilityTotalResult =
  | { ok: true; entity: Entity }
  | { ok: false; reason: string; entity: Entity };

/** The character with `ability`'s total at `total`, by moving its base score; or why it cannot be done that way. The derived numbers
 *  are left to the caller's own recompute (the sheet's step recomputes with its content). When the base hits its limits the result
 *  carries both the moved character and the reason: apply the one and show the other. */
export function setAbilityTotal(entity: Entity, ability: Ability, total: number): AbilityTotalResult {
  const before = effectiveAbilityScores(entity)[ability];
  if (!Number.isFinite(total)) return { ok: false, reason: 'Enter a whole number.', entity };
  const wanted = Math.round(total);
  if (wanted === before) return { ok: true, entity };
  const base = Math.max(BASE_ABILITY_MIN, Math.min(BASE_ABILITY_MAX, entity.stats[ability] + (wanted - before)));
  if (base === entity.stats[ability]) {
    return { ok: false, entity, reason: `The base score is already at its ${base === BASE_ABILITY_MAX ? 'highest' : 'lowest'} (${base}), so the total stays ${before}.` };
  }
  const moved: Entity = { ...entity, stats: { ...entity.stats, [ability]: base } };
  const after = effectiveAbilityScores(moved)[ability];
  if (after === before) {
    return { ok: false, entity, reason: `Something sets this score to ${before} (an item, a feature or an override). Change that instead.` };
  }
  const next = moved;   // hit points follow Constitution in the pipeline (followConModifier)
  if (after !== wanted) {
    // the base hit its limits: what could be done is done, and the person is told where it stopped
    return { ok: false, entity: next, reason: `The base score stops at ${base}, so the total is ${after}.` };
  }
  return { ok: true, entity: next };
}
