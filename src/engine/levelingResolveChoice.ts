import { itemIdForCharacter } from '../content/itemForCharacter';
import type { ItemIndexEntry } from '../content/itemRepo.types';
import { itemMatchesConstraint } from '../content/items/itemBrowse';
import { grantEntitlement } from './entitlements';
import { generateItemInstanceId } from './itemMechanics';
import { applyGrant } from './levelingGrants';
import { recomputeDerived } from './pipeline';
import { parseStartingItem } from './startingItems';
import { Entity, CampaignRules, Ability, ItemFilterConstraint } from './types';

// ── resolveChoice ─────────────────────────────────────────────────────────────

export function resolveChoice(
  entity: Entity,
  choiceId: string,
  selections: string[],
  rules: CampaignRules
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) throw new Error(`Choice not found: ${choiceId}`);
  if (selections.length !== pending.definition.count) {
    throw new Error(`Expected ${pending.definition.count} selections, got ${selections.length}`);
  }

  let updated = entity;
  const choiceSource = pending.sourceKind
    ? { kind: pending.sourceKind, id: pending.sourceId, choiceId: pending.id }
    : pending.definition.forClassId
      ? { kind: 'class' as const, id: pending.definition.forClassId, choiceId: pending.id }
      : { kind: 'manual' as const, choiceId: pending.id };
  // Item-identity closure (pass 3, finding F2): collects the EXACT
  // ItemInstance ids this choice grants, across every selection, so
  // reopenEquipmentChoice can later remove precisely what THIS choice
  // added instead of the first same-itemId row it happens to find.
  const grantedItemInstanceIds: string[] = [];
  let grantedGold = 0;

  for (const selId of selections) {
    if (!Array.isArray(pending.definition.pool)) continue;
    const option = pending.definition.pool.find(o => o.id === selId);
    if (!option) throw new Error(`Invalid selection: ${selId}`);

    for (const grant of pending.definition.grants) {
      updated = applyGrant(updated, grant, pending.grantedAt, pending.definition.forClassId, choiceSource);
    }

    // Equipment choices: the option's value is an array of item IDs.
    // Add each as a fresh ItemInstance to the carried inventory.
    if (pending.definition.kind === "equipment") {
      if (option.gold) {
        grantedGold += option.gold;
        updated = addGold(updated, option.gold);
      }
      const itemIds = Array.isArray(option.value) ? (option.value as string[]) : [];
      for (const entry of itemIds) {
        const { itemId: baseId, quantity } = parseStartingItem(entry);
        const itemId = itemIdForCharacter(baseId, updated.rulesetId);
        const instanceId = generateItemInstanceId();
        grantedItemInstanceIds.push(instanceId);
        updated = {
          ...updated,
          inventory: {
            ...updated.inventory,
            carried: [
              ...updated.inventory.carried,
              { id: instanceId, itemId, quantity, attuned: false, features: [] },
            ],
          },
        };
      }
    }

    // Skill choices: mark the skill as trained. Closure pass 2: this has no
    // backing Feature/Effect at all (it never did — see swapBackground's own
    // doc comment on this exact gap), so it's routed through the new
    // entitlement system instead of a raw flat-field mutation — recompute
    // then derives skills[x].trained from entitlements, so removing this
    // choice's origin later correctly un-trains it (unless another source
    // still grants it, or it's flagged sourceKind:'manual' — untraceable
    // provenance stays permanent, same conservative rule everywhere else).
    if (pending.definition.kind === "skill") {
      const skillName = option.value as string;
      if (updated.skills.skills[skillName as keyof typeof updated.skills.skills]) {
        updated = grantEntitlement(updated, {
          kind: 'skill_proficiency', key: skillName,
          sourceKind: pending.sourceKind ?? 'manual', sourceId: pending.sourceId, choiceId: pending.id,
        });
      }
    }

    // Spellcasting ability choice: rare-case homebrew classes whose casting
    // ability isn't fixed (see CharClass.spellcastingAbilityOptions). The
    // option's value is the chosen Ability; initialise spellcasting with it
    // exactly like the init_spellcasting grant would for a fixed-ability class.
    if (pending.definition.kind === "spellcasting_ability") {
      updated = applyGrant(updated, { kind: 'init_spellcasting', value: { ability: option.value as Ability } }, pending.grantedAt);
    }
  }

  updated = {
    ...updated,
    choices: updated.choices.map(c =>
      c.id === choiceId
        ? { ...c, resolved: true, selections, ...(grantedItemInstanceIds.length ? { grantedItemInstanceIds } : {}), ...(grantedGold ? { grantedGold } : {}) }
        : c
    )
  };

  return recomputeDerived(updated, rules);
}

