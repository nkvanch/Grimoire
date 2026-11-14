// Maximum hit points follow the Constitution modifier whatever changed it (pipeline.ts followConModifier): the book's rule that a
// changed modifier changes the maximum as if it had always been the new one. Every source, once, never twice.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { recomputeDerived } from '../pipeline';
import { applyCharacterOverride, removeCharacterOverride } from '../characterOverride';
import { setAbilityTotal } from '../abilityTotal';
import { setFeatureMode } from '../featureModes';
import { grantCustomFeature } from '../../components/sheet/AddCustomFeatureModal';
import { newDraftTrait } from '../../content/traitCompiler';
import type { Entity, Feature, RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
/** A level 7 human sorcerer, Constitution 12 (+1): 6 + 4 x 6 = 30, plus 7 from Constitution = 37. */
const sorcerer = (): Entity => recomputeDerived(createCharacter(provider, {
  id: 's', name: 'S', classId: 'sorcerer', raceId: 'human', backgroundId: 'acolyte', stats: { str: 10, dex: 12, con: 11, int: 11, wis: 12, cha: 16 }, level: 7,
}, DEFAULT_RULES), DEFAULT_RULES);
const hp = (e: Entity) => e.resources.hp;
const r = (e: Entity) => recomputeDerived(e, DEFAULT_RULES);
const conItem = (id: string, effects: unknown[], modes?: unknown[]): Entity['inventory']['equipped'][number] => ({
  id: `inst-${id}`, itemId: id, quantity: 1, attuned: true,
  features: [{ id: `${id}_f`, name: id, description: '', source: { kind: 'item', refId: id }, level: null, effects, actions: [], choices: [], passive: true, ...(modes ? { modes } : {}) }],
} as never);
const setCon = (v: number, atLeast = true) => ({ type: 'stat_modifier', target: 'con', operation: 'set', value: v, condition: null, ...(atLeast ? { atLeast } : {}) });
const wear = (e: Entity, inst: ReturnType<typeof conItem>) => ({ ...e, inventory: { ...e.inventory, equipped: [...e.inventory.equipped, inst] } });

it('starts as built: 37 from Constitution 12, nothing moved', () => {
  expect(hp(sorcerer())).toMatchObject({ maximum: 37, current: 37, conModApplied: 1 });
});

it('an item that sets Constitution (Amulet of Health, 19) raises the maximum by 3 x 7, and taking it off brings it back', () => {
  const worn = r(wear(sorcerer(), conItem('amulet', [setCon(19)])));
  expect(hp(worn)).toMatchObject({ maximum: 58, current: 58 });
  const off = r({ ...worn, inventory: { ...worn.inventory, equipped: [] } });
  expect(hp(off)).toMatchObject({ maximum: 37, current: 37 });
});

it('damage taken is kept, and a loss never takes current hit points below 0', () => {
  const worn = r(wear(sorcerer(), conItem('amulet', [setCon(19)])));
  const hurt = { ...worn, resources: { ...worn.resources, hp: { ...hp(worn), current: 40 } } };   // 18 damage
  const off = r({ ...hurt, inventory: { ...hurt.inventory, equipped: [] } });
  expect(hp(off)).toMatchObject({ maximum: 37, current: 19 });
  const nearlyDown = { ...worn, resources: { ...worn.resources, hp: { ...hp(worn), current: 5 } } };
  expect(hp(r({ ...nearlyDown, inventory: { ...nearlyDown.inventory, equipped: [] } })).current).toBe(0);
});

it('a mode that drops Constitution to 4 lowers it, switching back restores it', () => {
  const modes = [{ id: 'worn', name: 'Worn', effects: [] }, { id: 'twisted', name: 'Twisted', effects: [setCon(4, false)] }];
  let e = r(wear(sorcerer(), conItem('belt', [], modes)));
  expect(hp(e).maximum).toBe(37);
  e = r(setFeatureMode(e, 'inst-belt/belt_f', 'twisted'));
  expect(hp(e)).toMatchObject({ maximum: 9, current: 9 });          // -3 instead of +1: 4 x 7 = 28 less
  e = r(setFeatureMode(e, 'inst-belt/belt_f', 'worn'));
  expect(hp(e)).toMatchObject({ maximum: 37, current: 37 });
});

it('a feature granted on the sheet that raises Constitution counts too', () => {
  const draft = { ...newDraftTrait('Toughened'), localId: 'tough', effectKind: 'ability_score' as const, abilityTarget: 'con', abilityAmount: '4' } as never;
  const e = r(grantCustomFeature(sorcerer(), draft, DEFAULT_RULES));
  expect(hp(e).maximum).toBe(37 + 2 * 7);
});

it('an override and "set the total" each move it once, never twice', () => {
  const o = applyCharacterOverride(sorcerer(), { stat: 'con', value: 16, operation: 'set' }, DEFAULT_RULES);
  expect(hp(o).maximum).toBe(37 + 2 * 7);
  const id = o.characterOverrides!.find(x => x.active)!.id;
  expect(hp(removeCharacterOverride(o, id, DEFAULT_RULES)).maximum).toBe(37);
  const total = setAbilityTotal(sorcerer(), 'con', 14);
  expect(hp(r(total.entity)).maximum).toBe(37 + 1 * 7);
});

it("a Wild Shape beast's Constitution is the beast's, never the druid's hit points", () => {
  const druid = r(createCharacter(provider, {
    id: 'd', name: 'D', classId: 'druid', raceId: 'human', backgroundId: 'acolyte', stats: { str: 10, dex: 12, con: 13, int: 10, wis: 15, cha: 8 }, level: 4,
  }, DEFAULT_RULES));
  const before = hp(druid).maximum;
  const shaped = r({ ...druid, wildShapeState: { active: true, formId: 'brown_bear', hp: { current: 34, maximum: 34 } } } as unknown as Entity);
  expect(hp(shaped).maximum).toBe(before);
});

it('a character saved before this rule starts from its present modifier and nothing moves', () => {
  const s = sorcerer();
  const { conModApplied: _drop, ...old } = hp(s);
  const loaded = r({ ...s, resources: { ...s.resources, hp: old } });
  expect(hp(loaded)).toMatchObject({ maximum: 37, conModApplied: 1 });
});

it('a monster is left alone (its level stands for its CR, not its hit dice)', () => {
  const m = { ...sorcerer(), kind: 'monster' as const };
  expect(hp(r(wear(m, conItem('amulet', [setCon(19)])))).maximum).toBe(37);
  void ({} as Feature);
});

it('a character saved before this rule while wearing an Amulet of Health gets the hit points it never had, on the first load', () => {
  const s = sorcerer();
  const { conModApplied: _drop, ...old } = hp(s);                     // as the old rules left it: 37, the amulet never counted
  const wearing = wear({ ...s, resources: { ...s.resources, hp: old } }, conItem('amulet', [setCon(19)]));
  expect(hp(r(wearing))).toMatchObject({ maximum: 58, current: 58, conModApplied: 4 });
});
