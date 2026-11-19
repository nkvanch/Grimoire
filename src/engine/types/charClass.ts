import type { Ability, MulticlassPrerequisites, RulesetId, ContentOrigin } from './primitives';
import type { ClassProgression, ProficiencyGrant } from './leveling';
import type { DraftTrait } from './draftTrait';
import type { Feature } from './feature';
import type { ChoiceDefinition } from './choices';
import type { SpellPreparationPolicy } from './entityRuntime';

/**
 * One switchable set of options ("modes") for a class. The app never rolls for the player: a
 * `selector.table` maps the result of the player's OWN physical die to an option, and there is no
 * calendar, so a "period" (an in-game month) ends only when the player presses the change button.
 */
export type ModeGroup = {
  id:          string;
  /** Name of the feature that owns it, e.g. a mode-group feature. */
  name:        string;
  /** What one option is called to the player, e.g. 'Bound Spirit'. */
  optionLabel: string;
  /** What one period is called, e.g. 'month'. */
  periodLabel: string;
  classId:     string;
  /** HomebrewSubclass ids of this class that are the options of the group. */
  optionIds:   string[];
  selector: {
    die:   number;
    table: { value: number; optionId: string }[];
    /** Dice rolled per period by class level; the player picks which result answers. Default 1. */
    diceAtLevel?: { level: number; dice: number }[];
    /** Resource spent to throw a roll away and roll again (a mode-group reroll resource), usable from this class level. */
    rerollResourceId?: string;
    rerollFromLevel?: number;
    /** From this class level the player simply chooses any option (a high-level mode-group feature). */
    freeChoiceFromLevel?: number;
  };
  /** Resources made available again whenever a new period starts (a once-per-month reroll). */
  restoreOnSwitch?: string[];
};

/**
 * Per-character state for one Mode Group. `stash` holds the current value of the resources an
 * option granted at the moment the character left it, keyed by option id, so returning to the
 * option later finds them spent or unspent exactly as they were — "mode-owned persistent state".
 */
export type ModeState = {
  stash:    Record<string, Record<string, number>>;
  /** How many times the group has changed option since it was first set; informational. */
  changes:  number;
};

