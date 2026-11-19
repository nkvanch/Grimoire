import { officialClasses } from '../content/runtimeRules';
import { capitalize } from './actionCardText';
import { grantedSpellAbility } from './grantedSpellAbility';
import { getClassLevels } from './multiclass';
import { Entity, CharClass, SpellPreparationPolicy, Ability, SpellCastingContext, EntitlementSourceKind } from './types';

// ── Spell casting context (rules-engine blockers A & B, re-audit closure) ───
//
// Preparation legality and spellcasting ability used to be resolved
// independently (a raw sourceKind check for legality; a separate priority
// walk for ability) — the Codex re-audit found this let a cast "legalize
// through one source, then calculate through a different one" (e.g. a
// Wizard/Sorcerer character casting a spell both classes have: legal via
// Sorcerer's known-spell access, but silently computed with Wizard's INT).
// SpellCastingContext is the one shared unit both now resolve from, so a
// cast's legality and its ability always come from the SAME candidate
// source — see selectSpellCastingContext.

/**
 * Resolves which of the character's OWN classes a subclass belongs to,
 * using the character's own ClassLevelEntry records (multiclass.ts) rather
 * than a global subclass→class content registry (none exists — see the
 * closure's own disclosed note: ClassProgression/SubclassProgression carry
 * no stable subclass `id` to reverse-lookup by). This is actually more
 * correct than a global registry would be: it only ever resolves to a class
 * the CHARACTER actually has this exact subclass on, homebrew or official,
 * and needs no subclass content registry lookup at all (satisfies closure
 * 2D — official, homebrew, and non-primary-multiclass subclasses all
 * resolve identically, since none of them go through subclass content).
 */
function resolveClassIdForSubclass(entity: Entity, subclassId: string): string | undefined {
  return getClassLevels(entity).find(c => c.subclassId === subclassId)?.classId;
}

function resolvePreparationPolicy(classId: string | undefined, classDefs: readonly CharClass[]): SpellPreparationPolicy {
  if (!classId) return 'always_available';
  return classDefs.find(c => c.id === classId)?.spellPreparationPolicy ?? 'known';
}

function resolveClassAbility(classId: string | undefined, classDefs: readonly CharClass[]): Ability | undefined {
  if (!classId) return undefined;
  return classDefs.find(c => c.id === classId)?.spellcastingAbility;
}

/**
 * Rules-completeness batch (ritual casting), HIGH-fix closure: this
 * class's own ritual-access requirement (see CharClass.ritualCastingPolicy's
 * own doc comment) — undefined classId (no class-rooted source) or an
 * unauthored/homebrew-omitted policy both fail closed to `'none'`.
 */
function resolveClassRitualCastingPolicy(classId: string | undefined, classDefs: readonly CharClass[]): 'none' | 'known' | 'prepared' | 'spellbook' {
  if (!classId) return 'none';
  return classDefs.find(c => c.id === classId)?.ritualCastingPolicy ?? 'none';
}

/**
 * Rules-completeness batch (ritual casting), HIGH-fix closure: whether a
 * ritual attempt is legal RIGHT NOW under one class's own ritual-access
 * policy — see SpellCastingContext.ritualLegal's own doc comment (types.ts)
 * for exactly why this deliberately disagrees with normal preparation
 * legality for a `'spellbook'`-policy class.
 */
function ritualLegalForPolicy(policy: 'none' | 'known' | 'prepared' | 'spellbook', isPrepared: boolean): boolean {
  switch (policy) {
    case 'spellbook': return true;   // legal straight from the spellbook, prepared or not
    case 'known':     return true;   // no separate prepared/unprepared state to bypass
    case 'prepared':  return isPrepared; // identical requirement to a normal cast
    case 'none':      return false;
  }
}

