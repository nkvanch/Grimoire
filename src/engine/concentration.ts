import { DEFAULT_RULES } from './defaults';
import { rollD20 as rollD20Dice } from './dice';
import { recomputeDerived } from './pipeline';
import { CONCENTRATION_ADVANTAGE_FEATURE_IDS } from './ruleset/dnd5e';
import { DurationTracker, Entity, CampaignRules, Spell, FeatureInstance } from './types';

// ── Concentration ─────────────────────────────────────────────────────────────

/**
 * Parses a spell's free-text `duration` field into a DurationTracker for
 * concentration tracking. Matches both the SRD content format
 * ("Concentration, up to 1 minute") and the homebrew spell-builder's bare
 * format ("1 minute" — app/homebrew/spell-builder.tsx tracks concentration
 * as a separate checkbox, with no "Concentration, up to " prefix at all in
 * its duration text). Real 5e concentration spells only ever use round/
 * minute/hour scales — sampled every `concentration: true` entry in
 * src/content/spells/*.ts and found exactly this range: "1 round",
 * "1 minute", "10 minutes", "1 hour", "8 hours".
 *
 * Fail-open: returns null for anything that doesn't contain a bare
 * "<N> round(s)/minute(s)/hour(s)" pattern — e.g. "Instantaneous", "Until
 * dispelled", or other freeform homebrew text. Concentration still starts
 * via beginConcentration either way; this only gates the ticking countdown.
 * Never throws.
 */
export function parseConcentrationDuration(durationText: string): DurationTracker | null {
  const match = durationText.match(/(\d+)\s*(round|rounds|minute|minutes|hour|hours)\b/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit   = match[2].toLowerCase();

  const rounds =
    unit.startsWith('round')  ? amount :
    unit.startsWith('minute') ? amount * 10 :
    /* hour(s) */                amount * 600;

  return { unit: 'rounds', remaining: rounds };
}

/**
 * Drops the currently concentrated spell.
 * Removes all features tagged source.kind = 'spell' and source.refId = spellId.
 * Sets concentrating to null.
 * No-op if not concentrating.
 */
export function dropConcentration(entity: Entity): Entity {
  if (!entity.spellcasting?.concentrating) return entity;

  const droppedId = entity.spellcasting.concentrating;

  const cleanedFeatures = entity.features.filter(f =>
    !(f.source.kind === 'spell' && f.source.refId === droppedId)
  );

  return {
    ...entity,
    features: cleanedFeatures,
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentrating: null, concentratingDuration: undefined }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: false },
    },
  };
}

/**
 * Names of the effects that end together with the current concentration —
 * features tagged source.kind='spell' for the concentrated spell (exactly the
 * set dropConcentration removes). Empty when not concentrating or when the
 * spell carries no mechanical effect of its own.
 */
export function concentrationLinkedEffectNames(entity: Entity): string[] {
  const id = entity.spellcasting?.concentrating;
  if (!id) return [];
  return entity.features
    .filter(f => f.source.kind === 'spell' && f.source.refId === id)
    .map(f => f.name);
}

/**
 * The player/DM ends concentration by hand — the human-confirmed path the
 * table-first design calls for (a broken save, a dispel or a ruling all end
 * up here). Same deterministic cleanup as a failed concentration save:
 * dropConcentration clears the tracker and the linked spell features, and the
 * recompute makes sure nothing derived from those features lingers.
 * No-op when not concentrating.
 */
export function endConcentration(entity: Entity, rules: CampaignRules = DEFAULT_RULES): Entity {
  if (!entity.spellcasting?.concentrating) return entity;
  return recomputeDerived(dropConcentration(entity), rules);
}

/**
 * Begins concentrating on a spell.
 * Applies any onConcentrationFeatures from the spell definition.
 * Tags them with source = { kind: 'spell', refId: spell.id }
 * so dropConcentration can cleanly remove them.
 */
