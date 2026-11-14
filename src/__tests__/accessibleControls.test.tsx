// Every Pressable and TextInput comes from components/AccessibleControls: a pressable control is announced as a button and a text
// box is named by its placeholder, unless the call site says otherwise. Scans app/ and src/ so a new file can't skip it.
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput as RNTextInput, Text } from 'react-native';
import { Pressable, TextInput } from '../components/AccessibleControls';

const ROOT = path.resolve(__dirname, '..', '..');
const OWN = path.join(ROOT, 'src', 'components', 'AccessibleControls.tsx');

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

it('no file but AccessibleControls takes Pressable or TextInput from react-native', () => {
  const bad = [...tsxFiles(path.join(ROOT, 'app')), ...tsxFiles(path.join(ROOT, 'src'))]
    .filter(f => f !== OWN)
    .filter(f => /import\s*\{[^}]*\b(Pressable|TextInput)\b[^}]*\}\s*from\s*['"]react-native['"]/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(ROOT, f));
  expect(bad).toEqual([]);
});

const render = (el: React.ReactElement) => { let r!: TestRenderer.ReactTestRenderer; act(() => { r = TestRenderer.create(el); }); return r.root; };
const roleOf = (el: React.ReactElement) => (render(el).findByType(Pressable).children[0] as TestRenderer.ReactTestInstance).props.accessibilityRole;
const labelOf = (el: React.ReactElement) => render(el).findByType(RNTextInput).props.accessibilityLabel;

it('a pressable control is a button; a hidden one and one with its own role are left as they are', () => {
  expect(roleOf(<Pressable onPress={() => {}}><Text>New Race</Text></Pressable>)).toBe('button');
  expect(roleOf(<Pressable onPress={() => {}} accessible={false} />)).toBeUndefined();
  expect(roleOf(<Pressable onPress={() => {}} accessibilityRole="radio" />)).toBe('radio');
  expect(roleOf(<Pressable />)).toBeUndefined();
});

it('a text box is named by its placeholder unless it has a label', () => {
  expect(labelOf(<TextInput placeholder="Search items" />)).toBe('Search items');
  expect(labelOf(<TextInput placeholder="x" accessibilityLabel="Item search" />)).toBe('Item search');
});
