// ============================================================================
// FILE: src/platform/layout.ts
// One place that decides how the app lays itself out for the window it is in. A phone (and any window narrower than WIDE_MIN) keeps
// the single-column layout and bottom tabs unchanged; a wide window (the desktop app, a browser on a computer, a tablet held
// sideways) gets a side navigation bar, several columns for lists and a two-pane character sheet. Nothing here looks at the
// platform: only the width, so a phone can never be given the wide layout.
// ============================================================================
import { useWindowDimensions } from 'react-native';

/** Windows at least this wide (in layout pixels) get the wide layout. A phone, even sideways, is below it. */
export const WIDE_MIN = 1000;

/** Width of the side navigation bar in the wide layout. */
export const SIDEBAR_WIDTH = 220;

export type LayoutKind = 'compact' | 'wide';

export function layoutKindFor(width: number): LayoutKind {
  return width >= WIDE_MIN ? 'wide' : 'compact';
}

export function useLayout(): { width: number; height: number; kind: LayoutKind; isWide: boolean } {
  const { width, height } = useWindowDimensions();
  const kind = layoutKindFor(width);
  return { width, height, kind, isWide: kind === 'wide' };
}

/**
 * How many columns of cards fit in `available` pixels when each card wants at least `minCardWidth`.
 * Never fewer than 1 and never more than `max`.
 */
export function columnsFor(available: number, minCardWidth: number, gap = 12, max = 4): number {
  if (!(available > 0) || !(minCardWidth > 0)) return 1;
  const fit = Math.floor((available + gap) / (minCardWidth + gap));
  return Math.max(1, Math.min(max, fit));
}

/** Width of the content area beside the side navigation bar (or the whole window when compact). */
export function contentWidth(windowWidth: number): number {
  return layoutKindFor(windowWidth) === 'wide' ? windowWidth - SIDEBAR_WIDTH : windowWidth;
}

/**
 * Columns for a list of cards on the main (tab) screens: one on a phone, and as many as fit beside the side bar otherwise.
 * `minCardWidth` is the narrowest a card should get; `padding` is the screen's horizontal padding.
 */
export function useListColumns(minCardWidth = 420, padding = 32, max = 3): number {
  const { width } = useWindowDimensions();
  if (layoutKindFor(width) === 'compact') return 1;
  return columnsFor(contentWidth(width) - padding, minCardWidth, 12, max);
}
