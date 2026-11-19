import { CardGenOptions } from '../../engine/actionCardLayers';
import { ActionCard, Entity } from '../../engine/types';
import { useHomebrewStore } from '../../store/homebrewStore';
import { Colors } from '../../theme';

/**
 * Rules-engine blocker RE-AUDIT closure (dependency inversion, 1B/1D): the
 * ONE place this file resolves the authoritative merged official + homebrew
 * + active-ruleset content — the engine (actionCards.ts/actionUse.ts) never
 * reads useHomebrewStore itself; it's computed here, in the UI layer, and
 * passed down explicitly to every engine call that needs it. Called from
 * both ActionCardRow (the chooser's labels) and TabActionsInner (the actual
 * cast) — getMergedContentDB is internally memoized by its own inputs, so
 * this is one resolution, not two merge implementations.
 */
export function useCardContent(entity: Entity): Pick<CardGenOptions, 'classDefs' | 'homebrewSpells' | 'races' | 'items'> {
  const mergedContentDB = useHomebrewStore(s => s.getMergedContentDB(entity.rulesetId));
  return { classDefs: mergedContentDB.classes, homebrewSpells: mergedContentDB.spells, races: mergedContentDB.races, items: mergedContentDB.items };
}

export type CardLike = Pick<ActionCard, 'featureId' | 'sourceKind' | 'sourceId'>;

/**
 * Item-identity closure (pass 3, finding G): the ONE canonical identity for
 * an ActionCard, used for React keys AND favorite matching/storage alike —
 * `featureId` alone collides whenever two owned instances of the same item
 * (or an item and Additional Equipment/another grant of it) both author the
 * same feature, since sourceKind/sourceId (see actionUse.ts's own
 * stale-card-rejection fix) are the only things that actually distinguish
 * them. Non-item cards (class/spell/race/synthetic) have no instance to
 * disambiguate, so their identity stays exactly `featureId` — unchanged
 * from every card's identity before this closure.
 */
export function actionCardIdentity(card: CardLike): string {
  return card.sourceKind === 'item' && card.sourceId ? `item:${card.sourceId}:${card.featureId}` : card.featureId;
}

/**
 * True if an action card is favorited — checks Entity.favoriteActionIds
 * first, for the card's exact modern identity (the primary mechanism,
 * works for ANY card: feature-backed, weapon-attack, spell-based, or
 * synthetic like Unarmed Strike). Item-identity closure (pass 3, finding
 * G): also accepts a bare `featureId` string (used by every pre-existing
 * caller and test that predates per-instance identity — a non-item card's
 * identity IS its featureId, so this is lossless for them) alongside the
 * narrow legacy-compatibility fallback below.
 *
 * For an ITEM card specifically, a bare `featureId` entry in
 * favoriteActionIds (written by toggleFavoriteTag before this closure, when
 * no instance-aware identity existed yet) is also honored — deliberately
 * BROADER matching than the modern identity, since that old entry can't
 * know which instance the player meant. This is intentional, documented
 * legacy compatibility, not a second source of truth: toggleFavoriteTag
 * below converts it away the first time ANY instance of that card is
 * toggled, so the ambiguity never persists past one interaction.
 */
export function isFavoriteCard(entity: Entity, card: string | CardLike): boolean {
  const featureId = typeof card === 'string' ? card : card.featureId;
  const identity   = typeof card === 'string' ? card : actionCardIdentity(card);
  const favorites = entity.favoriteActionIds ?? [];
  if (favorites.includes(identity)) return true;
  if (identity !== featureId && favorites.includes(featureId)) return true; // legacy item-card fallback
  const f = entity.features.find(x => x.id === featureId)
    ?? entity.inventory.equipped.flatMap(inst => inst.features).find(x => x.id === featureId);
  return f?.favoriteTag === true;
}

export const CARD_COLORS: Record<ActionCard['color'], string> = {
  red:    Colors.red,
  green:  Colors.green,
  blue:   Colors.blue,
  purple: Colors.purple,
  gray:   Colors.textDim,
};
