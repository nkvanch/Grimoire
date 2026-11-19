// The character sheet's own changes: equipping and attuning, the bag, coin, conditions and death saves. Prepared characters for the
// native-parity fixtures, and the one function that applies an operation the way the sheet does. Pure data (no I/O).
import type { Entity, Item, ItemInstance, Feature, DurationTracker } from '../types';
import { DEFAULT_RULES } from '../defaults';
import { equipItem, unequipItem, toggleAttunement } from '../inventory';
import { applyCondition, removeCondition, reduceExhaustion, tickDurations, setFlag } from '../conditions';
import { startWildShape, endWildShape, applyWildShapeDamage } from '../combatWildShape';
import { recordDeathSave } from '../combatDamage';
import { recomputeDerived } from '../pipeline';
import { isStatefulItem, generateItemInstanceId } from '../itemMechanics';
import { lookupConditionFor } from '../../content/conditions/lookup';

type Json = Record<string, unknown>;

export type SheetOp =
  | { name: 'equip'; args: { itemId: string; instanceId?: string } }
  | { name: 'unequip'; args: { itemId: string; instanceId?: string } }
  | { name: 'toggleAttunement'; args: { itemId: string; instanceId?: string } }
  | { name: 'addItem'; args: { itemId: string } }
  | { name: 'removeItem'; args: { itemId: string; instanceId?: string } }
  | { name: 'adjustQuantity'; args: { itemId: string; delta: number; instanceId?: string } }
  | { name: 'setQuantity'; args: { itemId: string; quantity: number; instanceId?: string } }
  | { name: 'setCurrency'; args: { currency: { pp: number; gp: number; ep: number; sp: number; cp: number } } }
  | { name: 'applyCondition'; args: { conditionId: string; duration?: DurationTracker | null } }
  | { name: 'removeCondition'; args: { conditionId: string } }
  | { name: 'reduceExhaustion'; args: Record<string, never> }
  | { name: 'tickDurations'; args: Record<string, never> }
  | { name: 'setFlag'; args: { flag: string; value: boolean } }
  | { name: 'recordDeathSave'; args: { outcome: 'success' | 'failure' } }
  | { name: 'setDeathSaves'; args: { successes: number; failures: number } }
  | { name: 'togglePrepared'; args: { spellId: string } }
  | { name: 'startWildShape'; args: { formId: string } }
  | { name: 'endWildShape'; args: Record<string, never> }
  | { name: 'wildShapeDamage'; args: { amount: number; damageType?: string; nonmagical?: boolean } };

export type SheetCase = { name: string; entity: Entity; op: SheetOp; items?: Item[] };

const feature = (id: string, effects: Json[], extra: Json = {}, kind = 'item'): Json => ({
  id, name: id, description: '', source: { kind, refId: id }, level: null, actions: [], choices: [], passive: true, effects, isActive: true, ...extra,
});
const fx = (target: string, operation: string, value: unknown, extra: Json = {}, type = 'stat_modifier'): Json =>
  ({ type, target, operation, value, condition: null, ...extra });

const WARD_RING: Item = {
  id: 'hb_ward_ring', name: 'Ward Ring', weight: 0, cost: '', properties: ['ring', 'Requires attunement'],
  features: [feature('hb_ward_ring_ac', [fx('ac', 'add', 1)]) as unknown as Feature],
};
const CHARGE_WAND: Item = {
  id: 'hb_charge_wand', name: 'Charge Wand', weight: 1, cost: '', properties: ['wand'],
  features: [],
  resources: [{ resourceId: 'hb_wand_charges', name: 'Wand charges', maximum: 7, recharge: 'dawn' }],
};
const PLAIN_TRINKET: Item = {
  id: 'hb_trinket', name: 'Trinket', weight: 0, cost: '', properties: [], features: [],
};

const inst = (id: string, itemId: string, extra: Json = {}): Json => ({ id, itemId, quantity: 1, attuned: false, features: [], ...extra });
// the ring as equipping it leaves it: the definition's facts are already on the copy (a homebrew item is not in the engine's own catalog)
const wornRing = (id: string, attuned = false): Json => inst(id, 'hb_ward_ring', {
  attuned, requiresAttunement: true, wearsArmorOrShield: false, isShield: false, features: WARD_RING.features,
});

