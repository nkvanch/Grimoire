// ============================================================================
// FILE: src/content/contentUsage.ts
// "Existing characters are not silently changed by content changes." A
// character keeps an item or spell by id, and its rules are read from the
// library when the character loads (engine/itemMechanics.ts), so editing a
// homebrew item or spell changes every character that uses it. The builders ask
// first, naming those characters, instead of changing them quietly.
// ============================================================================
import type { Entity } from '../engine/types';
import { itemIdsOnEntity } from './itemRepo.types';
import { spellIdsOnEntity } from './spellRepo.types';

/** The characters (and companions) on this device that carry this item or know or prepare this spell. */
export function charactersUsing(type: 'item' | 'spell', id: string, characters: readonly Entity[]): Entity[] {
  return characters.filter(c => (type === 'item' ? itemIdsOnEntity(c) : spellIdsOnEntity(c)).includes(id));
}

/** The question a builder asks before saving an edit that changes those characters, or null when nobody uses it. */
export function usedByWarning(type: 'item' | 'spell', users: readonly Entity[]): { title: string; message: string } | null {
  if (users.length === 0) return null;
  const names = users.map(u => u.identity.name || 'Unnamed');
  const shown = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  const one = users.length === 1;
  const what = type === 'item' ? (one ? 'carries this item' : 'carry this item') : (one ? 'has this spell' : 'have this spell');
  return {
    title: `Change it for ${users.length} character${users.length === 1 ? '' : 's'}?`,
    message: `${shown} ${what}. Saving changes what it does for them too, the next time their sheet opens.`,
  };
}
