import { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SectionList } from '../Lists';
import { sortByOption } from '../../content/contentQuery';
import { mergeItemIndex } from '../../content/contentResolution';
import { itemsForRuleset } from '../../content/itemEditions';
import type { ItemIndexEntry } from '../../content/itemRepo.types';
import { armorWeight, isMagic, isWeapon, isRangedWeapon, isMartialWeapon, isArmorItem, isShield, isAmmo, isToolOrKit, isFocus, type ItemCategoryId, itemSortOptions, buildSimpleCustomItem, itemCategory, rarityOf, RARITY_TIERS, ITEM_CATEGORY_LABELS } from '../../content/items/itemBrowse';
import { itemRequiresAttunement } from '../../engine/itemMechanics';
import { Entity, RulesetId, matchesRuleset } from '../../engine/types';
import { useBrowseStateStore } from '../../store/browseStateStore';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors } from '../../theme';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { FilterSection, FilterChipRow, MultiSelectChipRow, OfficialHomebrewChipRow, ActiveFilterChips } from '../FilterChipRow';
import { NAME_INPUT } from '../nameInput';
import { isNonSrd, NonSrdBadge } from '../NonSrdBadge';
import { SortControl } from '../SortControl';
import { addStyles } from './inventoryStyles';
import { reportFailure } from '../../utils/alert';

export const ITEM_PICKER_SCREEN_KEY = 'item_picker';

// ── Item categories ───────────────────────────────────────────────────────────
// Classification helpers (isMagic/isWeapon/isRangedWeapon/isMartialWeapon/
// armorWeight/isArmorItem/isShield/isAmmo/isToolOrKit/isFocus) now live in
// src/content/items/itemBrowse.ts as the shared, independent-axis primitives
// — see that file's header. ITEM_CATEGORIES/categorise below stay as the
// results screen's own PRESENTATION grouping (a combined "Magic Weapons —
// Martial Melee"-style label reads fine as a section header); the actual
// FILTER controls in AddItemModal go through itemBrowse.ts's independent
// Category/Magical/WeaponClass/WeaponRange/ArmorWeight fields instead of
// matching against one of these 25 combined labels.

type ItemCategory = {
  label:  string;
  emoji:  string;
  test:   (item: ItemIndexEntry) => boolean;
};

function isArmor(i: ItemIndexEntry, weight: 'heavy' | 'medium' | 'light'): boolean {
  return armorWeight(i) === weight;
}

