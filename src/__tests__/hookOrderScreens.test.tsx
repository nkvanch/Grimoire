// Regression: two creation screens called a hook after an early return, so a render that took the early return ran
// fewer hooks than the one before and React threw ("Rendered fewer hooks than expected"). Each screen is rendered,
// then the state that decides the early return flips while it stays mounted.
const mockReplace = jest.fn();
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import SpellcastingAbilityScreen from '../../app/creation/spellcasting-ability';
import { useCharacterStore, makeEmptyEntity } from '../store/characterStore';

describe('creation screens keep the same hook order on every render', () => {
  afterEach(() => { useCharacterStore.setState({ draft: null }); mockReplace.mockClear(); });

  it('Spellcasting Ability: the draft disappearing while the screen is open does not throw', async () => {
    const draft = makeEmptyEntity('d1', 'character');
    useCharacterStore.setState({
      draft: {
        ...draft,
        choices: [{
          id: 'sa', grantedAt: 1, resolved: false, selections: [],
          definition: { id: 'sa', prompt: 'Choose your spellcasting ability', kind: 'spellcasting_ability', count: 1, pool: [{ id: 'int', label: 'Intelligence' }] as never, grants: [], required: true, resolved: false },
        }],
      },
    });
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => { r = TestRenderer.create(<SpellcastingAbilityScreen />); });
    await act(async () => { useCharacterStore.setState({ draft: null }); });
    expect(mockReplace).toHaveBeenCalledWith('/creation/name');
    await act(async () => { r.unmount(); });
  });
});