export type CharClass  = {
  id:          string;
  name:        string;
  hitDie:      number;
  features:    Feature[];     // level-1 features (backward-compat; Phase 2 uses levelFeatures)
  description?: string;

  // ── Phase 2: authored progression data (all optional) ─────────────────────────
  // When present, buildProgressionFromClass uses these instead of stub defaults.
  savingThrows?:          Ability[];     // e.g. ['str', 'con']
  armorProfs?:            string[];      // 'light' | 'medium' | 'heavy' | 'shield'
  weaponProfs?:           string[];      // 'simple' | 'martial'
  /** e.g. ["Thieves' Tools", "Herbalism Kit"] — free text, granted at level 1. */
  toolProfs?:             string[];
  startingEquipment?:     string[];
  /**
   * Free-text notes for gear that doesn't correspond to a real catalog item
   * (e.g. "a set of masterwork lockpicks" or setting-specific gear). Purely
   * descriptive — unlike startingEquipment, this is never turned into an
   * inventory grant, since there's no real Item for the engine to reference.
   */
  equipmentNotes?:        string;
  spellcastingAbility?:   Ability;       // 'int' | 'wis' | 'cha' — kept for backward compat; single-ability classes still just set this
  /**
   * Rare case: a class whose casting ability isn't fixed (the player picks
   * one at creation, e.g. "cast with INT or WIS, your choice"). When this has
   * 2+ entries, buildProgressionFromClass queues a 'spellcasting_ability'
   * choice instead of a fixed init_spellcasting grant — spellcastingAbility
   * above is ignored in that case. A single entry here behaves identically to
   * just setting spellcastingAbility.
   */
  spellcastingAbilityOptions?: Ability[];
  spellcastingStyle?:     'full' | 'half' | 'pact'; // slot table to use
  spellPreparationPolicy?: SpellPreparationPolicy;
  /** How many spells a preparing class may prepare at each class level 1..20 (the 2024 tables' Prepared Spells column). Absent:
   *  the 2014 rule, the casting ability modifier plus the class level (half of it for a half caster), at least 1. */
  preparedSpellsByLevel?: number[];
  ritualCastingPolicy?: 'none' | 'known' | 'prepared' | 'spellbook';
  spellcastingStartLevel?: number;       // first level that gets spell slots (default 1)
  asiLevels?:             number[];      // defaults to [4,8,12,16,19]
  hpAbility?:             Ability;
  // Per-level features authored by the player (replaces cls.features for level 1+).
  // DraftTrait (see the "5b" section below) so these carry a real mechanical
  // effect kind, same as race traits — not just flavor text. Classes saved
  // before this existed only have {level, name, description}; readers must
  // treat the rest of DraftTrait's fields (effectKind included) as optional
  // at runtime even though the type says otherwise — see progressions.ts's
  // buildProgressionFromClass, which defaults a missing effectKind to 'none'.
  levelFeatures?:         (DraftTrait & { level: number })[];
  /**
   * CHOICE-AUTHORING-1: real player choices (Expertise/Tool/Language today)
   * authored per-level, alongside levelFeatures above — e.g. "at level 3,
   * choose one tool proficiency." Merged into that level's own
   * LevelEntry.choices by buildProgressionFromClass (progressions.ts),
   * alongside the ASI/spellcasting-ability choices it already synthesizes.
   * Each ChoiceDefinition's id should already be namespaced (the builder
   * does this) so it can't collide with those synthesized ones.
   */
  levelChoices?:          { level: number; choices: ChoiceDefinition[] }[];
  /**
   * Escape hatch for hand-authored classes too complex for the simplified
   * builder fields (subclass features, known-spell grants, custom slot tables,
   * per-level effect-bearing features). When present, getProgressionForClass
   * uses this verbatim and ignores all the simplified fields above. The class
   * builder cannot create this — it's only set by seeded built-in homebrew or
   * the import pipeline — and editing such a class in the builder will drop it.
   */
  rawProgression?:        ClassProgression;
  /**
   * Mode Groups: sets of mutually exclusive, switchable options this class's character holds one
   * of at a time (a monthly swapped option). Each option is a HomebrewSubclass of this
   * class, so switching reuses the subclass apply/strip machinery and the option's level-gated
   * progression (see engine/modes.ts). Built-in/imported content only; the builders do not author this.
   */
  modeGroups?:            ModeGroup[];
  /**
   * Where this class's spell choices come from by default: an existing homebrew Spell List, or the
   * spell list of another (official or homebrew) class. Unset = spells tagged for this class's own
   * id, as before. The picker's "Spell Source" filter can still switch to any other list.
   */
  spellListSource?:       { kind: 'class'; classId: string } | { kind: 'list'; listId: string };
  /**
   * PHB "Multiclassing Proficiencies" table entry for this class when taken
   * as a SECOND-OR-LATER class (not your starting class) — applied instead
   * of the class's normal level-1 proficiency grant by levelUpClass(). A
   * class with no reduced multiclass table entry (Wizard, Sorcerer) grants
   * nothing when multiclassed into and should leave this undefined; the
   * class-builder does not currently expose authoring this field, so
   * homebrew classes always fall back to granting nothing on multiclass —
   * a conservative, disclosed default rather than a guess.
   */
  multiclassProficiencies?: ProficiencyGrant;
  /** The abilities this class asks for as one of several classes, read before the SRD table (engine/multiclassPrerequisites.ts). */
  multiclassPrerequisites?: MulticlassPrerequisites;
  /**
   * SRD 5.1 (CC-BY-4.0) legal status. All 12 core PHB classes are SRD-safe
   * (SRD 5.1 includes the full class chassis, not just a stripped subset).
   * Same semantics as Spell.srd — undefined = not yet audited = unsafe for
   * public builds. Mirrors ClassProgression.srd (the mechanical-progression
   * half of a class); this field is the display-metadata half's own tag,
   * since CharClass and ClassProgression are two separate objects for the
   * same class (see ClassProgression's own doc comment).
   */
  srd?: boolean;
  /** Which ruleset this class belongs to. Undefined = available under every ruleset. See the ContentHeader comment in primitives.ts. */
  rulesetId?: RulesetId;
  /** Where this homebrew came from (a book, a creator, a post). Optional; set by the builders and kept with the content. */
  origin?: ContentOrigin;
};
