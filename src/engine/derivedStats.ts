// ============================================================================
// FILE: src/engine/derivedStats.ts
// PROJECT: Derived Stat Computation Engine
//
// PIPELINE ORDER (last applied = highest priority):
//   Base stats → Feature passive effects → Equipment effects →
//   Condition effects → Campaign rule clamps → DM Overrides (wins over all)
//
// recomputeStats() is everything recomputeDerived() (pipeline.ts) does except the action cards. It lives here, below
// actionCards.ts, so the modules the cards are built from can read effects and scores without importing the cards back.
// The UI always reads from entity.derived and never computes stats itself.
// ============================================================================

import { findBeastForm } from '../content/runtimeRules';
import { KI_SAVE_FEATURE_ID } from './ruleset/dnd5e';
import { isFeatureSuspended } from './suspension';
import { exhaustionSpeedPenalty } from './exhaustion';
import {
  Entity, CampaignRules, DerivedStats, ActiveEffect,
  Ability, SkillName, DERIVED_NUMERIC_KEYS, Sense, AuditSourceKind,
} from './types';
import { tierHpBonus, hitDieTierFromEffects } from './hitDieTier';
import { resolveEffectsForTarget, resolveBinary, resolveCombine, resolveExtraAttack, resolveScaleFactor, applyScale } from './resolver';
import type { CardGenOptions } from './actionCardLayers';
import { deriveProficienciesFromEntitlements, initializeEntitlementInputs, recomputeResourceMaximums } from './entitlements';
import { modifier, proficiencyBonus, abilityDC } from './abilityMath';
import { collectAllEffects } from './collectEffects';
import { computeWeaponAttackBonuses } from './weaponAttackBonuses';
import { resolveSkill, applyAbilitySubstitutions, resolveSavingThrows } from './skillsAndSaves';

/** One base_ac_formula effect's resolved value, with enough source identity
 * for audit.ts to label it (recomputeDerived only needs .total). */
export type AcFormulaCandidate = {
  label: string; kind: AuditSourceKind; id: string;
  base: number; abilities: Ability[]; total: number;
};

/**
 * Picks the winning base_ac_formula effect (Unarmored Defense, Mage Armor,
 * etc.) — 5e rule: you use whichever formula gives the higher AC, formulas
 * never stack with each other. Shared by recomputeDerived (armor fallback
 * chain) and audit.ts's AC breakdown so they can never compute a different
 * winner. Returns null when no base_ac_formula effect is active.
 */
export function selectBestAcFormula(
  allEffects:     ActiveEffect[],
  effectiveStats: Entity['stats'],
): AcFormulaCandidate | null {
  const formulaEffects = allEffects.filter(ae => ae.effect.type === 'base_ac_formula');
  if (formulaEffects.length === 0) return null;
  // "You may add your full Dexterity modifier to your AC while wearing medium armor": a `set` on armor_dex_cap raises the +2
  // limit a medium armor formula carries (a higher cap wins; armor with no Dex cap is unaffected).
  const dexCapRaise = allEffects
    .filter(ae => ae.effect.target === 'armor_dex_cap' && ae.effect.operation === 'set' && typeof ae.effect.value === 'number')
    .reduce((m, ae) => Math.max(m, ae.effect.value as number), -Infinity);
  const candidates = formulaEffects.map((ae): AcFormulaCandidate => {
    const baseValue = ae.effect.value as number;
    const abilities = (ae.effect.formulaAbilities ?? []);
    const abilityBonus = abilities.reduce((sum, ab) => {
      const rawMod = modifier(effectiveStats[ab]);
      // formulaAbilityCap: e.g. { dex: 2 } for medium armor (PHB p.144)
      const printedCap = ae.effect.formulaAbilityCap?.[ab];
      const cap = printedCap !== undefined && ab === 'dex' && dexCapRaise > printedCap ? dexCapRaise : printedCap;
      return sum + (cap !== undefined ? Math.min(rawMod, cap) : rawMod);
    }, 0);
    return {
      label: ae.sourceName, kind: ae.sourceKind ?? 'base', id: ae.sourceId,
      base: baseValue, abilities, total: baseValue + abilityBonus,
    };
  });
  return candidates.reduce((a, b) => (b.total > a.total ? b : a));
}

/**
 * Applies all stat_modifier passive effects that target an ability score
 * (str/dex/con/int/wis/cha) on top of the base scores.
 * This is what makes race bonuses (+1 STR etc.) feed into
 * modifier calculations for AC, initiative, saves, and skills.
 * Exported so leveling.ts can compute effectiveStats.con for HP calculations.
 */
