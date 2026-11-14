// ============================================================================
// FILE: src/engine/featureModes.ts
// Modes: a feature (a character's or an item's) can work in one of several named ways, and the person switches between them on the
// sheet. The active mode's effects apply on top of the feature's own; the first mode is active until another is chosen. Which mode is
// active is kept on the character (Entity.featureModes), so an item keeps its own mode per owned copy.
// ============================================================================
import type { Effect, Entity, Feature, FeatureMode } from './types';

/** The key the active mode is kept under: the feature id, or `instanceId/featureId` for a feature on an owned item. */
export const modeKey = (featureId: string, instanceId?: string): string => (instanceId ? `${instanceId}/${featureId}` : featureId);

/** The mode in force, or null when the feature has none. */
export function activeMode(feature: Pick<Feature, 'modes'>, entity: Pick<Entity, 'featureModes'>, key: string): FeatureMode | null {
  const modes = feature.modes ?? [];
  if (!modes.length) return null;
  return modes.find(m => m.id === entity.featureModes?.[key]) ?? modes[0];
}

/** Every effect the feature has now: its own, then its active mode's. */
export function effectsInForce(feature: Pick<Feature, 'effects' | 'modes'>, entity: Pick<Entity, 'featureModes'>, key: string): Effect[] {
  const mode = activeMode(feature, entity, key);
  return mode ? [...(feature.effects ?? []), ...mode.effects] : (feature.effects ?? []);
}

/** The character with `modeId` active for the feature under `key`. */
export function setFeatureMode(entity: Entity, key: string, modeId: string): Entity {
  return { ...entity, featureModes: { ...(entity.featureModes ?? {}), [key]: modeId } };
}
