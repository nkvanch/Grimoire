// The inventory row of a magic armor whose rules leave the base open offers the choice, limited to what the item allows.
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ItemRow } from '../ItemRow';
import type { Item, ItemInstance } from '../../../engine/types';

const adamantine = {
  id: 't_adam', name: 'Adamantine Armor', weight: 0, cost: '—', properties: ['magic item', 'armor'],
  features: [{ id: 'f', name: 'Adamantine Armor', description: 'Armor (Any Medium or Heavy, Except Hide Armor), Uncommon.', source: { kind: 'item', refId: 't_adam' },
    level: null, effects: [], actions: [], choices: [], passive: true }],
} as unknown as Item;
const inst = (baseArmor?: string): ItemInstance => ({ id: 'i1', itemId: 't_adam', quantity: 1, attuned: false, features: [], baseArmor } as ItemInstance);
const texts = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));
const press = (r: TestRenderer.ReactTestRenderer, label: RegExp) => {
  const hit = r.root.findAll(n => typeof n.props.onPress === 'function' && label.test(texts({ root: n } as never).join(' ')))[0];
  act(() => hit.props.onPress());
};

it('asks for a base when none is chosen, lists only the allowed bases, and passes the pick on', () => {
  const picked: string[] = [];
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<ItemRow instance={inst()} equipped allItems={[adamantine]} onToggle={() => {}} onRemove={() => {}} onSetItemChoices={c => picked.push(c.baseArmor!)} />); });
  expect(texts(r).some(t => /Choose base armor/.test(t))).toBe(true);
  press(r, /Choose base armor/);
  const options = texts(r).filter(t => / · AC /.test(t));
  expect(options[0]).toBe('Chain Shirt · AC 13 + Dex (max 2)');
  expect(options.some(t => /^Hide /.test(t) || /^Leather /.test(t))).toBe(false);
  press(r, /^Plate · AC 18$/);
  expect(picked).toEqual(['plate']);
});

it('shows the chosen base, and nothing for an item whose base is fixed or that has no handler', () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<ItemRow instance={inst('half plate')} equipped allItems={[adamantine]} onToggle={() => {}} onRemove={() => {}} onSetItemChoices={() => {}} />); });
  expect(texts(r).some(t => /Base armor: Half Plate/.test(t))).toBe(true);
  act(() => { r.update(<ItemRow instance={inst()} equipped allItems={[adamantine]} onToggle={() => {}} onRemove={() => {}} />); });
  expect(texts(r).some(t => /base armor/i.test(t))).toBe(false);
});

it('a record that covers +1, +2 and +3 offers the bonus, after the base when it needs one', () => {
  const plus = { ...adamantine, id: 't_plus', name: 'Armor, +1, +2, or +3' } as Item;
  const picked: unknown[] = [];
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(<ItemRow instance={{ ...inst('plate'), itemId: 't_plus' }} equipped allItems={[plus]} onToggle={() => {}} onRemove={() => {}} onSetItemChoices={c => picked.push(c)} />); });
  expect(texts(r).some(t => /Choose its bonus \(\+1 until chosen\)/.test(t))).toBe(true);
  press(r, /Choose its bonus/);
  press(r, /^\+2$/);
  expect(picked).toEqual([{ magicBonus: 2 }]);
});
