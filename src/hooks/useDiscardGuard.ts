// src/hooks/useDiscardGuard.ts
// Nothing the person typed is thrown away without asking: every editing pop-up goes through here, every builder screen through
// useLeaveGuard (its own file, so a pop-up never pulls in the router).
import { useEffect, useRef } from 'react';
import { Alert } from '../utils/alert';

/** The one question, worded as creation's "Cancel character creation?" is. */
export function askDiscard(onDiscard: () => void): void {
  Alert.alert('Discard your changes?', 'What you changed here is not saved.', [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: onDiscard },
  ]);
}

/** A close that asks first when something was edited. */
export function closeAsking(edited: boolean, close: () => void): () => void {
  return () => (edited ? askDiscard(close) : close());
}

/** How long after opening (or `resetKey` changing) the form is taken as it started: the screen fills itself in effects first. */
export const SETTLE_MS = 300;

/**
 * Whether the form differs from how it started. `snapshot` is what saving now would store (a builder's buildX(), a pop-up's edits);
 * the start is taken once the screen has filled itself in from a saved record, so loading one is not an edit. `resetKey` restarts
 * it (the record being edited, or a pop-up opening). A snapshot that throws counts as unchanged.
 */
export function useEdited(snapshot: () => unknown, resetKey: unknown = null): boolean {
  let now: string;
  try { now = JSON.stringify(snapshot()) ?? ''; } catch { now = ''; }
  const latest = useRef(now);
  latest.current = now;
  const start = useRef<string | null>(null);
  const keyAt = useRef(resetKey);
  if (keyAt.current !== resetKey) { keyAt.current = resetKey; start.current = null; }   // the render that reopens is not edited
  useEffect(() => {
    const t = setTimeout(() => { start.current = latest.current; }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [resetKey]);
  return start.current !== null && now !== start.current;
}
