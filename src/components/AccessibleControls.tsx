// src/components/AccessibleControls.tsx
// React Native's Pressable and TextInput as screen readers need them. Every file imports these two from here, never from
// react-native (src/__tests__/accessibleControls.test.ts).
import type { ComponentProps } from 'react';
import { Pressable as RNPressable, TextInput as RNTextInput } from 'react-native';

/**
 * A Pressable with an onPress is a button unless it says otherwise: without a role TalkBack and a web screen reader announce
 * only its text, not that it can be pressed (the Homebrew Create buttons, creation's Next buttons). A Pressable hidden from
 * screen readers (accessible={false}, a backdrop) gets no role.
 */
export function Pressable(props: ComponentProps<typeof RNPressable>) {
  const role = props.onPress && props.accessible !== false ? 'button' : undefined;
  return <RNPressable accessibilityRole={role} {...props} />;
}

/** A TextInput is named by its placeholder unless it has its own label: unlabelled, a screen reader says only "edit box". */
export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput accessibilityLabel={props.placeholder} {...props} />;
}
