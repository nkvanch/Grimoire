// ============================================================================
// FILE: src/engine/skillCheck.ts
// A skill check as the engine states it: the bonus, whether advantage or disadvantage applies from the character's own active
// effects, and the dice expression for it. The sheet displays this and rolls it; it does not work any of it out (rules 1 and 22).
//
// Advantage reaches a skill check through two typed targets on an advantage/disadvantage effect:
//   skill:<skill_name>        e.g. skill:perception
//   ability_check:<ability>   e.g. ability_check:str   (every check with that ability, and a skill uses its ability)
// A free-text target ("Wisdom (Survival) checks to track fey") stays what it always was, a reminder chip; matching prose to a skill
// would be guessing. An effect gated by a situational question counts only while the player has answered Yes.
// Advantage and disadvantage from different sources cancel to a straight roll, as they do on the table.
// ============================================================================
import type { Entity, SkillName, Ability, AdvantageState } from './types';
import { modifier, collectAllEffects, applyStatModifiers, applyAbilitySubstitutions } from './pipeline';

export type SkillCheck = {
  bonus:       number;
  state:       AdvantageState;
  /** What the app rolls: 1d20, 2d20kh1 or 2d20kl1, plus the bonus. */
  expression:  string;
  /** The advantage/disadvantage targets that applied, for the sheet to show why. */
  sources:     string[];
};

export function skillCheckBonus(entity: Entity, skill: SkillName, ability: Ability): number {
  const effects = collectAllEffects(entity);
  const stats = applyAbilitySubstitutions(applyStatModifiers(entity.stats, effects), effects, 'ability_checks');
  const entry = entity.skills.skills[skill];
  const prof = entry?.expertise ? 2 : entry?.trained ? 1 : 0;
  // Bonuses effects give to this one skill (target 'skill.<name>'), the same ones the passive scores already include.
  const fromEffects = effects
    .filter(ae => ae.effect.type === 'stat_modifier' && ae.effect.target === `skill.${skill}` && ae.effect.operation === 'add' && typeof ae.effect.value === 'number')
    .reduce((sum, ae) => sum + (ae.effect.value as number), 0);
  return modifier(stats[ability]) + entity.derived.proficiencyBonus * prof + (entry?.bonus ?? 0) + fromEffects;
}

export function skillCheckAdvantage(entity: Entity, skill: SkillName, ability: Ability): { state: AdvantageState; sources: string[] } {
  const wanted = new Set([`skill:${skill}`, `ability_check:${ability}`]);
  const hits = (entity.derived.advantageStates ?? []).filter(a => wanted.has(a.target));
  const adv = hits.some(h => h.state === 'advantage');
  const dis = hits.some(h => h.state === 'disadvantage');
  const state: AdvantageState = adv && dis ? 'straight' : adv ? 'advantage' : dis ? 'disadvantage' : 'straight';
  return { state, sources: hits.map(h => h.target) };
}

export function skillCheck(entity: Entity, skill: SkillName, ability: Ability): SkillCheck {
  const bonus = skillCheckBonus(entity, skill, ability);
  const { state, sources } = skillCheckAdvantage(entity, skill, ability);
  const dice = state === 'advantage' ? '2d20kh1' : state === 'disadvantage' ? '2d20kl1' : '1d20';
  return { bonus, state, sources, expression: `${dice}${bonus >= 0 ? '+' : ''}${bonus}` };
}
