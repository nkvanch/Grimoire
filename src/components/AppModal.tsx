// src/components/AppModal.tsx
// React Native's Modal, kept clear of the Android navigation bar.
import { useContext } from 'react';
import { Modal as RNModal, ModalProps, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Colors } from '../theme';

/**
 * The app is edge-to-edge (android/gradle.properties edgeToEdgeEnabled), and then Android draws every Modal under the system bars
 * whatever its props say (ReactModalHostView navigationBarTranslucent). So the bottom of every pop-up sat under the navigation bar.
 * This keeps the content above it, with a strip the colour of a backdrop (or of the screen) under the bar, and tells the content
 * its bottom inset is 0 so a pop-up that already pads for the bar (SafeBottomView, insets.bottom) is not padded twice.
 * The top is left as the screens have it: content runs under the status bar and headers carry their own clearance.
 * Every file imports Modal from here, never from react-native (src/__tests__/modalSafeArea.test.ts).
 */
export function Modal({ children, ...props }: ModalProps) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, right: 0, bottom: 0, left: 0 };   // none outside a provider (tests)
  return (
    <RNModal {...props}>
      <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: 0 }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      <View style={{ height: insets.bottom, backgroundColor: props.transparent ? '#000000cc' : Colors.bg }} />
    </RNModal>
  );
}