// Explicitly exported so the Abilities tab and AsiFeatPicker can display
// effective scores (base + race/feat effects) rather than raw base stats.
export function applyStatModifiers(
  base:    Entity['stats'],
  effects: ActiveEffect[],
): Entity['stats'] {
  const abilities: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const result = { ...base };
  for (const ab of abilities) {
    const allForAbility = effects.filter(
      ae => ae.effect.type === 'stat_modifier' && ae.effect.target === ab
    );
    // "Your score becomes N if it is lower" (a "score becomes N" effect): an
    // `atLeast` set is a floor applied AFTER everything else, never a replacement that could lower
    // a higher score, so it is kept out of the ordinary set/add resolution below.
    const floors   = allForAbility.filter(ae => ae.effect.atLeast && ae.effect.operation === 'set' && typeof ae.effect.value === 'number');
    const relevant = allForAbility.filter(ae => !floors.includes(ae));
    if (relevant.length === 0) {
      if (floors.length) result[ab] = Math.max(result[ab], ...floors.map(f => f.effect.value as number));
      continue;
    }
    // Bug fix: this used to pick the 'set' effect by array order ("last
    // one wins"), which is order-dependent — shuffling collectAllEffects's
    // iteration order could change which 'set' effect won, and therefore
    // the character's effective ability score. resolveCombine (resolver.ts)
    // already resolves competing 'set' effects order-independently
    // (highest value wins) for ac/speed/every other stat_modifier target;
    // this now uses the exact same function, and the exact same "does a
    // 'set' exist? then that resolved value IS the score; otherwise add
    // the resolved (additive-only) delta to base" pattern speed already
    // uses just below (see the "Speed: respect 'set' operations" block).
    // A 'set' is the final score: the highest set wins and every add/multiply on this ability is ignored (user decision 2026-11-13,
    // same rule in the desktop app). Without a set: base + the resolved adds, as before.
    const sets = relevant.filter(ae => ae.effect.operation === 'set' && typeof ae.effect.value === 'number').map(ae => ae.effect.value as number);
    const score = sets.length ? Math.max(...sets) : base[ab] + resolveCombine(relevant);
    // 'scale' ("double your Strength") multiplies the resolved score, after set/add.
    result[ab] = applyScale(score, resolveScaleFactor(relevant));
    if (floors.length) result[ab] = Math.max(result[ab], ...floors.map(f => f.effect.value as number));
  }
  return result;
}

