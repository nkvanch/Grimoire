import { effectiveAbilityScores } from './derivedStats';
import { modifier } from './abilityMath';
import { hpMinHalfDie } from './houseRules';
import { Entity, CampaignRules, Ability } from './types';

// ── helpers ──────────────────────────────────────────────────────────────────

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

// ── HP per level ──────────────────────────────────────────────────────────────

/**
 * Closure 4A: the pure HP-gain calculation, extracted out of applyHP so a
 * level-up PREVIEW (HpRollGate, TabCharacter.tsx) can show the EXACT number
 * that will actually be applied — one source of truth instead of a second,
 * separately maintained copy of this formula that could (and did: the
 * hpMinHalfDie house-rule floor was previously missing from the preview
 * entirely) silently drift out of sync with what applyHP itself computes.
 * Never rolls on its own behalf for 'rolled' mode: a caller previewing a
 * value always already has a concrete candidate (the manually-entered or
 * app-rolled die result) to pass as `manualRoll` — this function only ever
 * turns a KNOWN roll (or a deterministic mode) into a final HP gain.
 */
export function calculateLevelUpHpGain(
  entity: Entity,
  die: number,
  mode: CampaignRules["hpMode"],
  rules: CampaignRules | undefined,
  hpAbility: Ability,
  isVeryFirstLevel: boolean,
  manualRoll?: number,
): number {
  // Use effectiveStats[hpAbility] so race bonuses (e.g. Dwarf +2 CON) feed
  // into HP. Defaults to CON (standard 5e RAW) — every existing class passes
  // no explicit ability and is completely unaffected. hpAbility lets a
  // homebrew class reflavor HP around a different score (e.g. CHA).
  const abilityMod = modifier(effectiveAbilityScores(entity)[hpAbility]);

  let rolled = isVeryFirstLevel
    ? die                                           // Very first level: always max die
    : mode === "max"    ? die
    : mode === "fixed"  ? Math.floor(die / 2) + 1
    : manualRoll !== undefined ? manualRoll
    : rollDie(die);

  // House rule: HP minimum half-die. A rolled value below half the die is bumped
  // up to half (rounded up), e.g. d10 → minimum 5. Only affects rolled mode
  // beyond level 1 (fixed/max already meet or exceed this).
  if (rules && mode === 'rolled' && !isVeryFirstLevel && hpMinHalfDie(rules)) {
    const halfDie = Math.ceil(die / 2);
    if (rolled < halfDie) rolled = halfDie;
  }

  return Math.max(1, rolled + abilityMod);
}

/**
 * Closure 4C: strict validation for a manually-entered/rolled level-up HP
 * die result — a complete positive integer within [1, dieSize]. Same
 * "reject a partial parse" reasoning as monsterFactory.ts's
 * isValidManualHp: JS's own parseInt silently accepts "5abc" as 5 and
 * treats "5.5" as 5, dropping everything after the leading digits — this
 * requires the ENTIRE trimmed string to be exactly one valid integer.
 */
export function isValidHpRoll(draft: string, dieSize: number): boolean {
  const trimmed = draft.trim();
  if (!/^[1-9][0-9]*$/.test(trimmed)) return false;
  const n = parseInt(trimmed, 10);
  return n >= 1 && n <= dieSize;
}

