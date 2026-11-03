import { charactersUsing, usedByWarning } from '../contentUsage';
import { makeEmptyEntity } from '../../store/characterStore';
import type { Entity } from '../../engine/types';

const character = (id: string, name: string, items: string[] = [], spells: string[] = []): Entity => {
  const e = makeEmptyEntity(id, 'character');
  return {
    ...e,
    identity: { ...e.identity, name },
    inventory: { ...e.inventory, carried: items.map((itemId, i) => ({ id: `${id}-${i}`, itemId, quantity: 1, attuned: false, features: [] })) },
    spellcasting: spells.length ? { ...(e.spellcasting ?? {}), cantrips: [], known: spells, prepared: [] } as Entity['spellcasting'] : e.spellcasting,
  };
};

describe('content usage', () => {
  const party = [character('a', 'Aria', ['hb_sword']), character('b', 'Bo', [], ['hb_bolt']), character('c', 'Cy')];

  it('finds who carries an item and who has a spell', () => {
    expect(charactersUsing('item', 'hb_sword', party).map(c => c.identity.name)).toEqual(['Aria']);
    expect(charactersUsing('spell', 'hb_bolt', party).map(c => c.identity.name)).toEqual(['Bo']);
    expect(charactersUsing('item', 'nothing', party)).toEqual([]);
  });

  it('asks before changing them, naming them, and says nothing when nobody uses it', () => {
    expect(usedByWarning('item', [party[0]])).toEqual({
      title: 'Change it for 1 character?',
      message: 'Aria carries this item. Saving changes what it does for them too, the next time their sheet opens.',
    });
    const many = Array.from({ length: 5 }, (_, i) => character(`x${i}`, `P${i}`));
    expect(usedByWarning('spell', many)?.message).toMatch(/^P0, P1, P2 and 2 more have this spell\./);
    expect(usedByWarning('item', [])).toBeNull();
  });
});
