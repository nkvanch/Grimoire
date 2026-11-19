import { officialClasses } from '../content/runtimeRules';
import { spellRepo } from '../content/spellRepo';
import { capitalize, actionTypeLabel, sourceKindLabel, fmtBonus, doubleDice, summaryOf, masteryNote } from './actionCardText';
import { cantripTierAt } from './cantripScaling';
import { damageTakenSince } from './damageLog';
import { SPELL_CARD_KEYWORDS } from './ruleset/dnd5e';
import { resolveSpellAttackBonus, resolveSpellSaveDC } from './spellCastingContext';
import { spellDamageBonus, spellDamageDieOverride, spellDamageTypeOverride, spellRangeOverride } from './spellModifiers';
import { Feature, RulesetId, Spell, AbilityEffect, ActionCardType, ActionCardColor, Entity, CharClass, OutcomeKey, Race, Item } from './types';

// ── Classification ────────────────────────────────────────────────────────────

/**
 * A spell_grant leveled-spell Feature (see traitCompiler.ts) carries a
 * `cast_spell` abilityEffect referencing a real Spell by id, rather than
 * being merged into entity.spellcasting.known — this looks up that Spell so
 * the card can render identically to a normally-known spell's card, just
 * sourced from a different Feature. Returns null for every ordinary feature.
 */
function findGrantedSpell(feature: Feature, rulesetId?: RulesetId | null): Spell | null {
  const castEffect = (feature.abilityEffects ?? []).find(
    (e): e is Extract<AbilityEffect, { type: 'cast_spell' }> => e.type === 'cast_spell'
  );
  if (!castEffect) return null;
  return spellRepo.getSpellSync(castEffect.spellId, rulesetId) ?? null;
}

/**
 * Determines the card type from a feature's abilityEffects and tags.
 * Priority: granted-spell delegation → explicit tags → effect-type inference → default 'utility'.
 */
export function classifyFeature(feature: Feature, rulesetId?: RulesetId | null): ActionCardType {
  const grantedSpell = findGrantedSpell(feature, rulesetId);
  if (grantedSpell) return classifySpell(grantedSpell);

  // Explicit tags win first
  if (feature.tags) {
    if (feature.tags.includes('transformation')) return 'transformation';
    if (feature.tags.includes('damage'))         return 'damage';
    if (feature.tags.includes('healing'))        return 'healing';
    if (feature.tags.includes('control'))        return 'control';
    if (feature.tags.includes('buff'))           return 'buff';
    if (feature.tags.includes('utility'))        return 'utility';
  }

  // Infer from abilityEffects
  const fx = feature.abilityEffects ?? [];
  if (fx.some(e => e.type === 'transform'))        return 'transformation';
  if (fx.some(e => e.type === 'damage'))           return 'damage';
  if (fx.some(e => e.type === 'heal' || e.type === 'heal_from_damage_taken' || e.type === 'temp_hp')) return 'healing';
  if (fx.some(e => e.type === 'apply_condition'))  return 'control';

  // Infer from active effects and passive effects
  if (fx.some(e => e.type === 'set_flag')) return 'buff';
  if (feature.effects.some(e =>
    e.type === 'stat_modifier' && (
      e.target === 'ac' || e.target === 'initiative' || e.target === 'speed'
    )
  )) return 'buff';

  if (feature.activation?.actionType === 'passive') return 'buff';

  return 'utility';
}

export function classifySpell(spell: Spell): ActionCardType {
  const name = spell.name.toLowerCase();
  const desc = spell.description.toLowerCase();

  const any = (text: string, words: readonly string[]) => words.some(w => text.includes(w));
  const k = SPELL_CARD_KEYWORDS;
  if (any(name, k.healingName)) return 'healing';
  if (any(desc, k.controlDescription)) return 'control';
  if (any(desc, k.damageDescription) || any(name, k.damageName)) return 'damage';
  if (any(name, k.buffName) || any(desc, k.buffDescription)) return 'buff';

  return 'utility';
}

export function cardColor(type: ActionCardType): ActionCardColor {
  switch (type) {
    case 'damage':         return 'red';
    case 'healing':        return 'green';
    case 'control':        return 'purple';
    case 'buff':           return 'blue';
    case 'transformation': return 'purple';
    case 'utility':        return 'gray';
  }
}

