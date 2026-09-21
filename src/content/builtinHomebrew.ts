// ============================================================================
// FILE: src/content/builtinHomebrew.ts
// The SRD edition ships no built-in homebrew: every class, race and subclass
// the app offers is SRD 5.1 content. The structure is kept so the homebrew
// store's seeding path stays identical to the full app.
// ============================================================================
import { CharClass, Race } from '../engine/types';

/** All built-in homebrew, grouped by content type for seeding. */
export const BUILTIN_HOMEBREW = {
  classes: [] as CharClass[],
  races:   [] as Race[],
};

/** Stable list of [type, item] pairs for the seeding loop. */
export const BUILTIN_HOMEBREW_SEED: Array<
  | { type: 'class'; item: CharClass }
  | { type: 'race';  item: Race }
> = [
  ...BUILTIN_HOMEBREW.classes.map(item => ({ type: 'class' as const, item })),
  ...BUILTIN_HOMEBREW.races.map(item => ({ type: 'race' as const, item })),
];
