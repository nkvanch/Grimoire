jest.mock('expo-router', () => ({ useRouter: () => ({}), useLocalSearchParams: () => ({}) }));
import { characteristicsFromText } from '../../../app/homebrew/background-builder';

describe('background builder personality text', () => {
  it('turns one-per-line boxes into the four lists, trimming blank lines', () => {
    expect(characteristicsFromText('Brave.\n\n  Curious. ', 'Charity. (Good)', '', 'Proud.')).toEqual({
      traits: ['Brave.', 'Curious.'], ideals: ['Charity. (Good)'], bonds: [], flaws: ['Proud.'],
    });
  });

  it('is undefined when every box is empty, so a background without a table stores none', () => {
    expect(characteristicsFromText('', ' \n ', '', '')).toBeUndefined();
  });
});
