// ============================================================================
// FILE: src/engine/actionCards.ts
// Action Card generator engine.
//
// Two kinds of features produce cards:
//   1. Features with activation (class abilities, racial abilities, etc.)
//   2. Spells in entity.spellcasting.known / prepared / cantrips
//
// Passive features (no activation field) are never given cards.
// ============================================================================

import { officialClasses, officialRaces, findBeastForm } from '../content/runtimeRules';
import { Feature, Entity, ActionCard, FeatureActivation, Race } from './types';
import { spellRepo } from '../content/spellRepo';
import { effectiveItemFeatures, isItemMechanicallyActive, resolveItemDefinition } from './itemMechanics';
import { isWeapon } from '../content/items/itemBrowse';
import { toItemIndexEntry } from '../content/itemRepo.types';
import { usesLargeCreatureWeaponDice } from './houseRules';
import { isIncapacitated, isDead, incapacitationReason } from './combatState';
import { CampaignRules } from './types';
import { ridersForCard } from './riders';
import { wildShapeLimits, eligibleWildShapeForms, wildShapeOptions } from './wildShapeForms';
import { isFeatureSuspended } from './suspension';
import { spellRangeOverride } from './spellModifiers';
import { COUNTS_AS_LARGE_FEATURE_IDS } from './ruleset/dnd5e';
import { dieRuleOf, doubleDice, masteryNote, formatDamage, fmtBonus, capitalize } from './actionCardText';
import { resolveSpellCastingContexts, collapseDistinctSpellCastingContexts, selectSpellCastingContext } from './spellCastingContext';
import { classifyFeature, cardColor, buildLayer1, buildLayer2, buildLayer3, buildOutcomeLines, buildCritLine, classifySpell, buildLayer1ForSpell, buildLayer2ForSpell, buildLayer3ForSpell, CardGenOptions } from './actionCardLayers';
import { isFeatureAvailable, resourceAndEconomyLegal } from './actionCardAvailability';

// ── Large-creature weapon dice (house rule) ──────────────────────────

// Bug fix (architecture review E6): this used to be a hardcoded 1-entry id
// allowlist that a race/subrace dev had to remember to hand-edit for every
// new Large race — Race.size/Subrace.size already exist as content fields
// for exactly this, but were never read for mechanics anywhere. Now reads
// the entity's actual race/subrace content record (subrace's own `size`
// wins when set, since it can override the parent race's — e.g. a Large
// "Giant" subrace of an otherwise-Medium race) instead of an id lookup
// table. The feature-id fallback stays as a last-resort safety net for a
// homebrew race authored before this field existed.
/**
 * Rules-engine blocker RE-AUDIT closure (dependency inversion, 1A): `races`
 * used to be resolved by reaching into useHomebrewStore.getState() directly
 * from inside this pure engine function — a rules-core file must never read
 * application/store state implicitly. The APPLICATION layer now resolves
 * the correct merged/ruleset-filtered race list (getMergedContentDB) and
 * passes it in; omitting it falls back to the deterministic, static
 * official race catalog (officialRaces()) — correct for every test and any
 * caller that hasn't been updated to pass homebrew-aware content, though it
 * won't reflect a homebrew race's own size.
 */
export function isLargeCreature(entity: Entity, races: readonly Race[] = officialRaces()): boolean {
  const raceId = entity.identity.raceId;
  if (raceId) {
    const race = races.find(r => r.id === raceId);
    if (race) {
      const subrace = entity.identity.subRaceId
        ? race.subraces?.find(sr => sr.id === entity.identity.subRaceId)
        : undefined;
      const size = subrace?.size ?? race.size;
      if (size) return size === 'Large';
    }
  }
  return entity.features.some(f => COUNTS_AS_LARGE_FEATURE_IDS.includes(f.id));
}

// ── Card generators ───────────────────────────────────────────────────────────

