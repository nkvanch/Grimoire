import { useState } from 'react';
import { View, Text } from 'react-native';
import { infusions } from '../../content/runtimeRules';
import { modeKey } from '../../engine/featureModes';
import { itemRequiresAttunement, baseArmorChoices, bonusChoices } from '../../engine/itemMechanics';
import type { ItemChoices } from '../../engine/inventory';
import { BASE_ARMOR_AC } from '../../engine/ruleset/dnd5e';
import { ItemInstance, Item, Entity } from '../../engine/types';
import { Pressable, TextInput } from '../AccessibleControls';
import { RecordIcon } from '../RecordPicture';
import { styles } from './inventoryStyles';
import { ModeSwitch } from './ModeSwitch';

// ── Item Row ───────────────────────────────────────────────────────────────────

export function ItemRow({
  instance, equipped, allItems, onToggle, onRemove, onRemoveInfusion, onQuantityChange, onSetQuantity,
  onToggleAttune, onCustomize, modeState, onSetMode, onSetItemChoices,
}: {
  instance: ItemInstance;
  equipped: boolean;
  allItems: Item[];
  onToggle: () => void;
  onRemove: () => void;
  onRemoveInfusion?: () => void;
  /** Carried-only — equipped rows don't get a stepper (see Props.onUpdateQuantity). */
  onQuantityChange?: (delta: number) => void;
  /** Carried-only — jump straight to an exact count (a stack of 20 arrows
   * doesn't want 20 taps of the +1 stepper). Committed on blur/submit, same
   * pattern as the Abilities tab's manual-bonus inputs. */
  onSetQuantity?: (quantity: number) => void;
  /** Present only when the item's definition requires attunement — the cap
   * check/explanatory Alert lives in the parent (it needs the whole
   * inventory to count), this just renders the toggle and calls back. */
  onToggleAttune?: () => void;
  /** Opens the customise pop-up for this owned copy (name, description, uses, ability changes). */
  onCustomize?: () => void;
  /** The character's active modes, and switching one (engine/featureModes.ts); a feature with modes shows its switch. */
  modeState?: Pick<Entity, 'featureModes'>;
  onSetMode?: (key: string, modeId: string, label: string) => void;
  /** The owner's choice on an item whose record leaves it open: a base armor (Adamantine Armor), a bonus ("Armor, +1, +2, or +3"). */
  onSetItemChoices?: (choices: ItemChoices) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const item  = allItems.find(i => i.id === instance.itemId);
  const name  = item?.name ?? instance.itemId;
  const props = item?.properties ?? [];
  const desc  = item?.features?.[0]?.description;
  const infusion = instance.infusedWith ? infusions().find(i => i.id === instance.infusedWith) : null;
  const needsAttunement = itemRequiresAttunement(item);
  const baseChoices = item && onSetItemChoices ? baseArmorChoices(item) : null;
  const bonuses = item && onSetItemChoices ? bonusChoices(item) : null;
  const title = (k: string) => k.replace(/\b\w/g, c => c.toUpperCase());

  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemRow}>
        <Pressable style={styles.itemMain} onPress={() => setExpanded(e => !e)}>
          <RecordIcon record={item} size={36} />
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{name}</Text>
            {props.length > 0 && (
              <Text style={styles.itemProps} numberOfLines={expanded ? undefined : 1}>
                {props.join(' · ')}
              </Text>
            )}
            {instance.quantity > 1 && (
              <Text style={styles.itemQty}>×{instance.quantity}</Text>
            )}
            {infusion && (
              <Text style={styles.itemInfused}>✨ Infused: {infusion.name}</Text>
            )}
            {needsAttunement && (
              <Text style={styles.itemAttunement}>{instance.attuned ? '🔗 Attuned' : '⚬ Requires attunement'}</Text>
            )}
          </View>
          <Text style={styles.expandCaret}>{expanded ? '▲' : '▼'}</Text>
        </Pressable>
        {needsAttunement && onToggleAttune && (
          <Pressable
            style={[styles.attuneBtn, instance.attuned && styles.attuneBtnActive]}
            onPress={onToggleAttune}
            hitSlop={8}
          >
            <Text style={[styles.attuneTxt, instance.attuned && styles.attuneTxtActive]}>
              {instance.attuned ? 'Attuned' : 'Attune'}
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.toggleBtn, equipped && styles.toggleBtnEquipped]}
          onPress={onToggle}
        >
          <Text style={[styles.toggleTxt, equipped && styles.toggleTxtEquipped]}>
            {equipped ? 'Unequip' : 'Equip'}
          </Text>
        </Pressable>
        <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeTxt}>✕</Text>
        </Pressable>
      </View>
      {baseChoices && onSetItemChoices && (
        <ChoicePick
          label="Base armor" chosen={instance.baseArmor} pending="Choose base armor (no AC until chosen)" itemName={name}
          options={baseChoices.map(k => ({ key: k, label: `${title(k)} · AC ${BASE_ARMOR_AC[k].ac}${BASE_ARMOR_AC[k].dexCap === null ? ' + Dex' : BASE_ARMOR_AC[k].dexCap ? ` + Dex (max ${BASE_ARMOR_AC[k].dexCap})` : ''}` }))}
          shown={k => title(k)} onPick={k => onSetItemChoices({ baseArmor: k })}
        />
      )}
      {bonuses && onSetItemChoices && (
        <ChoicePick
          label="Bonus" chosen={instance.magicBonus !== undefined ? String(instance.magicBonus) : undefined}
          pending={`Choose its bonus (+${bonuses[0]} until chosen)`} itemName={name}
          options={bonuses.map(n => ({ key: String(n), label: `+${n}` }))} shown={k => `+${k}`}
          onPick={k => onSetItemChoices({ magicBonus: parseInt(k, 10) })}
        />
      )}
      {modeState && onSetMode && (item?.features ?? []).map(f => (
        <ModeSwitch key={`mode-${f.id}`} feature={f} entity={modeState} modeKey={modeKey(f.id, instance.id)} onSet={onSetMode} />
      ))}
      {expanded && desc && (
        <View style={styles.itemDesc}>
          <Text style={styles.itemDescTxt}>{desc}</Text>
        </View>
      )}
      {expanded && onQuantityChange && (
        <View style={styles.qtyStepperRow}>
          <Text style={styles.qtyStepperLabel}>Quantity</Text>
          <View style={styles.qtyStepper}>
            <Pressable style={styles.qtyBtn} onPress={() => onQuantityChange(-1)} hitSlop={8}>
              <Text style={styles.qtyBtnTxt}>−</Text>
            </Pressable>
            {onSetQuantity ? (
              <TextInput
                key={instance.quantity}
                style={styles.qtyInput}
                defaultValue={String(instance.quantity)}
                keyboardType="number-pad"
                onEndEditing={e => {
                  const n = parseInt(e.nativeEvent.text, 10);
                  if (!isNaN(n) && n >= 0) onSetQuantity(n);
                }}
                onBlur={e => {
                  // react-native-web doesn't fire onEndEditing on blur (only
                  // native does) — read the live DOM value instead.
                  const raw = (e.target as unknown as { value?: string })?.value;
                  const n = raw !== undefined ? parseInt(raw, 10) : NaN;
                  if (!isNaN(n) && n >= 0) onSetQuantity(n);
                }}
              />
            ) : (
              <Text style={styles.qtyValue}>{instance.quantity}</Text>
            )}
            <Pressable style={styles.qtyBtn} onPress={() => onQuantityChange(1)} hitSlop={8}>
              <Text style={styles.qtyBtnTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      )}
      {expanded && onCustomize && (
        <Pressable style={styles.customizeBtn} onPress={onCustomize} accessibilityRole="button" accessibilityLabel={`Customize ${name}`}>
          <Text style={styles.customizeTxt}>✎ Customize: name, description, uses, ability scores</Text>
        </Pressable>
      )}
      {expanded && infusion && onRemoveInfusion && (
        <Pressable style={styles.removeInfusionBtn} onPress={onRemoveInfusion}>
          <Text style={styles.removeInfusionTxt}>Remove Infusion</Text>
        </Pressable>
      )}
    </View>
  );
}

/** One choice the owner makes on an item (its base armor, its bonus): the current pick, or a prompt, opening the list. */
function ChoicePick({ label, chosen, pending, itemName, options, shown, onPick }: {
  label: string; chosen: string | undefined; pending: string; itemName: string;
  options: { key: string; label: string }[]; shown: (key: string) => string; onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.baseArmorBox}>
      <Pressable style={styles.baseArmorBtn} onPress={() => setOpen(o => !o)}
        accessibilityLabel={chosen ? `${label} ${shown(chosen)}, change` : `Choose the ${label.toLowerCase()} of ${itemName}`}>
        <Text style={chosen ? styles.baseArmorTxt : styles.baseArmorTxtNeeded}>
          {chosen ? `${label}: ${shown(chosen)}` : pending} {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.baseArmorList}>
          {options.map(o => (
            <Pressable key={o.key} style={[styles.baseArmorOption, chosen === o.key && styles.baseArmorOptionOn]}
              onPress={() => { onPick(o.key); setOpen(false); }} accessibilityState={{ selected: chosen === o.key }}>
              <Text style={[styles.baseArmorOptionTxt, chosen === o.key && styles.baseArmorOptionTxtOn]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
