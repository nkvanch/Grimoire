import type { Ability, RulesetId, ContentOrigin } from './primitives';
import type { AbilityEffect } from './actionCard';
import type { Feature, Effect } from './feature';
import type { DurationTracker } from './conditions';
import type { AbilityScores, Sense } from './entityRuntime';

export type SlotEntry   = { total: number; used: number };
export type SpellSlots  = Record<'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9', SlotEntry>;

export type SpellcastingBlock = {
  ability:       Ability;
  slots:         SpellSlots;
  pactSlots?:    SpellSlots;
  cantrips:      string[];
  known:         string[];
  prepared:      string[];
  concentrating: string | null;
  /**
   * Rounds-remaining countdown for the spell currently being concentrated
   * on, parsed from that spell's Spell.duration at cast time by
   * parseConcentrationDuration() (combat.ts). undefined when not
   * concentrating, or when concentrating on a spell whose duration string
   * didn't match a known round/minute/hour pattern (fail-open —
   * concentration itself still works, it just has no ticking countdown or
   * "Xr" display). Ticked down by tickConcentrationDuration() (combat.ts),
   * called alongside tickDurations() from the same End Turn action.
   * Optional + additive: existing saved characters simply lack this field
   * until their next concentration cast.
   */
  concentratingDuration?: DurationTracker;
};

export type Spell = {
  id:                       string;
  name:                     string;
  /**
   * Widened from a strict `0|1|2|...|9` union to allow homebrew levels
   * beyond the standard range. KNOWN LIMITATION, disclosed not hidden: the
   * spell slot system (SpellSlots type) only has tiers 1-9 — a homebrew
   * spell authored at level 10+ has no slot tier to consume from, so it
   * displays correctly but can't be tracked as "slots remaining" the way
   * levels 1-9 are. Same reminder-only pattern used elsewhere in the app
   * for mechanics the engine doesn't fully model.
   */
  level:                    number;
  school:                   string;
  castingTime:              string;
  range:                    string;
  components:               string[];
  duration:                 string;
  description:              string;
  upcast:                   string | null;
  ritual:                   boolean;
  concentration:            boolean;
  /**
   * A cantrip's growth with the CHARACTER level: from each tier's level the card shows that dice expression (or beam count) in place
   * of the base. Absent means the spell prints its ladder in its text and engine/cantripScaling.ts derives the tiers from it.
   */
  cantripScaling?:          CantripScalingTier[];
  /** Class IDs that can cast this spell (lowercased, e.g. 'wizard'). Drives class-filtered spell lists. */
  classes?:                 string[];
  /**
   * Free-form categorization tags (e.g. 'damage', 'buff', 'debuff', 'healing',
   * 'control', 'utility', 'summoning') for filtering/browsing. Display and
   * search aid only — not mechanically enforced by the engine.
   */
  spellType?:               string[];
  /** Features applied to caster while concentrating — removed when concentration drops. */
  onConcentrationFeatures?: Feature[];
  srd?:                     boolean;
  /** Which ruleset this spell belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?:               RulesetId;
  /** The material component's description ("a bell and silver wire"), where the source text states it. */
  material?:                string;
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};

/**
 * A named, author-curated collection of spell ids — homebrew content in its
 * own right (create/export/import like any other builder type), distinct
 * from `Spell.classes` (which just tags which official classes a single
 * spell belongs to). A SpellList exists to give a class an ALTERNATE pool to
 * draw from — most commonly a homebrew class with no official spell list of
 * its own, or an optional/variant list for an existing class — without
 * having to retag every individual spell's `classes` field. `classId` is the
 * suggested/default class this list is for; it does not restrict who can
 * pick the list (see filterSpellsForClass in content/spellLists.ts), since
 * nothing stops a DM from offering the same curated list to more than one
 * class at their table.
 */
export type SpellList = {
  id:          string;
  name:        string;
  description?: string;
  classId?:    string;
  spellIds:    string[];
  srd?:        boolean;
  rulesetId?:  RulesetId;
};

export type Currency     = { pp: number; gp: number; ep: number; sp: number; cp: number };

