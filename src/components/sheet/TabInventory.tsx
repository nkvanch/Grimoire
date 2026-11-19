// src/components/sheet/TabInventory.tsx
// Tab — Equipped items, carried items, currency.
// Supports adding items from the content DB (or homebrew),
// removing items, and adjusting money per denomination.
// Large creature rules are surfaced when the character is Large-sized.
import { useState, useMemo, memo } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { Pressable, TextInput } from '../AccessibleControls';
import { Entity, ItemInstance, Item, Currency, CampaignRules } from '../../engine/types';
import { Alert } from '../../utils/alert';
import { applyStatModifiers, collectAllEffects } from '../../engine/pipeline';
import { resolveItemById } from '../../content/contentResolution';
import { useHomebrewStore } from '../../store/homebrewStore';
import { usesLargeCreatureWeaponDice } from '../../engine/houseRules';
import { infusions } from '../../content/runtimeRules';
import { infusionCapacity } from '../../engine/infusionCapacity';
import { isLargeCreature as engineIsLargeCreature } from '../../engine/actionCards';
import { itemRequiresAttunement, attunementCap, countAttuned } from '../../engine/inventory';
import { Colors } from '../../theme';
import { NAME_INPUT } from '../nameInput';
import { styles } from './inventoryStyles';
import { AddItemModal } from './AddItemModal';
import { COIN_KEYS, COIN_COLORS, CurrencyModal } from './CurrencyModal';
import { InfuseItemModal } from './InfuseItemModal';
import { ItemRow } from './ItemRow';

// ── Large creature detection ───────────────────────────────────────────────────

// The engine's own check: Large when the species or subspecies record says so, or a feature makes the character count as Large.
const isLargeCreature = (entity: Entity): boolean => engineIsLargeCreature(entity, useHomebrewStore.getState().getMergedContentDB().races);

// ── Main Tab ───────────────────────────────────────────────────────────────────

interface Props {
  entity:            Entity;
  /** `instanceId` (item-identity closure) — the EXACT owned copy this row
   *  represents (ItemInstance.id), since two rows can share `itemId`.
   *  Always passed from this file's own row callbacks below. */
  onEquip:           (itemId: string, instanceId?: string) => void;
  onUnequip:         (itemId: string, instanceId?: string) => void;
  onAddItem:         (itemId: string) => void;
  onRemoveItem:      (itemId: string, instanceId?: string) => void;
  /** +/- stepper on a carried stack — delta is +1 or -1. Not offered for
   * equipped items (stacking multiple of a worn/wielded item doesn't mean
   * anything the sheet tracks). */
  onUpdateQuantity:  (itemId: string, delta: number, instanceId?: string) => void;
  /** Jump straight to an exact carried-stack count (typed, not tapped). */
  onSetQuantity:     (itemId: string, quantity: number, instanceId?: string) => void;
  onUpdateCurrency:  (currency: Currency) => void;
  /** Active campaign rules — used to honour homebrew toggles (e.g. large-creature dice). */
  rules?:            CampaignRules;
  onApplyInfusion?:  (itemId: string, infusionId: string, damageType: string | undefined, instanceId: string) => void;
  onRemoveInfusion?: (itemId: string, instanceId?: string) => void;
  onToggleAttune?:   (itemId: string, instanceId?: string, overrule?: boolean) => void;
  /** Item 13 (loadouts) — save/apply/delete a named (equipped items,
   *  prepared spells) snapshot. Omitted entirely hides the section (same
   *  optional-prop pattern as onApplyInfusion). */
  onSaveLoadout?:    (name: string) => void;
  onApplyLoadout?:   (loadoutId: string) => void;
  onDeleteLoadout?:  (loadoutId: string) => void;
  /** Customise one owned copy (see ItemCustomizeModal). */
  onCustomizeItem?:  (instance: ItemInstance) => void;
  /** Switches a mode of an owned item's feature (engine/featureModes.ts). */
  onSetMode?:        (key: string, modeId: string, label: string) => void;
  /** The owner's choice on an item whose record leaves it open: a base armor, a +1/+2/+3 bonus (engine/inventory.ts setItemChoices). */
  onSetItemChoices?: (itemId: string, instanceId: string, choices: import('../../engine/inventory').ItemChoices) => void;
}