/**
 * Rules-completeness batch (ritual casting), one-issue closure: the ONE
 * shared UI decision for "is the SELECTED context legal to cast through,
 * given this cast mode" — normal casting checks `legal` (ordinary
 * preparation), ritual casting checks `ritualLegal` (a separate, source-
 * specific policy that can legally DISAGREE with `legal` — a Wizard ritual
 * straight from the spellbook is `ritualLegal: true` while `legal: false`
 * when unprepared). Deliberately takes the CONTEXT, never the coarse
 * card-level `ritualEligible`/`preparationOverridable` — those reflect a
 * best-effort DEFAULT context computed at generation time, which can be a
 * different context than the one actually selected (e.g. a multiclass
 * Wizard/Sorcerer spell where the player picks Sorcerer specifically).
 * TabActions.tsx and TabSpells.tsx both call this at every point where they
 * used to check `context.legal` unconditionally.
 */
export function isContextLegalForCastMode(context: SpellCastingContext, castMode?: 'ritual'): boolean {
  return castMode === 'ritual' ? context.ritualLegal === true : context.legal;
}

/**
 * Rules-completeness batch (ritual casting), one-issue closure: whether an
 * illegal cast attempt through `context` should offer the EXISTING "Cast
 * Anyway" preparation-bypass override at all. True only when the block is
 * genuinely about PREPARATION on a source that has SOME capability to cast
 * this way — normal casting, always (unchanged, matches every existing
 * "not prepared" prompt); ritual casting, only when `context.ritualEligible`
 * is true (e.g. an unprepared Cleric ritual — Cast Anyway legitimately
 * bypasses that class's own prep requirement, exactly like a normal cast).
 * False whenever the context has NO ritual-casting policy at all
 * (`ritualEligible` false, e.g. Sorcerer) — Cast Anyway bypasses
 * PREPARATION, not "grants a mechanical capability the source never had,"
 * and applyActionCardUse refuses that case unconditionally regardless of
 * bypassSpellPreparation (see its own doc comment) — offering the override
 * there would promise the player something it can never deliver. Already
 * implies `!isContextLegalForCastMode(context, castMode)` is true; callers
 * check that separately to decide the silent-decline path.
 */
export function needsPreparationOverride(context: SpellCastingContext, castMode?: 'ritual'): boolean {
  if (isContextLegalForCastMode(context, castMode)) return false;
  return castMode === 'ritual' ? context.ritualEligible === true : true;
}

/**
 * Deterministic, stable identity for a context — see SpellCastingContext.
 * contextKey's own doc comment (types.ts). Rules-engine blocker RE-AUDIT
 * closure (2A/2C): EntitlementRecord has no separate `id` field of its own
 * — its real stable identity IS its full structural shape (kind/sourceKind/
 * sourceId/choiceId, the same fields sameEntitlement() in entitlements.ts
 * already compares) — so this key includes ALL of them, not just
 * sourceKind+sourceId, to avoid colliding two entitlements that share a
 * source but differ by `kind` (spell_access vs cantrip_access) or
 * `choiceId` (two separate resolved choices granting the same class's
 * access). classId is layered on top since it's the resolved-ability-
 * relevant variant (e.g. a subclass source resolved to different parent
 * classes would otherwise share an identical entitlement identity).
 */
function makeContextKey(
  sourceKind: EntitlementSourceKind, sourceId: string | undefined, classId: string | undefined,
  entitlementKind?: string, choiceId?: string,
): string {
  return `${sourceKind}:${sourceId ?? ''}:${classId ?? ''}:${entitlementKind ?? ''}:${choiceId ?? ''}`;
}

/** Builds one real casting context for a specific classId, using that
 *  class's own authored policy/ability — shared by the direct 'class'-
 *  sourced branch and the ambiguous-legacy-candidate branch below, so
 *  "what does casting as class X actually mean" is computed exactly once. */
function contextForClass(
  classId: string, isPrepared: boolean, isCantrip: boolean, entity: Entity, classDefs: readonly CharClass[],
): { policy: SpellPreparationPolicy; ability: Ability; legal: boolean; ritualEligible: boolean; ritualLegal: boolean } {
  const policy  = isCantrip ? 'always_available' : resolvePreparationPolicy(classId, classDefs);
  const ability = resolveClassAbility(classId, classDefs) ?? entity.spellcasting?.ability ?? 'int';
  const legal   = policy === 'known' || policy === 'always_available' || isPrepared;
  const ritualPolicy   = resolveClassRitualCastingPolicy(classId, classDefs);
  const ritualEligible = ritualPolicy !== 'none';
  const ritualLegal     = ritualLegalForPolicy(ritualPolicy, isPrepared);
  return { policy, ability, legal, ritualEligible, ritualLegal };
}

