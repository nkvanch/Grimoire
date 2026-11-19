import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { SpellPaymentOption } from '../../../engine/spellPayment';
import { Entity, CampaignRules, DurationTracker, Currency, ItemInstance } from '../../../engine/types';
import { reportFailure } from '../../../utils/alert';
import { Pressable } from '../../AccessibleControls';
import { TabAbilities } from '../TabAbilities';
import { TabActions } from '../TabActions';
import { TabCharacter } from '../TabCharacter';
import { TabExploration } from '../TabExploration';
import { TabFeatures } from '../TabFeatures';
import { TabInventory } from '../TabInventory';
import { TabNotes } from '../TabNotes';
import { TabSpells } from '../TabSpells';
import { TabId } from './sheetScreenModel';
import { styles } from './sheetScreenStyles';

export function SheetTabContent({
  tabId, sheetMode, setSheetMode, entity, rules, isDm, campaignId, deviceId, handleDamage, handleHeal, handleAddCondition,
  handleRemoveCondition, handleResourceChange, handleSpendSlot, handleRestoreSlot, handleEndConcentration, onCombatEntityUpdate,
  handleEndTurn, onExplorationEntityUpdate, handleSaveExplorationNotes, onActionsEntityUpdate, onSpellsEntityUpdate,
  onAbilitiesEntityUpdate, freeEditAllowed, onFeaturesEntityUpdate, handleEquip, handleUnequip, handleAddItem, handleRemoveItem,
  handleUpdateQuantity, handleSetQuantity, handleUpdateCurrency, handleApplyInfusion, handleRemoveInfusion, handleToggleAttune,
  handleSetMode, handleSetItemChoices, handleSaveLoadout, handleApplyLoadout, handleDeleteLoadout, handleCustomizeItem, handleSaveNotes,
}: {
  tabId: TabId;
  sheetMode: "combat" | "exploration";
  setSheetMode: Dispatch<SetStateAction<"combat" | "exploration">>;
  entity: Entity;
  rules: CampaignRules;
  isDm: boolean;
  campaignId: string;
  deviceId: string;
  handleDamage: (amount: number, damageType?: string, isNonmagicalAttack?: boolean) => void;
  handleHeal: (amount: number) => void;
  handleAddCondition: (condId: string, duration: DurationTracker | null) => void;
  handleRemoveCondition: (condId: string) => void;
  handleResourceChange: (resourceId: string, delta: number) => void;
  handleSpendSlot: (tier: string, kind?: SpellPaymentOption["kind"]) => void;
  handleRestoreSlot: (tier: string, kind?: SpellPaymentOption["kind"]) => void;
  handleEndConcentration: (spellName: string) => void;
  onCombatEntityUpdate: (updated: Entity) => void;
  handleEndTurn: () => void;
  onExplorationEntityUpdate: (updated: Entity) => void;
  handleSaveExplorationNotes: (notes: string) => void;
  onActionsEntityUpdate: (updated: Entity) => void;
  onSpellsEntityUpdate: (updated: Entity, label?: string) => void;
  onAbilitiesEntityUpdate: (updated: Entity) => void;
  freeEditAllowed: boolean;
  onFeaturesEntityUpdate: (updated: Entity) => void;
  handleEquip: (itemId: string, instanceId?: string) => Promise<void>;
  handleUnequip: (itemId: string, instanceId?: string) => Promise<void>;
  handleAddItem: (itemId: string) => Promise<void>;
  handleRemoveItem: (itemId: string, instanceId?: string) => void;
  handleUpdateQuantity: (itemId: string, delta: number, instanceId?: string) => void;
  handleSetQuantity: (itemId: string, quantity: number, instanceId?: string) => void;
  handleUpdateCurrency: (currency: Currency) => void;
  handleApplyInfusion: (itemId: string, infusionId: string, damageType: string | undefined, instanceId?: string) => void;
  handleRemoveInfusion: (itemId: string, instanceId?: string) => void;
  handleToggleAttune: (itemId: string, instanceId?: string, overrule?: boolean) => void;
  handleSetMode: (key: string, modeId: string, label: string) => void;
  handleSetItemChoices: (itemId: string, instanceId: string, choices: import('../../../engine/inventory').ItemChoices) => void;
  handleSaveLoadout: (name: string) => void;
  handleApplyLoadout: (loadoutId: string) => Promise<void>;
  handleDeleteLoadout: (loadoutId: string) => void;
  handleCustomizeItem: (instance: ItemInstance) => Promise<void>;
  handleSaveNotes: (notes: string) => void;
}) {
  return (
    <>
      {tabId === 'character' && (
        <View style={{ flex: 1 }}>
          {/* Combat / Exploration mode switch */}
          <View style={styles.modeSwitch}>
            {(['combat', 'exploration'] as const).map(m => (
              <Pressable
                key={m}
                style={[styles.modeBtn, sheetMode === m && styles.modeBtnActive]}
                onPress={() => setSheetMode(m)}
              >
                <Text style={[styles.modeTxt, sheetMode === m && styles.modeTxtActive]}>
                  {m === 'combat' ? '⚔️  Combat' : '🧭  Exploration'}
                </Text>
              </Pressable>
            ))}
          </View>

          {sheetMode === 'combat' ? (
            <TabCharacter
              entity={entity}
              rules={rules}
              isDm={isDm}
              campaignId={campaignId}
              deviceId={deviceId}
              onDamage={handleDamage}
              onHeal={handleHeal}
              onAddCondition={handleAddCondition}
              onRemoveCondition={handleRemoveCondition}
              onResourceChange={handleResourceChange}
              onSpendSlot={handleSpendSlot}
              onRestoreSlot={handleRestoreSlot}
              onEndConcentration={handleEndConcentration}
              onEntityUpdate={onCombatEntityUpdate}
              onEndTurn={handleEndTurn}
            />
          ) : (
            <TabExploration
              entity={entity}
              rules={rules}
              onEntityUpdate={onExplorationEntityUpdate}
              onDamage={handleDamage}
              onHeal={handleHeal}
              onAddCondition={handleAddCondition}
              onRemoveCondition={handleRemoveCondition}
              onSaveExplorationNotes={handleSaveExplorationNotes}
            />
          )}
        </View>
      )}
      {tabId === 'actions' && (
        <TabActions
          entity={entity}
          rules={rules}
          onEntityUpdate={onActionsEntityUpdate}
          onEndTurn={handleEndTurn}
        />
      )}
      {tabId === 'spells' && (
        <TabSpells
          entity={entity}
          rules={rules}
          onEntityUpdate={onSpellsEntityUpdate}
          onEndTurn={handleEndTurn}
          onRestoreSlot={handleRestoreSlot}
          onEndConcentration={handleEndConcentration}
        />
      )}
      {tabId === 'abilities' && (
        <TabAbilities
          entity={entity}
          rules={rules}
          isDm={isDm}
          campaignId={campaignId}
          deviceId={deviceId}
          onEntityUpdate={onAbilitiesEntityUpdate}
          canSetTotals={freeEditAllowed}
        />
      )}
      {tabId === 'features' && (
        <TabFeatures
          entity={entity}
          rules={rules}
          onEntityUpdate={onFeaturesEntityUpdate}
        />
      )}
      {tabId === 'inventory' && (
        <TabInventory
          entity={entity}
          rules={rules}
          onEquip={(...args) => { void handleEquip(...args).catch(reportFailure('equip the item')); }}
          onUnequip={(...args) => { void handleUnequip(...args).catch(reportFailure('unequip the item')); }}
          onAddItem={(...args) => { void handleAddItem(...args).catch(reportFailure('add the item')); }}
          onRemoveItem={handleRemoveItem}
          onUpdateQuantity={handleUpdateQuantity}
          onSetQuantity={handleSetQuantity}
          onUpdateCurrency={handleUpdateCurrency}
          onApplyInfusion={handleApplyInfusion}
          onRemoveInfusion={handleRemoveInfusion}
          onToggleAttune={handleToggleAttune}
          onSetMode={handleSetMode}
          onSetItemChoices={handleSetItemChoices}
          onSaveLoadout={handleSaveLoadout}
          onApplyLoadout={(...args) => { void handleApplyLoadout(...args).catch(reportFailure('apply the loadout')); }}
          onDeleteLoadout={handleDeleteLoadout}
          onCustomizeItem={(inst) => { void handleCustomizeItem(inst).catch(reportFailure('open the item')); }}
        />
      )}
      {tabId === 'notes' && (
        <TabNotes notes={entity.notes} onSave={handleSaveNotes} />
      )}
    </>
  );
}
