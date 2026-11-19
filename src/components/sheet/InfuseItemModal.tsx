import { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { infusions } from '../../content/runtimeRules';
import { infusionCapacity } from '../../engine/infusionCapacity';
import { asksForDamageType } from '../../engine/infusionRules';
import { Entity, Item } from '../../engine/types';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { addStyles, infuseStyles } from './inventoryStyles';

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];

// ── Infuse Item Modal ───────────────────────────────────────────────────────────

export function InfuseItemModal({
  visible, entity, allItems, onApply, onClose,
}: {
  visible:  boolean;
  entity:   Entity;
  allItems: Item[];
  /** `instanceId` (item-identity closure, pass 2 finding B) — the EXACT
   *  owned copy selected below, since two eligible rows can share `itemId`.
   *  `itemId` is still passed alongside for display/definition-lookup
   *  convenience at the handler (unchanged contract there). */
  onApply:  (itemId: string, infusionId: string, damageType: string | undefined, instanceId: string) => void;
  onClose:  () => void;
}) {
  const known = entity.knownInfusionIds ?? [];
  const knownInfusions = infusions().filter(i => known.includes(i.id));
  const [selectedInfusion, setSelectedInfusion] = useState<string | null>(null);
  // Item-identity closure: selects the OWNED INSTANCE, not the definition —
  // storing `inst.itemId` here made two eligible same-definition rows
  // impossible to tell apart (both highlighted together, and Infuse always
  // targeted whichever instance a plain `.find(itemId)` happened to hit
  // first at the handler).
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [damageType, setDamageType] = useState<string>('fire');

  const cap = infusionCapacity(entity);
  const infusedInstances = [...entity.inventory.equipped, ...entity.inventory.carried].filter(i => i.infusedWith);
  const atCap = infusedInstances.length >= cap;
  // Item-identity closure: tag each candidate with WHICH side it's on so
  // two identical-definition rows (one equipped, one carried) at least
  // show a small disambiguator, per this app's "tiny label is enough,
  // independent row selection is the real requirement" UI convention.
  const ownedInstances = [
    ...entity.inventory.equipped.map(i => ({ inst: i, equippedLabel: true })),
    ...entity.inventory.carried.map(i => ({ inst: i, equippedLabel: false })),
  ].filter(({ inst }) => !inst.infusedWith);
  const selectedInstance = ownedInstances.find(({ inst }) => (inst.id ?? inst.itemId) === selectedInstanceId)?.inst;

  function reset() {
    setSelectedInfusion(null);
    setSelectedInstanceId(null);
    setDamageType('fire');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleApply() {
    if (!selectedInfusion || !selectedInstance || atCap) return;
    const instanceId = selectedInstance.id ?? selectedInstance.itemId;
    onApply(selectedInstance.itemId, selectedInfusion, asksForDamageType(knownInfusions.find(i => i.id === selectedInfusion)?.feature) ? damageType : undefined, instanceId);
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={addStyles.backdrop}>
        {/* SCROLL-TOUCH-1: backdrop is a sibling, not an ancestor, of the sheet (see TabInventory AddItemModal) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessible={false} />
        <View style={addStyles.sheet}>
          <Text style={addStyles.title}>Infuse an Item</Text>
          <Text style={infuseStyles.capNote}>{infusedInstances.length}/{cap} items currently infused</Text>
          {atCap && <Text style={infuseStyles.warn}>At capacity — remove an infusion before adding another.</Text>}

          <Text style={infuseStyles.stepLabel}>1. Choose infusion</Text>
          <ScrollView style={infuseStyles.pickList}>
            {knownInfusions.map(inf => (
              <Pressable
                key={inf.id}
                style={[infuseStyles.row, selectedInfusion === inf.id && infuseStyles.rowSelected]}
                onPress={() => setSelectedInfusion(inf.id)}
              >
                <Text style={infuseStyles.rowTxt}>{inf.name}{!inf.feature ? ' (flavor-only)' : ''}</Text>
              </Pressable>
            ))}
            {knownInfusions.length === 0 && <Text style={addStyles.empty}>No infusions known yet.</Text>}
          </ScrollView>

          {asksForDamageType(knownInfusions.find(i => i.id === selectedInfusion)?.feature) && (
            <>
              <Text style={infuseStyles.stepLabel}>Damage type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={addStyles.chipRowContent}>
                {DAMAGE_TYPES.map(dt => (
                  <Pressable
                    key={dt}
                    style={[addStyles.chip, damageType === dt && addStyles.chipActive]}
                    onPress={() => setDamageType(dt)}
                  >
                    <Text style={[addStyles.chipTxt, damageType === dt && addStyles.chipTxtActive]}>{dt}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={infuseStyles.stepLabel}>2. Choose item</Text>
          <ScrollView style={infuseStyles.pickList}>
            {ownedInstances.map(({ inst, equippedLabel }, idx) => {
              const def = allItems.find(i => i.id === inst.itemId);
              const instanceKey = inst.id ?? inst.itemId;
              return (
                <Pressable
                  key={inst.id ?? `${inst.itemId}_${idx}`}
                  style={[infuseStyles.row, selectedInstanceId === instanceKey && infuseStyles.rowSelected]}
                  onPress={() => setSelectedInstanceId(instanceKey)}
                >
                  <Text style={infuseStyles.rowTxt}>{def?.name ?? inst.itemId} {equippedLabel ? '(equipped)' : '(carried)'}</Text>
                </Pressable>
              );
            })}
            {ownedInstances.length === 0 && <Text style={addStyles.empty}>No un-infused items to choose from.</Text>}
          </ScrollView>

          <Pressable
            style={[addStyles.quickAddBtn, (!selectedInfusion || !selectedInstance || atCap) && addStyles.quickAddBtnDisabled]}
            disabled={!selectedInfusion || !selectedInstance || atCap}
            onPress={handleApply}
          >
            <Text style={addStyles.quickAddBtnTxt}>Infuse Item</Text>
          </Pressable>
          <Pressable style={addStyles.cancelBtn} onPress={handleClose}>
            <Text style={addStyles.cancelTxt}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