export function buildSheetCases(base: Entity): SheetCase[] {
  const out: SheetCase[] = [];
  const make = (name: string, op: SheetOp, tweak: (e: Entity & Json) => void = () => undefined, items?: Item[]) => {
    const e = JSON.parse(JSON.stringify(base)) as Entity & Json;
    (e.inventory as unknown as Json).equipped = [];
    (e.inventory as unknown as Json).carried = [];
    tweak(e);
    out.push({ name, entity: e, op, items });
  };
  const bag = (e: Entity & Json, equipped: Json[], carried: Json[]) => {
    (e.inventory as unknown as Json).equipped = equipped;
    (e.inventory as unknown as Json).carried = carried;
  };
  const res = (e: Entity & Json): Json => e.resources;
  const hp = (e: Entity & Json): Json => res(e).hp as Json;
  const addFeature = (e: Entity & Json, f: Json) => { e.features = [...e.features, f as never]; };

  // ── equipping ─────────────────────────────────────────────────────────────────────────────────────────────────────
  make('equip-armor', { name: 'equip', args: { itemId: 'chain_mail', instanceId: 'i-chain' } },
    e => bag(e, [], [inst('i-chain', 'chain_mail'), inst('i-shield', 'shield')]));
  make('equip-shield-over-armor', { name: 'equip', args: { itemId: 'shield', instanceId: 'i-shield' } },
    e => bag(e, [inst('i-chain', 'chain_mail')], [inst('i-shield', 'shield')]));
  make('equip-by-item-id-takes-first-match', { name: 'equip', args: { itemId: 'longsword' } },
    e => bag(e, [], [inst('i-a', 'longsword'), inst('i-b', 'longsword')]));
  make('equip-second-copy-stays-separate', { name: 'equip', args: { itemId: 'longsword', instanceId: 'i-b' } },
    e => bag(e, [inst('i-a', 'longsword')], [inst('i-b', 'longsword')]));
  make('equip-not-carried-is-nothing', { name: 'equip', args: { itemId: 'longsword', instanceId: 'i-nope' } },
    e => bag(e, [], [inst('i-a', 'longsword')]));
  make('equip-unknown-item', { name: 'equip', args: { itemId: 'zz_unknown', instanceId: 'i-u' } },
    e => bag(e, [], [inst('i-u', 'zz_unknown', { quantity: 3 })]));
  make('equip-attunement-ring', { name: 'equip', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [], [inst('i-ring', 'hb_ward_ring')]), [WARD_RING]);
  make('equip-attuned-ring-counts', { name: 'equip', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [], [inst('i-ring', 'hb_ward_ring', { attuned: true })]), [WARD_RING]);
  make('equip-wand-creates-its-pool', { name: 'equip', args: { itemId: 'hb_charge_wand', instanceId: 'i-wand' } },
    e => bag(e, [], [inst('i-wand', 'hb_charge_wand')]), [CHARGE_WAND]);
  make('equip-wand-again-keeps-spent-charges', { name: 'equip', args: { itemId: 'hb_charge_wand', instanceId: 'i-wand' } }, e => {
    bag(e, [], [inst('i-wand', 'hb_charge_wand')]);
    res(e).custom = [{ id: 'hb_wand_charges', name: 'Wand charges', current: 2, maximum: 7, recharge: 'dawn', sourceKind: 'item', sourceId: 'hb_charge_wand' }];
  }, [CHARGE_WAND]);
  make('equip-plain-gear-with-infusion', { name: 'equip', args: { itemId: 'shield', instanceId: 'i-shield' } },
    e => bag(e, [], [inst('i-shield', 'shield', { infusedWith: 'enhanced_defense', features: [feature('infusion_enhanced_defense', [fx('ac', 'add', 1)])] })]));

  make('unequip-armor', { name: 'unequip', args: { itemId: 'chain_mail', instanceId: 'i-chain' } },
    e => bag(e, [inst('i-chain', 'chain_mail'), inst('i-shield', 'shield')], []));
  make('unequip-one-of-two-copies', { name: 'unequip', args: { itemId: 'longsword', instanceId: 'i-b' } },
    e => bag(e, [inst('i-a', 'longsword'), inst('i-b', 'longsword')], []));
  make('unequip-keeps-attunement', { name: 'unequip', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [inst('i-ring', 'hb_ward_ring', { attuned: true })], []), [WARD_RING]);
  make('unequip-not-worn-is-nothing', { name: 'unequip', args: { itemId: 'chain_mail', instanceId: 'i-nope' } },
    e => bag(e, [inst('i-chain', 'chain_mail')], []));

  // ── attunement ────────────────────────────────────────────────────────────────────────────────────────────────────
  const three = [inst('i-1', 'hb_trinket', { attuned: true }), inst('i-2', 'hb_trinket', { attuned: true }), inst('i-3', 'hb_trinket', { attuned: true })];
  make('attune-on', { name: 'toggleAttunement', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [wornRing('i-ring')], []), [WARD_RING]);
  make('attune-off', { name: 'toggleAttunement', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [wornRing('i-ring', true)], []), [WARD_RING]);
  make('attune-carried-item', { name: 'toggleAttunement', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [], [inst('i-ring', 'hb_ward_ring')]), [WARD_RING]);
  make('attune-refused-at-the-cap', { name: 'toggleAttunement', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } },
    e => bag(e, [wornRing('i-ring')], three), [WARD_RING, PLAIN_TRINKET]);
  make('attune-cap-four-with-adept', { name: 'toggleAttunement', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } }, e => {
    bag(e, [wornRing('i-ring')], three);
    addFeature(e, feature('magic_item_adept', [], {}, 'class'));
  }, [WARD_RING, PLAIN_TRINKET]);
  make('attune-cap-five-with-savant-and-conflux', { name: 'toggleAttunement', args: { itemId: 'hb_ward_ring', instanceId: 'i-ring' } }, e => {
    bag(e, [wornRing('i-ring')], [...three, inst('i-4', 'hb_trinket', { attuned: true }), inst('i-5', 'hb_trinket', { attuned: true })]);
    addFeature(e, feature('magic_item_savant', [], {}, 'class'));
    addFeature(e, feature('feat_mystic_conflux', [], {}, 'feat'));
  }, [WARD_RING, PLAIN_TRINKET]);
  make('attune-unattuning-always-works', { name: 'toggleAttunement', args: { itemId: 'hb_trinket', instanceId: 'i-1' } },
    e => bag(e, [], three), [PLAIN_TRINKET]);

  // ── the bag ───────────────────────────────────────────────────────────────────────────────────────────────────────
  make('add-gear-stacks', { name: 'addItem', args: { itemId: 'torch' } },
    e => bag(e, [], [inst('i-torch', 'torch', { quantity: 4 })]));
  make('add-gear-new-row', { name: 'addItem', args: { itemId: 'torch' } }, e => bag(e, [], [inst('i-sword', 'longsword')]));
  make('add-weapon-is-its-own-copy', { name: 'addItem', args: { itemId: 'longsword' } }, e => bag(e, [], [inst('i-sword', 'longsword')]));
  make('add-armor-is-its-own-copy', { name: 'addItem', args: { itemId: 'chain_mail' } }, e => bag(e, [], [inst('i-chain', 'chain_mail')]));
  make('add-homebrew-ring-is-its-own-copy', { name: 'addItem', args: { itemId: 'hb_ward_ring' } },
    e => bag(e, [], [inst('i-ring', 'hb_ward_ring')]), [WARD_RING]);
  make('add-unknown-id-stacks', { name: 'addItem', args: { itemId: 'zz_unknown' } },
    e => bag(e, [], [inst('i-u', 'zz_unknown', { quantity: 2 })]));

  make('remove-by-instance', { name: 'removeItem', args: { itemId: 'longsword', instanceId: 'i-b' } },
    e => bag(e, [], [inst('i-a', 'longsword'), inst('i-b', 'longsword')]));
  make('remove-worn-by-instance', { name: 'removeItem', args: { itemId: 'chain_mail', instanceId: 'i-chain' } },
    e => bag(e, [inst('i-chain', 'chain_mail')], [inst('i-shield', 'shield')]));
  make('remove-by-item-id-takes-one-match', { name: 'removeItem', args: { itemId: 'longsword' } },
    e => bag(e, [], [inst('i-a', 'longsword'), inst('i-b', 'longsword')]));
  make('remove-missing-is-nothing', { name: 'removeItem', args: { itemId: 'longsword', instanceId: 'i-nope' } },
    e => bag(e, [], [inst('i-a', 'longsword')]));

  make('quantity-plus', { name: 'adjustQuantity', args: { itemId: 'torch', delta: 1, instanceId: 'i-torch' } },
    e => bag(e, [], [inst('i-torch', 'torch', { quantity: 2 })]));
  make('quantity-minus-to-zero-removes', { name: 'adjustQuantity', args: { itemId: 'torch', delta: -1, instanceId: 'i-torch' } },
    e => bag(e, [], [inst('i-torch', 'torch', { quantity: 1 }), inst('i-sword', 'longsword')]));
  make('quantity-set-exact', { name: 'setQuantity', args: { itemId: 'torch', quantity: 20, instanceId: 'i-torch' } },
    e => bag(e, [], [inst('i-torch', 'torch', { quantity: 2 })]));
  make('quantity-set-zero-removes', { name: 'setQuantity', args: { itemId: 'torch', quantity: 0, instanceId: 'i-torch' } },
    e => bag(e, [], [inst('i-torch', 'torch', { quantity: 2 })]));
  make('quantity-only-for-carried', { name: 'adjustQuantity', args: { itemId: 'torch', delta: 5, instanceId: 'i-torch' } },
    e => bag(e, [inst('i-torch', 'torch', { quantity: 2 })], []));

  make('currency-set', { name: 'setCurrency', args: { currency: { pp: 1, gp: 250, ep: 0, sp: 17, cp: 3 } } });

  // ── conditions ────────────────────────────────────────────────────────────────────────────────────────────────────
  make('condition-grappled-sets-speed', { name: 'applyCondition', args: { conditionId: 'grappled' } });
  make('condition-poisoned-with-rounds', { name: 'applyCondition', args: { conditionId: 'poisoned', duration: { unit: 'rounds', remaining: 3 } } });
  make('condition-already-active-is-nothing', { name: 'applyCondition', args: { conditionId: 'prone' } }, e => {
    e.conditions = [{ id: 'prone', sourceId: 'manual', duration: null, suppressedBy: [] }] as never;
    (e.conditionMonitor as unknown as Json).active = [{ id: 'prone', sourceId: 'manual', duration: null, suppressedBy: [] }];
  });
  make('condition-immune-is-nothing', { name: 'applyCondition', args: { conditionId: 'poisoned' } }, e => {
    addFeature(e, feature('poison_ward', [fx('poisoned', 'add', null, {}, 'condition_immunity')], {}, 'feat'));
  });
  make('condition-suppressed-by-a-feature', { name: 'applyCondition', args: { conditionId: 'blinded' } }, e => {
    addFeature(e, feature('blindsight_like', [fx('blinded', 'add', null, {}, 'suppress_condition_effects')], {}, 'feat'));
  });
  make('condition-exhaustion-steps-up', { name: 'applyCondition', args: { conditionId: 'exhaustion' } }, e => {
    (e.conditionMonitor as unknown as Json).exhaustion = 2;
  });
  make('condition-exhaustion-stops-at-six', { name: 'applyCondition', args: { conditionId: 'exhaustion' } }, e => {
    (e.conditionMonitor as unknown as Json).exhaustion = 6;
  });
  make('condition-stunned-ends-2024-concentration', { name: 'applyCondition', args: { conditionId: 'stunned' } }, e => {
    (e as Json).rulesetId = 'dnd5e-2024';
    ((e.spellcasting as unknown) as Json).concentrating = 'bless';
    ((e.spellcasting as unknown) as Json).concentratingDuration = { unit: 'rounds', remaining: 5 };
    (e.conditionMonitor as unknown as Json).flags = { concentrating: true };
    addFeature(e, feature('bless_effect', [fx('ac', 'add', 1)], {}, 'spell'));
    (e.features[e.features.length - 1] as unknown as Json).source = { kind: 'spell', refId: 'bless' };
  });
  make('condition-stunned-keeps-2014-concentration', { name: 'applyCondition', args: { conditionId: 'stunned' } }, e => {
    ((e.spellcasting as unknown) as Json).concentrating = 'bless';
    (e.conditionMonitor as unknown as Json).flags = { concentrating: true };
  });
  make('condition-unknown-id-is-a-bare-chip', { name: 'applyCondition', args: { conditionId: 'zz_custom' } });

  const withGrappled = (e: Entity & Json, duration: DurationTracker | null = null) => {
    const record = lookupConditionFor('grappled', e.rulesetId);
    const c = { id: 'grappled', sourceId: 'manual', duration, suppressedBy: [] };
    e.conditions = [c] as never;
    (e.conditionMonitor as unknown as Json).active = [c];
    for (const f of record?.features ?? []) addFeature(e, { ...(f as unknown as Json), source: { kind: 'condition', refId: 'grappled' }, isActive: true });
  };
  make('remove-condition-strips-its-features', { name: 'removeCondition', args: { conditionId: 'grappled' } }, e => withGrappled(e));
  make('remove-condition-not-there', { name: 'removeCondition', args: { conditionId: 'prone' } }, e => withGrappled(e));
  make('exhaustion-reduced', { name: 'reduceExhaustion', args: {} }, e => { (e.conditionMonitor as unknown as Json).exhaustion = 3; });
  make('exhaustion-reduced-at-zero', { name: 'reduceExhaustion', args: {} });
  make('ticks-rounds-down', { name: 'tickDurations', args: {} }, e => withGrappled(e, { unit: 'rounds', remaining: 3 }));
  make('ticks-expiry-removes-condition-and-features', { name: 'tickDurations', args: {} }, e => withGrappled(e, { unit: 'rounds', remaining: 1 }));
  make('ticks-leaves-permanent-ones', { name: 'tickDurations', args: {} }, e => withGrappled(e, null));
  make('flag-on', { name: 'setFlag', args: { flag: 'rage_active', value: true } });
  make('flag-off', { name: 'setFlag', args: { flag: 'rage_active', value: false } }, e => {
    (e.conditionMonitor as unknown as Json).flags = { rage_active: true };
  });

  // ── death saves ───────────────────────────────────────────────────────────────────────────────────────────────────
  const down = (e: Entity & Json, successes = 0, failures = 0, stable = false) => {
    hp(e).current = 0;
    res(e).deathSaves = { successes, failures, stable };
  };
  make('death-save-success', { name: 'recordDeathSave', args: { outcome: 'success' } }, e => down(e, 1, 1));
  make('death-save-failure', { name: 'recordDeathSave', args: { outcome: 'failure' } }, e => down(e, 1, 1));
  make('death-save-third-success-stabilizes', { name: 'recordDeathSave', args: { outcome: 'success' } }, e => down(e, 2, 1));
  make('death-save-third-failure', { name: 'recordDeathSave', args: { outcome: 'failure' } }, e => down(e, 0, 2));
  make('death-save-after-death-is-nothing', { name: 'recordDeathSave', args: { outcome: 'success' } }, e => down(e, 0, 3));
  make('death-save-when-stable-is-nothing', { name: 'recordDeathSave', args: { outcome: 'failure' } }, e => down(e, 3, 0, true));
  make('death-save-with-hp-is-nothing', { name: 'recordDeathSave', args: { outcome: 'failure' } }, e => { hp(e).current = 4; });
  make('death-saves-set-by-hand', { name: 'setDeathSaves', args: { successes: 2, failures: 1 } }, e => down(e, 0, 0));
  make('death-saves-set-three-successes-is-stable', { name: 'setDeathSaves', args: { successes: 3, failures: 0 } }, e => down(e, 0, 0));
  // ── preparing spells (TabSpells.tsx togglePrepared) ───────────────────────────────────────────────────────────────────
  const spellbook = (e: Entity & Json) => {
    const sc = e.spellcasting as unknown as Json;
    sc.known = ['magic_missile', 'shield', 'fireball'];
    sc.prepared = ['shield'];
  };
  make('prepare-a-spell', { name: 'togglePrepared', args: { spellId: 'magic_missile' } }, spellbook);
  make('unprepare-a-spell', { name: 'togglePrepared', args: { spellId: 'shield' } }, spellbook);
  make('prepare-a-second-spell', { name: 'togglePrepared', args: { spellId: 'fireball' } }, e => {
    spellbook(e);
    (e.spellcasting as unknown as Json).prepared = ['shield', 'magic_missile'];
  });
  return out;
}

