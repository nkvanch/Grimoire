// Every ScrollView, FlatList and SectionList comes from components/Lists, which lets a tap through while the keyboard is open
// (found 2026-11-18 on an Android 15 emulator: after a search the first tap on a result only closed the keyboard).
// Scans app/ and src/ so a new file can't skip it; scripts/lists-imports.js rewrites an import that does.
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScrollView as RNScrollView, FlatList as RNFlatList, Text } from 'react-native';
import { ScrollView, FlatList } from '../components/Lists';

const ROOT = path.resolve(__dirname, '..', '..');
const OWN = path.join(ROOT, 'src', 'components', 'Lists.tsx');

function files(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, acc);
    else if (/\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}

it('no file but Lists takes ScrollView, FlatList or SectionList from react-native', () => {
  const bad = [...files(path.join(ROOT, 'app')), ...files(path.join(ROOT, 'src'))]
    .filter(f => f !== OWN)
    .filter(f => /import\s*\{[^}]*\b(ScrollView|FlatList|SectionList)\b[^}]*\}\s*from\s*['"]react-native['"]/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(ROOT, f));
  expect(bad).toEqual([]);
});

it('a list lets taps through while the keyboard is open, unless the call site says otherwise, and its ref still reaches it', () => {
  let r!: TestRenderer.ReactTestRenderer;
  const ref = React.createRef<RNScrollView>();
  act(() => { r = TestRenderer.create(<ScrollView ref={ref}><Text>x</Text></ScrollView>); });
  expect(r.root.findByType(RNScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  expect(typeof ref.current?.scrollTo).toBe('function');
  act(() => { r.update(<FlatList data={[1]} renderItem={() => <Text>y</Text>} keyboardShouldPersistTaps="never" />); });
  expect(r.root.findByType(RNFlatList).props.keyboardShouldPersistTaps).toBe('never');
  act(() => r.unmount());
});
