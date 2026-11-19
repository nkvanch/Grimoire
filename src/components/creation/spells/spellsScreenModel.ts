import { Entity } from '../../../engine/types';

export const SCREEN_KEY = 'spell_picker';

/** Marks spellsVisited in notes JSON. */
export function markVisited(entity: Entity): Entity {
  let n: Record<string, unknown> = {};
  try { n = JSON.parse(entity.notes || '{}'); } catch { /* ignore */ }
  return { ...entity, notes: JSON.stringify({ ...n, spellsVisited: true }) };
}

export type AdditionalSpellFlow = 'closed' | 'menu' | 'library' | 'homebrew';
