import { modifier } from './abilityMath';
import { resolveEffectsForTarget } from './resolver';
import { Entity, SkillName, ActiveEffect, Ability, CampaignRules } from './types';

/** Computes the final bonus for a single skill. */
export function resolveSkill(
  entity:  Entity,
  stats:   Entity['stats'],
  skill:   SkillName,
  effects: ActiveEffect[],
  prof:    number,
): number {
  const entry = entity.skills.skills[skill];
  if (!entry) return 0;
  const baseMod        = modifier(stats[entry.ability]);
  const profMultiplier = entry.expertise ? 2 : entry.trained ? 1 : 0;
  const baseScore      = baseMod + prof * profMultiplier + (entry.bonus ?? 0);

  // Apply stat_modifier effects targeting this specific skill
  // target format: 'skill.perception', 'skill.athletics', etc.
  const skillBonus = effects
    .filter(ae =>
      ae.effect.type      === 'stat_modifier' &&
      ae.effect.target    === `skill.${skill}` &&
      ae.effect.operation === 'add' &&
      typeof ae.effect.value === 'number'
    )
    .reduce((sum, ae) => sum + (ae.effect.value as number), 0);

  return baseScore + skillBonus;
}

/**
 * Ability substitution ("use Constitution instead of Strength for ..."): the scores a roll of this kind reads. Where an active
 * `ability_substitute` effect replaces ability A with B for the kind, A reads as B's score when that is higher. Pure; the input
 * scores are the character's effective scores and are not changed.
 */
export function applyAbilitySubstitutions(
  stats:   Entity['stats'],
  effects: ActiveEffect[],
  kind:    import('./types').AbilityUseKind,
): Entity['stats'] {
  let out = stats;
  for (const ae of effects) {
    const fx = ae.effect;
    if (fx.type !== 'ability_substitute' || !fx.substituteFrom || !fx.substituteTo || !(fx.substituteFor ?? []).includes(kind)) continue;
    if (stats[fx.substituteTo] > out[fx.substituteFrom]) out = { ...out, [fx.substituteFrom]: stats[fx.substituteTo] };
  }
  return out;
}

/** Computes saving throw bonus for all six abilities. */
export function resolveSavingThrows(
  stats:        Entity['stats'],
  proficientIn: Ability[],
  prof:         number,
  effects:      ActiveEffect[],
  rules:        CampaignRules,
): Record<Ability, number> {
  const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const output = {} as Record<Ability, number>;
  for (const ab of abilities) {
    const base  = modifier(stats[ab]) + (proficientIn.includes(ab) ? prof : 0);
    // Reuses the savingThrows.<ability> target convention DM overrides
    // already use (see the "SIG-1" override loop above) so item/feat
    // effects and DM overrides share one naming scheme.
    const bonus = resolveEffectsForTarget(`savingThrows.${ab}`, effects, rules) as number;
    output[ab] = base + bonus;
  }
  return output;
}
