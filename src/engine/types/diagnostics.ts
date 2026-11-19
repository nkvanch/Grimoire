// ── Diagnostics (A-54) ───────────────────────────────────────────────────────
// Structured, non-blocking validation findings for an Entity. The governing
// rule, per the app's existing "disclosed, not silently repaired" philosophy:
// a detected problem never blocks the character from opening — it's surfaced
// as an Issue for the player/DM to see and decide what to do about, same as
// every other disclosed-gap pattern already used throughout this codebase.

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'missing_race' | 'missing_subrace' | 'missing_class' | 'missing_subclass'
  | 'missing_background' | 'missing_spell' | 'missing_item'
  // LIVE-RULESET-1: validateEntity() doesn't check feat/condition
  // references at all today — added for src/engine/rulesetChange.ts's
  // preview, which is the first consumer that needs them (a character's
  // feat/condition picks can become unresolved after a ruleset switch the
  // same way a race/class/spell/item pick already could).
  | 'missing_feat' | 'missing_condition'
  // LIVE-RULESET-2: the engine-level guard in rulesetChange.ts refuses to
  // apply a switch to an unregistered ruleset id or across two known,
  // different Games — these two codes report why, distinct from
  // package_unsupported_ruleset (an IMPORT-time diagnostic for a different
  // flow entirely).
  | 'unsupported_ruleset' | 'cross_game_ruleset'
  | 'ruleset_mismatch' | 'orphaned_choice_selection'
  // A-62: pack-level diagnostics (see src/engine/packDiagnostics.ts).
  | 'pack_broken_reference' | 'pack_content_shadowed' | 'pack_ruleset_mixed'
  | 'pack_content_in_use'
  // HOMEBREW-PACKAGE-1: portable package export/import diagnostics (see
  // src/engine/contentDependencies.ts / src/io/packageIO.ts). Distinct from
  // the pack_* codes above, which are about an already-INSTALLED pack's
  // ongoing health — these fire during export (building a package) or
  // import (evaluating one before commit).
  | 'package_missing_dependency' | 'package_unresolved_reference'
  | 'package_unsupported_ruleset' | 'package_corrupt'
  | 'package_incompatible_version' | 'package_duplicate_id'
  // CHOICE-EXPANSION-1: Expertise/Tool/Language interactive choices.
  // unresolved_choice_kind fires for a pending ChoiceDefinition whose kind
  // has no picker UI (see TabFeatures.tsx's dispatch) — surfaces the gap as
  // a real Issue instead of only a silent "ask your DM" note in one screen.
  // invalid_expertise_target fires when a RESOLVED expertise choice's
  // selected skill is no longer trained (the one real path in this engine
  // where that can happen live — see swapBackground's skill-retrain
  // checklist) — expertise is never silently reassigned to another skill.
  // missing_tool_definition/missing_language_definition mirror
  // orphaned_choice_selection for the two content kinds that previously had
  // no registry to check selections against at all.
  | 'unresolved_choice_kind' | 'invalid_expertise_target'
  | 'missing_tool_definition' | 'missing_language_definition';

export type Issue = {
  severity: IssueSeverity;
  code:     IssueCode;
  message:  string;
  /** The content/selection id this issue is about, e.g. a race or spell id. */
  affectedId?: string;
  /** Where on the entity this was found, e.g. 'identity.raceId'. */
  source?: string;
  suggestedFix?: string;
};