// ── Layer builders ────────────────────────────────────────────────────────────

/**
 * Layer 1: source type and card type.
 * Examples: "Lv 3 Spell • Damage", "Class Feature • Buff", "Bonus Action • Healing"
 */
export function buildLayer1(feature: Feature, cardType: ActionCardType, rulesetId?: RulesetId | null): string {
  const grantedSpell = findGrantedSpell(feature, rulesetId);
  if (grantedSpell) return buildLayer1ForSpell(grantedSpell, cardType);

  const typeLabel = capitalize(cardType);
  const action    = feature.activation;

  if (!action) return `Feature • ${typeLabel}`;

  const actionLabel = actionTypeLabel(action.actionType);

  if (feature.source.kind === 'spell') {
    const spell = spellRepo.getSpellSync(feature.source.refId, rulesetId);
    if (spell) {
      const lvl = spell.level === 0 ? 'Cantrip' : `Lv ${spell.level} Spell`;
      return `${lvl} • ${typeLabel}`;
    }
    return `Spell • ${typeLabel}`;
  }

  const sourceLabel = sourceKindLabel(feature.source.kind);
  return `${sourceLabel} • ${actionLabel} • ${typeLabel}`;
}

export function buildLayer1ForSpell(spell: Spell, cardType: ActionCardType): string {
  const typeLabel = capitalize(cardType);
  const lvl       = spell.level === 0 ? 'Cantrip' : `Lv ${spell.level} Spell`;
  return `${lvl} • ${spell.school} • ${typeLabel}`;
}

/**
 * Layer 2: key mechanical summary.
 * Examples: "8d6 Fire • 20 ft radius", "+2 damage, B/P/S resistance"
 */
/** "PBd6" becomes the character's real dice ("3d6"), and a bare "PB" the number. Anything else is returned unchanged. */
export function resolveProficiencyDice(dice: string, entity?: Entity): string {
  if (!entity || !/PB/.test(dice)) return dice;
  return dice.replace(/PB/g, String(entity.derived.proficiencyBonus));
}

export function buildLayer2(feature: Feature, entity?: Entity, opts: CardGenOptions = {}): string {
  const grantedSpell = findGrantedSpell(feature, entity?.rulesetId);
  if (grantedSpell) return buildLayer2ForSpell(grantedSpell);

  const fx = feature.abilityEffects ?? [];

  const parts: string[] = [];

  // Weapon attack: prepend to-hit and fold the flat damage bonus into the dice.
  // Only item-sourced features with a damage ability effect are weapons.
  const isWeapon = entity && feature.source?.kind === 'item'
    && (feature.abilityEffects ?? []).some(e => e.type === 'damage');
  const atk = isWeapon
    ? entity.derived.attackBonuses.find(ab => ab.id === feature.source.refId) ?? null
    : null;
  if (atk) {
    parts.push(`${fmtBonus(atk.bonus)} to hit`);
  }

  // The large-creature rule doubles WEAPON dice only (item-sourced attacks),
  // never spell or feature dice. atk is non-null exactly for weapon attacks.
  const doubleThisFeature = !!opts.doubleWeaponDice && atk !== null;

  for (const e of fx) {
    if (e.type === 'damage') {
      const tier = (e.diceByLevel ?? []).filter(t => entity && t.level <= entity.identity.level).sort((a, b) => b.level - a.level)[0];
      const baseDice = tier ? tier.dice : e.dice;
      const dice = doubleThisFeature ? doubleDice(baseDice) : baseDice;
      // For weapon attacks, show "2d8+8" (dice + ability/magic bonus).
      // Only the FIRST damage effect gets the ability mod (the weapon swing);
      // rider damage (e.g. 3d6 necrotic) is shown without the mod.
      const isFirstDamage = fx.findIndex(x => x.type === 'damage') === fx.indexOf(e);
      if (atk && isFirstDamage && atk.damageBonus !== 0) {
        parts.push(`${dice}${fmtBonus(atk.damageBonus)} ${capitalize(e.damageType)}`);
      } else {
        parts.push(`${dice} ${capitalize(e.damageType)}`);
      }
    } else if (e.type === 'heal') {
      parts.push(`Heal ${e.dice}`);
    } else if (e.type === 'track_effect') {
      parts.push(`Puts ${e.name} on a target`);
    } else if (e.type === 'temp_hp') {
      parts.push(`Temp HP ${resolveProficiencyDice(e.dice, entity)}`);
    } else if (e.type === 'heal_from_damage_taken') {
      const taken = entity ? damageTakenSince(entity, e.turnsBack) : 0;
      const frac = e.fraction === 0.5 ? 'half' : e.fraction === 1 ? 'all' : `${Math.round(e.fraction * 100)}%`;
      parts.push(entity ? `Heal ${Math.floor(taken * e.fraction)} (${frac} of the ${taken} taken since your ${e.turnsBack > 0 ? 'previous' : 'current'} turn began)` : `Heal ${frac} of damage taken`);
    } else if (e.type === 'apply_condition') {
      parts.push(capitalize(e.conditionId.replace(/_/g, ' ')));
    } else if (e.type === 'grant_speed') {
      parts.push(`${capitalize(e.speedType)} speed ${e.amount} ft`);
    } else if (e.type === 'set_flag') {
      parts.push(capitalize(e.flag.replace(/_/g, ' ')));
    } else if (e.type === 'restore_resource') {
      const amt = e.amount === 'full' ? 'Full' : `+${e.amount}`;
      parts.push(`${amt} ${e.resourceId.replace(/_/g, ' ')}`);
    } else if (e.type === 'spend_resource') {
      parts.push(`−${e.amount} ${e.resourceId.replace(/_/g, ' ')}`);
    }
  }

  // Passive resistance effects (e.g. Rage)
  const resistances = feature.effects
    .filter(e => e.type === 'grant_resistance')
    .map(e => capitalize(e.target));
  if (resistances.length > 0) {
    parts.push(`Resist ${resistances.join('/')}`);
  }

  if (feature.activation?.range && feature.activation.range !== 'self') {
    parts.push(`Range ${feature.activation.range}`);
  }
  if (feature.activation?.alsoCosts) {
    parts.push(`Also uses your ${feature.activation.alsoCosts === 'bonus_action' ? 'bonus action' : 'action'}`);
  }

  return parts.join(' • ') || summaryOf(feature.description);
}