/**
 * Builds every currently-valid casting context for one spell/cantrip —
 * every source (class/subclass/race/feat/item/manual/...) the entity
 * currently has real access through, each with its OWN preparation policy,
 * ability, and legality resolved together (never independently — see this
 * section's own header comment). `classDefs` defaults to the full official
 * catalog for callers/tests that want a fixed, isolated set; production
 * call sites pass the application-resolved merged content explicitly
 * (CardGenOptions.classDefs — see generateSpellCard/generateAllActionCards,
 * closures 2B and dependency-inversion 1B).
 */
export function resolveSpellCastingContexts(
  entity: Entity,
  spellId: string,
  classDefs: readonly CharClass[] = officialClasses(),
): SpellCastingContext[] {
  const isPrepared = entity.spellcasting?.prepared.includes(spellId) ?? false;
  const contexts: SpellCastingContext[] = [];

  // 1. A racial/feat/item grant_spell EFFECT can specify its own ability
  //    directly (e.g. a homebrew race's cantrip using CON) — the most
  //    specific possible signal, authored straight on the effect. Never
  //    gated by preparation (no class-style prep framework applies to a
  //    feature-granted spell). Marked explicitAbility so
  //    selectSpellCastingContext always prefers it (see that field's own
  //    doc comment).
  for (const f of entity.features) {
    if (!f.isActive) continue;
    // A racial trait with an unlock level does nothing before it (the same gate collectAllEffects applies).
    if (f.source.kind === 'race' && f.level !== null && f.level !== undefined && f.level > entity.identity.level) continue;
    const effects = f.effects ?? [];
    for (let effectIndex = 0; effectIndex < effects.length; effectIndex++) {
      const eff = effects[effectIndex];
      if (eff.type !== 'grant_spell') continue;
      if (eff.minLevel && entity.identity.level < eff.minLevel) continue;
      const matches = (eff.cantripIds ?? []).includes(spellId) || (eff.spellIds ?? []).includes(spellId);
      if (!matches) continue;
      const granted = grantedSpellAbility(entity, eff);
      const ability = granted ?? entity.spellcasting?.ability ?? 'int';
      // Rules-engine blocker RE-AUDIT closure (2A/2B — exact source
      // identity): a coarse `feature:${f.id}` key would collide when the
      // SAME feature carries two grant_spell effects for the same spell
      // with two DIFFERENT explicit abilities — a real, distinct mechanical
      // choice. `f.effects` is stable persisted content (an authored list,
      // never runtime-reordered), so its own index is a safe disambiguator
      // per this closure's own "stable persisted content" exception; the
      // spellId + resolved ability are layered on top so the key is
      // meaningful (not just an opaque index) and still differs whenever
      // the MECHANICS differ, even if content authoring ever reorders effects.
      contexts.push({
        contextKey: `feature:${f.id}:${effectIndex}:${spellId}:${ability}`,
        sourceKind: 'feature', sourceId: f.id,
        preparationPolicy: 'always_available',
        castingAbility: ability,
        legal: true,
        explicitAbility: granted != null,
      });
    }
  }

  // 2. Entitlement-tracked sources — the existing provenance model (see
  //    EntitlementRecord's own doc comment). Every sourceKind is examined on
  //    its own coherent semantics, not a blanket "non-class => legal":
  //      - 'class': the owning class's OWN authored preparation policy
  //        (CharClass.spellPreparationPolicy — content-driven, ruleset-
  //        capable; see its own doc comment) decides. Cantrips are never
  //        gated regardless of policy (cantrip_access is tracked separately
  //        from prep bookkeeping — known directly from the entitlement
  //        KIND, no spell-content lookup needed, so an unloaded spell can't
  //        silently fail closed here).
  //      - a sourceKind:'manual' entitlement carrying ambiguousClassIds
  //        (closure 1F — unresolved legacy provenance): NOT a single
  //        always-legal manual context. Generates one REAL context PER
  //        candidate class, each with that class's own actual policy/
  //        ability, so an unresolved Wizard/Sorcerer Fireball offers a
  //        genuine Wizard-INT-prepared-required context AND a genuine
  //        Sorcerer-CHA-known context — never a single unrestricted one.
  //      - 'subclass': resolved to its parent class ONLY to get a correct
  //        casting ability; the grant itself (e.g. Cleric domain spells via
  //        `known_spells` in the subclass's own progression) is always
  //        available, matching the book rule that these don't need separate
  //        preparation.
  //      - everything else (race/subrace/background/feat/feature/item/
  //        spell/condition/campaign/plain manual): no class-style
  //        preparation framework applies at all — an item's own charges/
  //        uses (if any) are a completely separate resource-cost gate,
  //        already enforced by isFeatureAvailable, not by this function.
  const sources = (entity.entitlements ?? []).filter(
    e => (e.kind === 'spell_access' || e.kind === 'cantrip_access') && e.key === spellId
      && !(e.minLevel && entity.identity.level < e.minLevel),
  );
  for (const s of sources) {
    const entitlementIsCantrip = s.kind === 'cantrip_access';

    if (s.sourceKind === 'manual' && s.ambiguousClassIds && s.ambiguousClassIds.length > 0) {
      for (const candidateClassId of s.ambiguousClassIds) {
        const { policy, ability, legal, ritualEligible, ritualLegal } = contextForClass(candidateClassId, isPrepared, entitlementIsCantrip, entity, classDefs);
        contexts.push({
          contextKey: makeContextKey('manual', s.sourceId, candidateClassId, s.kind, s.choiceId),
          sourceKind: 'manual', sourceId: s.sourceId, classId: candidateClassId,
          preparationPolicy: policy, castingAbility: ability, legal, ritualEligible, ritualLegal,
          unresolvedLegacy: true,
        });
      }
      continue; // never ALSO emit a blanket "manual = always legal" context for this record
    }

    let classId: string | undefined;
    let policy:  SpellPreparationPolicy;
    let ability: Ability;
    let ritualEligible: boolean;
    let ritualLegal: boolean;

    if (s.sourceKind === 'class') {
      classId = s.sourceId;
      ({ policy, ability, ritualEligible, ritualLegal } = contextForClass(classId ?? '', isPrepared, entitlementIsCantrip, entity, classDefs));
    } else if (s.sourceKind === 'subclass') {
      classId = s.sourceId ? resolveClassIdForSubclass(entity, s.sourceId) : undefined;
      policy  = 'always_available';
      ability = resolveClassAbility(classId, classDefs) ?? entity.spellcasting?.ability ?? 'int';
      // Domain/circle spells are cast through the parent class's own casting
      // rules (RAW: they don't need separate preparation — resolved via the
      // SAME parent classId just derived above, never a second, independent
      // policy). Ritual legality follows suit: a domain spell is never
      // "unprepared" in the first place, so ritualLegal matches ritualEligible
      // exactly (both true only when the parent class has a ritual policy).
      const ritualPolicy = resolveClassRitualCastingPolicy(classId, classDefs);
      ritualEligible = ritualPolicy !== 'none';
      ritualLegal = ritualEligible;
    } else {
      classId = undefined;
      policy  = 'always_available';
      ability = entity.spellcasting?.ability ?? 'int';
      ritualEligible = false; // no class-rooted ritual-casting policy applies to a race/feat/item/manual grant
      ritualLegal = false;
    }

    const legal = policy === 'known' || policy === 'always_available' || isPrepared;
    contexts.push({
      contextKey: makeContextKey(s.sourceKind, s.sourceId, classId, s.kind, s.choiceId),
      sourceKind: s.sourceKind, sourceId: s.sourceId, classId,
      preparationPolicy: policy, castingAbility: ability, legal, ritualEligible, ritualLegal,
    });
  }

  // A spell with no tracked entitlement AT ALL (a legacy save predating the
  // entitlement system, before its one-time migration/reclassification —
  // see initializeEntitlementInputs/reclassifyManualSpellSources,
  // entitlements.ts) fails OPEN: legal, same conservatism as before rather
  // than inventing a heuristic that could wrongly block an unrecognized
  // source.
  if (contexts.length === 0) {
    contexts.push({
      contextKey: makeContextKey('manual', undefined, undefined),
      sourceKind: 'manual', preparationPolicy: 'always_available',
      castingAbility: entity.spellcasting?.ability ?? 'int', legal: true,
    });
  }

  return contexts;
}