export function effectiveAbilityScores(entity: Entity): Entity['stats'] {
  const scores = applyStatModifiers(entity.stats, collectAllEffects(entity));
  for (const override of [...(entity.characterOverrides ?? []).filter(o=>o.active).sort((a,b)=>a.appliedAt-b.appliedAt), ...(entity.dmOverrides ?? []).filter(o=>o.active).sort((a,b)=>a.appliedAt-b.appliedAt)].filter(o => (['str','dex','con','int','wis','cha'] as string[]).includes(o.stat))) {
    const ability = override.stat as Ability; scores[ability] = override.operation === 'set' ? override.value : scores[ability] + override.value;
  }
  return scores;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Recomputes all derived statistics for an entity from scratch.
 * Call this after every state mutation — it is intentionally cheap.
 *
 * DM overrides are applied LAST and win over everything else.
 * They never modify entity.stats or entity.features.
 *
 * `content` (rules-engine blocker RE-AUDIT closure — dependency inversion,
 * 1B): explicit, application-resolved classes/races/spells/items — the ONE
 * merged content snapshot (getMergedContentDB(entity.rulesetId)) — threaded
 * straight through to initializeEntitlementInputs (spell reclassification),
 * item-mechanics resolution (equipped-item effects, weapon attack bonuses),
 * and generateAllActionCards (spell-card/context generation) — this file
 * never reaches into a store for any of it. Optional so every pre-existing
 * call site (this function has ~50 across the engine) keeps working
 * unchanged, falling back to the deterministic official-only catalogs each
 * of those functions already defaults to.
 */
/** Keeps every `perProficiencyBonus` pool's maximum equal to the current proficiency bonus, preserving what was spent. */
function syncProficiencyResources(entity: Entity): Entity {
  if (!entity.resources.custom.some(r => r.perProficiencyBonus)) return entity;
  const pb = proficiencyBonus(entity.identity.level);
  let changed = false;
  const custom = entity.resources.custom.map(r => {
    if (!r.perProficiencyBonus || r.maximum === pb) return r;
    changed = true;
    const spent = Math.max(0, r.maximum - r.current);
    return { ...r, maximum: pb, baseMaximum: pb, current: Math.max(0, pb - spent) };
  });
  return changed ? { ...entity, resources: { ...entity.resources, custom } } : entity;
}

/**
 * Folds the bonuses that depend only on the character's level into each effect's numeric value:
 * `addProficiencyBonus` (Alert: initiative + PB) and `addPerLevel` (Dwarven Toughness: +1 per level).
 * Runs before anything reads the effects, so max-HP reconciliation and every stat see plain numbers.
 */
export function foldKnownBonuses(effects: ActiveEffect[], entity: Entity): ActiveEffect[] {
  if (!effects.some(ae => ae.effect.addProficiencyBonus || ae.effect.addPerLevel)) return effects;
  const pb = proficiencyBonus(entity.identity.level);
  return effects.map(ae => {
    const { addProficiencyBonus, addPerLevel } = ae.effect;
    if (!addProficiencyBonus && !addPerLevel) return ae;
    const base = typeof ae.effect.value === 'number' ? ae.effect.value : 0;
    return { ...ae, effect: { ...ae.effect, value: base + (addProficiencyBonus ? pb : 0) + (addPerLevel ? addPerLevel * entity.identity.level : 0) } };
  });
}

/** Keeps `perAbilityModifier` and `perLevel` pools at their formula value (the spent amount is preserved). */
function syncFormulaResources(entity: Entity, stats: Entity['stats']): Entity {
  if (!entity.resources.custom.some(r => r.perAbilityModifier || r.perLevel)) return entity;
  let changed = false;
  const custom = entity.resources.custom.map(r => {
    let target: number | null = null;
    if (r.perAbilityModifier) target = Math.max(1, modifier(stats[r.perAbilityModifier]));
    else if (r.perLevel) target = Math.max(0, r.perLevel * entity.identity.level);
    if (target === null || r.maximum === target) return r;
    changed = true;
    const spent = Math.max(0, r.maximum - r.current);
    return { ...r, maximum: target, baseMaximum: target, current: Math.max(0, target - spent) };
  });
  return changed ? { ...entity, resources: { ...entity.resources, custom } } : entity;
}

/**
 * Maximum hit points follow the Constitution modifier, whatever changed it (an improvement, a feat, an item, a mode, a condition, a
 * feature, an override): the book's rule that a changed modifier changes the maximum as if it had always been the new one, so by the
 * change times the level. Current hit points move by the same amount (damage taken is kept), never below 0. One place for every
 * source; the maximum is a stored number, so the modifier it reflects is kept beside it (HPBlock.conModApplied).
 * shortcut: characters only and every level counts Constitution; a monster's level is a stand-in for its CR, and a homebrew class
 * whose hit points use another ability is counted as Constitution. Upgrade when hit dice per class carry their ability.
 */
export function followConModifier(entity: Entity, con: number): Entity {
  const mod = modifier(con);
  const hp = entity.resources.hp;
  if (entity.kind !== 'character' || hp.conModApplied === mod) return entity;
  const level = entity.identity.level;
  const delta = level > 0 ? (mod - (hp.conModApplied ?? savedConModifier(entity))) * level : 0;
  if (delta === 0) return { ...entity, resources: { ...entity.resources, hp: { ...hp, conModApplied: mod } } };   // only the record
  const maximum = Math.max(1, hp.maximum + delta);
  const current = Math.min(maximum, Math.max(0, hp.current + delta));
  return { ...entity, resources: { ...entity.resources, hp: { ...hp, maximum, current, conModApplied: mod } } };
}

/**
 * For a character saved before HPBlock.conModApplied: the modifier its stored maximum already reflects. Before this rule only
 * improvements, feats, overrides and "set the total" moved the maximum, so it reflects the base scores, the character's own
 * features and the overrides, never an item, a condition or a mode. Taking that as the start puts right, on the first load,
 * a maximum an item such as an Amulet of Health never changed.
 */
function savedConModifier(entity: Entity): number {
  const own: ActiveEffect[] = entity.features
    .filter(f => f.isActive && f.source.kind !== 'condition' && !isFeatureSuspended(entity, f.id))
    .flatMap(f => f.effects.map(effect => ({ effect, sourceName: f.name, sourceId: f.id, appliedAt: f.level ?? 0 })));
  let con = applyStatModifiers(entity.stats, own).con;
  for (const o of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active && o.stat === 'con')) {
    con = o.operation === 'set' ? o.value : con + o.value;
  }
  return modifier(con);
}

