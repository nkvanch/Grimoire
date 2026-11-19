// ============================================================================
// FILE: src/content/spellRepo.ts
// The spell repo on every platform: a thin synchronous wrapper around the static spell arrays
// (src/content/spells/index.ts, which Metro swaps for an empty module in the app), served through the
// installed packs by withOfficialSpells.
// ============================================================================
import { Spell } from '../engine/types';
import { ALL_SPELLS } from './spells/index';
import type { SpellIndexEntry, SpellRepo } from './spellRepo.types';
import { withOfficialSpells } from './packRepos';
import { resolveSpellVersion } from './spells/spellVersions';

const spellById = new Map<string, Spell>(ALL_SPELLS.map(s => [s.id, s]));

const index: SpellIndexEntry[] = ALL_SPELLS.map(s => ({
  id:            s.id,
  name:          s.name,
  level:         s.level,
  school:        s.school,
  castingTime:   s.castingTime,
  ritual:        s.ritual,
  concentration: s.concentration,
  classes:       s.classes,
  srd:           s.srd,
  rulesetId:     s.rulesetId,
  components:    s.components,
}));

export const spellRepo: SpellRepo = withOfficialSpells({
  async init() { /* no-op — the static arrays are already in memory */ },
  getIndex() { return index; },
  async ensureLoaded() { /* no-op — everything is already resident */ },
  getSpellSync(id, rulesetId) { return resolveSpellVersion(spellById.get(id), rulesetId); },
});
