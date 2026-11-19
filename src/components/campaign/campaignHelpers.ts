import { Platform } from 'react-native';
import { Alert } from '../../utils/alert';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Shows an error message reliably on every platform. Alert.alert's simple
 * (title, message) form is unreliable on web depending on the React Native
 * Web version — it can render nothing at all, which looks exactly like the
 * triggering button silently did nothing. window.alert always works on web.
 */
export function showError(title: string, message: string) {
  if (Platform.OS === 'web') {
     
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