function TabInventoryInner({
  entity, onEquip, onUnequip, onAddItem, onRemoveItem, onUpdateQuantity, onSetQuantity, onUpdateCurrency, rules,
  onApplyInfusion, onRemoveInfusion, onToggleAttune, onSaveLoadout, onApplyLoadout, onDeleteLoadout, onCustomizeItem, onSetMode, onSetItemChoices,
}: Props) {
  const { inventory } = entity;
  const { currency }  = inventory;
  const [addOpen,    setAddOpen]    = useState(false);
  const [currOpen,   setCurrOpen]   = useState(false);
  const [infuseOpen, setInfuseOpen] = useState(false);
  const [loadoutName, setLoadoutName] = useState('');
  const knownInfusionIds = entity.knownInfusionIds ?? [];

  const homebrewItemList = useHomebrewStore(s => s.items);
  // Full records — only for equipped/carried instance ids (already warmed
  // via characterStore.ts's loadCharacters()/handleEquip/handleAddItem).
  // NOT the whole catalog — that's what itemRepo.getIndex() (Tier 1) is for,
  // used by AddItemModal. resolveItemById gives homebrew-first precedence —
  // see contentResolution.ts.
  const instanceIds = new Set([...inventory.equipped, ...inventory.carried].map(i => i.itemId));
  const allItems: Item[] = Array.from(instanceIds)
    // A record found through the other edition's id (a 2014 character's scholars_pack answered by scholars_pack_2024)
    // is keyed back to the id the character carries, or every lookup below misses it and the row shows the raw id.
    .map(id => { const it = resolveItemById(id, homebrewItemList); return it && it.id !== id ? { ...it, id } : it; })
    .filter((i): i is Item => !!i);

  const large          = isLargeCreature(entity);
  // Effective STR (race/feat bonuses) — matches the engine's derived values,
  // not the raw base score. Memoized (ITEMS-PERF-3): was recomputed
  // (full effect-collection pass over entity.features) on every render of
  // this tab, including renders triggered by unrelated local state
  // (currOpen/infuseOpen/loadoutName toggles) that don't touch stats/effects.
  const effectiveStr  = useMemo(
    () => applyStatModifiers(entity.stats, collectAllEffects(entity)).str,
    [entity],
  );
  const carryCapacity  = effectiveStr * (large ? 30 : 15);
  const totalWeight    = [...inventory.equipped, ...inventory.carried].reduce((sum, inst) => {
    const def = allItems.find(i => i.id === inst.itemId);
    return sum + (def?.weight ?? 0) * inst.quantity;
  }, 0);
  const weightPct  = carryCapacity > 0 ? totalWeight / carryCapacity : 0;
  const weightColor = weightPct > 1 ? Colors.red : weightPct >= 0.75 ? Colors.gold : Colors.green;

  const equippedIds = new Set(inventory.equipped.map(i => i.itemId));
  const carriedIds  = new Set(inventory.carried.map(i => i.itemId));

  const attunedCount = countAttuned(entity);
  const attuneCap    = attunementCap(entity);

  function handleAttuneToggle(inst: ItemInstance) {
    if (!onToggleAttune) return;
    if (!inst.attuned && attunedCount >= attuneCap) {
      Alert.alert('Attunement Full', `You're already attuned to ${attuneCap} item${attuneCap === 1 ? '' : 's'}. Un-attune from one first, or overrule to attune one more.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Overrule', onPress: () => onToggleAttune(inst.itemId, inst.id, true) },
      ]);
      return;
    }
    onToggleAttune(inst.itemId, inst.id);
  }

  function confirmRemove(inst: ItemInstance) {
    const item = allItems.find(i => i.id === inst.itemId);
    Alert.alert('Remove Item', `Remove ${item?.name ?? inst.itemId} from your inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemoveItem(inst.itemId, inst.id) },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Carry Weight */}
      <View style={styles.section}>
        <View style={styles.weightHeader}>
          <Text style={styles.sectionTitle}>WEIGHT</Text>
          <Text style={[styles.weightValue, { color: weightColor }]}>
            {Math.round(totalWeight * 10) / 10} / {carryCapacity} lbs
          </Text>
        </View>
        <View style={styles.weightBarOuter}>
          <View style={[styles.weightBarFill, {
            width: `${Math.round(Math.min(1, weightPct) * 100)}%` as any,
            backgroundColor: weightColor,
          }]} />
        </View>
        {weightPct > 1 && <Text style={styles.overweight}>⚠ Encumbered — over carry capacity</Text>}
        {large && (
          <Text style={styles.largePCNote}>
            🦴 Large creature — carry capacity doubled (STR × 30).
            {rules && usesLargeCreatureWeaponDice(rules)
              ? ' Homebrew: this creature rolls double weapon damage dice with appropriately sized weapons.'
              : ' (Standard rules: weapon damage dice are unaffected by size.)'}
          </Text>
        )}
      </View>

      {/* Currency */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CURRENCY</Text>
          <Pressable style={styles.editCurrBtn} onPress={() => setCurrOpen(true)}>
            <Text style={styles.editCurrTxt}>Edit</Text>
          </Pressable>
        </View>
        <View style={styles.currencyRow}>
          {COIN_KEYS.map(key => (
            <View key={key} style={styles.coinBox}>
              <Text style={[styles.coinValue, { color: COIN_COLORS[key] }]}>{currency[key]}</Text>
              <Text style={styles.coinLabel}>{key.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Attunement — only shown once the character owns something that needs it */}
      {[...inventory.equipped, ...inventory.carried].some(inst => itemRequiresAttunement(allItems.find(i => i.id === inst.itemId))) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ATTUNEMENT ({attunedCount}/{attuneCap})</Text>
        </View>
      )}

      {/* Infusions — only shown for classes that know at least one (Artificer) */}
      {onApplyInfusion && knownInfusionIds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              INFUSIONS ({[...inventory.equipped, ...inventory.carried].filter(i => i.infusedWith).length}/{infusionCapacity(entity)})
            </Text>
            <Pressable style={styles.addBtn} onPress={() => setInfuseOpen(true)}>
              <Text style={styles.addBtnTxt}>+ Infuse Item</Text>
            </Pressable>
          </View>
          <Text style={styles.emptyNote}>
            Known: {knownInfusionIds.map(id => infusions().find(i => i.id === id)?.name ?? id).join(', ')}
          </Text>
        </View>
      )}

      {/* Loadouts (item 13) — named saved (equipped items, prepared
          spells) snapshots the player can swap between. Only shown when
          the parent screen wires the callbacks (mirrors onApplyInfusion's
          optional-prop pattern). */}
      {onSaveLoadout && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>LOADOUTS ({(entity.loadouts ?? []).length})</Text>
          </View>
          <View style={styles.loadoutSaveRow}>
            <TextInput {...NAME_INPUT}
              style={styles.loadoutInput}
              value={loadoutName}
              onChangeText={setLoadoutName}
              placeholder="e.g. Dungeon, Social…"
              placeholderTextColor={Colors.textDim}
            />
            <Pressable
              style={[styles.addBtn, !loadoutName.trim() && styles.addBtnDisabled]}
              disabled={!loadoutName.trim()}
              onPress={() => { onSaveLoadout(loadoutName.trim()); setLoadoutName(''); }}
            >
              <Text style={styles.addBtnTxt}>💾 Save Current</Text>
            </Pressable>
          </View>
          {(entity.loadouts ?? []).length === 0 ? (
            <Text style={styles.emptyNote}>No saved loadouts yet</Text>
          ) : (
            (entity.loadouts ?? []).map(l => (
              <View key={l.id} style={styles.loadoutRow}>
                <View style={styles.loadoutInfo}>
                  <Text style={styles.loadoutName}>{l.name}</Text>
                  <Text style={styles.loadoutMeta}>
                    {l.equippedItemIds.length} equipped · {l.preparedSpellIds.length} prepared
                  </Text>
                </View>
                <Pressable style={styles.loadoutBtn} onPress={() => onApplyLoadout?.(l.id)}>
                  <Text style={styles.loadoutBtnTxt}>Apply</Text>
                </Pressable>
                <Pressable style={styles.loadoutBtnDelete} onPress={() => onDeleteLoadout?.(l.id)}>
                  <Text style={styles.loadoutBtnDeleteTxt}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* Equipped */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>EQUIPPED ({inventory.equipped.length})</Text>
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Item</Text>
          </Pressable>
        </View>
        {inventory.equipped.length === 0 ? (
          <Text style={styles.emptyNote}>Nothing equipped</Text>
        ) : (
          inventory.equipped.map((inst, idx) => (
            <ItemRow
              key={inst.id ?? `eq_${inst.itemId}_${idx}`}
              instance={inst}
              equipped
              allItems={allItems}
              onToggle={() => onUnequip(inst.itemId, inst.id)}
              onRemove={() => confirmRemove(inst)}
              onRemoveInfusion={onRemoveInfusion ? () => onRemoveInfusion(inst.itemId, inst.id) : undefined}
              onToggleAttune={onToggleAttune ? () => handleAttuneToggle(inst) : undefined}
              onCustomize={onCustomizeItem ? () => onCustomizeItem(inst) : undefined}
              modeState={entity}
              onSetMode={onSetMode}
              onSetItemChoices={onSetItemChoices && inst.id ? choices => onSetItemChoices(inst.itemId, inst.id!, choices) : undefined}
            />
          ))
        )}
      </View>

      {/* Carried */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CARRIED ({inventory.carried.length})</Text>
          {inventory.equipped.length > 0 ? null : (
            <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
              <Text style={styles.addBtnTxt}>+ Add Item</Text>
            </Pressable>
          )}
        </View>
        {inventory.carried.length === 0 ? (
          <Text style={styles.emptyNote}>Bag is empty — tap + Add Item to add gear</Text>
        ) : (
          inventory.carried.map((inst, idx) => (
            <ItemRow
              key={inst.id ?? `ca_${inst.itemId}_${idx}`}
              instance={inst}
              equipped={false}
              allItems={allItems}
              onToggle={() => onEquip(inst.itemId, inst.id)}
              onRemove={() => confirmRemove(inst)}
              onRemoveInfusion={onRemoveInfusion ? () => onRemoveInfusion(inst.itemId, inst.id) : undefined}
              onQuantityChange={delta => onUpdateQuantity(inst.itemId, delta, inst.id)}
              onSetQuantity={qty => onSetQuantity(inst.itemId, qty, inst.id)}
              onToggleAttune={onToggleAttune ? () => handleAttuneToggle(inst) : undefined}
              onCustomize={onCustomizeItem ? () => onCustomizeItem(inst) : undefined}
              modeState={entity}
              onSetMode={onSetMode}
              onSetItemChoices={onSetItemChoices && inst.id ? choices => onSetItemChoices(inst.itemId, inst.id!, choices) : undefined}
            />
          ))
        )}
        {/* Always show Add Item in carried section when bag is empty */}
        {inventory.carried.length === 0 && inventory.equipped.length > 0 && (
          <Pressable style={styles.addItemRow} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Add Item to bag</Text>
          </Pressable>
        )}
      </View>

      {/* ITEMS-PERF-1: was unconditionally mounted with only `visible` gating
          RN Modal's native visibility — the component body (full ~891-item
          catalog merge + 27-category classification pass + sort, none of it
          memoized) still ran on every TabInventory render regardless of
          whether the picker was open. Gating the element itself means that
          work only happens while the picker is actually open. */}
      {addOpen && (
        <AddItemModal
          visible={addOpen}
          entityRulesetId={entity.rulesetId}
          equippedIds={equippedIds}
          carriedIds={carriedIds}
          onAdd={onAddItem}
          onClose={() => setAddOpen(false)}
        />
      )}

      <CurrencyModal
        visible={currOpen}
        currency={currency}
        onSave={onUpdateCurrency}
        onClose={() => setCurrOpen(false)}
      />

      {onApplyInfusion && (
        <InfuseItemModal
          visible={infuseOpen}
          entity={entity}
          allItems={allItems}
          onApply={onApplyInfusion}
          onClose={() => setInfuseOpen(false)}
        />
      )}

    </ScrollView>
  );
}

// EDIT-PERF-1: see TabCharacter.tsx's identical comment.
export const TabInventory = memo(TabInventoryInner);