function beginConcentration(
  entity: Entity,
  spell:  Spell,
  rules:  CampaignRules
): Entity {
  const spellFeatures: FeatureInstance[] = (spell.onConcentrationFeatures ?? []).map(f => ({
    ...f,
    source:   { kind: 'spell' as const, refId: spell.id },
    level:    entity.identity.level,
    isActive: true,
  }));

  const updated = {
    ...entity,
    features: [...entity.features, ...spellFeatures],
    spellcasting: entity.spellcasting
      ? {
          ...entity.spellcasting,
          concentrating:         spell.id,
          concentratingDuration: parseConcentrationDuration(spell.duration) ?? undefined,
        }
      : null,
    conditionMonitor: {
      ...entity.conditionMonitor,
      flags: { ...entity.conditionMonitor.flags, concentrating: true },
    },
  };

  return recomputeDerived(updated, rules);
}

/**
 * Cast a concentration spell.
 * Automatically drops the previous concentration before beginning the new one.
 * This is the Hex → Fly scenario: Hex drops silently, Fly takes over.
 */
export function castConcentrationSpell(
  entity: Entity,
  spell:  Spell,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  let updated = dropConcentration(entity);
  updated     = beginConcentration(updated, spell, rules);
  return updated;
}

/**
 * Decrements the concentrating spell's tracked round countdown by 1 —
 * called from the same End Turn action that ticks entity.conditions'
 * 'rounds' durations (conditions.ts's tickDurations). Deliberately NOT
 * folded into tickDurations itself: conditions.ts is a lower-level module
 * combat.ts already imports from, so a function needing dropConcentration
 * has to live here to avoid a circular import — callers just chain both.
 * Auto-drops concentration via dropConcentration() when the countdown hits
 * 0, and explicitly recomputes afterward since dropConcentration() itself
 * does not.
 * No-op if not concentrating, or concentrating on a spell whose duration
 * didn't parse to a tracked countdown (parseConcentrationDuration returned
 * null at cast time).
 */
export function tickConcentrationDuration(
  entity: Entity,
  rules:  CampaignRules = DEFAULT_RULES
): Entity {
  const tracker = entity.spellcasting?.concentratingDuration;
  if (!tracker || tracker.unit !== 'rounds') return entity;

  const remaining = tracker.remaining - 1;
  if (remaining <= 0) {
    return recomputeDerived(dropConcentration(entity), rules);
  }

  return {
    ...entity,
    spellcasting: entity.spellcasting
      ? { ...entity.spellcasting, concentratingDuration: { ...tracker, remaining } }
      : null,
  };
}

// ── Concentration check (on damage) ──────────────────────────────────────────

export function rollConcentrationSave(
  entity:      Entity,
  damageTaken: number,
): { passed: boolean; dc: number; roll: number } {
  const dc = Math.max(10, Math.floor(damageTaken / 2));

  // Use the pipeline-computed CON saving throw, which already accounts for the
  // effective CON modifier (race/feat bonuses) AND saving-throw proficiency
  // (e.g. Resilient adds CON to proficiencies.savingThrows, which flows into
  // derived.savingThrows.con). Reading entity.stats.con directly would miss both.
  const conSaveBonus = entity.derived.savingThrows.con;

  // feature id (feat_<id>); the old 'war_caster'/'resilient_con' ids never
  // matched anything created by the feats system.
  const hasWarCaster = entity.features.some(f =>
    f.isActive && CONCENTRATION_ADVANTAGE_FEATURE_IDS.includes(f.id)
  );

  const baseRoll = (): number => rollD20Dice(conSaveBonus).total;

  const roll = hasWarCaster
    ? Math.max(baseRoll(), baseRoll())   // Advantage: roll twice, keep higher
    : baseRoll();

  return { passed: roll >= dc, dc, roll };
}

/**
 * Deterministic bookkeeping once a concentration save's outcome is known —
 * table-first: the primary Success/Failure buttons call this directly with
 * a human-supplied result, and rollConcentrationSave's app-roll convenience
 * calls it too, with its own computed `passed`. No-op if not concentrating.
 */
export function resolveConcentrationOutcome(entity: Entity, passed: boolean): Entity {
  if (!entity.spellcasting?.concentrating) return entity;
  return passed ? entity : dropConcentration(entity);
}

export function concentrationCheck(
  entity:      Entity,
  damageTaken: number,
  rules:       CampaignRules = DEFAULT_RULES
): Entity {
  if (!entity.spellcasting?.concentrating) return entity;
  const { passed } = rollConcentrationSave(entity, damageTaken);
  return resolveConcentrationOutcome(entity, passed);
}