/**
 * Collapses MECHANICALLY EQUIVALENT contexts down to one representative
 * each — same castingAbility + preparationPolicy + legal means the player
 * has no real decision to make between them (closure 1C: "you may collapse
 * contexts when all relevant cast mechanics are identical"). Two
 * mechanically DIFFERENT contexts (different ability, or one legal/one
 * not) always both survive, so `length > 1` is exactly "a real choice
 * exists" — the signal ActionCard.spellCastingContexts/the UI chooser key
 * off of.
 */
export function collapseDistinctSpellCastingContexts(contexts: SpellCastingContext[]): SpellCastingContext[] {
  const seen = new Map<string, SpellCastingContext>();
  for (const c of contexts) {
    const key = `${c.castingAbility}|${c.preparationPolicy}|${c.legal}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

/** Fixed, principled tie-break order for selectSpellCastingContext — never
 *  raw entitlement array order (see its own doc comment). */
const SOURCE_KIND_PRIORITY: EntitlementSourceKind[] =
  ['class', 'subclass', 'race', 'subrace', 'feat', 'feature', 'item', 'background', 'spell', 'manual', 'condition', 'campaign'];

/**
 * Picks ONE casting context to actually use for a spell — the single
 * source both isSpellPreparationLegal and resolveSpellAbility now derive
 * from, so a cast can never "legalize through source A, then calculate
 * through source B" (the bug the Codex re-audit found). Prefers a LEGAL
 * context when any exist (an unprepared Wizard copy never wins over a
 * known Sorcerer copy of the same spell). When multiple contexts remain
 * (several legal at once, or none legal — falls back to picking among the
 * illegal ones so a reason/ability is still reportable), ties break
 * deterministically: the character's OWN earliest-taken class wins first
 * (getClassLevels' index — the existing "primary class" concept, see
 * ClassLevelEntry's own doc comment), then a fixed source-kind priority.
 * Never "whichever entitlement happens to be first in the array" — that's
 * exactly the un-principled rule the task explicitly forbids.
 */
export function selectSpellCastingContext(
  entity: Entity,
  spellId: string,
  classDefs: readonly CharClass[] = officialClasses(),
): SpellCastingContext {
  const contexts = resolveSpellCastingContexts(entity, spellId, classDefs);
  const legal = contexts.filter(c => c.legal);
  const pool = legal.length > 0 ? legal : contexts;

  const classOrder = getClassLevels(entity).map(c => c.classId as string);
  const rank = (c: SpellCastingContext): number => {
    if (c.explicitAbility) return -1; // always wins — see the field's own doc comment
    if (c.classId) {
      const idx = classOrder.indexOf(c.classId);
      if (idx >= 0) return idx;
    }
    return 1000 + SOURCE_KIND_PRIORITY.indexOf(c.sourceKind);
  };
  return pool.slice().sort((a, b) => rank(a) - rank(b))[0];
}

// ── Prepared-spell eligibility (rules-engine blocker A) ─────────────────────

/**
 * Whether a class uses SOME preparation model for its leveled spells
 * (spellbook-prepared or full-list-prepared — see CharClass.
 * spellPreparationPolicy's own doc comment). Read from the class catalog on
 * every call: the catalog is empty at import time in the app builds (content
 * packs load later), so a set computed once at module load stayed empty and
 * the Spells tab never showed its prepare toggle.
 */
export function isPreparedCasterClass(classId: string, classDefs: readonly CharClass[] = officialClasses()): boolean {
  const policy = classDefs.find(c => c.id === classId)?.spellPreparationPolicy;
  return policy === 'spellbook_prepared' || policy === 'full_list_prepared';
}

/**
 * The ONE authoritative check for whether a leveled spell is currently
 * legal to cast on preparation grounds alone — used by BOTH generateSpellCard
 * (to compute `available`/`preparationOverridable`) and applyActionCardUse
 * (actionUse.ts, to enforce it at cast time) so there is exactly one
 * definition of "prepared enough to cast," never two. Legal if ANY of the
 * spell's SpellCastingContexts (see resolveSpellCastingContexts, above) is
 * legal — removing one source can never silently revoke a different,
 * still-valid source's access.
 */
export function isSpellPreparationLegal(
  entity: Entity, spellId: string, classDefs: readonly CharClass[] = officialClasses(),
): boolean {
  return resolveSpellCastingContexts(entity, spellId, classDefs).some(c => c.legal);
}

// ── Multiclass spellcasting ability (rules-engine blocker B) ────────────────

/**
 * Resolves the correct casting ability for ONE specific spell/cantrip, from
 * the SAME selected context isSpellPreparationLegal effectively legalizes
 * through (selectSpellCastingContext) — never entity.spellcasting.ability's
 * single global scalar, which can only ever hold ONE value at a time and is
 * therefore structurally wrong for a multiclass character whose classes use
 * different abilities (a Wizard/Cleric multiclass has exactly one
 * spellcasting.ability field, but Wizard spells need INT and Cleric spells
 * need WIS — the field can only ever agree with one of them).
 *
 * Payment (which slot/resource pays for the cast) is intentionally NOT an
 * input here — spellPayment.ts's slot/resource selection is a completely
 * separate concern from which class's ability governs the spell (see the
 * task's own "payment is independent" constraint); a Wizard spell paid via
 * a shared multiclass slot or a Warlock spell paid via Pact Magic still
 * resolves its ability purely from its OWN casting context.
 */
export function resolveSpellAbility(
  entity: Entity,
  spellId: string,
  classDefs: readonly CharClass[] = officialClasses(),
): Ability {
  return selectSpellCastingContext(entity, spellId, classDefs).castingAbility;
}

// ── Per-spell spell save DC / attack bonus (rules-engine blocker B, 2E) ─────

function hasActiveOverride(entity: Entity, stat: string): boolean {
  return [...(entity.characterOverrides ?? []), ...(entity.dmOverrides ?? [])].some(o => o.active && o.stat === stat);
}

/**
 * Per-spell spell save DC, wired into the SAME production derived-stats
 * pipeline the character's headline `derived.spellSaveDC` already uses
 * (pipeline.ts) rather than a second formula engine: `derived.spellSaveDC`
 * is `8 + prof + mod(entity.spellcasting.ability)` plus any active feature-
 * effect/override bonus already baked in by recomputeDerived. The bonus
 * portion (everything beyond the pure ability-based baseline) is ability-
 * INDEPENDENT — a flat "+1 spell save DC" feature or override applies the
 * same regardless of which class cast the spell — so it's isolated once
 * (`derived.spellSaveDC - derived.abilityBasedDC[globalAbility]`) and
 * re-added on top of this spell's OWN resolved-ability baseline
 * (`derived.abilityBasedDC[ability]`, already computed for every ability by
 * recomputeDerived). An ACTIVE character/DM override on 'spellSaveDC' is a
 * human-stated flat final number ("your spell DC is 17") — existing
 * override precedence (2F) makes it authoritative over every spell
 * regardless of source, so it's returned as-is rather than decomposed.
 */
export function resolveSpellSaveDC(
  entity: Entity, spellId: string, classDefs: readonly CharClass[] = officialClasses(),
): number | null {
  return computeSpellSaveDCForAbility(entity, resolveSpellAbility(entity, spellId, classDefs));
}

/** Ability-parameterized core of resolveSpellSaveDC — shared with the
 *  "Cast as..." source-chooser label formatter (formatCastingContextLabel),
 *  which already has a specific SpellCastingContext's ability in hand and
 *  doesn't need to re-resolve it via a spellId. */
export function computeSpellSaveDCForAbility(entity: Entity, ability: Ability): number | null {
  if (!entity.spellcasting || entity.derived.spellSaveDC == null) return null;
  if (hasActiveOverride(entity, 'spellSaveDC')) return entity.derived.spellSaveDC;
  if (ability === entity.spellcasting.ability) return entity.derived.spellSaveDC;
  const flatBonus = entity.derived.spellSaveDC - entity.derived.abilityBasedDC[entity.spellcasting.ability];
  return entity.derived.abilityBasedDC[ability] + flatBonus;
}

/** Per-spell spell attack bonus — same reuse strategy as resolveSpellSaveDC
 *  above. `derived.abilityBasedDC[ability] - 8` recovers the pure
 *  "prof + mod(ability)" attack-bonus baseline for any ability from the
 *  already-computed DC array (DC is always exactly 8 higher than the
 *  matching attack bonus per the 5e formula), so no second per-ability
 *  attack-bonus table needs to exist alongside abilityBasedDC. */
export function resolveSpellAttackBonus(
  entity: Entity, spellId: string, classDefs: readonly CharClass[] = officialClasses(),
): number | null {
  return computeSpellAttackBonusForAbility(entity, resolveSpellAbility(entity, spellId, classDefs));
}

/** Ability-parameterized core of resolveSpellAttackBonus — see
 *  computeSpellSaveDCForAbility's own doc comment for why this shape exists. */
export function computeSpellAttackBonusForAbility(entity: Entity, ability: Ability): number | null {
  if (!entity.spellcasting || entity.derived.spellAttackBonus == null) return null;
  if (hasActiveOverride(entity, 'spellAttackBonus')) return entity.derived.spellAttackBonus;
  if (ability === entity.spellcasting.ability) return entity.derived.spellAttackBonus;
  const globalBaseline = entity.derived.abilityBasedDC[entity.spellcasting.ability] - 8;
  const flatBonus = entity.derived.spellAttackBonus - globalBaseline;
  const spellBaseline = entity.derived.abilityBasedDC[ability] - 8;
  return spellBaseline + flatBonus;
}

function entitlementSourceKindLabel(kind: EntitlementSourceKind): string {
  switch (kind) {
    case 'race':       return 'Racial';
    case 'subrace':    return 'Racial';
    case 'class':      return 'Class';
    case 'subclass':   return 'Subclass';
    case 'background': return 'Background';
    case 'feat':       return 'Feat';
    case 'feature':    return 'Feature';
    case 'item':       return 'Item';
    case 'spell':      return 'Spell';
    case 'condition':  return 'Condition';
    case 'campaign':   return 'Campaign';
    case 'manual':     return 'Manual';
  }
}

/**
 * Compact human label for one casting context — the "Cast as..." chooser
 * (closure 1C) uses this per option, e.g. "Wizard — INT — DC 15" or
 * "Sorcerer — CHA — Not Prepared". `classDefs` should be the SAME merged/
 * ruleset-resolved list the context was built from (the application layer's
 * explicit CardGenOptions.classDefs) so a homebrew class's own display name
 * is honored.
 */
export function formatCastingContextLabel(
  entity: Entity, context: SpellCastingContext, classDefs: readonly CharClass[] = officialClasses(),
): string {
  const className = context.classId
    ? (classDefs.find(c => c.id === context.classId)?.name ?? capitalize(context.classId))
    : entitlementSourceKindLabel(context.sourceKind);
  const abilityLabel = context.castingAbility.toUpperCase();
  const dc = computeSpellSaveDCForAbility(entity, context.castingAbility);
  const dcPart = !context.legal ? ' — Not Prepared' : dc != null ? ` — DC ${dc}` : '';
  return `${className} — ${abilityLabel}${dcPart}`;
}