export function recomputeStats(
  entityParam: Entity, rules: CampaignRules,
  content: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
): Entity {
  // Use a mutable local reference so we can apply grant_proficiency effects
  let entity = syncProficiencyResources(recomputeResourceMaximums(initializeEntitlementInputs(entityParam, content.homebrewSpells)));

  let allEffects      = foldKnownBonuses(collectAllEffects(entity, content.items), entity);

  // ── Derived max-HP bonus ("+5 maximum hit points" as an effect on target 'max_hp') ──
  // resources.hp.maximum is a STORED value (set by leveling, adjusted by CON changes), so a bonus
  // can't simply be summed into it on every recompute. HPBlock.bonusApplied records how much of
  // `maximum` the effects currently account for; only the difference is applied, which is what
  // makes a tier that REPLACES +5 with +10 net +5, and removing the feature take its bonus back.
  // Plus whatever a hit-die tier effect (hitDieTier.ts) is worth across the character's levels.
  const hpBonus = Math.trunc(resolveEffectsForTarget('max_hp', allEffects, rules) as number)
    + tierHpBonus(entity.resources.hitDice, hitDieTierFromEffects(allEffects, rules));
  const hpApplied = entity.resources.hp.bonusApplied ?? 0;
  if (hpBonus !== hpApplied) {
    const delta = hpBonus - hpApplied;
    const hp = entity.resources.hp;
    const maximum = Math.max(1, hp.maximum + delta);
    const current = delta > 0 ? hp.current + delta : Math.min(hp.current, maximum);
    entity = { ...entity, resources: { ...entity.resources, hp: { ...hp, maximum, current, bonusApplied: hpBonus } } };
  }

  let effectiveStats = applyStatModifiers(entity.stats, allEffects);
  const profBonus     = proficiencyBonus(entity.identity.level);

  // ── Wild Shape: physical stats (STR/DEX/CON) come from the beast form;
  //    mental scores (INT/WIS/CHA) stay the player's own, per the book rule
  //    ("you retain your own... Intelligence, Wisdom, and Charisma scores").
  //    Same non-mutating "apply on top" philosophy as DmOverride — nothing
  //    here touches entity.stats itself. See docs/ROADMAP_1.0.md "FEATURE
  //    DESIGN: Wild Shape".
  const conBeforeBeast = effectiveStats.con;   // the character's own, for its hit points (a beast form has its own)
  const beastForm = entity.wildShapeState?.active
    ? findBeastForm(entity.wildShapeState.formId) ?? null
    : null;
  if (beastForm) {
    effectiveStats = {
      ...effectiveStats,
      str: beastForm.stats.str,
      dex: beastForm.stats.dex,
      con: beastForm.stats.con,
    };
  }

  // Ability-score DM replacements/additions feed every dependent derived value.
  for (const override of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active && (['str','dex','con','int','wis','cha'] as string[]).includes(o.stat))) {
    const ability = override.stat as Ability;
    effectiveStats[ability] = override.operation === 'set' ? override.value : effectiveStats[ability] + override.value;
  }

  // The character's own Constitution with the overrides on it: what its maximum hit points follow.
  let ownCon = conBeforeBeast;
  for (const o of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active && o.stat === 'con')) {
    ownCon = o.operation === 'set' ? o.value : ownCon + o.value;
  }
  entity = followConModifier(entity, ownCon);

  entity = syncFormulaResources(entity, effectiveStats);

  // "Add your Charisma modifier to initiative" (Effect.addAbilityModifier): fold the final ability
  // modifier into the effect's own value now that every ability score is settled, so every consumer
  // (initiative, AC, saves, ...) just sees an ordinary numeric bonus.
  if (allEffects.some(ae => ae.effect.addAbilityModifier)) {
    allEffects = allEffects.map(ae => ae.effect.addAbilityModifier
      ? { ...ae, effect: { ...ae.effect, value: (typeof ae.effect.value === 'number' ? ae.effect.value : 0) + modifier(effectiveStats[ae.effect.addAbilityModifier]) } }
      : ae);
  }

  // Authoritative inputs: persisted entitlements and currently active effects.
  // Every flat grant field below is compatibility output, never an ownership oracle.
  const profEffects = allEffects.filter(ae => ae.effect.type === 'grant_proficiency');
  const newGrantedSkills = new Set<SkillName>();
  const newExpertiseSkills = new Set<SkillName>();
  const newGrantedTools: string[] = [];
  const newGrantedWeapons: string[] = [];
  const newGrantedArmor: string[] = [];
  const newGrantedLanguages: string[] = [];

  // Entitlement-derived contribution — folded into the SAME newGranted*
  // sets the active-effect loop below also populates. Neither reads prior output.
  const entDerived = deriveProficienciesFromEntitlements(entity);
  for (const s of entDerived.skills.trained)   newGrantedSkills.add(s);
  for (const s of entDerived.skills.expertise) newExpertiseSkills.add(s);
  for (const t of entDerived.tools)     if (!newGrantedTools.some(x => x.toLowerCase() === t.toLowerCase()))     newGrantedTools.push(t);
  for (const w of entDerived.weapons)   if (!newGrantedWeapons.some(x => x.toLowerCase() === w.toLowerCase())) newGrantedWeapons.push(w);
  for (const a of entDerived.armor)     if (!newGrantedArmor.some(x => x.toLowerCase() === a.toLowerCase()))   newGrantedArmor.push(a);
  for (const l of entDerived.languages) if (!newGrantedLanguages.some(x => x.toLowerCase() === l.toLowerCase())) newGrantedLanguages.push(l);

  for (const ae of profEffects) {
    // target format: 'skill:perception', 'skill:athletics', etc.
    if (ae.effect.target.startsWith('skill:')) {
      const skillName = ae.effect.target.slice(6) as SkillName;
      // 'add' with the value 'expertise_if_proficient' is applied in the second pass below, once every
      // plain proficiency source has been counted ("gain proficiency; if already proficient, expertise").
      if (ae.effect.operation === 'add' && ae.effect.value !== 'expertise_if_proficient') newGrantedSkills.add(skillName);
      else if (ae.effect.operation === 'multiply') { newGrantedSkills.add(skillName); newExpertiseSkills.add(skillName); }
    }
    // target format: 'tool:thieves_tools', 'tool:herbalism_kit', etc.
    if (ae.effect.target.startsWith('tool:') && ae.effect.operation === 'add') {
      const toolName = ae.effect.target.slice(5).replace(/_/g, ' ');
      if (!newGrantedTools.some(t => t.toLowerCase() === toolName.toLowerCase())) newGrantedTools.push(toolName);
    }
    // target format: 'weapon:rapier', 'weapon:battleaxe', etc.
    if (ae.effect.target.startsWith('weapon:') && ae.effect.operation === 'add') {
      const weaponName = ae.effect.target.slice(7).replace(/_/g, ' ');
      if (!newGrantedWeapons.some(w => w.toLowerCase() === weaponName.toLowerCase())) newGrantedWeapons.push(weaponName);
    }
    // target format: 'armor:light', 'armor:medium', 'armor:heavy', 'armor:shields'
    if (ae.effect.target.startsWith('armor:') && ae.effect.operation === 'add') {
      const armorName = ae.effect.target.slice(6).replace(/_/g, ' ');
      if (!newGrantedArmor.some(a => a.toLowerCase() === armorName.toLowerCase())) newGrantedArmor.push(armorName);
    }
  }

  // Second pass: "proficiency, or expertise if you already have it" .
  // Sequential on purpose — two such effects naming the same skill make the second one expertise.
  for (const ae of profEffects) {
    if (ae.effect.operation !== 'add' || ae.effect.value !== 'expertise_if_proficient' || !ae.effect.target.startsWith('skill:')) continue;
    const skillName = ae.effect.target.slice(6) as SkillName;
    if (newGrantedSkills.has(skillName) || newExpertiseSkills.has(skillName)) newExpertiseSkills.add(skillName);
    newGrantedSkills.add(skillName);
  }

  // Skills: project current authoritative grants.
  let updatedSkills = entity.skills.skills;
  let skillsChanged = false;
  for (const skillName of Object.keys(updatedSkills) as SkillName[]) {
    const existing = updatedSkills[skillName];
    if (!existing || typeof existing !== 'object') continue;   // not a skill entry: a member this build does not know
    const finalTrained = newGrantedSkills.has(skillName) || newExpertiseSkills.has(skillName);
    const finalExpertise = newExpertiseSkills.has(skillName);
    if (finalTrained !== existing.trained || finalExpertise !== existing.expertise) {
      if (!skillsChanged) updatedSkills = { ...updatedSkills };
      updatedSkills[skillName] = { ...existing, trained: finalTrained, expertise: finalExpertise };
      skillsChanged = true;
    }
  }
  if (skillsChanged) {
    entity = { ...entity, skills: { ...entity.skills, skills: updatedSkills } };
  }

  entity = {
    ...entity,
    proficiencies: { ...entity.proficiencies, tools: newGrantedTools,
      weapons: newGrantedWeapons, armor: newGrantedArmor, languages: newGrantedLanguages },
    spellcasting: entity.spellcasting ? { ...entity.spellcasting,
      known: entDerived.spells, cantrips: entDerived.cantrips } : null,
  };

  // ── Base AC resolution (priority order) ──────────────────────────────────
  // 1. base_ac_formula effects (Unarmored Defense, Mage Armor, etc.)
  //    formulaAbilities adds modifier(stat) for each listed ability.
  // 2. entity.resources.ac  (set when armor is equipped — 0 = no armor)
  // 3. Fallback: 10 + DEX modifier
  const acFormula        = beastForm ? null : selectBestAcFormula(allEffects, effectiveStats);
  const calculatedBaseAc = beastForm
    ? beastForm.ac
    : acFormula
      ? acFormula.total
      : entity.resources.ac > 0
        ? entity.resources.ac
        : 10 + modifier(effectiveStats.dex);

  // Beast form AC is a flat total (no magic armor while transformed) — skip
  // the shield/magic-bonus stacking that normally applies on top.
  // An effect marked appliesInBeastForm ("also in your wild shapes") still adds on top of the form's flat AC.
  const acBonus = (resolveEffectsForTarget(
    'ac',
    allEffects.filter(ae => ae.effect.type !== 'base_ac_formula' && (!beastForm || ae.effect.appliesInBeastForm)),
    rules,
  ) as number);

  // ── Speed: respect 'set' operations (Dwarf/Halfling/Gnome 25 ft) ─────────
  const speedEffects  = allEffects.filter(ae => ae.effect.target === 'speed');
  const hasSetSpeed   = speedEffects.some(ae => ae.effect.operation === 'set');
  const speedResolved = resolveEffectsForTarget('speed', allEffects, rules) as number;
  // Rules-correctness fix (speed-zero precedence): a condition that sets
  // speed to 0 (Grappled/Restrained/Stunned/Unconscious — see
  // content/conditions/index.ts's speedZeroFeature) is a RESTRICTION, not
  // an ordinary "highest set wins" replacement value — 5e RAW: the creature
  // "can't benefit from any bonus to its speed" while this applies. Without
  // this check, resolveCombine's normal 'set' tie-break (highest value
  // wins) let an ordinary higher replacement speed (e.g. a 40ft "set"
  // effect) or an additive bonus stacked on top of the winning 'set' beat
  // the 0, which is wrong — the restriction must dominate base speed,
  // additive bonuses, AND ordinary replacement/set effects. An explicit
  // character/DM override for 'speed' (applied later, unconditionally,
  // near the end of this function) still wins over this — this only
  // affects the CALCULATED value overrides start from.
  // Rules-correctness fix (Wild Shape speed-zero precedence): the
  // beastForm branch used to short-circuit straight to beastForm.speed
  // BEFORE the restriction check below ever ran, so a transformed,
  // Grappled/Restrained creature incorrectly kept its full beast-form
  // movement — the active condition's effects survive transformation (they
  // live on entity.features, untouched by Wild Shape), so the restriction
  // must still apply. Compute the ordinary-or-transformed CALCULATED speed
  // first, then apply the restriction on top unconditionally, exactly like
  // the non-transformed path always has.
  const beastSpeedBonus = beastForm
    ? (resolveEffectsForTarget('speed', allEffects.filter(ae => ae.effect.appliesInBeastForm && ae.effect.operation === 'add'), rules) as number)
    : 0;
  const calculatedSpeed = beastForm
    ? beastForm.speed + beastSpeedBonus
    : hasSetSpeed
      ? speedResolved
      : entity.resources.speed + speedResolved;
  const hasZeroSpeedRestriction = speedEffects.some(ae => ae.effect.operation === 'set' && ae.effect.value === 0);
  // 'scale' (double/halve speed) applies to the resolved speed; a speed-zero restriction still wins.
  // 2024 Exhaustion: -5 ft Speed per level (the 2014 tiers are descriptive; see exhaustion.ts).
  const finalSpeed = hasZeroSpeedRestriction ? 0 : Math.max(0, applyScale(calculatedSpeed, resolveScaleFactor(speedEffects)) - exhaustionSpeedPenalty(entity));

  // ── Senses: aggregate grant_sense effects, dedup by type (largest range) ──
  const senseEffects = allEffects.filter(ae => ae.effect.type === 'grant_sense');
  const senseMap = new Map<string, Sense>();
  for (const ae of senseEffects) {
    const e = ae.effect;
    if (!e.senseType) continue;
    const range = e.senseRange ?? 0;
    const existing = senseMap.get(e.senseType);
    // Keep the longest-range instance of each sense type; carry its note.
    if (!existing || range > existing.range) {
      senseMap.set(e.senseType, { type: e.senseType, range, note: e.senseNote });
    }
  }
  // Beast form senses fully replace the player's own while transformed — you
  // perceive the world as the beast does, per the book rule.
  const senses = beastForm
    ? (beastForm.senses ?? [])
    : Array.from(senseMap.values()).sort((a, b) => b.range - a.range);

  // ── Movement: aggregate grant_movement effects, keep largest per type ──
  const moveEffects = allEffects.filter(ae => ae.effect.type === 'grant_movement');
  const movement: import('./types').MovementSpeeds = beastForm
    ? {
        ...(beastForm.flySpeed   ? { fly:   beastForm.flySpeed }   : {}),
        ...(beastForm.swimSpeed  ? { swim:  beastForm.swimSpeed }  : {}),
        ...(beastForm.climbSpeed ? { climb: beastForm.climbSpeed } : {}),
      }
    : {};
  if (!beastForm) {
    for (const ae of moveEffects) {
      const t = ae.effect.movementType;
      // "A Climb Speed equal to your Speed" follows the final walking Speed (so Roving's +10 carries into it);
      // a fixed range, or a bonus on top of the Speed, can be added with movementRange.
      const r = (ae.effect.movementEqualsSpeed ? finalSpeed : 0) + (ae.effect.movementRange ?? 0);
      if (!t) continue;
      if ((movement[t] ?? 0) < r) movement[t] = r;
    }
  }
  // A Speed of 0 from a condition (Grappled, Restrained, Stunned, ...) leaves no speed of any kind to move at.
  if (hasZeroSpeedRestriction) for (const k of Object.keys(movement) as (keyof typeof movement)[]) delete movement[k];

  // ── Build derived stats object ────────────────────────────────────────────
  const advDisadvEffects = allEffects.filter(ae =>
    ae.effect.operation === 'advantage' || ae.effect.operation === 'disadvantage'
  );
  const advTargets = new Set(advDisadvEffects.map(ae => ae.effect.target));
  const advantageStates: DerivedStats['advantageStates'] = [];
  for (const target of advTargets) {
    const state = resolveBinary(advDisadvEffects.filter(ae => ae.effect.target === target));
    if (state !== 'straight') advantageStates.push({ target, state });
  }

  const derived: DerivedStats = {
    proficiencyBonus: profBonus,
    ac:               applyScale(calculatedBaseAc + acBonus, resolveScaleFactor(allEffects.filter(ae => ae.effect.target === 'ac'))),
    initiative:       applyScale(
                        modifier(effectiveStats.dex) + (resolveEffectsForTarget('initiative', allEffects, rules) as number),
                        resolveScaleFactor(allEffects.filter(ae => ae.effect.target === 'initiative')),
                      ),
    speed:            finalSpeed,
    critsNegated:     allEffects.some(ae => ae.effect.target === 'critical_hits_against' && ae.effect.operation === 'immunity'),
    critRange:        allEffects
      .filter(ae => ae.effect.target === 'crit_range' && ae.effect.operation === 'set' && typeof ae.effect.value === 'number')
      .reduce((lowest, ae) => Math.min(lowest, Math.max(2, ae.effect.value as number)), 20),
    // Bug fix (architecture review U7): a passive-score-targeted
    // stat_modifier effect (e.g. Observant's +5 to passive Perception and
    // passive Investigation) used to be silently ignored here — unlike
    // every other derived stat below, which folds in its own
    // resolveEffectsForTarget term on top of the base formula.
    passivePerception:    10 + resolveSkill(entity, applyAbilitySubstitutions(effectiveStats, allEffects, 'ability_checks'), 'perception', allEffects, profBonus)
                            + (resolveEffectsForTarget('passivePerception', allEffects, rules) as number),
    passiveInvestigation: 10 + resolveSkill(entity, applyAbilitySubstitutions(effectiveStats, allEffects, 'ability_checks'), 'investigation', allEffects, profBonus)
                            + (resolveEffectsForTarget('passiveInvestigation', allEffects, rules) as number),
    passiveInsight:       10 + resolveSkill(entity, applyAbilitySubstitutions(effectiveStats, allEffects, 'ability_checks'), 'insight', allEffects, profBonus)
                            + (resolveEffectsForTarget('passiveInsight', allEffects, rules) as number),
    senses,
    movement,
    savingThrows:     resolveSavingThrows(applyAbilitySubstitutions(effectiveStats, allEffects, 'saving_throws'), entity.proficiencies.savingThrows, profBonus, allEffects, rules),
    attackBonuses:    computeWeaponAttackBonuses(entity, applyAbilitySubstitutions(effectiveStats, allEffects, 'weapon_attacks'), profBonus, content.items),
    advantageStates,
    spellSaveDC:  entity.spellcasting
      ? abilityDC(profBonus, modifier(effectiveStats[entity.spellcasting.ability]))
          // Accept either target spelling so feature authors aren't tripped by
          // the snake_case/camelCase split (DM overrides use 'spellSaveDC').
          + (resolveEffectsForTarget('spell_save_dc', allEffects, rules) as number)
          + (resolveEffectsForTarget('spellSaveDC', allEffects, rules) as number)
      : null,
    spellAttackBonus: entity.spellcasting
      ? profBonus + modifier(effectiveStats[entity.spellcasting.ability])
          + (resolveEffectsForTarget('spell_attack_bonus', allEffects, rules) as number)
          + (resolveEffectsForTarget('spellAttackBonus', allEffects, rules) as number)
      : null,
    // Monk's ki-ability save DC (Stunning Strike, etc.) — always WIS-based,
    // separate from spellSaveDC since Monk has no entity.spellcasting block.
    kiSaveDC: entity.features.some(f => f.id === KI_SAVE_FEATURE_ID)
      ? abilityDC(profBonus, modifier(effectiveStats.wis))
          + (resolveEffectsForTarget('ki_save_dc', allEffects, rules) as number)
      : null,
    // Generic 8 + prof + ability mod, precomputed for every ability — any
    // non-caster class feature with its own save DC (Barbarian's
    // Intimidating Presence is STR-based, etc.) references the one it
    // needs via requiresSave.dc = { ability: 'str' } etc. Always populated,
    // unlike kiSaveDC/spellSaveDC — no per-class gating check needed since
    // a feature only ever points at this if it actually has one.
    abilityBasedDC: {
      str: abilityDC(profBonus, modifier(effectiveStats.str)),
      dex: abilityDC(profBonus, modifier(effectiveStats.dex)),
      con: abilityDC(profBonus, modifier(effectiveStats.con)),
      int: abilityDC(profBonus, modifier(effectiveStats.int)),
      wis: abilityDC(profBonus, modifier(effectiveStats.wis)),
      cha: abilityDC(profBonus, modifier(effectiveStats.cha)),
    },
    // Extra Attack / action-structure batch — see this field's own doc
    // comment (types.ts) for the multiclass max-not-additive rationale.
    attackActionAttacks: 1 + resolveExtraAttack(allEffects),
  };

  // ── Apply DM overrides LAST ───────────────────────────────────────────────
  // Scalar numeric fields (DERIVED_NUMERIC_KEYS):
  const mutableDerived = derived as unknown as Record<string, number | null>;
  for (const override of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active)) {
    if (!DERIVED_NUMERIC_KEYS.has(override.stat)) continue;
    const current = (mutableDerived[override.stat] as number) ?? 0;
    mutableDerived[override.stat] =
      override.operation === 'set' ? override.value : current + override.value;
  }

  // SIG-1: Saving throw DM overrides (e.g. "savingThrows.str")
  for (const override of [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].filter(o => o.active)) {
    if (!override.stat.startsWith('savingThrows.')) continue;
    const ability = override.stat.slice('savingThrows.'.length) as Ability;
    if (!(['str','dex','con','int','wis','cha'] as string[]).includes(ability)) continue;
    const current = derived.savingThrows[ability] ?? 0;
    derived.savingThrows[ability] = override.operation === 'set'
      ? override.value
      : current + override.value;
  }

  const withDerived = { ...entity, derived };

  // Action cards depend on the just-computed `derived` (available-slot
  // checks, etc.) and on entity.features/inventory — compute them once,
  // here, at the single choke point every mutation passes through, instead
  // of leaving each consuming tab to regenerate them on every render (the
  // actual cause of the "elementary operations lag" this was built to fix
  // — see the SQLite/render-loop plan). Safe to call synchronously:
  // spellRepo/itemRepo's Tier-2 caches are guaranteed warm for every id
  // this entity references by the time any mutation reaches here.
  return withDerived;
}
