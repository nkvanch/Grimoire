import { MonsterVisibility, RewardKind, SessionLogKind, CharacterVitals } from './types';

export const STATS = ['ac', 'speed', 'initiative', 'save', 'spell_attack', 'spell_dc'];

export function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
export function str(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 200;
}
export function optStr(x: unknown): x is string | null {
  return x === null || (typeof x === 'string' && x.length <= 2000);
}
export function int(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x);
}
export function validMonsterVisibility(x: unknown): x is MonsterVisibility {
  return isObj(x) && typeof x.name === 'boolean' && typeof x.hpState === 'boolean'
    && typeof x.exactHp === 'boolean' && typeof x.ac === 'boolean' && typeof x.conditions === 'boolean';
}
const REWARD_KINDS = new Set<RewardKind>(['homebrew_feature', 'resource', 'proficiency', 'reward_tier', 'permanent_modifier', 'campaign_boon']);
export function rewardKind(x: unknown): x is RewardKind {
  return typeof x === 'string' && REWARD_KINDS.has(x as RewardKind);
}
const SESSION_LOG_KINDS = new Set<SessionLogKind>(['major_event', 'encounter_outcome', 'npc_death', 'quest_outcome', 'reward', 'milestone', 'rule_change', 'custom_note']);
export function sessionLogKind(x: unknown): x is SessionLogKind {
  return typeof x === 'string' && SESSION_LOG_KINDS.has(x as SessionLogKind);
}
/** Session log text is narrative prose, not a short label — same ceiling as a RuleSuggestion note. */
export function logText(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 2000;
}

/** Lightweight structural validation — this is read-only DM-dashboard display data (see
 *  CharacterVitals's own doc comment), not something any op applies consequences from, so this
 *  checks shape/types rather than game-rule bounds (e.g. a homebrew resource's maximum isn't
 *  capped here). */
export function validVitals(x: unknown): x is CharacterVitals {
  if (!isObj(x)) return false;
  if (typeof x.tempHp !== 'number' || typeof x.speed !== 'number') return false;
  if (!int(x.exhaustion) || x.exhaustion < 0 || x.exhaustion > 6) return false;
  if (!Array.isArray(x.conditions) || !x.conditions.every(c => typeof c === 'string')) return false;
  if (x.concentration !== null && typeof x.concentration !== 'string') return false;
  const ds = x.deathSaves;
  if (!isObj(ds) || !int(ds.successes) || !int(ds.failures) || typeof ds.stable !== 'boolean') return false;
  if (!Array.isArray(x.resources) || !x.resources.every(r =>
    isObj(r) && str(r.id) && str(r.name) && typeof r.current === 'number' && typeof r.maximum === 'number')) return false;
  if (x.spellSlots !== null) {
    if (!isObj(x.spellSlots)) return false;
    if (!Object.values(x.spellSlots).every(s => isObj(s) && typeof s.total === 'number' && typeof s.used === 'number')) return false;
  }
  // Live Play additions are optional, but when present they must be well formed.
  const strs = (v: unknown) => Array.isArray(v) && v.length <= 64 && v.every(i => typeof i === 'string' && i.length <= 80);
  if (x.passives !== undefined) {
    const p = x.passives;
    if (!isObj(p) || typeof p.perception !== 'number' || typeof p.investigation !== 'number' || typeof p.insight !== 'number') return false;
  }
  if (x.defenses !== undefined) {
    const d = x.defenses;
    if (!isObj(d) || !strs(d.resistances) || !strs(d.immunities) || !strs(d.vulnerabilities) || !strs(d.conditionImmunities) || typeof d.critsNegated !== 'boolean') return false;
  }
  if (x.effects !== undefined && !strs(x.effects)) return false;
  return true;
}
