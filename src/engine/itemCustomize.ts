// ============================================================================
// FILE: src/engine/itemCustomize.ts
// Customising an item a character owns: its name, its description, its uses (a wand's charges) and what it does to ability scores
//
// "Set to" is written as the rules write it for such items (Belt of Giant Strength, Amulet of Health): the score BECOMES that number
// unless it is already higher, and nothing else is added on top (an `atLeast` set, applied after every other bonus in pipeline.ts).
// Effects the form does not show (a scale, anything that is not an ability set/add) are kept exactly as they were.
// ============================================================================
import { Ability, Effect, Entity, Feature, Item, ItemInstance, ResourceGrant } from './types';
import { hydrateItemInstanceDefinitionFacts, itemRequiresAttunement } from './itemMechanics';
import { applyGrant } from './levelingGrants';

export const ITEM_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export type ItemRecharge = 'short_rest' | 'long_rest' | 'dawn' | 'never';
/** `min` (an add only): the score never goes below it ("down by 10, never below 4"), a floor applied after every other change. */
export type AbilityChange = { operation: 'set' | 'add'; value: number; min?: number };
export type AbilityChanges = Partial<Record<Ability, AbilityChange>>;
/** A mode of the item (engine/featureModes.ts): its name and its own ability changes, on top of the item's. */
export type ModeEdits = { id: string; name: string; abilities: AbilityChanges };
export type ItemEdits = {
  name: string;
  description: string;
  /** null: the item has no uses to track. */
  uses: { maximum: number; recharge: ItemRecharge } | null;
  abilities: AbilityChanges;
  /** Empty: the item has no modes. */
  modes: ModeEdits[];
};

const isAbility = (t: string): t is Ability => (ITEM_ABILITIES as string[]).includes(t);
/** An ability set (plain or floor) or add: the effects the form owns. Every other effect is left alone. */
const formAbilityEffect = (e: Effect): boolean =>
  e.type === 'stat_modifier' && isAbility(e.target) && (e.operation === 'set' || e.operation === 'add') && typeof e.value === 'number';
const RECHARGES: ItemRecharge[] = ['short_rest', 'long_rest', 'dawn', 'never'];

/** The ability changes `effects` make, as the form shows them: an add with a floor on the same ability reads as an add with a minimum. */
export function abilityChangesOf(effects: readonly Effect[]): AbilityChanges {
  const out: AbilityChanges = {};
  for (const ab of ITEM_ABILITIES) {
    const mine = effects.filter(e => formAbilityEffect(e) && e.target === ab);
    const add = mine.find(e => e.operation === 'add');
    const set = mine.find(e => e.operation === 'set');
    if (add) out[ab] = { operation: 'add', value: add.value as number, ...(set ? { min: set.value as number } : {}) };
    else if (set) out[ab] = { operation: 'set', value: set.value as number };
  }
  return out;
}

/** The effects for these ability changes: "set to" as a floor (see the header), an add, and an add's minimum as a floor after it. */
export function abilityChangeEffects(changes: AbilityChanges): Effect[] {
  return ITEM_ABILITIES.flatMap(ab => {
    const c = changes[ab];
    if (!c || !Number.isFinite(c.value)) return [];
    const effect = { type: 'stat_modifier', target: ab, operation: c.operation, value: Math.round(c.value), condition: null } as Effect;
    if (c.operation === 'set') return [{ ...effect, atLeast: true }];
    return Number.isFinite(c.min) ? [effect, { type: 'stat_modifier', target: ab, operation: 'set', value: Math.round(c.min!), condition: null, atLeast: true }] : [effect];
  });
}

/** What the form starts from. */
export function itemEditsOf(item: Item): ItemEdits {
  const first = item.features?.[0];
  const abilities: ItemEdits['abilities'] = {};
  for (const f of item.features ?? []) Object.assign(abilities, abilityChangesOf(f.effects ?? []));
  const modes = (first?.modes ?? []).map(m => ({ id: m.id, name: m.name, abilities: abilityChangesOf(m.effects) }));
  const pool = item.resources?.[0];
  const recharge = pool ? (RECHARGES.find(r => pool.recharge === r || String(pool.recharge).startsWith(`${r}:`)) ?? 'long_rest') : 'long_rest';
  return {
    name: item.name,
    description: item.features?.[0]?.description ?? '',
    uses: pool ? { maximum: pool.maximum, recharge } : null,
    abilities,
    modes,
  };
}

