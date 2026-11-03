// ============================================================================
// FILE: src/components/live/LiveTurnBanner.tsx
// "Whose turn is it" strip on a character sheet, while this device takes part
// in a live session as the character on that sheet and the DM is running turns
// in an active encounter. Reads only the session view this device already has
// (src/session/runtime.ts), so it shows exactly what the player may see: a
// combatant hidden from players never appears here by name.
// ============================================================================
import { View, Text, StyleSheet } from 'react-native';
import { useSessionRuntime } from '../../session/runtime';
import type { LiveEncounter, ViewState } from '../../session/types';
import { Colors, Spacing, FontSize, FontWeight } from '../../theme';

export type LiveTurn = { round: number; mine: boolean; currentName: string };

/** The turn to announce on `characterId`'s sheet, or null when there is none. Pure, for tests. */
export function liveTurnFor(view: ViewState | null, participantId: string | null, characterId: string | undefined): LiveTurn | null {
  if (!view || !participantId || !characterId) return null;
  if (view.participants[participantId]?.characterId !== characterId) return null;
  const encounter: LiveEncounter | undefined = Object.values(view.encounters ?? {}).find(e => e.active && e.currentTurnIndex !== null);
  if (!encounter || encounter.currentTurnIndex === null) return null;
  const currentId = encounter.turnOrder[encounter.currentTurnIndex];
  if (!currentId) return null;
  const currentName = encounter.combatants.find(c => c.id === currentId)?.name
    ?? view.participants[currentId]?.nickname
    ?? 'Someone';
  return { round: encounter.round, mine: currentId === participantId, currentName };
}

export function LiveTurnBanner({ characterId }: { characterId: string | undefined }) {
  const view = useSessionRuntime(s => s.view);
  const participantId = useSessionRuntime(s => s.participantId);
  const turn = liveTurnFor(view, participantId, characterId);
  if (!turn) return null;
  return (
    <View style={[styles.banner, turn.mine && styles.mine]} accessibilityRole="text" testID="live-turn-banner">
      <Text style={styles.txt}>{turn.mine ? '⚔️ YOUR TURN' : `Round ${turn.round} — ${turn.currentName}'s turn`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 6, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceHigh,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  mine: { backgroundColor: Colors.gold + '33', borderBottomColor: Colors.gold },
  txt:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
