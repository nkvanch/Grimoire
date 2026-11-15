// src/engine/featureText.ts
// The rules text behind something on the sheet, for showing it when tapped: an action card (Actions tab and everywhere cards are
// listed) and a resource (Combat tab). Cards and resources carry no description of their own; it lives on the feature, the item
// or the spell they come from.
import type { ActionCard, Entity, Feature, Item } from './types';
import { spellRepo } from '../content/spellRepo';
import { resolveItemDefinition } from './itemMechanics';

const text = (f: Pick<Feature, 'description'> | undefined) => (f?.description?.trim() ? f.description.trim() : null);

/** What a card does in words: its feature's, its item's or its spell's text. null when nothing records any. */
export function cardDescription(entity: Entity, card: ActionCard, homebrewItems: readonly Item[] = []): string | null {
  const own = text(entity.features.find(f => f.id === card.featureId));
  if (own) return own;
  const owned = [...entity.inventory.equipped, ...entity.inventory.carried];
  const inst = owned.find(i => i.id === card.sourceId || card.featureId.startsWith(`${i.id ?? i.itemId}_`));
  if (inst) {
    const def = resolveItemDefinition(inst.itemId, homebrewItems);
    const fromItem = [...(inst.features ?? []), ...(def?.features ?? [])].find(f => f.id === card.featureId) ?? (inst.features ?? [])[0] ?? def?.features[0];
    const t = text(fromItem);
    if (t) return t;
  }
  return text(spellRepo.getSpellSync(card.featureId, entity.rulesetId));
}

/**
 * What a resource is for: the feature named like it (Ki, Channel Divinity), or else every feature that spends it (Action Surge's
 * pool), each with its own text. Empty when nothing on the character mentions it.
 */
export function resourceDescription(entity: Entity, resource: { id: string; name: string }): { name: string; text: string }[] {
  const bare = (s: string) => s.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
  const withText = (fs: Feature[]) => fs.flatMap(f => { const t = text(f); return t ? [{ name: f.name, text: t }] : []; });
  const named = withText(entity.features.filter(f => bare(f.name) === bare(resource.name)));
  if (named.length) return named;
  return withText(entity.features.filter(f => f.activation?.resourceCost?.resourceId === resource.id));
}
