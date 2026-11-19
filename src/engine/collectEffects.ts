import { findBeastForm } from '../content/runtimeRules';
import { effectsInForce, modeKey } from './featureModes';
import { WornGear, wornGearOf, resolveItemDefinition, itemWearsArmorOrShield, isItemMechanicallyActive, effectiveItemFeatures, statedArmorAc } from './itemMechanics';
import { isFeatureSuspended } from './suspension';
import { Entity, ActiveEffect } from './types';

// ── Effect collection ─────────────────────────────────────────────────────────

/**
 * Whether an effect's `condition` gate is satisfied. A condition is one of:
 *   - a runtime flag name ("rage_active") that is currently true,
 *   - an active condition id ("poisoned"), or
 *   - a resource threshold: `resource:<resourceId><op><n>` with op one of <= >= < > == (e.g.
 *     "resource:glassback_pressure<=1" — true while that pool's CURRENT value is 1 or less). This
 *     is how a state meter (a state meter) drives tiered penalties with no new state: the
 *     effects simply switch on and off as the resource moves, and a missing pool is false.
 *   - a worn-gear test: `worn:no_armor`, `worn:not_heavy` (no Heavy armor), `worn:no_medium_or_heavy`, or `worn:no_armor_or_shield`
 *     ("while you aren't wearing armor or wielding a Shield"). Needs the worn-gear state, which the
 *     effect collector computes once from the equipped items.
 */
export function effectConditionActive(
  condition: string,
  flags: Record<string, boolean>,
  activeConditionIds: ReadonlySet<string>,
  entity: Entity,
  worn?: WornGear,
): boolean {
  if (flags[condition] === true || activeConditionIds.has(condition)) return true;
  if (condition.startsWith('worn:')) {
    if (!worn) return false;
    switch (condition.slice(5)) {
      case 'no_armor':           return worn.armor === 'none';
      case 'not_heavy':          return worn.armor !== 'heavy';
      case 'no_armor_or_shield': return worn.armor === 'none' && !worn.shield;
      case 'no_medium_or_heavy': return worn.armor === 'none' || worn.armor === 'light';   // "provided you are not wearing medium or heavy armor" (a shield is fine)
      default:                   return false;
    }
  }
  const m = /^resource:([A-Za-z0-9_]+)(<=|>=|==|<|>)(-?\d+)$/.exec(condition);
  if (!m) return false;
  const pool = entity.resources.custom.find(r => r.id === m[1]);
  if (!pool) return false;
  const n = parseInt(m[3], 10);
  switch (m[2]) {
    case '<=': return pool.current <= n;
    case '>=': return pool.current >= n;
    case '<':  return pool.current <  n;
    case '>':  return pool.current >  n;
    default:   return pool.current === n;
  }
}

/**
 * Situational questions whose answer the engine already knows from the character's state, so the player is never asked them
 * (the sheet leaves them out). Keyed by Effect.situational.id: characters keep their own copy of a feature, so an answer here
 * reaches characters built before it was added, without changing their data or the signed packs.
 */
export const OBSERVED_SITUATIONALS: Readonly<Record<string, (worn: WornGear) => boolean>> = {
  fighting_style_defense_armored: worn => worn.armor !== 'none',   // Defense: "while you are wearing armor" (a shield is not armor)
};

/** Whether a situational effect counts: the engine's own answer when it has one, otherwise the player's explicit Yes. */
function situationalYes(entity: Entity, id: string, worn: WornGear): boolean {
  const observed = OBSERVED_SITUATIONALS[id];
  return observed ? observed(worn) : entity.situationalAnswers?.[id] === true;
}

