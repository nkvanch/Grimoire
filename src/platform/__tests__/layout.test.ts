// The width rules that decide between the phone layout and the wide layout.
import { WIDE_MIN, SIDEBAR_WIDTH, layoutKindFor, columnsFor, contentWidth } from '../layout';

describe('layoutKindFor', () => {
  it('keeps every phone width, in either orientation, on the phone layout', () => {
    for (const w of [320, 360, 390, 412, 430, 600, 720, 844, 915, 999]) expect(layoutKindFor(w)).toBe('compact');
  });
  it('gives windows from WIDE_MIN up the wide layout', () => {
    for (const w of [WIDE_MIN, 1024, 1280, 1920, 2560]) expect(layoutKindFor(w)).toBe('wide');
  });
  it('WIDE_MIN is above the widest phone in landscape', () => {
    expect(WIDE_MIN).toBeGreaterThan(932);   // an iPhone Pro Max held sideways
  });
});

describe('columnsFor', () => {
  it('fits as many columns as the width allows, between 1 and the cap', () => {
    expect(columnsFor(400, 420)).toBe(1);
    expect(columnsFor(900, 420)).toBe(2);
    expect(columnsFor(1300, 420)).toBe(3);
    expect(columnsFor(3000, 420)).toBe(4);
    expect(columnsFor(3000, 420, 12, 2)).toBe(2);
  });
  it('is one column for nonsense input', () => {
    expect(columnsFor(0, 420)).toBe(1);
    expect(columnsFor(-5, 420)).toBe(1);
    expect(columnsFor(900, 0)).toBe(1);
    expect(columnsFor(NaN, 420)).toBe(1);
  });
});

describe('contentWidth', () => {
  it('is the whole window on the phone layout and the window minus the side bar otherwise', () => {
    expect(contentWidth(390)).toBe(390);
    expect(contentWidth(1280)).toBe(1280 - SIDEBAR_WIDTH);
  });
});
