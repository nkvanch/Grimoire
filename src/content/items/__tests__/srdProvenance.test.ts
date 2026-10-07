import { FULL_ITEM_LIBRARY } from '../index';
import { hasVerifiedPublicItemProvenance, itemProvenance } from '../srdProvenance';
import { GENERATED_SRD_ITEMS } from '../generatedSrdItems';

describe('SRD item provenance public gate', () => {

  it('exposes only generated canonical records while preserving the full catalog', () => {
    expect(hasVerifiedPublicItemProvenance('longsword')).toBe(true);
    expect(hasVerifiedPublicItemProvenance('amulet_of_health')).toBe(false);
    expect(FULL_ITEM_LIBRARY.some(item => item.id === 'longsword')).toBe(true);
  });

  it('exposes exactly generated verified items from the real public-build module', () => {
    const previous = process.env.EXPO_PUBLIC_SRD_ONLY;
    process.env.EXPO_PUBLIC_SRD_ONLY = 'true';
    try {
      jest.isolateModules(() => {
        const { ALL_ITEMS } = require('../index') as typeof import('../index');
        expect(ALL_ITEMS).toEqual(GENERATED_SRD_ITEMS);
      });
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_SRD_ONLY;
      else process.env.EXPO_PUBLIC_SRD_ONLY = previous;
    }
  });
});