export function collectAllEffects(entity: Entity, homebrewItems: readonly import('./types').Item[] = []): ActiveEffect[] {
  const effects: ActiveEffect[]       = [];
  const activeFlags                   = entity.conditionMonitor.flags;
  const activeConditionIds            = new Set(entity.conditions.map(c => c.id));
  const worn: WornGear                = wornGearOf(entity.inventory.equipped, id => resolveItemDefinition(id, homebrewItems));

  // 1. Features from race, class, background, feats, spells, etc.
  for (const fi of entity.features) {
    if (!fi.isActive) continue;
    if (isFeatureSuspended(entity, fi.id)) continue;   // switched off for a time (engine/suspension.ts)
    // A RACIAL trait with an authored unlock level (Draconic Flight at 5, Large Form at 5) does nothing
    // until the character reaches it — the same gate action-card generation already applies. Limited to
    // race-sourced features on purpose: class/feat/background features are stamped with the level they
    // were granted at (which is not always <= the character's level in fixtures and mid-creation states).
    if (fi.source.kind === 'race' && fi.level !== null && fi.level > entity.identity.level) continue;

    for (const effect of effectsInForce(fi, entity, fi.id)) {
      if (effect.minLevel && entity.identity.level < effect.minLevel) continue;
      // Gate: skip if effect requires a flag or condition that is not active
      if (effect.condition !== null && !effectConditionActive(effect.condition, activeFlags, activeConditionIds, entity, worn)) continue;

      // Gate: skip a situational effect (item 9 — a real-world fact the
      // engine can't observe, e.g. "an ally within 5 feet") unless the
      // player/DM has explicitly answered Yes. Unanswered and explicit No
      // are treated identically — conservative, never silently overstates
      // a bonus. See Effect.situational's own doc comment.
      if (effect.situational && !situationalYes(entity, effect.situational.id, worn)) continue;

      // Gate: skip if this feature's source condition has its effects suppressed
      if (fi.source.kind === 'condition') {
        const sourceCond = entity.conditions.find(c => c.id === fi.source.refId);
        if (sourceCond && sourceCond.suppressedBy.length > 0) {
          const suppressed = sourceCond.suppressedBy.some(suppressorId =>
            doesSuppressTarget(entity, suppressorId, effect.target)
          );
          if (suppressed) continue;
        }
      }

      effects.push({
        effect,
        sourceName: fi.name,
        sourceId:   fi.id,
        appliedAt:  fi.level ?? 0,
        sourceKind: fi.source.kind,
      });
    }
  }

  // 1b. Auras of other party members this character has marked itself as being inside (engine/auras.ts).
  for (const a of entity.receivedAuras ?? []) {
    for (const effect of a.effects) {
      if (effect.condition !== null && effect.condition !== undefined && !effectConditionActive(effect.condition, activeFlags, activeConditionIds, entity, worn)) continue;
      effects.push({ effect, sourceName: `${a.label} (${a.sourceName})`, sourceId: `${a.sourceEntityId}:${a.featureId}`, appliedAt: 0, sourceKind: 'feature' as never });
    }
  }

  // 2. Equipped items — features fire while the item is worn/wielded.
  //    Re-audit A17: an item that REQUIRES attunement must not contribute
  //    anything until actually attuned — merely equipping it used to be
  //    enough (an unattuned Ring of Protection still gave +1 AC). Items
  //    with no attunement requirement (requiresAttunement falsy) are
  //    unaffected — their effects always fired on equip and still do.
  // Re-audit A19: whether ANY equipped item is armor/a shield — computed
  // once, outside the per-item loop, so an effect declaring
  // requiresNoArmorOrShield can check "is something ELSE equipped that
  // counts" without an O(n^2) rescan. Deliberately counts every equipped
  // item, including the one this effect's own feature lives on (Bracers of
  // Defense itself is neither armor nor a shield, so this is correct for
  // it; a hypothetical future item that WAS both armor and had its own
  // requiresNoArmorOrShield effect would be a contradiction in the content
  // itself, not something this predicate needs to resolve).
  const anyArmorOrShieldEquipped = entity.inventory.equipped.some(i => {
    const definition = resolveItemDefinition(i.itemId, homebrewItems);
    return definition ? itemWearsArmorOrShield(definition) : i.wearsArmorOrShield === true;
  });

  for (const item of entity.inventory.equipped) {
    const definition = resolveItemDefinition(item.itemId, homebrewItems);
    if (!isItemMechanicallyActive(item, definition)) {
      // Not attuned: only its nonmagical benefits, so armor or a shield still counts as plain armor (found 2026-11-18 on the
      // emulator: an unattuned Dragon Scale Mail gave AC as if nothing were worn).
      const plain = definition ? statedArmorAc(definition, true, item.baseArmor) : null;
      if (plain) effects.push({ effect: plain, sourceName: definition!.name, sourceId: item.id ?? item.itemId, appliedAt: 0, sourceKind: 'item' });
      continue;
    }
    const itemFeatures = effectiveItemFeatures(item, definition);
    for (const fi of itemFeatures) {
      for (const effect of effectsInForce(fi, entity, modeKey(fi.id, item.id))) {
        if (effect.condition !== null && !effectConditionActive(effect.condition, activeFlags, activeConditionIds, entity, worn)) continue;
        if (effect.requiresNoArmorOrShield && anyArmorOrShieldEquipped) continue;
        if (effect.situational && !situationalYes(entity, effect.situational.id, worn)) continue;
        effects.push({
          effect,
          sourceName: fi.name,
          // Item-identity closure (pass 2, finding C): CONTRIBUTOR identity
          // is the owned INSTANCE (item.id) — distinct from the definition
          // lookup just above (resolveItemDefinition still keys on
          // item.itemId, unchanged). Two identical equipped items each push
          // their own ActiveEffect entry already (this loop iterates the
          // real array, never deduped by itemId), so their contributions
          // were always independently removable at the array level; this
          // only makes their PROVENANCE (audit-trail identity) distinct
          // too, rather than both reporting the same itemId as their
          // source. Falls back to itemId for a still-unmigrated instance.
          sourceId:   item.id ?? item.itemId,
          appliedAt:  0,
          sourceKind: 'item',
        });
      }
    }
    // Armor or a shield whose data carries no AC effect of its own gives the AC it states, or its base armor's (statedArmorAc).
    // Without the definition, the AC hydrated onto the instance when it was equipped.
    const stated = definition ? statedArmorAc({ id: definition.id, name: definition.name, properties: definition.properties, features: itemFeatures }, false, item.baseArmor, item.magicBonus) : (item.statedAc ?? null);
    if (stated) effects.push({ effect: stated, sourceName: definition?.name ?? item.itemId, sourceId: item.id ?? item.itemId, appliedAt: 0, sourceKind: 'item' });
  }

  // 3. Rules-engine blocker RE-AUDIT closure (Closure 3C — native BeastForm
  //    defenses): while transformed, the active beast form's OWN typed
  //    damage resistances/immunities/vulnerabilities participate in the
  //    SAME damage-resolution path as every other active effect (used by
  //    resolveResistance via collectAllEffects — see applyWildShapeDamage,
  //    combat.ts, which calls collectAllEffects(entity) BEFORE reverting).
  //    Purely derived from wildShapeState.formId, never copied onto the
  //    entity — reverting (wildShapeState -> null) makes these vanish with
  //    no cleanup mutation, since this block simply stops firing.
  if (entity.wildShapeState?.active) {
    const form = findBeastForm(entity.wildShapeState.formId);
    if (form) {
      const pushDefense = (damageType: string, operation: 'resistance' | 'immunity' | 'vulnerability') => {
        effects.push({
          effect: { type: 'grant_resistance', target: damageType, operation, value: null, condition: null },
          sourceName: form.name, sourceId: form.id, appliedAt: 0, sourceKind: 'condition',
        });
      };
      for (const t of form.damageResistances ?? [])    pushDefense(t, 'resistance');
      for (const t of form.damageImmunities ?? [])      pushDefense(t, 'immunity');
      for (const t of form.damageVulnerabilities ?? []) pushDefense(t, 'vulnerability');
    }
  }

  return effects;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Returns true if the suppressor feature silences the given effect target.
 */
function doesSuppressTarget(
  entity:      Entity,
  suppressorId: string,
  effectTarget: string,
): boolean {
  const suppressor = entity.features.find(f => f.id === suppressorId);
  if (!suppressor) return false;
  return suppressor.effects.some(
    e =>
      e.type === 'suppress_condition_effects' &&
      Array.isArray(e.value) &&
      (e.value).includes(effectTarget),
  );
}
