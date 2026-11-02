// The sheet's turn strip reads the live-session view this device already has, for the character it plays there.
jest.mock('../../../session/runtime', () => ({ useSessionRuntime: jest.fn() }));
import { liveTurnFor } from '../LiveTurnBanner';
import type { ViewState, LiveEncounter, PublicParticipant } from '../../../session/types';

function participant(id: string, nickname: string, characterId: string | null): PublicParticipant {
  return { id, nickname, capabilities: ['player'], connected: true, characterId };
}

function view(encounter: Partial<LiveEncounter>): ViewState {
  return {
    participants: { p1: participant('p1', 'Ann', 'char-ann'), p2: participant('p2', 'Bo', 'char-bo') },
    encounters: {
      e1: {
        id: 'e1', name: 'Bridge', active: true, round: 2, currentTurnIndex: 0,
        turnOrder: ['p1', 'gob1', 'p2'],
        combatants: [{ id: 'gob1', name: 'Goblin' } as LiveEncounter['combatants'][number]],
        ...encounter,
      },
    },
  } as unknown as ViewState;
}

describe('liveTurnFor', () => {
  it("says it is your turn on your own character's sheet", () => {
    expect(liveTurnFor(view({}), 'p1', 'char-ann')).toEqual({ round: 2, mine: true, currentName: 'Ann' });
  });

  it("names whoever acts, a monster or another player, on your sheet", () => {
    expect(liveTurnFor(view({ currentTurnIndex: 1 }), 'p1', 'char-ann')).toEqual({ round: 2, mine: false, currentName: 'Goblin' });
    expect(liveTurnFor(view({ currentTurnIndex: 2 }), 'p1', 'char-ann')?.currentName).toBe('Bo');
  });

  it('shows nothing on a sheet that is not the character you play in the session', () => {
    expect(liveTurnFor(view({}), 'p1', 'some-other-character')).toBeNull();
  });

  it('shows nothing before the DM starts turns, with no active encounter, or outside a session', () => {
    expect(liveTurnFor(view({ currentTurnIndex: null }), 'p1', 'char-ann')).toBeNull();
    expect(liveTurnFor(view({ active: false }), 'p1', 'char-ann')).toBeNull();
    expect(liveTurnFor(null, 'p1', 'char-ann')).toBeNull();
    expect(liveTurnFor(view({}), null, 'char-ann')).toBeNull();
  });
});
