import { useState, useCallback } from 'react';
import { itemRepo } from '../../../content/itemRepo';
import { getInfusion } from '../../../content/runtimeRules';
import { TimelineCategory } from '../../../db/timelineRepo';
import { setFeatureMode } from '../../../engine/featureModes';
import { infusionCapacity } from '../../../engine/infusionCapacity';
import { asksForDamageType, CHOOSE_DAMAGE_TYPE } from '../../../engine/infusionRules';
import { equipItem, unequipItem, toggleAttunement, applyItemInfusion, removeItemInfusion, setItemChoices, ItemChoices } from '../../../engine/inventory';
import { isStatefulItem, generateItemInstanceId } from '../../../engine/itemMechanics';
import { captureLoadout, applyLoadout, deleteLoadout } from '../../../engine/loadout';
import { simulate } from '../../../engine/simulate';
import { Entity, Item, CampaignRules, ItemInstance } from '../../../engine/types';
import { STEP_OPERATIONS } from '../../../store/pinningService';
import { Alert } from '../../../utils/alert';

export function useSheetInventoryHandlers({ entity, homebrewItems, rules, mutate }: {
  entity: Entity | undefined;
  homebrewItems: Item[];
  rules: CampaignRules;
  mutate: (updater: (e: Entity) => Entity, label?: string, category?: TimelineCategory, operations?: readonly string[]) => void;
}) {
  // Set by handleEquip/handleUnequip once the change has been simulated but
  // not yet resolved — drives EquipmentPreviewModal. Both resolve the
  // item's definition first (itemRepo only ever holds the OFFICIAL catalog —
  // equips with permanently empty features: no attack card, no AC change,
  // nothing), purely so the preview can show the item's name and (for
  // equip) hydrate its features — the actual mutation is the pure
  // equipItem()/unequipItem() (src/engine/inventory.ts), so it's usable
  // directly as a simulate() mutator.
  const [equipPreview, setEquipPreview] = useState<{
    kind: 'equip' | 'unequip'; itemName: string; before: Entity; after: Entity;
  } | null>(null);

  // `instanceId` (item-identity closure) — the EXACT owned copy the player
  // tapped, since two carried/equipped rows can share `itemId`. TabInventory
  // already iterates real ItemInstance objects, so it always has one to
  // pass; omitted only by any not-yet-updated caller, which falls back to
  // the first `itemId` match (equipItem/unequipItem's own back-compat).
  const handleEquip = useCallback(async (itemId: string, instanceId?: string) => {
    if (!entity) return;
    await itemRepo.ensureLoaded([itemId]);
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const { before, after } = simulate(entity, e => equipItem(e, itemId, def, rules, instanceId), rules);
    setEquipPreview({ kind: 'equip', itemName: def?.name ?? itemId, before, after });
  }, [entity, homebrewItems, rules]);

  const handleUnequip = useCallback(async (itemId: string, instanceId?: string) => {
    if (!entity) return;
    await itemRepo.ensureLoaded([itemId]); // symmetry — resolves the name for display
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const { before, after } = simulate(entity, e => unequipItem(e, itemId, rules, instanceId), rules);
    setEquipPreview({ kind: 'unequip', itemName: def?.name ?? itemId, before, after });
  }, [entity, homebrewItems, rules]);

  const confirmEquipPreview = useCallback(() => {
    if (!equipPreview) return;
    mutate(() => equipPreview.after, `${equipPreview.kind === 'equip' ? 'Equipped' : 'Unequipped'} ${equipPreview.itemName}`, 'inventory', STEP_OPERATIONS.equipment);
    setEquipPreview(null);
  }, [mutate, equipPreview]);

  // Looks up an item's display name for a mutate() label — falls back to the
  // raw id when the definition isn't loaded/found, same fallback every other
  // item-name lookup in this file already uses (handleEquip/handleUnequip).
  const itemName = useCallback((itemId: string) =>
    itemRepo.getItemSync(itemId)?.name ?? homebrewItems.find(i => i.id === itemId)?.name ?? itemId,
  [homebrewItems]);

  // A plain boolean flip, unlike equip/unequip — no AC/attack-bonus change
  // to preview, so this mutates directly like handleAddItem/handleRemoveItem
  // rather than going through a simulate()-backed preview modal. The cap
  // check itself lives in toggleAttunement() (a no-op past the cap); the UI
  // (TabInventory) checks countAttuned()/attunementCap() itself first so it
  // can show an explanatory Alert instead of a silent no-op.
  // a feature's mode (engine/featureModes.ts): one Undo-able step, named after the mode
  const handleSetMode = useCallback((key: string, modeId: string, label: string) => {
    mutate(e => setFeatureMode(e, key, modeId), `Mode: ${label}`, 'inventory');
  }, [mutate]);

  // the owner's choice on an item whose record leaves it open (a base armor, a +1/+2/+3 bonus): one Undo-able step
  const handleSetItemChoices = useCallback((itemId: string, instanceId: string, choices: ItemChoices) => {
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    const what = choices.baseArmor ? `Base armor: ${choices.baseArmor}` : `Bonus: +${choices.magicBonus}`;
    mutate(e => setItemChoices(e, instanceId, choices, def, rules), `${what} (${itemName(itemId)})`, 'inventory', STEP_OPERATIONS.equipment);
  }, [mutate, itemName, homebrewItems, rules]);

  const handleToggleAttune = useCallback((itemId: string, instanceId?: string, overrule?: boolean) => {
    mutate(e => toggleAttunement(e, itemId, instanceId, overrule), `Toggled attunement: ${itemName(itemId)}${overrule ? ' (overruled)' : ''}`, 'inventory', STEP_OPERATIONS.equipment);
  }, [mutate, itemName]);

  // Item 13 (loadouts) — save/apply/delete a named (equipped items,
  // prepared spells) snapshot. Apply resolves every item definition the
  // loadout needs to newly EQUIP up front (same itemRepo.ensureLoaded +
  // homebrew-fallback pattern handleEquip already uses), then applies the
  // whole swap as one mutation with a plain confirm — a full
  // simulate()-backed preview (like single-item equip/unequip gets) would
  // need a new prepared-spell-aware row builder on top of
  // buildEquipmentSummaryRows; skipped for this slice in favor of a clear
  // Alert summary, since the player is applying a loadout they themselves
  // named and saved, not reacting to a surprising external change.
  const handleSaveLoadout = useCallback((name: string) => {
    if (!entity) return;
    mutate(e => ({ ...e, loadouts: [...(e.loadouts ?? []), captureLoadout(e, name)] }), `Saved loadout: ${name}`, 'inventory');
  }, [entity, mutate]);

  const handleApplyLoadout = useCallback(async (loadoutId: string) => {
    if (!entity) return;
    const loadout = entity.loadouts?.find(l => l.id === loadoutId);
    if (!loadout) return;
    await itemRepo.ensureLoaded(loadout.equippedItemIds);
    const itemDefs: Record<string, ReturnType<typeof itemRepo.getItemSync>> = {};
    for (const id of loadout.equippedItemIds) {
      itemDefs[id] = itemRepo.getItemSync(id) ?? homebrewItems.find(i => i.id === id);
    }
    const willEquip = loadout.equippedItemIds.filter(id => !entity.inventory.equipped.some(i => i.itemId === id));
    const willUnequip = entity.inventory.equipped.map(i => i.itemId).filter(id => !loadout.equippedItemIds.includes(id));
    const summary = [
      willEquip.length   ? `Equip: ${willEquip.map(itemName).join(', ')}` : null,
      willUnequip.length ? `Unequip: ${willUnequip.map(itemName).join(', ')}` : null,
      loadout.preparedSpellIds.length ? `Prepare ${loadout.preparedSpellIds.length} spell(s)` : null,
    ].filter((s): s is string => !!s).join('\n');
    Alert.alert(`Apply "${loadout.name}"?`, summary || 'No changes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: () => {
        mutate(e => applyLoadout(e, loadout, itemDefs, rules), `Applied loadout: ${loadout.name}`, 'inventory', STEP_OPERATIONS.equipment);
      } },
    ]);
  }, [entity, homebrewItems, itemName, mutate, rules]);

  const handleDeleteLoadout = useCallback((loadoutId: string) => {
    const loadout = entity?.loadouts?.find(l => l.id === loadoutId);
    Alert.alert('Delete Loadout', `Delete "${loadout?.name ?? 'this loadout'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        mutate(e => deleteLoadout(e, loadoutId), `Deleted loadout: ${loadout?.name ?? loadoutId}`, 'inventory');
      } },
    ]);
  }, [entity, mutate]);

  const handleAddItem = useCallback(async (itemId: string) => {
    await itemRepo.ensureLoaded([itemId]);
    const def = itemRepo.getItemSync(itemId) ?? homebrewItems.find(i => i.id === itemId);
    mutate(e => {
      // Item-identity closure: stack onto an existing carried instance ONLY
      // for a genuinely fungible item (arrows, potions, torches, etc.) —
      // "+ Add Item" on something already in the bag should read as "add
      // one more", matching the ×N badge ItemRow already renders. A
      // STATEFUL item (attunable, weapon/armor/shield, or feature-granting
      // — see isStatefulItem's own doc comment) always gets its OWN new
      // instance/id instead: selecting the same magic-item definition twice
      // must be able to end with two independently-tracked owned copies,
      // never silently merged into one shared quantity row.
      const stateful = isStatefulItem(def);
      const existing = !stateful ? e.inventory.carried.find(i => i.itemId === itemId) : undefined;
      const carried = existing
        ? e.inventory.carried.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
        : [...e.inventory.carried, { id: generateItemInstanceId(), itemId, quantity: 1, attuned: false, features: [] }];
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `Added item: ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName, homebrewItems]);

  // `instanceId` (item-identity closure) — removes that EXACT owned copy.
  // Falls back to removing the first `itemId` match only (never every
  // matching row) when omitted, so a stale/legacy caller can't silently
  // wipe every copy of a shared definition (the exact INV-1-class bug this
  // closure exists to prevent).
  const handleRemoveItem = useCallback((itemId: string, instanceId?: string) => {
    mutate(e => {
      function removeOneMatch(list: ItemInstance[]): ItemInstance[] {
        const index = instanceId
          ? list.findIndex(i => i.id === instanceId)
          : list.findIndex(i => i.itemId === itemId);
        if (index < 0) return list;
        const next = [...list]; next.splice(index, 1); return next;
      }
      // An instance lives in exactly one of equipped/carried — removing
      // from both is safe (whichever doesn't contain it is a no-op), and
      // avoids the caller needing to know which side it's currently on.
      return {
        ...e,
        inventory: {
          ...e.inventory,
          equipped: removeOneMatch(e.inventory.equipped),
          carried:  removeOneMatch(e.inventory.carried),
        },
      };
    }, `Removed item: ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  // +/- stepper on a carried stack's quantity. Dropping to 0 removes it
  // outright — same "gone" result as tapping the ✕ button, just reachable
  // from the stepper too so the player doesn't need both controls.
  // `instanceId` — targets that exact carried row (see handleRemoveItem's
  // own doc comment for why falling back to itemId only ever touches the
  // first match, never every row sharing a definition).
  const handleUpdateQuantity = useCallback((itemId: string, delta: number, instanceId?: string) => {
    mutate(e => {
      const inst = instanceId
        ? e.inventory.carried.find(i => i.id === instanceId)
        : e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      const nextQty = inst.quantity + delta;
      const carried = nextQty <= 0
        ? e.inventory.carried.filter(i => i !== inst)
        : e.inventory.carried.map(i => i === inst ? { ...i, quantity: nextQty } : i);
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `${delta > 0 ? '+' : ''}${delta} ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  // Typed exact quantity (e.g. "you just picked up 20 arrows") — same
  // 0-removes-the-stack behavior as the +/- stepper above.
  const handleSetQuantity = useCallback((itemId: string, quantity: number, instanceId?: string) => {
    mutate(e => {
      const inst = instanceId
        ? e.inventory.carried.find(i => i.id === instanceId)
        : e.inventory.carried.find(i => i.itemId === itemId);
      if (!inst) return e;
      const carried = quantity <= 0
        ? e.inventory.carried.filter(i => i !== inst)
        : e.inventory.carried.map(i => i === inst ? { ...i, quantity } : i);
      return { ...e, inventory: { ...e.inventory, carried } };
    }, `Set ${itemName(itemId)} quantity to ${quantity}`, 'inventory');
  }, [mutate, itemName]);

  // Item-identity closure (pass 2, finding B): targets the EXACT selected
  // ItemInstance by `instanceId` — the picker (InfuseItemModal,
  // TabInventory.tsx) now selects a real owned instance, not merely a
  // definition, so two eligible rows sharing `itemId` are independently
  // targetable. Falls back to the first `itemId` match only when
  // `instanceId` is genuinely absent (defensive — shouldn't happen once an
  // instance has gone through boot/import hydration).
  const handleApplyInfusion = useCallback((itemId: string, infusionId: string, damageType: string | undefined, instanceId?: string) => {
    mutate(e => {
      const infusion = getInfusion(infusionId);
      if (!infusion) return e;
      const cap = infusionCapacity(e);
      const infusedCount = [...e.inventory.equipped, ...e.inventory.carried].filter(i => i.infusedWith).length;
      if (infusedCount >= cap) return e;

      // player's chosen damage type before the feature is appended.
      let feature = infusion.feature;
      if (feature && asksForDamageType(feature) && damageType) {
        feature = {
          ...feature,
          effects: feature.effects.map(eff =>
            eff.target === CHOOSE_DAMAGE_TYPE ? { ...eff, target: damageType } : eff
          ),
        };
      }

      return applyItemInfusion(e, itemId, infusionId, feature ?? null, instanceId);
    }, `Infused ${itemName(itemId)}: ${getInfusion(infusionId)?.name ?? infusionId}`, 'inventory');
  }, [mutate, itemName]);

  const handleRemoveInfusion = useCallback((itemId: string, instanceId?: string) => {
    mutate(e => removeItemInfusion(e, itemId, instanceId), `Removed infusion from ${itemName(itemId)}`, 'inventory');
  }, [mutate, itemName]);

  const handleUpdateCurrency = useCallback((currency: import('../../../engine/types').Currency) => {
    mutate(e => ({ ...e, inventory: { ...e.inventory, currency } }), 'Updated currency', 'inventory');
  }, [mutate]);
  return {
    equipPreview, setEquipPreview, handleEquip, handleUnequip, confirmEquipPreview, handleSetMode, handleToggleAttune, handleSaveLoadout,
    handleApplyLoadout, handleDeleteLoadout, handleAddItem, handleRemoveItem, handleUpdateQuantity, handleSetQuantity, handleApplyInfusion,
    handleRemoveInfusion, handleUpdateCurrency, handleSetItemChoices,
  };
}