/**
 * Generates an ActionCard for a single feature.
 * Returns null for passive features (no activation).
 *
 * `itemInstanceId` (item-identity closure, pass 2 finding D) — pass the
 * owning ItemInstance's `id` when `feature` lives on an equipped item's own
 * features array (never for an entity.features-sourced class/race/feat
 * feature). Stamps `sourceKind:'item'`/`sourceId` on the returned card so
 * two identical equipped items' authored-feature cards don't collide in
 * identity, and so applyActionCardUse (actionUse.ts) can revalidate the
 * EXACT instance at execution time instead of a flat cross-instance search.
 */
export function generateActionCard(
  feature: Feature,
  entity: Entity,
  opts: CardGenOptions = {},
  itemInstanceId?: string,
): ActionCard | null {
  if (!feature.activation) return null;
  let activation: FeatureActivation = feature.activation;
  // The 2014 Druid's Wild Shape is one card whose picker lists the forms the character's level allows (engine/wildShapeForms.ts).
  if (activation.beastFormPicker && entity) {
    const limits = wildShapeLimits(entity);
    activation = {
      ...activation,
      actionType: limits?.bonusAction ? 'bonus_action' : activation.actionType,
      options: wildShapeOptions(eligibleWildShapeForms(entity)),
    };
    feature = { ...feature, activation };
  }

  const cardType = classifyFeature(feature, entity?.rulesetId);
  const base = isFeatureAvailable(feature, entity);
  // A feature switched off for a time (engine/suspension.ts) cannot be used until it comes back.
  const suspended = !!entity && isFeatureSuspended(entity, feature.id);
  const available = base.available && !suspended;
  const reason = suspended ? 'Switched off for now (until the end of your next turn).' : base.reason;
  const incapacitatedOverridable = suspended ? false : base.incapacitatedOverridable;

  const tabs: ActionCard['tabs'] = ['features'];
  const actionType = activation.actionType;
  // 'free' (usable alongside another action, e.g. a maneuver riding a normal
  // attack) still spends a resource and needs a discoverable [Use] button —
  // the Actions tab is the only place that exists in the app. Only bare
  // 'passive' features (no player-triggered use at all) are excluded.
  if (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction' || actionType === 'free') {
    tabs.push('actions');
  }
  if (feature.source.kind === 'spell')     tabs.push('spellcasting');
  if (feature.source.kind === 'item')      tabs.push('inventory');

  return {
    featureId:         feature.id,
    name:              feature.name,
    cardType,
    color:             cardColor(cardType),
    layer1:            buildLayer1(feature, cardType, entity?.rulesetId),
    layer2:            buildLayer2(feature, entity, opts),
    layer3:            buildLayer3(feature, entity),
    outcomes:          [...buildOutcomeLines(feature), ...buildCritLine(feature, entity)],
    triggerNote:       feature.trigger ?? null,
    activation,
    resourceCost:      activation.resourceCost,
    tabs,
    available,
    unavailableReason: reason,
    incapacitatedOverridable,
    ...(itemInstanceId ? { sourceKind: 'item' as const, sourceId: itemInstanceId } : {}),
  };
}

/**
 * Generates an ActionCard for a known/prepared spell.
 * The spell is looked up from spellRepo's Tier-2 cache by ID, falling back
 * to `opts.homebrewSpells` for anything spellRepo doesn't have (a homebrew
 * spell — e.g. one added via "+ Add Additional Spell" or a homebrew spell
 * tagged for the character's own class — would otherwise silently never get
 * a card, mirroring the same official-then-homebrew fallback already used
 * for equipped-item features above). Rules-engine blocker RE-AUDIT closure
 * (dependency inversion, 1A/1B): `opts.homebrewSpells`/`opts.classDefs` are
 * explicit, application-resolved inputs — this function never reaches into
 * a store itself; omitting them means "no homebrew spell fallback, official
 * class catalog only" (a deterministic, static default), not "ask a store."
 */