/**
 * `entity`, when passed, wires the real per-spell attack bonus (closure 2E:
 * production card UI, not just a helper-level number) into a detected
 * "melee/ranged spell attack" spell — resolveSpellAttackBonus (above)
 * already reuses the existing derived-stats/override pipeline, this just
 * threads the spell's own id through to it. Same lightweight description-
 * regex detection style buildLayer2ForSpell already uses for damage/heal
 * dice — not a new formula engine, just a new textual signal feeding the
 * one that already exists.
 */
export function buildLayer2ForSpell(spell: Spell, entity?: Entity, classDefs: readonly CharClass[] = officialClasses()): string {
  const parts: string[] = [];

  if (entity && /(melee|ranged) spell attack/i.test(spell.description)) {
    const atk = resolveSpellAttackBonus(entity, spell.id, classDefs);
    if (atk != null) parts.push(`${fmtBonus(atk)} to hit`);
  }

  // Extract damage dice pattern from description
  const diceMatch = spell.description.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+damage/i);
  if (diceMatch) {
    const bonus = entity ? spellDamageBonus(entity, spell.id) : 0;
    const die = entity ? spellDamageDieOverride(entity, spell.id) : null;
    // A cantrip grows with the character's level (engine/cantripScaling.ts), not with a slot.
    const tier = entity ? cantripTierAt(spell, entity.identity.level) : null;
    // A tier may carry a flat amount with its dice ("3d6+2"); it is added to any damage bonus the character has.
    const base = tier?.dice ?? diceMatch[1].replace(/\s+/g, '');
    const split = base.match(/^([0-9]+d[0-9]+)([+-][0-9]+)?$/);
    const core = split ? split[1] : base;
    const flat = (split && split[2] ? parseInt(split[2], 10) : 0) + bonus;
    const dice = die ? core.replace(/d[0-9]+$/, `d${die}`) : core;
    const type = (entity ? spellDamageTypeOverride(entity, spell.id) : null) ?? diceMatch[2];
    const beams = tier?.count ? ` ×${tier.count}` : '';
    parts.push(`${dice}${flat ? (flat > 0 ? `+${flat}` : `${flat}`) : ''} ${capitalize(type)}${beams}`);
    // Only a spell that gives hit points back heals: "hit points" alone also describes Sleep's pool and damage riders.
  } else if (/\b(regains?|restores?)\b[^.]*hit points/i.test(spell.description)) {
    const healMatch = spell.description.match(/(\d+d\d+(?:\s*\+\s*\d+)?)/);
    if (healMatch) parts.push(`Heal ${healMatch[1]}`);
  }

  // Range info (an active spell_range effect, e.g. Long-Range Artillery, overrides the printed range)
  const rangeOverride = entity ? spellRangeOverride(entity, spell.id) : null;
  if (rangeOverride !== null) {
    parts.push(`${rangeOverride} feet`);
  } else if (spell.range && spell.range !== 'Self') {
    parts.push(spell.range);
  }

  return parts.join(' • ') || summaryOf(spell.description);
}

