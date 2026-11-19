// A pop-up stays above the on-screen keyboard on Android (found 2026-11-18 on an Android 15 emulator: a short bottom sheet sat
// wholly behind the keyboard, since an edge-to-edge window is not resized for it). The strip under every Modal grows to the
// keyboard's height while it is open.
import React from 'react';
import { Keyboard, Platform, Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Modal } from '../AppModal';

const stripHeight = (r: TestRenderer.ReactTestRenderer) => {
  const strips = r.root.findAllByType(View).filter(v => typeof (v.props.style as { height?: number } | undefined)?.height === 'number');
  return (strips[strips.length - 1].props.style as { height: number }).height;
};

it('on Android the strip under a Modal is as tall as the open keyboard, and goes back when it closes', () => {
  const listeners: Record<string, (e: unknown) => void> = {};
  const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: (e: unknown) => void) => {
    listeners[name] = fn;
    return { remove: () => undefined };
  }) as never);
  const os = Platform.OS;
  Platform.OS = 'android';
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<Modal visible><Text>sheet</Text></Modal>); });
  expect(stripHeight(r)).toBe(0);
  act(() => listeners.keyboardDidShow({ endCoordinates: { height: 885 } }));
  expect(stripHeight(r)).toBe(885);
  act(() => listeners.keyboardDidHide({}));
  expect(stripHeight(r)).toBe(0);
  act(() => r.unmount());
  Platform.OS = os;
  spy.mockRestore();
});