export function generateSpellCard(
  spellId: string,
  entity: Entity,
  opts: CardGenOptions = {},
): ActionCard | null {
  const homebrewSpells = opts.homebrewSpells ?? [];
  const spell = spellRepo.getSpellSync(spellId, entity.rulesetId) ?? homebrewSpells.find(s => s.id === spellId);
  if (!spell) return null;

  const cardType = classifySpell(spell);

  // Determine slot tier for cost
  const tier  = spell.level as 1|2|3|4|5|6|7|8|9 | undefined;
  const cost  = spell.level > 0
    ? { resourceId: 'spell_slots', quantity: 1, spellSlotTier: tier as 1|2|3|4|5|6|7|8|9 }
    : null;

  const actionType = spell.castingTime.includes('bonus action') ? 'bonus_action'
    : spell.castingTime.includes('reaction')                    ? 'reaction'
    : 'action';

  const spellRange = spellRangeOverride(entity, spell.id) !== null ? `${spellRangeOverride(entity, spell.id)} feet` : spell.range;
  const activation: FeatureActivation = {
    actionType,
    resourceCost: cost,
    range:        spellRange,
    target:       spell.range.includes('cone') || spell.range.includes('radius') || spell.range.includes('cube') ? 'area' : 'single',
    requiresSave: null,
  };

  // Always check resource/economy legality, even for a cantrip (cost ===
  // null) — bug fix: it used to be skipped whenever cost was falsy, which
  // also skipped the turn-economy check (that check runs before the
  // resource-cost check, so it applies regardless of whether there's a
  // cost). A cantrip card was therefore always shown available:true even
  // after the character had already used their action/bonus action/
  // reaction this turn. resourceAndEconomyLegal already handles cost===null
  // correctly on its own (falls through to legal:true once the economy
  // check passes), so no ternary is needed. Deliberately calls
  // resourceAndEconomyLegal directly (not isFeatureAvailable) so this
  // function can independently combine THREE separate legality gates —
  // resource/economy, preparation, and incapacitation (HIGH batch, C7) —
  // each with its own override flag, rather than isFeatureAvailable's
  // single combined status gate.
  const { legal: costAndEconomyLegal, reason: costReason } = resourceAndEconomyLegal(
    { activation, effects: [], abilityEffects: [] } as unknown as Feature, entity,
  );

  // Rules-engine blocker fix (prepared-spell eligibility): this used to
  // stop here — a spell card was available whenever the slot/action-economy
  // check passed, with NO check at all for whether a prepared caster had
  // actually prepared this leveled spell. isSpellPreparationLegal is the
  // one authoritative, source-aware check (see its own doc comment); never
  // gates cantrips (spell.level === 0 never carries a spell_access
  // entitlement, only cantrip_access, so it always returns true for them).
  //
  // Closure 2B: classDefs comes from the caller's explicit opts.classDefs
  // (the application layer's merged official + homebrew + active-ruleset
  // content set), not the bare official catalog default — a homebrew
  // class's own preparation policy/ability is honored whenever the caller
  // supplies it.
  const classDefs = opts.classDefs ?? officialClasses();
  const allContexts = resolveSpellCastingContexts(entity, spellId, classDefs);
  const distinctContexts = collapseDistinctSpellCastingContexts(allContexts);
  const selectedContext = selectSpellCastingContext(entity, spellId, classDefs);
  const preparationLegal = distinctContexts.some(c => c.legal);
  // Rules-completeness batch (ritual casting): offered whenever the spell
  // is ritual-tagged content AND at least one candidate source can ritual-
  // cast at all — a coarse "should the UI even ask" signal. The SPECIFIC
  // context the player ultimately selects (default or chosen via "Cast
  // as...") is re-checked for its OWN ritualEligible flag at execution time
  // (applyActionCardUse) — this flag never gates the actual mutation.
  const ritualEligible = spell.ritual && distinctContexts.some(c => c.ritualEligible);

  // Rules-engine HIGH-batch closure (C7): preparation and incapacitation
  // (0HP/Unconscious) are two INDEPENDENT one-off overridable restrictions —
  // a spell can be blocked by either, both, or neither, and each gets its
  // own override flag so the UI can offer "Cast Anyway"/"Use Anyway"
  // separately (or together) without one masking the other. Dead is a hard
  // blocker checked first, same as isFeatureAvailable.
  const dead = isDead(entity);
  const incapacitated = !dead && isIncapacitated(entity);
  const available = costAndEconomyLegal && preparationLegal && !incapacitated && !dead;
  // Only offer an override when the resource/economy check ITSELF still
  // passes — if a slot is also missing or the action economy is already
  // spent, those still block normally (no "cast with no slot anyway"
  // support here, for either override).
  const preparationOverridable = costAndEconomyLegal && !preparationLegal && !dead;
  const incapacitatedOverridable = costAndEconomyLegal && incapacitated && !dead;
  const statusReason = incapacitated ? incapacitationReason(entity) : null;
  const reason = dead ? 'Dead'
    : !costAndEconomyLegal ? costReason
    : [!preparationLegal ? 'Not prepared' : null, statusReason].filter(Boolean).join(' • ') || null;

  const tabs: ActionCard['tabs'] = ['spellcasting', 'features'];
  if (actionType === 'action' || actionType === 'bonus_action' || actionType === 'reaction') {
    tabs.push('actions');
  }

  return {
    featureId:         spellId,
    name:              spell.name,
    cardType,
    color:             cardColor(cardType),
    layer1:            buildLayer1ForSpell(spell, cardType),
    layer2:            buildLayer2ForSpell(spell, entity, classDefs),
    layer3:            buildLayer3ForSpell(spell, entity, classDefs),
    outcomes:          [],
    triggerNote:       null,
    activation,
    resourceCost:      cost,
    tabs,
    available,
    unavailableReason: reason,
    preparationOverridable,
    incapacitatedOverridable,
    // Closure 1B: the card PRESERVES the exact context it was generated
    // against — applyActionCardUse revalidates this same context (by
    // contextKey) at execution time rather than silently re-resolving a
    // possibly-different source. Only exposes the alternatives list when a
    // real choice exists (closure 1C) — a single distinct context means
    // there's nothing to choose between.
    spellCastingContext:  selectedContext,
    spellCastingContexts: distinctContexts.length > 1 ? distinctContexts : undefined,
    ...(ritualEligible ? { ritualEligible: true as const } : {}),
  };
}

