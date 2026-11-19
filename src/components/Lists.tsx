// src/components/Lists.tsx
// React Native's scrolling lists, taking a tap while the keyboard is open. Every file imports ScrollView, FlatList and SectionList
// from here, never from react-native (src/__tests__/lists.test.tsx).
import type { ComponentProps } from 'react';
import { FlatList as RNFlatList, ScrollView as RNScrollView, SectionList as RNSectionList } from 'react-native';

/*
 * React Native's default (keyboardShouldPersistTaps "never") spends the first tap on a list closing the keyboard, so after typing
 * in a search box the first tap on a result did nothing (found 2026-11-18 on an Android 15 emulator: Add Item, the creation race
 * and class lists). "handled" lets a tap on a button or row through, and a tap on empty space still closes the keyboard.
 * A call site can still pass its own value. React 19 passes `ref` as a prop, so scrollTo and scrollToIndex keep working; the casts
 * keep each list's own (generic) props.
 */
export const ScrollView = ((props: ComponentProps<typeof RNScrollView>) =>
  <RNScrollView keyboardShouldPersistTaps="handled" {...props} />) as unknown as typeof RNScrollView;

export const FlatList = ((props: ComponentProps<typeof RNFlatList>) =>
  <RNFlatList keyboardShouldPersistTaps="handled" {...props} />) as unknown as typeof RNFlatList;

export const SectionList = ((props: ComponentProps<typeof RNSectionList>) =>
  <RNSectionList keyboardShouldPersistTaps="handled" {...props} />) as unknown as typeof RNSectionList;

// the same names as types, for a ref (useRef<ScrollView>(null))
export type ScrollView = RNScrollView;
export type FlatList<T = unknown> = RNFlatList<T>;
export type SectionList<T = unknown, S = unknown> = RNSectionList<T, S>;