const ITEM_CATEGORIES: ItemCategory[] = [
  // ── Magic equipment, sub-typed like mundane gear ──
  {
    label: 'Magic Weapons — Martial Melee',
    emoji: '✨⚔️',
    test: i => isMagic(i) && isWeapon(i) && !isRangedWeapon(i) && isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Simple Melee',
    emoji: '✨🗡️',
    test: i => isMagic(i) && isWeapon(i) && !isRangedWeapon(i) && !isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Martial Ranged',
    emoji: '✨🏹',
    test: i => isMagic(i) && isWeapon(i) && isRangedWeapon(i) && isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Simple Ranged',
    emoji: '✨🎟️',
    test: i => isMagic(i) && isWeapon(i) && isRangedWeapon(i) && !isMartialWeapon(i),
  },
  {
    label: 'Magic Weapons — Other',
    emoji: '✨☄️',
    test: i => isMagic(i) && isWeapon(i),  // weapon but base type unidentifiable
  },
  { label: 'Magic Heavy Armor',  emoji: '✨🛡️', test: i => isMagic(i) && isArmor(i, 'heavy') },
  { label: 'Magic Medium Armor', emoji: '✨🥋', test: i => isMagic(i) && isArmor(i, 'medium') },
  { label: 'Magic Light Armor',  emoji: '✨👕', test: i => isMagic(i) && isArmor(i, 'light') },
  { label: 'Magic Armor — Other', emoji: '✨🧥', test: i => isMagic(i) && isArmorItem(i) },
  { label: 'Magic Shields',      emoji: '✨🔰', test: i => isMagic(i) && isShield(i) },
  { label: 'Magic Ammunition',   emoji: '✨🎯', test: i => isMagic(i) && isAmmo(i) },
  { label: 'Magic Tools & Kits', emoji: '✨🔧', test: i => isMagic(i) && isToolOrKit(i) },
  { label: 'Magic Focuses',      emoji: '✨🔮', test: i => isMagic(i) && isFocus(i) },
  { label: 'Wondrous & Other Magic', emoji: '✨', test: i => isMagic(i) }, // remaining magic

  // ── Mundane weapons by category ──
  { label: 'Weapons — Martial Melee',  emoji: '⚔️', test: i => isWeapon(i) && !isRangedWeapon(i) && isMartialWeapon(i) },
  { label: 'Weapons — Simple Melee',   emoji: '🗡️', test: i => isWeapon(i) && !isRangedWeapon(i) && !isMartialWeapon(i) },
  { label: 'Weapons — Martial Ranged', emoji: '🏹', test: i => isWeapon(i) && isRangedWeapon(i) && isMartialWeapon(i) },
  { label: 'Weapons — Simple Ranged',  emoji: '🎟️', test: i => isWeapon(i) && isRangedWeapon(i) && !isMartialWeapon(i) },

  // ── Mundane armor by weight ──
  { label: 'Heavy Armor',  emoji: '🛡️', test: i => isArmor(i, 'heavy') },
  { label: 'Medium Armor', emoji: '🥋', test: i => isArmor(i, 'medium') },
  { label: 'Light Armor',  emoji: '👕', test: i => isArmor(i, 'light') },
  { label: 'Armor — Other', emoji: '🧥', test: i => isArmorItem(i) },
  { label: 'Shields',      emoji: '🔰', test: i => isShield(i) },
  { label: 'Ammunition',   emoji: '🎯', test: i => isAmmo(i) && !isWeapon(i) },
  { label: 'Tools & Kits', emoji: '🔧', test: i => isToolOrKit(i) },
  { label: 'Spellcasting Focuses', emoji: '🔮', test: i => isFocus(i) },
  { label: 'Adventuring Gear', emoji: '🎒', test: () => true }, // catch-all
];

function categorise(items: ItemIndexEntry[]): { cat: ItemCategory; items: ItemIndexEntry[] }[] {
  const result: { cat: ItemCategory; items: ItemIndexEntry[] }[] = [];
  const assigned = new Set<string>();
  for (const cat of ITEM_CATEGORIES) {
    const matched = items.filter(i => !assigned.has(i.id) && cat.test(i));
    if (matched.length > 0) {
      matched.forEach(i => assigned.add(i.id));
      result.push({ cat, items: matched });
    }
  }
  return result;
}

// ── Sorting ─────────────────────────────────────────────────────────────
// Sort options (A–Z/Z–A/Rarity/Value/Weight/Source) now come from the
// shared itemSortOptions()/SortControl (src/content/items/itemBrowse.ts),
// same pattern as every other content type this pass.

// ── Add Item Modal ─────────────────────────────────────────────────────────────

