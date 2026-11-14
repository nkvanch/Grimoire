// src/hooks/useLeaveGuard.ts
// A builder screen asks before it is left with unsaved edits (src/hooks/useDiscardGuard.ts holds the question and useEdited).
import { useRef } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { askDiscard } from './useDiscardGuard';

/**
 * A screen that asks before it is left with edits (the Back button, Android back, a swipe, the header). Returns `leave`, to call
 * before navigating away after a save, so the save's own navigation is not asked about.
 */
export function useLeaveGuard(edited: boolean): () => void {
  const navigation = useNavigation();
  const allowed = useRef(false);
  usePreventRemove(edited, ({ data }) => {
    if (allowed.current) navigation.dispatch(data.action);
    else askDiscard(() => navigation.dispatch(data.action));
  });
  return () => { allowed.current = true; };
}
