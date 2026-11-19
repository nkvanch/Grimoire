// src/components/AppModal.tsx
// React Native's Modal, kept clear of the Android navigation bar and the on-screen keyboard.
import { useContext, useEffect, useState } from 'react';
import { Keyboard, Modal as RNModal, ModalProps, Platform, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Colors } from '../theme';

/** Android: the height of the on-screen keyboard while it is open, else 0. Edge-to-edge windows are not resized for it. */
function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', e => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

/**
 * The app is edge-to-edge (android/gradle.properties edgeToEdgeEnabled), and then Android draws every Modal under the system bars
 * whatever its props say (ReactModalHostView navigationBarTranslucent). So the bottom of every pop-up sat under the navigation bar.
 * This keeps the content above it, with a strip the colour of a backdrop (or of the screen) under the bar, and tells the content
 * its bottom inset is 0 so a pop-up that already pads for the bar (SafeBottomView, insets.bottom) is not padded twice.
 * The same strip grows to the keyboard's height while it is open (found 2026-11-18 on an Android 15 emulator: a short bottom
 * sheet, Add Item with no results, sat wholly behind the keyboard; the window is no longer resized for it).
 * The top is left as the screens have it: content runs under the status bar and headers carry their own clearance.
 * Every file imports Modal from here, never from react-native (src/__tests__/modalSafeArea.test.ts).
 */
export function Modal({ children, ...props }: ModalProps) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, right: 0, bottom: 0, left: 0 };   // none outside a provider (tests)
  const keyboard = useAndroidKeyboardHeight();
  return (
    <RNModal {...props}>
      <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: 0 }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      <View style={{ height: Math.max(insets.bottom, keyboard), backgroundColor: props.transparent ? '#000000cc' : Colors.bg }} />
    </RNModal>
  );
}