/**
 * A beast (or other creature) an entity can temporarily transform into via
 * Wild Shape. Small, curated content type — v1 ships a handful of SRD-legal
 * low/mid-CR beasts, not a builder. See docs/ROADMAP_1.0.md "FEATURE DESIGN:
 * Wild Shape" for the full design and scope cut.
 */
/** One step of a cantrip's level ladder: `dice` replaces the base damage dice, `count` is how many beams or attacks (Eldritch Blast). */
export type CantripScalingTier = { level: number; dice?: string; count?: number };

export type BeastForm = {
  id:              string;
  name:            string;
  /** CR gate for player-facing pickers (e.g. "only CR ≤ 1/4 beasts at level 2"). */
  challengeRating: number;
  /** 'elemental' for the elemental forms some features grant, which are not offered by the beast picker. Absent means a beast. */
  creatureType?:   'beast' | 'elemental';
  size:            'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge';
  stats:           AbilityScores;       // the beast's own STR/DEX/CON/INT/WIS/CHA
  ac:              number;
  hp:              number;              // flat HP pool for the beast form
  speed:           number;              // walking speed in feet
  swimSpeed?:      number;
  flySpeed?:       number;
  climbSpeed?:     number;
  senses?:         Sense[];
  /** Simple attacks, shown as ActionCards while transformed — same as any other AbilityEffect-driven attack in the app. */
  attacks:         { name: string; effect: AbilityEffect; /** The stat block's printed to-hit bonus. Absent: the card uses the form's best of Strength and Dexterity plus the character's proficiency bonus. */ attackBonus?: number }[];
  /** Free-text trait summaries (e.g. "Keen Smell", "Pack Tactics") — display-only in v1, not mechanically enforced. */
  traits?:         string[];
  /**
   * Rules-engine blocker RE-AUDIT closure (Closure 3 — native BeastForm
   * defenses): plain damage-type strings (the SAME taxonomy
   * grant_resistance's own `target` field already uses everywhere else in
   * the app — 'fire', 'lightning', 'acid', ... — no second damage-type
   * taxonomy). Only unconditional, always-on resistances/immunities/
   * vulnerabilities belong here — a qualified one (e.g. 5e's "bludgeoning/
   * piercing/slashing from NONMAGICAL attacks") has no representation in
   * this engine (resolveResistance has no "was this attack magical" input)
   * and is deliberately left undeclared rather than represented incorrectly
   * as an unconditional resistance; see beastforms/index.ts's own per-form
   * comment for exactly what's included/excluded for each shipped form.
   * Read by pipeline.ts's collectAllEffects while `wildShapeState.active`
   * is true — never copied onto the base entity, so a plain revert
   * (wildShapeState -> null) makes these vanish with zero cleanup.
   */
  damageResistances?:    string[];
  damageImmunities?:     string[];
  damageVulnerabilities?: string[];
  /**
   * Rules-engine blocker RE-AUDIT closure (3B): the standard 5e elemental
   * innate resistance to bludgeoning/piercing/slashing damage from
   * NONMAGICAL attacks/weapons — a real, RAW-significant defense every
   * shipped elemental form has, but one this engine cannot infer on its
   * own (it has no concept of an attack being magical/nonmagical).
   * Deliberately NOT folded into `damageResistances` above: that list
   * means "always resisted, unconditionally," which this qualified
   * resistance is not. Investigated reusing Effect.situational/
   * Entity.situationalAnswers (the app's existing manual yes/no mechanism)
   * first, per this closure's own instruction — rejected because that
   * mechanism is PERSISTENT entity state meant for slow-changing facts
   * ("an ally within 5 feet"), and this fact can change every single hit;
   * forcing the DM to toggle persistent state before/after every attack
   * would be poor table-first UX. Instead consulted via a small, explicit,
   * PER-HIT parameter at the point damage is entered — see
   * applyWildShapeDamage's own `isNonmagicalAttack` parameter (combat.ts)
   * and the DM/player damage-entry UI's "Nonmagical attack" checkbox.
   * Bounded to exactly this one 5e distinction — not a general magical/
   * nonmagical attack-qualifier system.
   */
  nonmagicalPhysicalResistance?: boolean;
};