// The sheet's own handlers (app/sheet/[id].tsx), reduced to the entity change. Item definitions come from `items` (homebrew). The sheet's
// mutate() recomputes after every change, so the result here does too.
export function runSheetOp(entity: Entity, op: SheetOp, items: Item[], lookupDefinition: (id: string) => Item | undefined): Entity {
  return recomputeDerived(applySheetOp(entity, op, items, lookupDefinition), DEFAULT_RULES);
}

function applySheetOp(entity: Entity, op: SheetOp, items: Item[], lookupDefinition: (id: string) => Item | undefined): Entity {
  const def = (id: string) => items.find(i => i.id === id) ?? lookupDefinition(id);
  const a = op.args as Record<string, never> & Json;
  switch (op.name) {
    case 'equip': return equipItem(entity, op.args.itemId, def(op.args.itemId), DEFAULT_RULES, op.args.instanceId);
    case 'unequip': return unequipItem(entity, op.args.itemId, DEFAULT_RULES, op.args.instanceId);
    case 'toggleAttunement': return toggleAttunement(entity, op.args.itemId, op.args.instanceId);
    case 'addItem': {
      const itemId = op.args.itemId;
      const stateful = isStatefulItem(def(itemId));
      const existing = !stateful ? entity.inventory.carried.find(i => i.itemId === itemId) : undefined;
      const carried: ItemInstance[] = existing
        ? entity.inventory.carried.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
        : [...entity.inventory.carried, { id: generateItemInstanceId(), itemId, quantity: 1, attuned: false, features: [] }];
      return { ...entity, inventory: { ...entity.inventory, carried } };
    }
    case 'removeItem': {
      const removeOne = (list: ItemInstance[]) => {
        const index = op.args.instanceId ? list.findIndex(i => i.id === op.args.instanceId) : list.findIndex(i => i.itemId === op.args.itemId);
        if (index < 0) return list;
        const next = [...list]; next.splice(index, 1); return next;
      };
      return { ...entity, inventory: { ...entity.inventory, equipped: removeOne(entity.inventory.equipped), carried: removeOne(entity.inventory.carried) } };
    }
    case 'adjustQuantity':
    case 'setQuantity': {
      const target = op.args.instanceId
        ? entity.inventory.carried.find(i => i.id === op.args.instanceId)
        : entity.inventory.carried.find(i => i.itemId === op.args.itemId);
      if (!target) return entity;
      const next = op.name === 'adjustQuantity' ? target.quantity + (op.args as { delta: number }).delta : (op.args as { quantity: number }).quantity;
      const carried = next <= 0
        ? entity.inventory.carried.filter(i => i !== target)
        : entity.inventory.carried.map(i => i === target ? { ...i, quantity: next } : i);
      return { ...entity, inventory: { ...entity.inventory, carried } };
    }
    case 'setCurrency': return { ...entity, inventory: { ...entity.inventory, currency: op.args.currency } };
    case 'applyCondition': {
      const record = lookupConditionFor(op.args.conditionId, entity.rulesetId);
      return applyCondition(entity, op.args.conditionId, 'manual', DEFAULT_RULES, record?.features, op.args.duration ?? null);
    }
    case 'removeCondition': return removeCondition(entity, op.args.conditionId, DEFAULT_RULES);
    case 'reduceExhaustion': return reduceExhaustion(entity, DEFAULT_RULES);
    case 'tickDurations': return tickDurations(entity, DEFAULT_RULES);
    case 'setFlag': return setFlag(entity, op.args.flag, op.args.value, DEFAULT_RULES);
    case 'recordDeathSave': return recordDeathSave(entity, op.args.outcome, DEFAULT_RULES);
    case 'startWildShape': return startWildShape(entity, op.args.formId, DEFAULT_RULES);
    case 'endWildShape': return endWildShape(entity, DEFAULT_RULES);
    case 'wildShapeDamage': return applyWildShapeDamage(entity, op.args.amount, DEFAULT_RULES, op.args.damageType, op.args.nonmagical === true);
    case 'togglePrepared': {
      if (!entity.spellcasting) return entity;
      const spellId = op.args.spellId;
      const prepared = entity.spellcasting.prepared.includes(spellId)
        ? entity.spellcasting.prepared.filter(id => id !== spellId)
        : [...entity.spellcasting.prepared, spellId];
      return { ...entity, spellcasting: { ...entity.spellcasting, prepared } };
    }
    case 'setDeathSaves': {
      void a;
      return recomputeDerived({
        ...entity,
        resources: { ...entity.resources, deathSaves: { successes: op.args.successes, failures: op.args.failures, stable: op.args.successes >= 3 } },
      }, DEFAULT_RULES);
    }
  }
}

