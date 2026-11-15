// Removing a spell after creation: gone from the lists, its grants taken back, a choice that picked it no longer records it, and
// nothing later (a recompute, another spell being granted) brings it back.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { grantEntitlement } from '../entitlements';
import { forgetSpell } from '../leveling';
import type { ChoiceState, Entity, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const sorcerer = (): Entity => recomputeDerived(createCharacter(provider, { id: 's', name: 'S', classId: 'sorcerer', raceId: 'human',
  backgroundId: 'acolyte', stats: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 }, level: 3 }, DEFAULT_RULES), DEFAULT_RULES);
const holds = (e: Entity, id: string) => [...e.spellcasting!.cantrips, ...e.spellcasting!.known, ...e.spellcasting!.prepared].includes(id)
  || (e.entitlements ?? []).some(x => x.key === id);

it('a spell added after creation is removed, and stays removed', () => {
  const learned = grantEntitlement(sorcerer(), { kind: 'spell_access', key: 'magic_missile', sourceKind: 'class', sourceId: 'sorcerer' });
  expect(holds(learned, 'magic_missile')).toBe(true);
  const gone = forgetSpell(learned, 'magic_missile', DEFAULT_RULES);
  expect(holds(gone, 'magic_missile')).toBe(false);
  expect(holds(recomputeDerived(gone, DEFAULT_RULES), 'magic_missile')).toBe(false);
  const another = grantEntitlement(gone, { kind: 'spell_access', key: 'shield', sourceKind: 'class', sourceId: 'sorcerer' });
  expect(holds(another, 'magic_missile')).toBe(false);
  expect(holds(another, 'shield')).toBe(true);
});

it('a spell a resolved choice picked leaves the choice record too; its other picks stay', () => {
  const choice = { id: 'c1', resolved: true, selections: ['fire_bolt', 'light'], sourceKind: 'class', sourceId: 'sorcerer',
    definition: { id: 'c1', prompt: 'Choose 2 cantrips', kind: 'spell', count: 2, pool: 'all', grants: [], required: true, resolved: true } } as unknown as ChoiceState;
  let e = { ...sorcerer(), choices: [...sorcerer().choices, choice] };
  for (const id of ['fire_bolt', 'light']) e = grantEntitlement(e, { kind: 'cantrip_access', key: id, sourceKind: 'class', sourceId: 'sorcerer', choiceId: 'c1' });
  const gone = forgetSpell(e, 'fire_bolt', DEFAULT_RULES);
  expect(holds(gone, 'fire_bolt')).toBe(false);
  expect(holds(gone, 'light')).toBe(true);
  expect(gone.choices.find(c => c.id === 'c1')!.selections).toEqual(['light']);
});

it('a spell the character does not hold changes nothing', () => {
  const s = sorcerer();
  expect(forgetSpell(s, 'wish', DEFAULT_RULES)).toBe(s);
});
