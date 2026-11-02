import { plainText, unwrapMarkdownLinks, stripMarkdownEmphasis } from '../plainText';
import { characteristicsFor, OFFICIAL_BACKGROUND_CHARACTERISTICS } from '../backgrounds/characteristics';

describe('plainText', () => {
  it('keeps the words of a link and drops the address', () => {
    expect(unwrapMarkdownLinks('Casting _[knock](https://www.aidedd.org/dnd/sorts.php?vo=knock)_ on it')).toBe('Casting knock on it');
    expect(unwrapMarkdownLinks('a [warhorse](https://www.aidedd.org/dnd/monstres.php?vo=warhorse), a pony')).toBe('a warhorse, a pony');
  });

  it('removes emphasis markers but not underscores inside words or other text', () => {
    expect(stripMarkdownEmphasis('**_At Higher Levels_**. When you cast')).toBe('At Higher Levels. When you cast');
    expect(stripMarkdownEmphasis('such as a _glyph of warding_, or')).toBe('such as a glyph of warding, or');
    expect(stripMarkdownEmphasis('snake_case_id stays')).toBe('snake_case_id stays');
    expect(stripMarkdownEmphasis('2 + 2 * 3')).toBe('2 + 2 * 3');
  });

  it('passes null and undefined through', () => {
    expect(plainText(null)).toBeNull();
    expect(plainText(undefined)).toBeUndefined();
  });
});

describe('characteristicsFor', () => {
  it("prefers a background's own table, then the official one for its id, then none", () => {
    const own = { traits: ['Brave.'], ideals: [], bonds: [], flaws: [] };
    expect(characteristicsFor({ id: 'acolyte', characteristics: own })).toBe(own);
    expect(characteristicsFor({ id: 'acolyte' })).toBe(OFFICIAL_BACKGROUND_CHARACTERISTICS.acolyte);
    expect(characteristicsFor({ id: 'acolyte_2024' })).toBeUndefined();
    expect(characteristicsFor({ id: 'my_homebrew', characteristics: { traits: [], ideals: [], bonds: [], flaws: [] } })).toBeUndefined();
    expect(characteristicsFor(undefined)).toBeUndefined();
  });
});
