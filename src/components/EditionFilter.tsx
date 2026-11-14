// src/components/EditionFilter.tsx
// The Game / Version filter on the character-creation pickers. It starts on the character's own rules, so a 2024 character sees 2024
// content and a 2014 one sees 2014 content; clearing it shows every edition. Remembered per draft while the app is open (a new draft
// starts on its own rules again). The rules themselves are in content/editionFilter.ts.
import { useCallback, useMemo, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { GameId, RulesetId } from '../engine/types';
import { useCharacterStore } from '../store/characterStore';
import { gameIdForRuleset, rulesetLabel, GAMES } from '../content/rulesets';
import { editionChoiceFor, editionOptions, matchesEdition, type EditionChoice } from '../content/editionFilter';
import { FilterChipRow, FilterSection } from './FilterChipRow';
import { Colors, FontSize } from '../theme';

type Tagged = { rulesetId?: RulesetId | null };

export function useEditionFilter(savedFilters: Record<string, unknown>) {
  const draft = useCharacterStore(s => s.draft);
  const start = (): EditionChoice => (savedFilters.editionFor === draft?.id
    ? { game: (savedFilters.gameFilter as GameId) ?? null, version: (savedFilters.rulesetFilter as RulesetId) ?? null }
    : editionChoiceFor(draft?.rulesetId));
  const [choice, setChoice] = useState<EditionChoice>(start);

  const setVersion = useCallback((version: RulesetId | null) => {
    setChoice(c => ({ version, game: version ? (gameIdForRuleset(version) ?? c.game) : c.game }));
  }, []);
  const setGame = useCallback((game: GameId | null) => {
    setChoice(c => ({ game, version: c.version && game && gameIdForRuleset(c.version) === game ? c.version : null }));
  }, []);
  const clear = useCallback(() => setChoice({ game: null, version: null }), []);
  const matches = useCallback((item: Tagged, official: boolean) => matchesEdition(item, official, choice), [choice]);

  const chips = useMemo(() => [
    ...(choice.version ? [{ key: 'version', label: rulesetLabel(choice.version) ?? String(choice.version), onClear: () => setVersion(null) }]
      : choice.game ? [{ key: 'game', label: Object.values(GAMES).find(g => g.id === choice.game)?.name ?? String(choice.game), onClear: () => setGame(null) }] : []),
  ], [choice, setVersion, setGame]);

  return {
    choice, setVersion, setGame, clear, matches, chips,
    /** Spread into the screen's saved filters. */
    toSave: { gameFilter: choice.game, rulesetFilter: choice.version, editionFor: draft?.id ?? null },
  };
}
export type EditionFilter = ReturnType<typeof useEditionFilter>;

/** The Game and Version rows of a picker's filter panel. */
export function EditionFilterSections({ edition, official, homebrew = [] }: { edition: EditionFilter; official: readonly Tagged[]; homebrew?: readonly Tagged[] }) {
  const { games, versions } = useMemo(() => editionOptions(official, homebrew, edition.choice.game), [official, homebrew, edition.choice.game]);
  return (
    <>
      <FilterSection label="Game">
        {games.length > 1
          ? <FilterChipRow options={games} value={edition.choice.game} onChange={edition.setGame} />
          : <Text style={styles.only}>{games[0]?.label ?? 'No game tagged'}{games.length === 1 ? ' (the only game installed)' : ''}</Text>}
      </FilterSection>
      <FilterSection label="Version">
        {versions.length > 1
          ? <FilterChipRow options={versions} value={edition.choice.version} onChange={edition.setVersion} />
          : <Text style={styles.only}>{versions[0]?.label ?? 'All'}</Text>}
      </FilterSection>
    </>
  );
}

const styles = StyleSheet.create({
  only: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
