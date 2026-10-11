// src/content/classes/__tests__/classBrowse.test.ts
import { classDisplayName } from '../classBrowse';
import { ALL_CHAR_CLASSES } from '../index';
import type { CharClass } from '../../../engine/types';

describe('classDisplayName', () => {
  // Real, confirmed bug: AddSpellModal.tsx's class-filter chips used to run
  // a naive cap() helper (capitalize only the first character of the raw id
  // string) over a spell's `classes: string[]` ids — turning a multi-word
  // snake_case class id like 'example_class' into 'Example_class' instead of
  // the class's real display name 'Example Class'. classDisplayName looks up
  // the real name from the class registry instead of guessing from the id.
  const exampleClass: CharClass = {
    id: 'example_class', name: 'Example Class', hitDie: 10, features: [],
  } as CharClass;

  it('resolves a class id to its real display name, not a naive capitalization of the id', () => {
    expect(classDisplayName('example_class', [exampleClass])).toBe('Example Class');
    expect(classDisplayName('example_class', [exampleClass])).not.toBe('Example_class');
  });

  it('falls back to the raw id when the class truly cannot be found', () => {
    expect(classDisplayName('nonexistent_class', ALL_CHAR_CLASSES as CharClass[])).toBe('nonexistent_class');
  });

  it('resolves every official class id to its real display name', () => {
    for (const cls of ALL_CHAR_CLASSES) {
      expect(classDisplayName(cls.id, ALL_CHAR_CLASSES)).toBe(cls.name);
    }
  });
});