/**
 * Layer 3: save / concentration / duration notes.
 * Examples: "Dex Save (half)", "Concentration • 1 min", null
 */
export function buildLayer3(feature: Feature, entity?: Entity, classDefs: readonly CharClass[] = officialClasses()): string | null {
  const grantedSpell = findGrantedSpell(feature, entity?.rulesetId);
  if (grantedSpell) return buildLayer3ForSpell(grantedSpell, entity, classDefs);

  const action = feature.activation;
  const parts: string[] = [];

  if (action?.requiresSave) {
    const ab  = action.requiresSave.ability.toUpperCase();
    const dcSpec = action.requiresSave.dc;
    // This 'spell_save_dc' sentinel is only reached for a non-spell feature
    // (grantedSpell is null here) — no spellId to resolve a per-source
    // ability from, so the character's headline spellcasting ability is the
    // objectively correct answer (this is what the sentinel has always
    // meant: "use your primary spellcasting stat"), same as spellAttackBonus.
    const dc  = dcSpec === 'spell_save_dc' ? (entity?.derived.spellSaveDC != null ? `DC ${entity.derived.spellSaveDC}` : 'Spell DC')
      : dcSpec === 'ki_save_dc' ? (entity?.derived.kiSaveDC != null ? `DC ${entity.derived.kiSaveDC}` : 'Ki DC')
      : typeof dcSpec === 'object' ? (entity ? `DC ${entity.derived.abilityBasedDC[dcSpec.ability]}` : `${dcSpec.ability.toUpperCase()} DC`)
      : `DC ${dcSpec}`;
    const saveOnSuccess = (feature.abilityEffects ?? []).find(
      (e): e is Extract<AbilityEffect, { type: 'damage' }> => e.type === 'damage'
    )?.saveOnSuccess;
    const half = saveOnSuccess === 'half' ? ' (half)' : '';
    parts.push(`${ab} Save vs ${dc}${half}`);
  }

  if (action?.resourceCost?.resourceId === 'spell_slots') {
    const tier = action.resourceCost.spellSlotTier;
    if (tier) parts.push(`Slot Lv ${tier}+`);
  }

  if (entity && feature.source?.kind === 'item' && (feature.abilityEffects ?? []).some(e => e.type === 'damage')) {
    const mastery = masteryNote(entity, feature.source.refId);
    if (mastery) parts.push(mastery);
  }

  return parts.length > 0 ? parts.join(' • ') : null;
}

/**
 * `entity`, when passed, wires the spell's OWN resolved-source spell save
 * DC (resolveSpellSaveDC, above) into a detected save — closure 2E:
 * production card UI must show a real per-spell number for a multiclass
 * character, not the same global DC on every spell. Save DETECTION itself
 * is unchanged (the existing description-regex heuristic); this only adds
 * the number once a save is already found.
 */
export function buildLayer3ForSpell(spell: Spell, entity?: Entity, classDefs: readonly CharClass[] = officialClasses()): string | null {
  const parts: string[] = [];

  if (spell.concentration) {
    const durShort = spell.duration
      .replace('Concentration, up to ', '')
      .replace('Concentration, ', '');
    parts.push(`Concentration • ${durShort}`);
  }

  // Detect save in description
  const saveMatch = spell.description.match(/(\w+)\s+saving throw/i);
  if (saveMatch) {
    const ab   = saveMatch[1].slice(0, 3).toUpperCase();
    const half = spell.description.toLowerCase().includes('half') ? ' (half)' : '';
    const dc   = entity ? resolveSpellSaveDC(entity, spell.id, classDefs) : null;
    parts.push(dc != null ? `${ab} Save vs DC ${dc}${half}` : `${ab} Save${half}`);
  }

  if (spell.ritual) parts.push('Ritual');

  return parts.length > 0 ? parts.join(' • ') : null;
}