export function addGold(entity: Entity, gp: number): Entity {
  return { ...entity, inventory: { ...entity.inventory, currency: { ...entity.inventory.currency, gp: entity.inventory.currency.gp + gp } } };
}

// ── STARTING-EQUIPMENT-1 ─────────────────────────────────────────────────────
// A dedicated resolver for kind:'equipment' choices using the new
// exact_options/bundle_options/filtered_item styles (ChoiceDefinition's own
// doc comment explains the shapes). Deliberately separate from
// resolveChoice() above rather than folding into it: resolveChoice's
// `selections: string[]` contract (each entry a pool-option id) doesn't fit
// a filtered_item choice, whose "selections" are real item ids with no pool
// at all — extending that one shared function's contract to cover this would
// risk every OTHER choice kind it already serves (skill/spell/language/...).
// Every existing equipment choice literal in src/content (no `equipmentStyle`
// set) is untouched and keeps going through resolveChoice() exactly as
// before — this function is additive, not a replacement.

export type EquipmentChoiceResolution =
  | { style: 'filtered_item'; itemIds: string[] }
  | { style: 'exact_options' | 'bundle_options'; optionId: string; filteredItemIds?: string[] };

/** Caller supplies item lookup (Tier-1 index entries) — this function does
 *  no I/O and doesn't care whether the source is the official spellRepo-
 *  style index, homebrew, or a merge of both. */
export function resolveEquipmentChoice(
  entity: Entity,
  choiceId: string,
  resolution: EquipmentChoiceResolution,
  itemLookup: (id: string) => ItemIndexEntry | undefined,
  rules: CampaignRules,
): Entity {
  const pending = entity.choices.find(c => c.id === choiceId);
  if (!pending) throw new Error(`Choice not found: ${choiceId}`);
  if (pending.definition.kind !== 'equipment') throw new Error(`Not an equipment choice: ${choiceId}`);

  function requireMatches(ids: string[], constraint: ItemFilterConstraint) {
    for (const id of ids) {
      const item = itemLookup(id);
      if (!item || !itemMatchesConstraint(item, constraint)) {
        throw new Error(`Item "${id}" does not satisfy the required constraint for this choice.`);
      }
    }
  }

  let fixedItemIds: string[] = [];
  let filteredItemIds: string[] = [];
  let selections: string[] = [];
  let grantedGold = 0;

  if (resolution.style === 'filtered_item') {
    const constraint = pending.definition.itemFilter ?? {};
    if (resolution.itemIds.length !== pending.definition.count) {
      throw new Error(`Expected ${pending.definition.count} item(s), got ${resolution.itemIds.length}.`);
    }
    requireMatches(resolution.itemIds, constraint);
    filteredItemIds = resolution.itemIds;
    selections = filteredItemIds;
  } else {
    const pool = Array.isArray(pending.definition.pool) ? pending.definition.pool : [];
    const option = pool.find(o => o.id === resolution.optionId);
    if (!option) throw new Error(`Invalid selection: ${resolution.optionId}`);
    fixedItemIds = Array.isArray(option.value) ? option.value as string[] : [];
    if (option.itemFilter) {
      const got = resolution.filteredItemIds ?? [];
      if (got.length !== option.itemFilter.quantity) {
        throw new Error(`Expected ${option.itemFilter.quantity} item(s), got ${got.length}.`);
      }
      requireMatches(got, option.itemFilter.constraint);
      filteredItemIds = got;
    }
    selections = [resolution.optionId, ...filteredItemIds];
    grantedGold = option.gold ?? 0;
  }

  let updated = grantedGold ? addGold(entity, grantedGold) : entity;
  for (const grant of pending.definition.grants) {
    updated = applyGrant(updated, grant, pending.grantedAt);
  }
  const grantedItemInstanceIds: string[] = [];
  for (const entry of [...fixedItemIds, ...filteredItemIds]) {
    const { itemId: baseId, quantity } = parseStartingItem(entry);
    const itemId = itemIdForCharacter(baseId, updated.rulesetId);
    const instanceId = generateItemInstanceId();
    grantedItemInstanceIds.push(instanceId);
    updated = {
      ...updated,
      inventory: {
        ...updated.inventory,
        carried: [...updated.inventory.carried, { id: instanceId, itemId, quantity, attuned: false, features: [] }],
      },
    };
  }
  updated = {
    ...updated,
    choices: updated.choices.map(c => c.id === choiceId
      ? { ...c, resolved: true, selections, ...(grantedItemInstanceIds.length ? { grantedItemInstanceIds } : {}), ...(grantedGold ? { grantedGold } : {}) }
      : c),
  };

  return recomputeDerived(updated, rules);
}
