// app/sheet/[id].tsx
// Character sheet — 6-tab sheet with persistent rest bar.
// All values read from entity.derived — never computed in components.
import { useLayout } from '../../src/platform/layout';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { ScrollView } from '../../src/components/Lists';
import { Pressable } from '../../src/components/AccessibleControls';
import { useLocalSearchParams } from 'expo-router';
import { useCharacterStore } from '../../src/store/characterStore';
import { useCustomRuleProfileStore } from '../../src/store/customRuleProfileStore';
import { sheetRuleAccess } from '../../src/components/sheet/ruleProfileUi';
import { freeEditUiModel } from '../../src/components/sheet/sheetUiModel';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { useLastCharacterStore } from '../../src/store/lastCharacterStore';
import { Alert } from '../../src/utils/alert';
import { STEP_OPERATIONS, versionNotes, pinToInstalled } from '../../src/store/pinningService';
import { characterInfoRows } from '../../src/content/characterInfo';
import { customizedItem, moveOwnedItem, type ItemEdits } from '../../src/engine/itemCustomize';
import { useCampaignStore } from '../../src/store/campaignStore';
import { useDeviceStore }  from '../../src/store/deviceStore';
import { recomputeDerived } from '../../src/engine/pipeline';
import { playerEndTurn } from '../../src/engine/combat';
import { shortRestMinutes, longRestHours } from '../../src/engine/houseRules';
import { validateEntity } from '../../src/engine/validation';
import { Entity, Item, ItemInstance, Issue } from '../../src/engine/types';
import { itemRepo } from '../../src/content/itemRepo';
import { spellRepo } from '../../src/content/spellRepo';
import { spellIdsOnEntity } from '../../src/content/spellRepo.types';
import { TimelineCategory } from '../../src/db/timelineRepo';
import { buildRestMutation } from '../../src/components/sheet/RestPreviewModal';
import { exportCharacter, ExportFormat, ExportAction } from '../../src/io/exportShare';
import { GlobalDiceRoller } from '../../src/components/GlobalDiceRoller';
import { SafeBottomView }  from '../../src/components/SafeBottomView';
import { ErrorBoundary }   from '../../src/components/ErrorBoundary';
import { useSafeGoBack }   from '../../src/hooks/useSafeGoBack';
import { Colors } from '../../src/theme';
import { styles } from '../../src/components/sheet/screen/sheetScreenStyles';
import { TabId, BASE_TABS, SPELLS_TAB, formatShortRest } from '../../src/components/sheet/screen/sheetScreenModel';
import { useSheetInventoryHandlers } from '../../src/components/sheet/screen/useSheetInventoryHandlers';
import { useSheetCombatHandlers } from '../../src/components/sheet/screen/useSheetCombatHandlers';
import { SheetModals } from '../../src/components/sheet/screen/SheetModals';
import { SheetHeader } from '../../src/components/sheet/screen/SheetHeader';
import { SheetTabContent } from '../../src/components/sheet/screen/SheetTabContent';