export function AddItemModal({
  visible, entityRulesetId, equippedIds, carriedIds, onAdd, onClose,
}: {
  visible:     boolean;
  /** LIVE-RULESET-2 (item 7): the character's entity.rulesetId, passed by
   *  name rather than the whole Entity — this modal otherwise has no need
   *  for one. Base-filters the pool the same "untagged = shared" way every
   *  other content pool does. */
  entityRulesetId: Entity['rulesetId'];
  equippedIds: Set<string>;
  carriedIds:  Set<string>;
  onAdd:       (itemId: string) => void;
  onClose:     () => void;
}) {
  const homebrewItems = useHomebrewStore(s => s.items);
  const saveHomebrew  = useHomebrewStore(s => s.saveItem);
  const homebrewItemIds = new Set(homebrewItems.map(i => i.id));
  // BROWSE-STATE-1: this modal is conditionally mounted (`{addOpen &&
  // <AddItemModal/>}` in the parent, for perf — see that call site's own
  // comment), so its internal state would otherwise reset every time it's
  // reopened. Restore/persist via the shared browseStateStore instead.
  const savedItemPicker = useBrowseStateStore.getState().getBrowseState(ITEM_PICKER_SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedItemFilters = savedItemPicker.filters ?? {};
  const [search,    setSearch]    = useState(savedItemPicker.search ?? '');
  const [expanded, setExpanded]  = useState<string | null>(null);
  // Independent-axis filters (SHARED-QUERY-1): Category/Magical/WeaponClass/
  // WeaponRange/ArmorWeight/Rarity are each their own field — never combined
  // into one taxonomy string like the old "Magic Weapons — Martial Melee"
  // catFilter this replaces. See itemBrowse.ts's header comment.
  const [categoryFilter, setCategoryFilter] = useState<ItemCategoryId | null>((savedItemFilters.categoryFilter as ItemCategoryId) ?? null);
  const [magicalFilter, setMagicalFilter] = useState<'all' | 'magical' | 'mundane'>((savedItemFilters.magicalFilter as 'all' | 'magical' | 'mundane') ?? 'all');
  const [weaponClassFilter, setWeaponClassFilter] = useState<'martial' | 'simple' | null>((savedItemFilters.weaponClassFilter as 'martial' | 'simple') ?? null);
  const [weaponRangeFilter, setWeaponRangeFilter] = useState<'melee' | 'ranged' | null>((savedItemFilters.weaponRangeFilter as 'melee' | 'ranged') ?? null);
  const [armorWeightFilter, setArmorWeightFilter] = useState<'heavy' | 'medium' | 'light' | null>((savedItemFilters.armorWeightFilter as 'heavy' | 'medium' | 'light') ?? null);
  const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set((savedItemFilters.rarityFilter as string[]) ?? []));
  const sortOptions = itemSortOptions(i => homebrewItemIds.has(i.id));
  const [sort, setSort] = useState(savedItemPicker.sort ?? 'name_asc');
  // Official/Homebrew — real, homebrewItemIds membership (already computed
  // below for the row badge, now also drives an actual filter). Requires
  // Attunement — real, itemRequiresAttunement() works off Tier-1 fields
  // (id/properties) alone, no Tier-2 load needed. Ruleset — TIER1-EXT-1:
  // now a real Tier-1 field too (ItemIndexEntry was extended). Source/Pack
  // via getContentProvenance() is not wired here: Item has no per-item
  // sourcebook field at all (only Feat does), so the derived label would
  // only ever be "SRD 5.1" or undefined — the existing NonSrdBadge per row
  // already communicates that narrower signal.
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedItemFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  const [attunementOnly, setAttunementOnly] = useState(!!savedItemFilters.attunementOnly);
  // LIVE-RULESET-2 (item 8): this filter is persisted via browseStateStore
  // and shared by KEY across every character/session (ITEM_PICKER_SCREEN_KEY
  // isn't per-character) — restoring it blindly on mount (this modal is
  // conditionally mounted, remounting fresh every time the picker opens)
  // could resurrect a filter chosen for a DIFFERENT character's ruleset,
  // which combined with the ruleset-aware base filter below could leave
  // the picker showing zero items with no obvious reason why. Restored
  // only when it was persisted alongside a matching rulesetFilterSetFor —
  // every other persisted filter/search/sort restores unconditionally, so
  // this doesn't cost any of that preservation.
  const [rulesetFilter, setRulesetFilter] = useState<string | null>(
    savedItemFilters.rulesetFilterSetFor === entityRulesetId ? (savedItemFilters.rulesetFilter as string) ?? null : null
  );
  useEffect(() => {
    setBrowseState(ITEM_PICKER_SCREEN_KEY, {
      search, sort,
      filters: {
        categoryFilter, magicalFilter, weaponClassFilter, weaponRangeFilter, armorWeightFilter,
        rarityFilter: Array.from(rarityFilter), officialFilter, attunementOnly, rulesetFilter,
        // LIVE-RULESET-2 (item 8): which character's ruleset rulesetFilter
        // was actually chosen under — read back on next mount to decide
        // whether it's still valid. See the state init above.
        rulesetFilterSetFor: entityRulesetId,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, categoryFilter, magicalFilter, weaponClassFilter, weaponRangeFilter, armorWeightFilter, rarityFilter, officialFilter, attunementOnly, rulesetFilter, entityRulesetId]);
  // Quick-add custom item form
  const [quickOpen, setQuickOpen] = useState(false);
  const [qName,  setQName]  = useState('');
  const [qType,  setQType]  = useState('');
  const [qDesc,  setQDesc]  = useState('');
  // Collapsible filters dropdown
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function handleQuickAdd() {
    const name = qName.trim();
    if (!name) return;
    const custom = buildSimpleCustomItem(name, qType, qDesc);
    await saveHomebrew('item', custom);
    onAdd(custom.id);
    setQName(''); setQType(''); setQDesc(''); setQuickOpen(false);
  }


  // Deduped by id, homebrew wins on collision — see contentResolution.ts.
  // official id would show up as two separate rows.)
  // A 5.5e character is offered the 5.5e record where the edition has one, and a 5e character never sees the 5.5e records.
  const allItems: ItemIndexEntry[] = itemsForRuleset(mergeItemIndex(homebrewItems), entityRulesetId);
  const q = search.trim().toLowerCase();
  // LIVE-RULESET-2 (item 7/8): the manual Ruleset chip OVERRIDES the
  // character's own ruleset when set (an explicit "show me ONLY this
  // ruleset's items" ask), otherwise falls back to matchesRuleset against
  // entityRulesetId — the same "untagged = shared, tagged-different =
  // hidden" rule every other content pool uses, so the picker defaults to
  // the character's own ruleset with nothing chosen. Stacking both
  // (base-filter AND a differently-valued manual chip) would make the
  // manual chip permanently show zero results whenever it names a ruleset
  // other than the character's own — override, not intersect.
  const effectiveRulesetFilter = (rulesetFilter as RulesetId | null) ?? entityRulesetId;
  const searchFiltered = allItems
    .filter(i => !q || i.name.toLowerCase().includes(q) || i.properties.some(p => p.toLowerCase().includes(q)))
    .filter(i => officialFilter === 'all' || (officialFilter === 'homebrew') === homebrewItemIds.has(i.id))
    .filter(i => !attunementOnly || itemRequiresAttunement(i))
    .filter(i => matchesRuleset(i.rulesetId, effectiveRulesetFilter))
    .filter(i => !categoryFilter || itemCategory(i) === categoryFilter)
    .filter(i => magicalFilter === 'all' || (magicalFilter === 'magical') === isMagic(i))
    .filter(i => !weaponClassFilter || (itemCategory(i) === 'weapon' && (weaponClassFilter === 'martial' ? isMartialWeapon(i) : !isMartialWeapon(i))))
    .filter(i => !weaponRangeFilter || (itemCategory(i) === 'weapon' && (weaponRangeFilter === 'ranged' ? isRangedWeapon(i) : !isRangedWeapon(i))))
    .filter(i => !armorWeightFilter || armorWeight(i) === armorWeightFilter)
    .filter(i => rarityFilter.size === 0 || (rarityOf(i) !== null && rarityFilter.has(rarityOf(i)!)));
  const availableItemRulesets = Array.from(new Set(allItems.map(i => i.rulesetId).filter((r): r is NonNullable<typeof r> => !!r))).map(String);
  const availableRarities = RARITY_TIERS.filter(r => allItems.some(i => rarityOf(i) === r));

  const groups = categorise(searchFiltered).map(g => ({
    ...g,
    items: sortByOption(g.items, sortOptions, sort),
  }));
  const activeFilterCount =
    (categoryFilter ? 1 : 0) + (magicalFilter !== 'all' ? 1 : 0) + (weaponClassFilter ? 1 : 0) +
    (weaponRangeFilter ? 1 : 0) + (armorWeightFilter ? 1 : 0) + rarityFilter.size +
    (officialFilter !== 'all' ? 1 : 0) + (attunementOnly ? 1 : 0) + (rulesetFilter ? 1 : 0);
  function clearAllItemFilters() {
    setCategoryFilter(null); setMagicalFilter('all'); setWeaponClassFilter(null);
    setWeaponRangeFilter(null); setArmorWeightFilter(null); setRarityFilter(new Set());
    setOfficialFilter('all'); setAttunementOnly(false); setRulesetFilter(null);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* SCROLL-TOUCH-1: the sheet used to BE a Pressable (to swallow backdrop
          taps). A Pressable ancestor claims every touch that starts on a
          non-touchable child, so once a category was picked (rows are plain
          Views, only "+ Add" is a button) the list only scrolled when the
          drag began on "+ Add". The backdrop is now a separate sibling, and
          the sheet a plain View that never takes part in touch negotiation. */}
      <View style={addStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={addStyles.sheet}>
          <View style={addStyles.titleRow}>
            <Text style={addStyles.title}>Add Item</Text>
            <Pressable
              style={[addStyles.quickToggle, quickOpen && addStyles.quickToggleActive]}
              onPress={() => setQuickOpen(o => !o)}
            >
              <Text style={[addStyles.quickToggleTxt, quickOpen && addStyles.quickToggleTxtActive]}>
                {quickOpen ? '× Cancel' : '+ Custom item'}
              </Text>
            </Pressable>
          </View>

          {/* Quick-add custom (homebrew) item form */}
          {quickOpen && (
            <View style={addStyles.quickForm}>
              <TextInput {...NAME_INPUT}
                style={addStyles.quickInput}
                value={qName}
                onChangeText={setQName}
                placeholder="Item name (required)"
                placeholderTextColor={Colors.textDim}
                autoFocus
              />
              <TextInput
                style={addStyles.quickInput}
                value={qType}
                onChangeText={setQType}
                placeholder="Properties, comma-separated (e.g. magic item, wondrous)"
                placeholderTextColor={Colors.textDim}
              />
              <TextInput
                style={[addStyles.quickInput, addStyles.quickInputMulti]}
                value={qDesc}
                onChangeText={setQDesc}
                placeholder="Description (optional)"
                placeholderTextColor={Colors.textDim}
                multiline
              />
              <Pressable
                style={[addStyles.quickAddBtn, !qName.trim() && addStyles.quickAddBtnDisabled]}
                onPress={() => { void handleQuickAdd().catch(reportFailure('add the item')); }}
                disabled={!qName.trim()}
              >
                <Text style={addStyles.quickAddBtnTxt}>Create & Add to Bag</Text>
              </Pressable>
            </View>
          )}
          <TextInput
            style={addStyles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search all items…"
            placeholderTextColor={Colors.textDim}
            autoFocus
          />

          {/* Filters dropdown toggle */}
          <View style={addStyles.filterBar}>
            <Pressable style={addStyles.filterToggle} onPress={() => setFiltersOpen(o => !o)}>
              <Text style={addStyles.filterToggleTxt}>
                {filtersOpen ? '▲' : '▼'} Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </Pressable>
            <SortControl options={sortOptions} value={sort} onChange={setSort} />
          </View>

          {filtersOpen && (
            <View style={addStyles.filterPanel}>
              <FilterSection label="Category">
                <FilterChipRow
                  options={(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategoryId[]).map(id => ({ id, label: ITEM_CATEGORY_LABELS[id] }))}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  scrollable
                />
              </FilterSection>
              <FilterSection label="Magical / Mundane">
                <FilterChipRow
                  options={[{ id: 'magical' as const, label: 'Magical' }, { id: 'mundane' as const, label: 'Mundane' }]}
                  value={magicalFilter === 'all' ? null : magicalFilter}
                  onChange={v => setMagicalFilter(v ?? 'all')}
                />
              </FilterSection>
              {categoryFilter === 'weapon' && (
                <>
                  <FilterSection label="Weapon Class">
                    <FilterChipRow
                      options={[{ id: 'martial' as const, label: 'Martial' }, { id: 'simple' as const, label: 'Simple' }]}
                      value={weaponClassFilter}
                      onChange={setWeaponClassFilter}
                    />
                  </FilterSection>
                  <FilterSection label="Weapon Range">
                    <FilterChipRow
                      options={[{ id: 'melee' as const, label: 'Melee' }, { id: 'ranged' as const, label: 'Ranged' }]}
                      value={weaponRangeFilter}
                      onChange={setWeaponRangeFilter}
                    />
                  </FilterSection>
                </>
              )}
              {categoryFilter === 'armor' && (
                <FilterSection label="Armor Class">
                  <FilterChipRow
                    options={[{ id: 'heavy' as const, label: 'Heavy' }, { id: 'medium' as const, label: 'Medium' }, { id: 'light' as const, label: 'Light' }]}
                    value={armorWeightFilter}
                    onChange={setArmorWeightFilter}
                  />
                </FilterSection>
              )}
              {availableRarities.length > 0 && (
                <FilterSection label="Rarity">
                  <MultiSelectChipRow
                    options={availableRarities.map(r => ({ id: r, label: r[0].toUpperCase() + r.slice(1) }))}
                    values={rarityFilter}
                    onChange={setRarityFilter}
                  />
                </FilterSection>
              )}
              <FilterSection label="Official / Homebrew">
                <OfficialHomebrewChipRow value={officialFilter} onChange={setOfficialFilter} />
              </FilterSection>
              <Pressable
                style={[addStyles.chip, attunementOnly && addStyles.chipActive, addStyles.attunementToggle]}
                onPress={() => setAttunementOnly(v => !v)}
              >
                <Text style={[addStyles.chipTxt, attunementOnly && addStyles.chipTxtActive]}>Requires Attunement</Text>
              </Pressable>
              {availableItemRulesets.length > 1 && (
                <FilterSection label="Ruleset">
                  <FilterChipRow
                    options={availableItemRulesets.map(r => ({ id: r, label: r }))}
                    value={rulesetFilter}
                    onChange={setRulesetFilter}
                  />
                </FilterSection>
              )}
            </View>
          )}
          <ActiveFilterChips
            chips={[
              ...(categoryFilter ? [{ key: 'cat', label: ITEM_CATEGORY_LABELS[categoryFilter], onClear: () => setCategoryFilter(null) }] : []),
              ...(magicalFilter !== 'all' ? [{ key: 'magic', label: magicalFilter === 'magical' ? 'Magical' : 'Mundane', onClear: () => setMagicalFilter('all') }] : []),
              ...(weaponClassFilter ? [{ key: 'wclass', label: weaponClassFilter === 'martial' ? 'Martial' : 'Simple', onClear: () => setWeaponClassFilter(null) }] : []),
              ...(weaponRangeFilter ? [{ key: 'wrange', label: weaponRangeFilter === 'ranged' ? 'Ranged' : 'Melee', onClear: () => setWeaponRangeFilter(null) }] : []),
              ...(armorWeightFilter ? [{ key: 'aweight', label: armorWeightFilter[0].toUpperCase() + armorWeightFilter.slice(1), onClear: () => setArmorWeightFilter(null) }] : []),
              ...Array.from(rarityFilter).map(r => ({ key: `rarity_${r}`, label: r[0].toUpperCase() + r.slice(1), onClear: () => setRarityFilter(prev => { const n = new Set(prev); n.delete(r); return n; }) })),
              ...(officialFilter !== 'all' ? [{ key: 'official', label: officialFilter === 'official' ? 'Official' : 'Homebrew', onClear: () => setOfficialFilter('all') }] : []),
              ...(attunementOnly ? [{ key: 'attune', label: 'Requires Attunement', onClear: () => setAttunementOnly(false) }] : []),
              ...(rulesetFilter ? [{ key: 'ruleset', label: rulesetFilter, onClear: () => setRulesetFilter(null) }] : []),
            ]}
            onClearAll={clearAllItemFilters}
          />

          {/* Results grouped by category — SectionList for virtualization,
              since a broad search can force-expand many categories at once
              across a 920-item catalog. See docs/ROADMAP_1.0.md Phase 3.5. */}
          {groups.length === 0 ? (
            <Text style={addStyles.empty}>No items match "{search}".</Text>
          ) : (
            <SectionList
              style={{ maxHeight: 420 }}
              sections={groups.map(({ cat, items }) => ({
                catLabel:   cat.label,
                emoji:      cat.emoji,
                totalCount: items.length,
                // Collapsed categories render zero items (still show their
                // header) — same UX as before, but now virtualized for
                // whichever section(s) actually have visible data.
                data: (expanded === cat.label || !!q || !!categoryFilter) ? items : [],
              }))}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <Pressable
                  style={addStyles.groupHeader}
                  onPress={() => setExpanded(e => e === section.catLabel ? null : section.catLabel)}
                >
                  <Text style={addStyles.groupEmoji}>{section.emoji}</Text>
                  <Text style={addStyles.groupLabel}>{section.catLabel}</Text>
                  <Text style={addStyles.groupCount}>({section.totalCount})</Text>
                  <Text style={addStyles.groupCaret}>
                    {expanded === section.catLabel || q ? '▲' : '▼'}
                  </Text>
                </Pressable>
              )}
              renderItem={({ item }) => {
                // Owning one already doesn't block adding more — carrying
                // multiple of the same item (arrows, potions, torches) is
                // normal, so "+ Add" always stays tappable; it stacks onto
                // the existing carried entry (see handleAddItem) rather
                // than blocking or duplicating a row.
                const owned = equippedIds.has(item.id) || carriedIds.has(item.id);
                return (
                  <View style={[addStyles.itemRow, owned && addStyles.itemRowOwned]}>
                    <View style={addStyles.itemInfo}>
                      <View style={addStyles.itemNameLine}>
                        <Text style={[addStyles.itemName, owned && addStyles.itemNameOwned]}>
                          {item.name}
                        </Text>
                        {!homebrewItemIds.has(item.id) && isNonSrd(item.srd, item.rulesetId) && <NonSrdBadge />}
                      </View>
                      {item.properties.length > 0 && (
                        <Text style={addStyles.itemProps} numberOfLines={1}>
                          {item.properties.join(' · ')}
                        </Text>
                      )}
                      {item.cost !== '0 gp' && item.cost && (
                        <Text style={addStyles.itemCost}>{item.cost}</Text>
                      )}
                    </View>
                    <View style={addStyles.itemActions}>
                      {owned && (
                        <Text style={addStyles.ownedBadge}>
                          {equippedIds.has(item.id) ? 'Equipped' : 'In bag'}
                        </Text>
                      )}
                      <Pressable
                        style={addStyles.addBtn}
                        onPress={() => { onAdd(item.id); }}
                      >
                        <Text style={addStyles.addBtnTxt}>{owned ? '+1' : '+ Add'}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
          <Pressable style={addStyles.cancelBtn} onPress={onClose}>
            <Text style={addStyles.cancelTxt}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