export type ItemInstance = {
  /**
   * Item-identity closure: stable identity for THIS OWNED COPY, distinct
   * from `itemId` (the shared ItemDefinition/content id two independently-
   * owned copies of the same magic item both point at). Two ItemInstances
   * may legally share `itemId` while having different `id` — that's exactly
   * what makes "two identical swords, one equipped+attuned, one not" a
   * legal, stable state instead of one shared mutable row. Generated once
   * at a mutation boundary (add/duplicate/import) — see
   * generateItemInstanceId (inventory.ts) — never inside recomputeDerived
   * or another pure derivation function.
   *
   * Optional so every pre-existing ItemInstance literal across the app
   * (test fixtures, and any character saved before this field existed)
   * stays valid — the SAME disclosed-migration-gap convention this type's
   * own requiresAttunement/wearsArmorOrShield fields already use.
   * characterStore.ts's load hydration backfills a stable id for any
   * instance missing one, exactly once, so nothing regenerates it on
   * every recompute. Code that needs to target ONE SPECIFIC owned
   * instance (equip/unequip/attune/remove/resource lookups) should match
   * on `id`, not `itemId` — matching on `itemId` can silently pick
   * whichever same-definition copy happens to be first in the array.
   */
  id?:      string;
  itemId:   string;
  quantity: number;
  /** Stable owner for creation-time additional items. */
  acquisitionSourceId?: string;
  attuned:  boolean;
  features: Feature[];
  /**
   * Id of the infusion (src/content/infusions/index.ts) currently occupying
   * this specific item instance, if any — null/undefined for an uninfused
   * item. The infusion's own Feature is additively appended to `features`
   * (never replacing the base item's own features, unlike equip hydration —
   * see app/sheet/[id].tsx's handleApplyInfusion), so removing it means
   * both stripping that Feature back out AND clearing this field.
   */
  infusedWith?: string | null;
  /**
   * Re-audit A17: hydrated ONCE at equip time (see equipItem, engine/
   * inventory.ts) from the item content definition's own
   * itemRequiresAttunement() check — the SAME pattern `features` above
   * already uses to get content-definition data onto a pure ItemInstance
   * without the engine pipeline needing a live content-store lookup.
   * undefined/false means "no attunement requirement" (every existing
   * saved instance, and anything equipped before this field existed,
   * parses as not-required until re-equipped — a disclosed migration
   * gap, not a silent behavior change for anything already correct).
   * Consumers (collectAllEffects, action-card generation) gate an
   * equipped item's effects/actions on `!requiresAttunement || attuned`.
   */
  requiresAttunement?: boolean;
  /**
   * Re-audit A19: hydrated ONCE at equip time (see equipItem, engine/
   * inventory.ts), from the same armorWeight()/isShield() classifiers the
   * Compendium/equipment-picker filters already use — true when this item
   * IS armor or a shield. Lets a effect on a DIFFERENT equipped item (e.g.
   * Bracers of Defense) check Effect.requiresNoArmorOrShield against the
   * rest of entity.inventory.equipped without a content-store lookup.
   * undefined/false for every non-armor/shield item, and for anything
   * equipped before this field existed (disclosed migration gap, same as
   * requiresAttunement's own — re-equip refreshes it).
   */
  wearsArmorOrShield?: boolean;
  /** Armor weight and shield-ness, hydrated with the other definition facts, so worn-gear conditions need no catalog lookup. */
  armorWeight?: 'light' | 'medium' | 'heavy';
  isShield?: boolean;
  statedAc?: Effect;
  /** The base armor its owner chose (a BASE_ARMOR_AC key, e.g. 'plate') for a magic armor whose rules leave the base open
   *  (Armor +1, Adamantine Armor, Armor of Resistance): its AC and weight follow it. See baseArmorChoices (itemMechanics.ts). */
  baseArmor?: string;
  /** The magic bonus its owner chose for a record that covers several ("Armor, +1, +2, or +3"); see bonusChoices. */
  magicBonus?: number;
};

export type InventoryBlock = {
  equipped: ItemInstance[];
  carried:  ItemInstance[];
  currency: Currency;
};