// ── Descriptive outcome lines ────────────────────────────────────────────────

const OUTCOME_KEY_LABELS: Record<OutcomeKey, string> = {
  hit:     'On hit',
  miss:    'On miss',
  success: 'On success',
  failure: 'On failure',
};

const OUTCOME_KEY_ORDER: OutcomeKey[] = ['hit', 'miss', 'success', 'failure'];

/**
 * Formats one ActivationOutcome's `effects` using the same wording buildLayer2
 * uses for the overlapping AbilityEffect variants (set_flag, restore_resource),
 * plus a line for `transform` (which buildLayer2 has no line-formatting for —
 * it only uses `transform` to pick the card's cardType). Effects this app
 * doesn't have a short summary for are silently skipped here — content
 * authors should put anything not covered by these in `description` instead,
 * per OutcomeMap's own doc comment.
 */
function formatOutcomeEffects(effects: AbilityEffect[]): string[] {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.type === 'set_flag') {
      parts.push(capitalize(e.flag.replace(/_/g, ' ')));
    } else if (e.type === 'restore_resource') {
      const amt = e.amount === 'full' ? 'Full' : `+${e.amount}`;
      parts.push(`${amt} ${e.resourceId.replace(/_/g, ' ')}`);
    } else if (e.type === 'transform') {
      parts.push(`Transform into ${e.formId.replace(/_/g, ' ')}`);
    }
  }
  return parts;
}

/**
 * Builds one rendered line per populated OutcomeMap entry — e.g.
 * "On hit: Target is knocked prone". Purely descriptive, never auto-applied
 * (see OutcomeMap's doc comment) — this is display text only, the player
 * still resolves everything themselves. Returns [] when the feature has no
 * `outcomes`.
 */
/** A weapon or attack ability's critical hit line, with the creature's own crit range. Empty for abilities that are not attacks. */
export function buildCritLine(feature: Feature, entity?: Entity): string[] {
  const dealsDamage = (feature.abilityEffects ?? []).some(e => e.type === 'damage');
  const isAttack = feature.source?.kind === 'item' || (feature.tags ?? []).includes('attack');
  if (!dealsDamage || !isAttack || !entity) return [];
  const range = entity.derived.critRange ?? 20;
  return [`On a critical hit (${range >= 20 ? '20' : `${range}–20`}): roll the damage dice twice`];
}

export function buildOutcomeLines(feature: Feature): string[] {
  const outcomes = feature.outcomes;
  if (!outcomes) return [];

  const lines: string[] = [];
  for (const key of OUTCOME_KEY_ORDER) {
    const outcome = outcomes[key];
    if (!outcome) continue;

    const effectsText = formatOutcomeEffects(outcome.effects ?? []).join(' • ');
    const text = outcome.description
      ? (effectsText ? `${outcome.description} (${effectsText})` : outcome.description)
      : effectsText;
    if (!text) continue;

    lines.push(`${OUTCOME_KEY_LABELS[key]}: ${text}`);
  }
  return lines;
}

/**
 * Options that tune card generation from active campaign rules AND
 * (rules-engine blocker RE-AUDIT closure — dependency inversion, 1B) carry
 * the explicit, pre-resolved content this call should use for spellcasting-
 * context/large-creature/item resolution. The APPLICATION layer computes
 * this ONCE per mutation (getMergedContentDB(entity.rulesetId) — classes/
 * races/spells/items all come from that SAME merged snapshot, never a
 * second ad-hoc merge path) and passes it down — this file never reaches
 * into a store for any of it. Omitting a field falls back to the matching
 * deterministic, static official-only catalog on each function that
 * consumes it (officialClasses() / officialRaces() / itemRepo-only / no homebrew
 * spells) — correct for every test and any caller not yet updated to pass
 * homebrew-aware content, though it won't reflect homebrew content in that
 * case.
 */
export type CardGenOptions = {
  doubleWeaponDice?: boolean;
  classDefs?:        readonly CharClass[];
  homebrewSpells?:   readonly Spell[];
  races?:            readonly Race[];
  items?:            readonly Item[];
};
