import { Dispatch, SetStateAction } from 'react';
import { ContentTypeId } from '../../../content/contentQuery';
import { ItemCategoryId, ITEM_CATEGORY_LABELS } from '../../../content/items/itemBrowse';
import { FilterSection, FilterChipRow, MultiSelectChipRow } from '../../FilterChipRow';

export function ItemFilters({
  contentType, itemCat, setItemCat, itemMagical, setItemMagical, itemWeaponClass, setItemWeaponClass, itemWeaponRange, setItemWeaponRange,
  itemArmorWeightF, setItemArmorWeightF, availableItemRarities, itemRarity, setItemRarity,
}: {
  contentType: ContentTypeId | "all";
  itemCat: ItemCategoryId | null;
  setItemCat: Dispatch<SetStateAction<ItemCategoryId | null>>;
  itemMagical: "all" | "magical" | "mundane";
  setItemMagical: Dispatch<SetStateAction<"all" | "magical" | "mundane">>;
  itemWeaponClass: "martial" | "simple" | null;
  setItemWeaponClass: Dispatch<SetStateAction<"martial" | "simple" | null>>;
  itemWeaponRange: "melee" | "ranged" | null;
  setItemWeaponRange: Dispatch<SetStateAction<"melee" | "ranged" | null>>;
  itemArmorWeightF: "heavy" | "medium" | "light" | null;
  setItemArmorWeightF: Dispatch<SetStateAction<"heavy" | "medium" | "light" | null>>;
  availableItemRarities: ("common" | "uncommon" | "rare" | "very rare" | "legendary" | "artifact")[];
  itemRarity: Set<string>;
  setItemRarity: Dispatch<SetStateAction<Set<string>>>;
}) {
  return (
    <>
      {contentType === 'item' && (
        <>
          <FilterSection label="Category">
            <FilterChipRow options={(Object.keys(ITEM_CATEGORY_LABELS) as ItemCategoryId[]).map(id => ({ id, label: ITEM_CATEGORY_LABELS[id] }))} value={itemCat} onChange={setItemCat} scrollable />
          </FilterSection>
          <FilterSection label="Magical / Mundane">
            <FilterChipRow options={[{ id: 'magical' as const, label: 'Magical' }, { id: 'mundane' as const, label: 'Mundane' }]} value={itemMagical === 'all' ? null : itemMagical} onChange={v => setItemMagical(v ?? 'all')} />
          </FilterSection>
          {itemCat === 'weapon' && (
            <>
              <FilterSection label="Weapon Class">
                <FilterChipRow options={[{ id: 'martial' as const, label: 'Martial' }, { id: 'simple' as const, label: 'Simple' }]} value={itemWeaponClass} onChange={setItemWeaponClass} />
              </FilterSection>
              <FilterSection label="Weapon Range">
                <FilterChipRow options={[{ id: 'melee' as const, label: 'Melee' }, { id: 'ranged' as const, label: 'Ranged' }]} value={itemWeaponRange} onChange={setItemWeaponRange} />
              </FilterSection>
            </>
          )}
          {itemCat === 'armor' && (
            <FilterSection label="Armor Class">
              <FilterChipRow options={[{ id: 'heavy' as const, label: 'Heavy' }, { id: 'medium' as const, label: 'Medium' }, { id: 'light' as const, label: 'Light' }]} value={itemArmorWeightF} onChange={setItemArmorWeightF} />
            </FilterSection>
          )}
          {availableItemRarities.length > 0 && (
            <FilterSection label="Rarity">
              <MultiSelectChipRow options={availableItemRarities.map(r => ({ id: r, label: r[0].toUpperCase() + r.slice(1) }))} values={itemRarity} onChange={setItemRarity} />
            </FilterSection>
          )}
        </>
      )}
    </>
  );
}