/**
 * Generates all Action Cards for an entity.
 * Runs over every active feature and all known/prepared spells.
 * Filters nulls. Each card knows which tabs it belongs to.
 *
 * `contentOpts` (rules-engine blocker RE-AUDIT closure — dependency
 * inversion, 1B): explicit, application-resolved classes/races/homebrew
 * spells — see CardGenOptions' own doc comment. Threaded straight through
 * to isLargeCreature and every generateSpellCard call below, so the whole
 * card set for one entity is generated against ONE consistent content
 * snapshot. Omitting it (every pre-existing call site) preserves today's
 * exact official-only behavior.
 */
export function generateAllActionCards(
  entity: Entity, rules?: CampaignRules,
  contentOpts: Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> = {},
): ActionCard[] {
  const cards: ActionCard[] = [];

  // Large-creature weapon-dice house rule: active only when the rule is on AND
  // this creature is Large+. Weapon (item) damage dice double on their cards.
  const doubleWeaponDice =
    !!rules && usesLargeCreatureWeaponDice(rules) && isLargeCreature(entity, contentOpts.races);
  const opts: CardGenOptions = { doubleWeaponDice, ...contentOpts };

  // 1. Feature-based cards (class abilities, race abilities, background features)
  for (const fi of entity.features) {
    if (!fi.isActive) continue;
    // Level-gate: a Feature can be present on the entity (already granted,
    // already applied) but not yet "switch on" until the character reaches
    // its authored level — needed for spell_grant traits, where one trait
    // can contain several leveled sub-grants at different levels (so it
    // can't be gated at grant-time the way class leveling already is).
    // Self-healing on manual level edits; class/subclass features are
    // unaffected since their level is always <= the character's by
    // construction of levelUp()'s crossing loop.
    if (fi.level !== null && fi.level > entity.identity.level) continue;
    const card = generateActionCard(fi, entity, opts);
    if (card) cards.push(card);
  }

  // 1b. Equipped item features (weapon attacks, magic-item actions).
  //     These live on inventory.equipped[].features, NOT entity.features, so
  //     they must be iterated separately or weapon attack cards never appear.
  //     If an equipped instance has no hydrated features (older saves stored
  //     only the itemId), fall back to the item definition — itemRepo for
  //     the official catalog, homebrewStore for anything itemRepo doesn't
  //     have (a homebrew weapon/item otherwise silently never gets a card).
  for (const inst of entity.inventory.equipped) {
    // An item requiring attunement gives none of its own cards until attuned (the same flag collectAllEffects uses for its
    // passive effects); a weapon still gets the plain weapon card below, as its base weapon.
    const definition = resolveItemDefinition(inst.itemId, opts.items);
    const attuned = isItemMechanicallyActive(inst, definition);
    const feats = attuned ? effectiveItemFeatures(inst, definition) : [];
    const plainNote = [masteryNote(entity, inst.itemId), attuned ? null : 'Not attuned: a plain weapon, without its magic'].filter(Boolean).join(' · ') || null;
    const weaponAttack = inst.id
      ? entity.derived.attackBonuses.find(candidate => candidate.instanceId === inst.id)
      : entity.derived.attackBonuses.find(candidate => candidate.id === inst.itemId);
    let hasAuthoredAttack = false;
    for (const fi of feats) {
      if (!fi.activation) continue;
      // Item-identity closure: stamps sourceKind:'item'/sourceId = THIS
      // instance's own id, so two identical equipped items' authored-
      // feature cards carry distinct, revalidatable identity (see
      // generateActionCard's own doc comment).
      const card = generateActionCard(fi, entity, opts, inst.id);
      if (card) {
        const isDamageFeature = fi.abilityEffects?.some(effect => effect.type === 'damage') ?? false;
        if (isDamageFeature) hasAuthoredAttack = true;
        // Extra Attack / action-structure batch: gated on isWeapon(), not
        // isDamageFeature alone — in principle these could diverge for
        // content this catalog doesn't currently author (a non-weapon
        // item's own damage-dealing feature), but isWeapon() ITSELF already
        // treats any declared damage effect as sufficient evidence of being
        // a weapon (hasDamageEffect, itemBrowse.ts) for every item shape
        // actually authored here, so this stays the semantically correct
        // (never narrower) gate rather than assuming isDamageFeature alone
        // is enough — see ActionCard.isWeaponAttack's own doc comment.
        //
        // Extra Attack sequence closure (two-issue final closure, Part A2):
        // ALSO requires actionType === 'action' — a weapon's own authored
        // attack feature that activates as a Bonus Action or Reaction (e.g.
        // a magic weapon's "as a bonus action, make a melee attack" rider)
        // deals damage and belongs to a weapon, but is NOT a genuine Attack-
        // action attack and must never be sequence-eligible merely because
        // it satisfies the other two conditions. Standalone use of such a
        // card (its own normal Bonus Action/Reaction economy) is completely
        // unaffected — this only controls the isWeaponAttack flag.
        const isWeaponAttack = isDamageFeature && !!definition && isWeapon(toItemIndexEntry(definition)) && fi.activation.actionType === 'action';
        cards.push(isWeaponAttack ? { ...card, isWeaponAttack: true, ...dieRuleOf(weaponAttack, card.layer3) } : card);
      }
    }
    if (definition && isWeapon(toItemIndexEntry(definition)) && !hasAuthoredAttack) {
      // Item-identity closure: prefer the EXACT matching AttackBonus by
      // instance id when this instance has one — `.find(a => a.id ===
      // itemId)` alone always returns the FIRST equipped weapon sharing
      // that itemId, silently generating an identical (wrong) attack card
      // for every OTHER identical copy. Falls back to the old itemId-only
      // match for an instance with no id yet (pre-migration/test fixture).
      const attack = weaponAttack;
      if (attack) {
        const activation: FeatureActivation = { actionType: 'action', resourceCost: null, range: attack.type === 'ranged' ? 'weapon range' : '5 feet', target: 'single', requiresSave: null };
        const availability = isFeatureAvailable({ activation, effects: [], abilityEffects: [] } as unknown as Feature, entity);
        const dice = doubleWeaponDice ? doubleDice(attack.damageDice) : attack.damageDice;
        cards.push({
          // Item-identity closure: keyed by instance id when present, so
          // two identical equipped weapons produce two DISTINCT cards
          // instead of colliding on one shared featureId (falls back to
          // the original itemId-based scheme for an un-migrated instance,
          // preserving every existing single-copy featureId exactly).
          featureId: `${inst.id ?? inst.itemId}_basic_weapon_attack`, name: definition.name,
          cardType: 'damage', color: 'red', layer1: `Action • ${capitalize(attack.type)} Weapon Attack`,
          layer2: `${fmtBonus(attack.bonus)} to hit • ${dice}${attack.damageBonus !== 0 ? fmtBonus(attack.damageBonus) : ''} ${capitalize(attack.damageType)}`,
          layer3: plainNote, outcomes: [], triggerNote: null, activation, resourceCost: null,
          tabs: ['actions', 'features'], available: availability.available, unavailableReason: availability.reason,
          incapacitatedOverridable: availability.incapacitatedOverridable,
          ...dieRuleOf(attack, plainNote),
          isWeaponAttack: true, // Extra Attack / action-structure batch — a real weapon attack, eligible for the Attack action's extra attack opportunities.
          // Item-identity closure: same stale-instance revalidation at
          // execution time as an authored item-feature card, even though
          // this synthetic card has no abilityEffects of its own to apply —
          // still worth rejecting cleanly rather than silently no-op'ing
          // against a stale removed/unequipped weapon.
          ...(inst.id ? { sourceKind: 'item' as const, sourceId: inst.id } : {}),
        });
      }
    }
    // The off-hand attack of two-weapon fighting: a Bonus Action, not part of the Attack action's sequence.
    if (definition && weaponAttack?.offHandDamageBonus !== undefined) {
      const activation: FeatureActivation = { actionType: 'bonus_action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null };
      const availability = isFeatureAvailable({ activation, effects: [], abilityEffects: [] } as unknown as Feature, entity);
      const dice = doubleWeaponDice ? doubleDice(weaponAttack.damageDice) : weaponAttack.damageDice;
      const bonus = weaponAttack.offHandDamageBonus;
      cards.push({
        featureId: `${inst.id ?? inst.itemId}_offhand_attack`, name: `${definition.name} (off-hand)`,
        cardType: 'damage', color: 'red', layer1: 'Bonus Action • Melee Weapon Attack',
        layer2: `${fmtBonus(weaponAttack.bonus)} to hit • ${dice}${bonus !== 0 ? fmtBonus(bonus) : ''} ${capitalize(weaponAttack.damageType)}`,
        layer3: 'After you attack with a light weapon in your other hand.', outcomes: [], triggerNote: null, activation, resourceCost: null,
        tabs: ['actions', 'features'], available: availability.available, unavailableReason: availability.reason,
        incapacitatedOverridable: availability.incapacitatedOverridable,
        ...(inst.id ? { sourceKind: 'item' as const, sourceId: inst.id } : {}),
      });
    }
  }

  // 1c. Unarmed Strike — synthetic, always available (see the
  //     computeWeaponAttackBonuses 'unarmed_strike' entry in pipeline.ts),
  //     not tied to any equipped item or granted Feature, so it's built
  //     directly here rather than through generateActionCard.
  const unarmed = entity.derived.attackBonuses.find(ab => ab.id === 'unarmed_strike');
  if (unarmed) {
    const dmgStr = `${formatDamage(unarmed.damageDice, unarmed.damageBonus)} ${capitalize(unarmed.damageType)}`;
    const unarmedActivation: FeatureActivation = { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null };
    // Was hardcoded available:true, unconditionally — bypassed
    // isFeatureAvailable() entirely, which is otherwise the only card ever
    // exempt from A-25's action-economy gate (a real attack, not a passive).
    const { available, reason, incapacitatedOverridable } = isFeatureAvailable(
      { activation: unarmedActivation, effects: [], abilityEffects: [] } as unknown as Feature, entity,
    );
    cards.push({
      featureId: 'unarmed_strike',
      name:      'Unarmed Strike',
      cardType:  'damage',
      color:     'red',
      layer1:    'Action • Damage',
      layer2:    `${fmtBonus(unarmed.bonus)} to hit • ${dmgStr}`,
      layer3:    null,
      outcomes:  [],
      triggerNote: null,
      activation: unarmedActivation,
      resourceCost: null,
      tabs: ['actions', 'features'],
      available,
      unavailableReason: reason,
      incapacitatedOverridable,
      isWeaponAttack: true, // Extra Attack / action-structure batch — usable with the Attack action's extra attack opportunities.
    });
  }

  // 1d. While in a Wild Shape form, the form's own attacks (its bite, claws) as cards: your game statistics are the beast's.
  const shaped = entity.wildShapeState?.active ? findBeastForm(entity.wildShapeState.formId) : undefined;
  if (shaped) {
    const strMod = Math.floor((shaped.stats.str - 10) / 2);
    const dexMod = Math.floor((shaped.stats.dex - 10) / 2);
    shaped.attacks.forEach((a, i) => {
      if (a.effect.type !== 'damage') return;
      const toHit = a.attackBonus ?? Math.max(strMod, dexMod) + entity.derived.proficiencyBonus;
      const activation: FeatureActivation = { actionType: 'action', resourceCost: null, range: '5 feet', target: 'single', requiresSave: null };
      const av = isFeatureAvailable({ activation, effects: [], abilityEffects: [] } as unknown as Feature, entity);
      cards.push({
        featureId: `wild_shape_attack_${shaped.id}_${i}`, name: `${a.name} (${shaped.name})`,
        cardType: 'damage', color: 'red', layer1: 'Action • Beast Attack',
        layer2: `${fmtBonus(toHit)} to hit • ${a.effect.dice} ${capitalize(a.effect.damageType)}`,
        layer3: null, outcomes: [], triggerNote: null, activation, resourceCost: null,
        tabs: ['actions', 'features'], available: av.available, unavailableReason: av.reason,
        incapacitatedOverridable: av.incapacitatedOverridable, isWeaponAttack: true,
      });
    });
  }

  // 2. Spell-based cards (cantrips + known/prepared)
  if (entity.spellcasting) {
    const spellIds = new Set([
      ...entity.spellcasting.cantrips,
      ...entity.spellcasting.known,
      ...entity.spellcasting.prepared,
    ]);
    for (const id of spellIds) {
      const card = generateSpellCard(id, entity, opts);
      if (card) cards.push(card);
    }
  }

  // An Attack action under way (Extra Attack) has attacks left: its weapon attacks stay usable though the Action is spent.
  const open = entity.attackSequence;
  const attacksLeft = !!open && open.actorId === entity.id && open.usedAttacks < open.maxAttacks;
  return cards.map(c => {
    const riders = ridersForCard(entity, c);
    let card = riders.length ? { ...c, riders } : c;
    if (attacksLeft && !card.available && card.isWeaponAttack && card.activation.actionType === 'action'
      && isFeatureAvailable({ activation: card.activation }, entity, false, true).available) {
      card = { ...card, available: true, unavailableReason: null };
    }
    return card;
  });
}