export function applyHP(
  entity: Entity,
  die: number,
  mode: CampaignRules["hpMode"],
  atLevel: number,
  rules?: CampaignRules,
  hpAbility: Ability = 'con',
  /**
   * Whether this is the character's very first level EVER (max die,
   * standard 5e RAW) — defaults to `atLevel === 1`, which is exactly right
   * for single-class characters (levelUp() only ever passes atLevel=1 once,
   * at creation). Multiclass callers (levelUpClass()) pass this explicitly:
   * a SECOND class's own level 1 must NOT re-max HP, only the character's
   * true first level does.
   */
  isVeryFirstLevel: boolean = atLevel === 1,
  /**
   * Table-first resolution: when mode === 'rolled', a caller that already
   * has the physically-rolled die result passes it here instead of letting
   * this function call rollDie(die) itself. Ignored for every other mode
   * (isVeryFirstLevel/'max'/'fixed' are already deterministic and must stay
   * exactly as they were). undefined (every existing caller) reproduces the
   * previous rollDie(die) behavior exactly — this parameter is additive.
   */
  manualRoll?: number,
): Entity {
  const gain = calculateLevelUpHpGain(entity, die, mode, rules, hpAbility, isVeryFirstLevel, manualRoll);

  return {
    ...entity,
    resources: {
      ...entity.resources,
      hp: {
        // Spread first: carries HPBlock.bonusApplied across, so a max_hp-effect bonus isn't
        // forgotten (and then re-added on the next recompute) just because the character levelled.
        ...entity.resources.hp,
        current: entity.resources.hp.current + gain,
        maximum: entity.resources.hp.maximum + gain,
        temp:    entity.resources.hp.temp
      },
      hitDice: addHitDie(entity.resources.hitDice, die),
    }
  };
}

/**
 * Adds one hit die of the given size to a HitDiceBlock, correctly — see
 * HitDiceBlock's own doc comment (types.ts) for the bug this fixes.
 * Backfills `pools` from the existing scalar state the first time a
 * SECOND die size shows up; stays pools-free (and therefore identical to
 * the pre-fix behavior) for single-class characters and same-die-size
 * multiclass combinations.
 */
function addHitDie(hitDice: Entity['resources']['hitDice'], die: number): Entity['resources']['hitDice'] {
  const pools = hitDice.pools
    ?? (hitDice.total > 0 ? [{ die: hitDice.die, total: hitDice.total, remaining: hitDice.remaining }] : []);
  const idx = pools.findIndex(p => p.die === die);
  const nextPools = idx >= 0
    ? pools.map((p, i) => i === idx ? { ...p, total: p.total + 1, remaining: p.remaining + 1 } : p)
    : [...pools, { die, total: 1, remaining: 1 }];
  return {
    ...hitDice,
    die,
    total:     nextPools.reduce((sum, p) => sum + p.total, 0),
    remaining: nextPools.reduce((sum, p) => sum + p.remaining, 0),
    pools:     nextPools.length > 1 ? nextPools : undefined,
  };
}

// ── recalculateAllHP ─────────────────────────────────────────────────────────

/**
 * Recalculates the character's total HP from scratch using their FINAL ability
 * scores (after race bonuses) and their class hit die.
 *
 * Call this in the review step, AFTER recomputeDerived(), so that race bonuses
 * from features have been applied to effectiveStats before HP is computed.
 *
 * Creation order mismatch fix: if the player chose class before setting scores,
 * HP was computed with CON mod 0. This corrects it.
 *
 * Level 1:   always max die + CON mod (minimum 1).
 * Level 2+:  fixed = floor(die/2)+1+CON mod, max = die+CON mod (min 1 each).
 */
export function recalculateAllHP(entity: Entity, rules: CampaignRules, hpAbility: Ability = 'con'): Entity {
  const level = entity.identity.level;
  if (level <= 0) return entity;

  const die  = entity.resources.hitDice.die;

  // Use effectiveStats so race bonuses count
  const abilityMod = modifier(effectiveAbilityScores(entity)[hpAbility]);

  // Level 1: always max die
  let totalHP = Math.max(1, die + abilityMod);

  // Levels 2+
  for (let lvl = 2; lvl <= level; lvl++) {
    const gained = rules.hpMode === 'max'
      ? die + abilityMod
      : Math.floor(die / 2) + 1 + abilityMod;
    totalHP += Math.max(1, gained);
  }

  return {
    ...entity,
    resources: {
      ...entity.resources,
      hp: { current: totalHP, maximum: totalHP, temp: 0 },
      hitDice: { ...entity.resources.hitDice, total: level, remaining: level },
    },
  };
}