// Wild Shape: transforming, ending it, and damage while transformed, on a 2014 Druid.
export function buildWildShapeCases(druid: Entity): SheetCase[] {
  const out: SheetCase[] = [];
  const make = (name: string, op: SheetOp, tweak: (e: Entity & Json) => void = () => undefined) => {
    const e = JSON.parse(JSON.stringify(druid)) as Entity & Json;
    tweak(e);
    out.push({ name, entity: e, op });
  };
  const shaped = (formId: string, beastHp: number, beastHpMax = beastHp) => (e: Entity & Json) => {
    (e as Json).wildShapeState = { active: true, formId, beastHp, beastHpMax, expiresAt: { unit: 'hours', remaining: 2 } };
  };
  const hp = (e: Entity & Json) => (e.resources as unknown as Json).hp as Json;

  make('ws-start-wolf', { name: 'startWildShape', args: { formId: 'wolf' } });
  make('ws-start-crocodile', { name: 'startWildShape', args: { formId: 'crocodile' } });
  make('ws-start-flyer', { name: 'startWildShape', args: { formId: 'giant_wasp' } });
  make('ws-start-unknown-form', { name: 'startWildShape', args: { formId: 'not_a_form' } });
  make('ws-start-while-shaped', { name: 'startWildShape', args: { formId: 'ape' } }, shaped('wolf', 11));
  make('ws-start-with-form-bonuses', { name: 'startWildShape', args: { formId: 'wolf' } }, e => {
    const f = (id: string, effects: Json[]) => ({ id, name: id, description: '', source: { kind: 'feat', refId: id }, level: null, actions: [], choices: [], passive: true, effects, isActive: true });
    const fx = (target: string, value: number, extra: Json = {}) => ({ type: 'stat_modifier', target, operation: 'add', value, condition: null, ...extra });
    e.features = [...e.features, f('hb_in_form', [fx('ac', 2, { appliesInBeastForm: true }), fx('speed', 10, { appliesInBeastForm: true })]) as never,
      f('hb_out_of_form', [fx('ac', 1), fx('speed', 5)]) as never];
  });
  make('ws-start-grappled', { name: 'startWildShape', args: { formId: 'wolf' } }, e => {
    (e as Json).conditions = [{ id: 'grappled', sourceId: 'manual', duration: null, suppressedBy: [] }];
    (e.conditionMonitor as unknown as Json).active = (e as Json).conditions;
    e.features = [...e.features, { id: 'grappled_speed', name: 'Grappled', description: '', source: { kind: 'condition', refId: 'grappled' }, level: null, actions: [], choices: [], passive: true,
      effects: [{ type: 'stat_modifier', target: 'speed', operation: 'set', value: 0, condition: null }], isActive: true } as never];
  });
  make('ws-end', { name: 'endWildShape', args: {} }, shaped('wolf', 7, 11));
  make('ws-end-when-not-shaped', { name: 'endWildShape', args: {} });

  make('ws-damage-absorbed', { name: 'wildShapeDamage', args: { amount: 5, damageType: 'slashing' } }, shaped('wolf', 11));
  make('ws-damage-untyped', { name: 'wildShapeDamage', args: { amount: 4 } }, shaped('wolf', 11));
  make('ws-damage-takes-temp-first', { name: 'wildShapeDamage', args: { amount: 8 } }, e => { shaped('wolf', 11)(e); hp(e).temp = 3; });
  make('ws-damage-exactly-the-form', { name: 'wildShapeDamage', args: { amount: 11 } }, shaped('wolf', 11));
  make('ws-damage-overflows-onto-the-druid', { name: 'wildShapeDamage', args: { amount: 20, damageType: 'fire' } }, shaped('wolf', 11));
  make('ws-damage-overflow-past-temp', { name: 'wildShapeDamage', args: { amount: 20 } }, e => { shaped('wolf', 6)(e); hp(e).temp = 4; });
  make('ws-damage-form-resists', { name: 'wildShapeDamage', args: { amount: 10, damageType: 'lightning' } }, shaped('air_elemental', 90));
  make('ws-damage-form-immune', { name: 'wildShapeDamage', args: { amount: 10, damageType: 'poison' } }, shaped('air_elemental', 90));
  make('ws-damage-nonmagical-resisted', { name: 'wildShapeDamage', args: { amount: 10, damageType: 'piercing', nonmagical: true } }, shaped('earth_elemental', 126));
  make('ws-damage-magical-not-resisted', { name: 'wildShapeDamage', args: { amount: 10, damageType: 'piercing', nonmagical: false } }, shaped('earth_elemental', 126));
  make('ws-damage-when-not-shaped', { name: 'wildShapeDamage', args: { amount: 10 } });
  return out;
}