export default function CharacterSheetScreen() {
  const { isWide } = useLayout();
  const { id }   = useLocalSearchParams<{ id: string }>();
  // Individual selectors — never object literals, which create a new reference every render
  // and trigger React's useSyncExternalStore infinite-loop guard.
  const characters      = useCharacterStore(s => s.characters);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const campaignRules   = useCharacterStore(s => s.rules);
  const customRuleProfiles = useCustomRuleProfileStore(s => s.profiles);
  const undoStack       = useCharacterStore(s => s.undoStack);
  const redoStack       = useCharacterStore(s => s.redoStack);
  const undo            = useCharacterStore(s => s.undo);
  const redo            = useCharacterStore(s => s.redo);
  const lastPersistError = useCharacterStore(s => s.lastPersistError);
  const isDm        = useCampaignStore(s => s.isDm);
  const campaignId  = useCampaignStore(s => s.activeCampaign?.id ?? '');
  // Item 17 (timeline improvements) — session grouping in CharacterHistoryModal.
  const activeCampaignSessionLog = useCampaignStore(s => s.activeCampaign?.sessionLog);
  const deviceId    = useDeviceStore(s => s.session?.deviceId ?? '');
  const homebrewItems = useHomebrewStore(s => s.items);
  const homebrewSubclasses = useHomebrewStore(s => s.subclasses);
  const getMergedContentDB = useHomebrewStore(s => s.getMergedContentDB);

  const entity = characters.find(c => c.id === id);
  const ruleAccess = entity ? sheetRuleAccess(campaignRules, entity, customRuleProfiles) : { effectiveRules: campaignRules, canFreeEdit: true };
  const rules = ruleAccess.effectiveRules;
  const freeEditModel = entity ? freeEditUiModel(campaignRules,entity,customRuleProfiles) : null;
  const [activeTab, setActiveTab] = useState<TabId>('character');
  const [sheetMode, setSheetMode] = useState<'combat' | 'exploration'>('combat');
  const [freeEditOpen, setFreeEditOpen] = useState(false);
  const [rulesetChangeOpen, setRulesetChangeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const goBack = useSafeGoBack('/(tabs)');

  // A-54: recompute diagnostics whenever the viewed entity actually changes
  // (a real mutation, not every render — `entity` is only a new object
  // reference after updateCharacter runs). Ensure-load the entity's own
  // spells/items first: on native both repos only warm their in-memory
  // cache on demand (getSpellSync/getItemSync read that cache synchronously
  // and never touch SQLite themselves), so calling validateEntity before
  // this would misreport real, present content as "missing" — the same
  // false-positive trap the level-up preview's own spellIdsOnEntity +
  // ensureLoaded pairing already avoids.
  useEffect(() => {
    if (!entity) { setIssues([]); return; }
    let cancelled = false;
    void (async () => {
      await spellRepo.ensureLoaded(spellIdsOnEntity(entity));
      await itemRepo.ensureLoaded([
        ...entity.inventory.carried.map(i => i.itemId),
        ...entity.inventory.equipped.map(i => i.itemId),
      ]);
      if (cancelled) return;
      const contentDB = getMergedContentDB(entity.rulesetId);
      setIssues(validateEntity(entity, contentDB, homebrewSubclasses));
    })();
    return () => { cancelled = true; };
  }, [entity, getMergedContentDB, homebrewSubclasses]);

  // Track "last opened" explicitly — the Home screen's old heuristic
  // (last entry in the in-memory characters array) reflected creation
  // order, not viewing order, and drifted from reality within a session
  // since local edits don't reorder that array. No-ops on web.
  useEffect(() => {
    if (id) void useLastCharacterStore.getState().markOpened(id).catch(() => {});
  }, [id]);

  const handleExportFormat = useCallback(async (format: ExportFormat, action: ExportAction) => {
    setExportSheetOpen(false);
    if (!entity) return;
    setExporting(true);
    try {
      await exportCharacter(entity, format, action);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  }, [entity]);

  // Free-edit a character's own data. Hidden only when a DM has explicitly
  // locked player edits via the house rule (the DM keeps the button). Being
  // nominally in a campaign no longer hides it — a player editing their own
  // sheet is normal, and the lock toggle is the real control.
  const freeEditAllowed = freeEditModel?.hasControls === true && !freeEditModel.locked;
  useEffect(()=>{ if(!freeEditAllowed)setFreeEditOpen(false); },[freeEditAllowed]);

  // Build tab list: Spells tab is inserted after Actions for spellcasters.
  // Also show it for a character whose features grant a spell (a species' innate cantrip, e.g. a Skeleton's Doomed Touch)
  // even if the spellcasting block hasn't been initialised yet: the tab provides the repair action that initialises it.
  const grantsASpell = !!entity?.features.some(f => f.effects?.some(e => e.type === 'grant_spell'));
  const showSpellsTab = !!entity?.spellcasting || grantsASpell;
  const TABS: { id: TabId; label: string }[] = showSpellsTab
    ? [BASE_TABS[0], BASE_TABS[1], SPELLS_TAB, ...BASE_TABS.slice(2)]
    : BASE_TABS;

  // Tab min-width: fills screen for 6 tabs, scrollable for 7.
  // A phone fits about six tabs across the window; in the wide layout the tabs share the right-hand pane, so they are narrower.
  const TAB_MIN_W = isWide ? 104 : Math.floor(Dimensions.get('window').width / 6);

  // Rules-engine blocker RE-AUDIT closure (1D/1E/1F): the ONE explicit
  // merged content snapshot every ordinary player mutation recomputes
  // against — resolved once here at the application mutation boundary
  // (mutate) rather than re-derived per handler, so an unrelated HP/
  // resource/action mutation can never silently fall back to official-only
  // content for a homebrew character.
  const cardContent = useMemo(() => {
    if (!entity) return {};
    const db = getMergedContentDB(entity.rulesetId);
    return { classDefs: db.classes, homebrewSpells: db.spells, races: db.races, items: db.items };
  }, [entity?.rulesetId, getMergedContentDB]);

  // `operations`: the automatic dnd5e operations the step runs (STEP_OPERATIONS); a pinned character whose versions cannot run them is left
  // unchanged and told why (LIFE-004). A step that passes none (free edit, typing a note) is never refused.
  const mutate = useCallback((updater: (e: Entity) => Entity, label?: string, category?: TimelineCategory, operations?: readonly string[]) => {
    if (!id) return;
    const refusal = updateCharacter(id, e => {
      const updated = updater(e);
      return recomputeDerived(updated, rules, cardContent);
    }, label, category, operations);
    if (refusal) Alert.alert('Not done', refusal);
  }, [id, updateCharacter, rules, cardContent]);

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // built only while the page is open
  const infoRows = useMemo(() => (entity && infoOpen ? characterInfoRows(entity, getMergedContentDB(entity.rulesetId), homebrewSubclasses) : []),
    [entity, infoOpen, getMergedContentDB, homebrewSubclasses]);
  // theirs is changed in place; then this owned copy is moved onto it, keeping its spent uses.
  const [customizing, setCustomizing] = useState<{ instanceId: string; item: Item; makesCopy: boolean } | null>(null);
  const saveHomebrewItem = useHomebrewStore(s => s.saveItem);
  const handleCustomizeItem = useCallback(async (instance: ItemInstance) => {
    await itemRepo.ensureLoaded([instance.itemId]);
    const official = itemRepo.getItemSync(instance.itemId);
    const item = official ?? homebrewItems.find(i => i.id === instance.itemId);
    if (!item || !instance.id) { Alert.alert('Not available', 'This item could not be found, so it cannot be customised.'); return; }
    setCustomizing({ instanceId: instance.id, item, makesCopy: !!official });
  }, [homebrewItems]);
  const saveCustomizedItem = useCallback(async (edits: ItemEdits) => {
    if (!customizing) return;
    const { instanceId, item, makesCopy } = customizing;
    const id = makesCopy ? `${item.id}_custom_${Date.now().toString(36)}` : item.id;
    const mine = customizedItem(item, edits, id);
    try {
      await saveHomebrewItem('item', mine);
    } catch (e: any) {
      Alert.alert('Not saved', `The item could not be saved: ${e?.message ?? e}`);
      return;
    }
    mutate(e => moveOwnedItem(e, instanceId, item, mine), `Customised ${mine.name}`, 'inventory');
    setCustomizing(null);
  }, [customizing, saveHomebrewItem, mutate]);
  const handleRename = useCallback((name: string) => mutate(e => ({ ...e, identity: { ...e.identity, name } }), `Renamed to ${name}`, 'other'), [mutate]);
  const handlePortrait = useCallback((portraitUri: string | undefined) => mutate(e => {
    const { portraitUri: _old, ...identity } = e.identity;
    return { ...e, identity: portraitUri ? { ...identity, portraitUri } : identity };
  }, portraitUri ? 'Portrait set' : 'Portrait removed', 'other'), [mutate]);
  // read only while the menu or the panel is open: resolving the lock checks every kept revision
  const versions = useMemo(() => (entity && (headerMenuOpen || versionsOpen) ? versionNotes(entity) : null), [entity, headerMenuOpen, versionsOpen]);
  const handlePinToInstalled = useCallback(() => {
    if (!entity) return;
    let pinned: Entity;
    try { pinned = pinToInstalled(entity); } catch (e: any) { Alert.alert('Not done', `The versions could not be kept: ${e?.message ?? e}`); return; }
    mutate(() => pinned, 'Versions pinned', 'other');
  }, [entity, mutate]);

  const {
    handleDamage, handleHeal, handleAddCondition, handleRemoveCondition, handleResourceChange, handleSpendSlot, handleRestoreSlot,
    handleEndConcentration,
  } = useSheetCombatHandlers({
    mutate, rules, entity, getMergedContentDB,
  });

  const {
    equipPreview, setEquipPreview, handleEquip, handleUnequip, confirmEquipPreview, handleSetMode, handleSetItemChoices, handleToggleAttune, handleSaveLoadout,
    handleApplyLoadout, handleDeleteLoadout, handleAddItem, handleRemoveItem, handleUpdateQuantity, handleSetQuantity, handleApplyInfusion,
    handleRemoveInfusion, handleUpdateCurrency,
  } = useSheetInventoryHandlers({
    entity, homebrewItems, rules, mutate,
  });

  const handleSaveNotes = useCallback((notes: string) => {
    mutate(e => ({ ...e, notes }), 'Edited notes', 'other');
  }, [mutate]);

  // Its own field, own handler — see Entity.explorationNotes's doc comment
  // (audit finding NOTES-CORRUPT-1): the Exploration tab used to share
  // entity.notes with the Notes tab above, corrupting each other's data.
  const handleSaveExplorationNotes = useCallback((notes: string) => {
    mutate(e => ({ ...e, explorationNotes: notes }), 'Edited exploration notes', 'other');
  }, [mutate]);

  // Wild Shape duration is tracked in hours (wildShapeState.expiresAt), but
  // the app has no granular hour-by-hour game clock anywhere else to tick it
  // down against. A rest (short or long) always represents at least the
  // beast form's remaining duration passing in practice, so reverting on any
  // rest is a reasonable practical proxy for real duration expiry rather
  // than building a full time-tracking system that doesn't exist elsewhere
  // in the app. See docs/ROADMAP_1.0.md Phase 3.4 for the honest gap this
  // simplifies. (This composition lives in buildRestMutation, shared with
  // RestPreviewModal, so the preview and the real action can never drift.)
  // `hitDiceAllocation` (rules-completeness batch, long-rest recovery) —
  // the player's own mixed-pool choice from RestPreviewModal, threaded
  // straight through to the SAME buildRestMutation the preview already
  // simulated against, so what Confirm applies is exactly what was shown.
  const handleRest = useCallback((kind: 'short' | 'long', hitDiceAllocation?: import('../../src/engine/rest').HitDiceRecoveryAllocation) => {
    mutate(buildRestMutation(kind, rules, hitDiceAllocation), kind === 'short' ? 'Short Rest' : 'Long Rest', 'rest',
      kind === 'short' ? STEP_OPERATIONS.shortRest : STEP_OPERATIONS.longRest);
  }, [mutate, rules]);

  const [restPreview, setRestPreview] = useState<'short' | 'long' | null>(null);
  const [restBarHeight, setRestBarHeight] = useState(0);

  // EDIT-PERF-1: each Tab component below is wrapped in React.memo, but that
  // only helps if its props are actually stable — these onEntityUpdate
  // closures used to be created inline in JSX (`updated => mutate(...)`), a
  // fresh function reference on every render of this screen, which defeated
  // memoization and forced the ENTIRE active tab to re-render on any
  // unrelated state change here (e.g. opening the Free-Edit modal, which
  // doesn't touch entity/rules at all). Hoisting them into useCallback,
  // keyed only on the already-stable `mutate`, makes them real stable
  // references so React.memo can actually skip re-rendering the tab.
  const onCombatEntityUpdate      = useCallback((updated: Entity) => mutate(() => updated, 'Character progression', 'combat'), [mutate]);
  const onExplorationEntityUpdate = useCallback((updated: Entity) => mutate(() => updated, 'Exploration action', 'other'), [mutate]);
  const onActionsEntityUpdate     = useCallback((updated: Entity) => mutate(() => updated, 'Used action card', 'combat'), [mutate]);
  const onSpellsEntityUpdate      = useCallback((updated: Entity, label?: string) => mutate(() => updated, label ?? 'Spellbook change', 'spells'), [mutate]);
  const onAbilitiesEntityUpdate   = useCallback((updated: Entity) => mutate(() => updated, 'Ability override', 'other'), [mutate]);
  const onFeaturesEntityUpdate    = useCallback((updated: Entity) => mutate(() => updated, 'Edited features', 'features'), [mutate]);
  // Closure item 16: the ONE authoritative End Turn entry point — Character/
  // Actions/Spells tabs all call this same handler now instead of each
  // computing playerEndTurn() locally and routing the result through their
  // own differently-labeled/categorized generic onEntityUpdate (which used
  // to produce 3 different timeline labels — 'Character progression',
  // 'Used action card', 'End Turn' — and 2 different categories for the
  // exact same mutation). One call site means one label/category/sync/undo
  // behavior, guaranteed identical regardless of which tab it's pressed from.
  const handleEndTurn = useCallback(() => mutate(e => playerEndTurn(e, rules), 'End Turn', 'combat', STEP_OPERATIONS.endTurn), [mutate, rules]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // All hooks above run unconditionally (Rules of Hooks). Only now, after every
  // hook has been called, do we branch on a missing entity.
  if (!entity) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorTxt}>Character not found.</Text>
        </View>
      </View>
    );
  }

  const { identity, resources, derived } = entity;

  // Header stat colours — while Wild Shaped, show the beast's hp pool (the
  // one actually taking damage right now), not the player's real HP
  // underneath, which is untouched and would misleadingly look unchanged.
  const wildShaped = entity.wildShapeState?.active;
  const headerHpCurrent = wildShaped ? entity.wildShapeState!.beastHp    : resources.hp.current;
  const headerHpMax     = wildShaped ? entity.wildShapeState!.beastHpMax : resources.hp.maximum;
  const hpPct   = headerHpMax > 0 ? headerHpCurrent / headerHpMax : 0;
  const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;

  // The tab bar and the tab bodies are built by functions so the phone layout (one tab at a time) and the wide layout (Combat beside
  // the other tabs) show exactly the same things.
  const rightTab: TabId = activeTab === 'character' ? 'actions' : activeTab;
  const renderTabBar = (tabsToShow: { id: TabId; label: string }[]) => (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabsToShow.map(t => {
            // Pending Choices (skill picks, ASI/feat, subclass, etc.) only ever
            // resolve from the Features tab — a badge here is the "notice this
            // from any tab" signal for a choice that just unlocked (e.g. right
            // after a level-up), since the Combat tab's Level Up button gives no
            // other indication one is waiting.
            const pendingCount = t.id === 'features'
              ? (entity?.choices.filter(c => !c.resolved).length ?? 0)
              : 0;
            return (
              <Pressable
                key={t.id}
                style={[styles.tabBtn, { minWidth: TAB_MIN_W }, activeTab === t.id && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.id)}
              >
                <View style={styles.tabLabelRow}>
                  <Text style={[styles.tabTxt, activeTab === t.id && styles.tabTxtActive]}>
                    {t.label}
                  </Text>
                  {pendingCount > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeTxt}>{pendingCount}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
  );
  const renderTab = (tabId: TabId) => (
    <>
          <SheetTabContent
            tabId={tabId}
            sheetMode={sheetMode}
            setSheetMode={setSheetMode}
            entity={entity}
            rules={rules}
            isDm={isDm}
            campaignId={campaignId}
            deviceId={deviceId}
            handleDamage={handleDamage}
            handleHeal={handleHeal}
            handleAddCondition={handleAddCondition}
            handleRemoveCondition={handleRemoveCondition}
            handleResourceChange={handleResourceChange}
            handleSpendSlot={handleSpendSlot}
            handleRestoreSlot={handleRestoreSlot}
            handleEndConcentration={handleEndConcentration}
            onCombatEntityUpdate={onCombatEntityUpdate}
            handleEndTurn={handleEndTurn}
            onExplorationEntityUpdate={onExplorationEntityUpdate}
            handleSaveExplorationNotes={handleSaveExplorationNotes}
            onActionsEntityUpdate={onActionsEntityUpdate}
            onSpellsEntityUpdate={onSpellsEntityUpdate}
            onAbilitiesEntityUpdate={onAbilitiesEntityUpdate}
            freeEditAllowed={freeEditAllowed}
            onFeaturesEntityUpdate={onFeaturesEntityUpdate}
            handleEquip={handleEquip}
            handleUnequip={handleUnequip}
            handleAddItem={handleAddItem}
            handleRemoveItem={handleRemoveItem}
            handleUpdateQuantity={handleUpdateQuantity}
            handleSetQuantity={handleSetQuantity}
            handleUpdateCurrency={handleUpdateCurrency}
            handleApplyInfusion={handleApplyInfusion}
            handleRemoveInfusion={handleRemoveInfusion}
            handleToggleAttune={handleToggleAttune}
            handleSetMode={handleSetMode}
            handleSetItemChoices={handleSetItemChoices}
            handleSaveLoadout={handleSaveLoadout}
            handleApplyLoadout={handleApplyLoadout}
            handleDeleteLoadout={handleDeleteLoadout}
            handleCustomizeItem={handleCustomizeItem}
            handleSaveNotes={handleSaveNotes}
          />
    </>
  );

  return (
    <View style={styles.screen}>

      <SheetHeader
        goBack={goBack}
        identity={identity}
        setRenameOpen={setRenameOpen}
        undoStack={undoStack}
        id={id}
        undo={undo}
        redoStack={redoStack}
        redo={redo}
        setHeaderMenuOpen={setHeaderMenuOpen}
        setInfoOpen={setInfoOpen}
        entity={entity}
        hpColor={hpColor}
        headerHpCurrent={headerHpCurrent}
        headerHpMax={headerHpMax}
        wildShaped={wildShaped}
        derived={derived}
        resources={resources}
        headerMenuOpen={headerMenuOpen}
        setHistoryOpen={setHistoryOpen}
        setRulesetChangeOpen={setRulesetChangeOpen}
        freeEditAllowed={freeEditAllowed}
        setFreeEditOpen={setFreeEditOpen}
        versions={versions}
        setVersionsOpen={setVersionsOpen}
        exporting={exporting}
        setExportSheetOpen={setExportSheetOpen}
        issues={issues}
        setIssuesOpen={setIssuesOpen}
      />

      {/* Surfaces a failed local save instead of only logging it — a write
          failure used to leave the UI looking correct while the disk
          silently kept the pre-mutation state, discovered only after a
          later restart reverted the change with no explanation (audit
          finding PERSIST-5). Clears itself on the next successful save. */}
      {lastPersistError && (
        <View style={styles.persistErrorBanner}>
          <Text style={styles.persistErrorTxt}>⚠️ {lastPersistError}</Text>
        </View>
      )}

      {/* Tab Content — wrapped in its own ErrorBoundary (architecture review
          C8, defense in depth): a structurally malformed character (e.g.
          imported from a corrupted/hand-edited pack) can throw while
          rendering derived data here. Scoped BELOW the header/tab bar above
          (which stay outside, so "← Back" always works even if every tab
          crashes) and keyed on entity.id + activeTab so navigating to a
          different character or switching tabs always gets a fresh
          boundary — a crash on one tab doesn't leave every other tab (or
          every other character) stuck showing the same stale fallback. */}
      {isWide ? (
        <View style={styles.widePanes}>
          <View style={styles.widePaneLeft}>
            <ErrorBoundary key={`${entity.id}_character`}>
              <View style={styles.tabContent}>{renderTab('character')}</View>
            </ErrorBoundary>
          </View>
          <View style={styles.widePaneRight}>
            {renderTabBar(TABS.filter(t => t.id !== 'character'))}
            <ErrorBoundary key={`${entity.id}_${rightTab}`}>
              <View style={styles.tabContent}>{renderTab(rightTab)}</View>
            </ErrorBoundary>
          </View>
        </View>
      ) : (
        <>
          {renderTabBar(TABS)}
          <ErrorBoundary key={`${entity.id}_${activeTab}`}>
            <View style={styles.tabContent}>{renderTab(activeTab)}</View>
          </ErrorBoundary>
        </>
      )}

      {/* Persistent Rest Bar — wrapped so it stays above the Android nav bar; measured so the dice button sits above it */}
      <View onLayout={e => setRestBarHeight(e.nativeEvent.layout.height)}>
      <SafeBottomView>
        <View style={styles.restBar}>
          <Pressable style={styles.restBtn} onPress={() => setRestPreview('short')}>
            <Text style={styles.restBtnTxt}>☕  Short Rest</Text>
            <Text style={styles.restBtnSub}>{formatShortRest(shortRestMinutes(rules))}</Text>
          </Pressable>
          <Pressable style={[styles.restBtn, styles.restBtnLong]} onPress={() => setRestPreview('long')}>
            <Text style={styles.restBtnTxt}>🌙  Long Rest</Text>
            <Text style={styles.restBtnSub}>{longRestHours(rules)} hours</Text>
          </Pressable>
        </View>
      </SafeBottomView>
      </View>

      {/* Global dice roller — floats above the rest bar, whose height includes the device's navigation-bar inset (a fixed 72 sat on
          the Long Rest button on an Android 15 emulator, 2026-11-19) */}
      <GlobalDiceRoller bottom={restBarHeight ? restBarHeight + 8 : 72} right={12} />

      <SheetModals
        freeEditOpen={freeEditOpen}
        entity={entity}
        rules={rules}
        mutate={mutate}
        setFreeEditOpen={setFreeEditOpen}
        rulesetChangeOpen={rulesetChangeOpen}
        setRulesetChangeOpen={setRulesetChangeOpen}
        historyOpen={historyOpen}
        id={id}
        setHistoryOpen={setHistoryOpen}
        activeCampaignSessionLog={activeCampaignSessionLog}
        customizing={customizing}
        saveCustomizedItem={saveCustomizedItem}
        setCustomizing={setCustomizing}
        infoOpen={infoOpen}
        identity={identity}
        infoRows={infoRows}
        setInfoOpen={setInfoOpen}
        handlePortrait={handlePortrait}
        renameOpen={renameOpen}
        handleRename={handleRename}
        setRenameOpen={setRenameOpen}
        versions={versions}
        versionsOpen={versionsOpen}
        handlePinToInstalled={handlePinToInstalled}
        setVersionsOpen={setVersionsOpen}
        issuesOpen={issuesOpen}
        issues={issues}
        setIssuesOpen={setIssuesOpen}
        restPreview={restPreview}
        handleRest={handleRest}
        setRestPreview={setRestPreview}
        equipPreview={equipPreview}
        confirmEquipPreview={confirmEquipPreview}
        setEquipPreview={setEquipPreview}
        homebrewItems={homebrewItems}
        exportSheetOpen={exportSheetOpen}
        handleExportFormat={handleExportFormat}
        setExportSheetOpen={setExportSheetOpen}
      />

    </View>
  );
}
