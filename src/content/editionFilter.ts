// ============================================================================
// FILE: src/content/editionFilter.ts
// The Game / Version filter of the character-creation pickers (race, class, background, spells).
//
// Which edition a piece of content belongs to: its own ruleset tag when it has one; official content with no tag is the original 5e
// (2014) content (the 5.1 SRD pack tags nothing, the 5.2.1 pack tags everything 2024); homebrew with no tag belongs to every edition
// and is never filtered out. Same reading as EditionBadge's editionLabel.
// ============================================================================
import type { GameId, RulesetId } from '../engine/types';
import { GAMES, gameIdForRuleset, rulesetLabel } from './rulesets';

const BASELINE = 'dnd5e-2014' as RulesetId;
type Tagged = { rulesetId?: RulesetId | null };
export type EditionChoice = { game: GameId | null; version: RulesetId | null };
export type EditionOption<T extends string> = { id: T; label: string };

/** The edition `item` belongs to, or undefined when it belongs to every edition. */
export function editionOf(item: Tagged, official: boolean): RulesetId | undefined {
  if (item.rulesetId) return item.rulesetId;
  return official ? BASELINE : undefined;
}

/** Whether `item` passes the chosen game and version. Content of every edition always passes. */
export function matchesEdition(item: Tagged, official: boolean, choice: EditionChoice): boolean {
  const edition = editionOf(item, official);
  if (!edition) return true;
  if (choice.version) return edition === choice.version;
  if (choice.game) return gameIdForRuleset(edition) === choice.game;
  return true;
}

/** The games and versions present among `official` and `homebrew` content; versions narrowed to `game` when one is chosen. */
export function editionOptions(official: readonly Tagged[], homebrew: readonly Tagged[], game: GameId | null): {
  games: EditionOption<GameId>[]; versions: EditionOption<RulesetId>[];
} {
  const editions = new Set<RulesetId>();
  for (const item of official) { const e = editionOf(item, true); if (e) editions.add(e); }
  for (const item of homebrew) { const e = editionOf(item, false); if (e) editions.add(e); }
  const all = [...editions].sort();
  const gameIds = [...new Set(all.map(e => gameIdForRuleset(e)).filter((g): g is GameId => !!g))];
  return {
    games: gameIds.map(id => ({ id, label: Object.values(GAMES).find(g => g.id === id)?.name ?? String(id) })),
    versions: all.filter(e => !game || gameIdForRuleset(e) === game).map(id => ({ id, label: rulesetLabel(id) ?? String(id) })),
  };
}

/** Where a picker starts: the character's own rules (its game and version), or everything when it has none. */
export function editionChoiceFor(characterRuleset: RulesetId | undefined | null): EditionChoice {
  return characterRuleset ? { game: gameIdForRuleset(characterRuleset) ?? null, version: characterRuleset } : { game: null, version: null };
}