/** The person's version of `item` under `id`. */
export function customizedItem(item: Item, edits: ItemEdits, id: string): Item {
  const name = edits.name.trim() || item.name;
  const changes = abilityChangeEffects(edits.abilities);
  const modes = (edits.modes ?? []).map((m, i) => ({ id: m.id, name: m.name.trim() || `Mode ${i + 1}`, effects: abilityChangeEffects(m.abilities) }));
  const retag = (f: Feature): Feature => (f.source?.kind === 'item' && f.source.refId === item.id ? { ...f, source: { ...f.source, refId: id } } : f);
  const renamed = (n: string) => (name !== item.name && n.startsWith(item.name) ? name + n.slice(item.name.length) : n);
  // the item's own description feature (id `<item>_desc`) is its name on the sheet: it always carries the current name, so an item
  // renamed before renames carried over is put right on its next save
  const kept = (item.features ?? []).map(f => retag({ ...f, name: f.id.endsWith('_desc') ? name : renamed(f.name), effects: (f.effects ?? []).filter(e => !formAbilityEffect(e)) }));
  const first: Feature = kept[0] ?? {
    id: `${id}_desc`, name, description: '', source: { kind: 'item', refId: id }, level: null, effects: [], actions: [], choices: [], passive: true,
  };
  const { modes: _oldModes, ...firstRest } = first;
  void _oldModes;
  const features = [{ ...firstRest, description: edits.description, effects: [...(first.effects ?? []), ...changes], ...(modes.length ? { modes } : {}) }, ...kept.slice(1)];

  const [oldPool, ...otherPools] = item.resources ?? [];
  const max = edits.uses ? Math.max(0, Math.floor(edits.uses.maximum)) : 0;
  const pool: ResourceGrant | null = edits.uses && max > 0
    ? { ...(oldPool ?? {}), resourceId: oldPool?.resourceId ?? `${id}_uses`, name: oldPool?.name ? renamed(oldPool.name) : `${name} uses`, maximum: max, recharge: edits.uses.recharge }
    : null;
  const resources = [...(pool ? [pool] : []), ...otherPools];

  // an official item can need attunement by its id alone; the copy has a new id, so it says so in its properties
  const properties = itemRequiresAttunement(item) && !item.properties.some(p => p.toLowerCase().includes('requires attunement'))
    ? [...item.properties, 'requires attunement'] : [...item.properties];

  const { srd: _srd, homebrewDraft: _draft, resources: _res, ...rest } = item as Item & { srd?: boolean };
  void _srd; void _draft; void _res;   // a builder draft would no longer describe the copy
  return { ...rest, id, name, properties, features, ...(resources.length ? { resources } : {}) };
}

/**
 * Moves the owned copy `instanceId` from `from` onto `to`, keeping its quantity, attunement, infusion and place (worn or carried).
 * A pool the item already gave keeps its spent uses: its maximum follows the edit, and a pool the edit took away is removed. A new
 * pool on a worn item is granted now. The caller recomputes the derived numbers.
 */
export function moveOwnedItem(entity: Entity, instanceId: string, from: Item, to: Item): Entity {
  const swap = (list: ItemInstance[]) => list.map(i => (i.id === instanceId ? hydrateItemInstanceDefinitionFacts({ ...i, itemId: to.id }, to) : i));
  const worn = entity.inventory.equipped.some(i => i.id === instanceId);
  let next: Entity = { ...entity, inventory: { ...entity.inventory, equipped: swap(entity.inventory.equipped), carried: swap(entity.inventory.carried) } };

  const newPools = new Map((to.resources ?? []).map(r => [r.resourceId, r]));
  const dropped = new Set((from.resources ?? []).map(r => r.resourceId).filter(rid => !newPools.has(rid)));
  const custom = next.resources.custom
    .filter(c => !dropped.has(c.id))
    .map(c => {
      const r = newPools.get(c.id);
      if (!r || (c.maximum === r.maximum && c.recharge === r.recharge)) return c;
      const current = Math.max(0, Math.min(r.maximum, c.current + (r.maximum - c.maximum)));   // the same number of uses stays spent
      return { ...c, maximum: r.maximum, baseMaximum: r.maximum, recharge: r.recharge, current };
    });
  next = { ...next, resources: { ...next.resources, custom } };
  if (worn) {
    for (const r of to.resources ?? []) next = applyGrant(next, { kind: 'resource', value: r }, next.identity.level, undefined, { kind: 'item', id: to.id });
  }
  return next;
}
