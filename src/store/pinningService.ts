// ============================================================================
// FILE: src/store/pinningService.ts
// The app's side of revision pinning (contract LIFE-004, the desktop app's CharacterViewModel lock services): the catalog of what is installed
// (official packs and the person's library), the device's revision store, and the three things the app does with them:
//  - a character is pinned when it is kept, and on "pin to installed";
//  - an automatic step is refused when the character's pinned versions cannot run it (never a free edit or a manual step);
//  - every change to a pinned character names any definition it took on since, keeping what the lock already names.
// ============================================================================
import { installedOfficialPacks } from '../content/officialPackService';
import { pinningCatalog } from '../content/pinningCatalog';
import { useHomebrewStore } from './homebrewStore';
import { MemoryRevisionStore, RevisionStore } from '../engine/pinning/revisionStore';
import { DurableRevisionStore } from '../db/revisionRepo';
import {
  currentLockFor, attachLock, checkOperationsFor, extendLockDefinitions, lockReport, resolvePinnedContent, pinnedLockOf, type PinningCatalog,
} from '../engine/ruleset/dnd5ePinning';
import type { Entity } from '../engine/types';

// Until the durable store is open (or if it cannot be), revisions live as long as this session, as on the desktop.
let store: RevisionStore = new MemoryRevisionStore();
export const revisionStore = (): RevisionStore => store;
/** Called once at boot, after the database is open. */
export async function openRevisionStore(): Promise<void> {
  store = await DurableRevisionStore.open();
}
/** Tests only. */
export const setRevisionStoreForTest = (s: RevisionStore) => { store = s; };

let cached: { packs: unknown; hb: unknown; catalog: PinningCatalog } | null = null;
/** What is installed, as records exactly as they are held. Rebuilt only when the packs or the library change. */
export function installedCatalog(): PinningCatalog {
  const packs = installedOfficialPacks();
  const hb = useHomebrewStore.getState();
  const lists = [hb.races, hb.subraces, hb.classes, hb.subclasses, hb.backgrounds, hb.spells, hb.items, hb.feats];
  if (cached && cached.packs === packs && (cached.hb as unknown[]).every((l, i) => l === lists[i])) return cached.catalog;
  const catalog = pinningCatalog(packs, {
    race: hb.races, subrace: hb.subraces, class: hb.classes, subclass: hb.subclasses, background: hb.backgrounds,
    spell: hb.spells, item: hb.items, feat: hb.feats,
  } as never);
  cached = { packs, hb: lists, catalog };
  return catalog;
}

/** The character pinned to what is installed now, with the text of every definition kept. */
export const pinToInstalled = (entity: Entity): Entity =>
  attachLock(entity, currentLockFor(entity, installedCatalog(), Math.floor(Date.now() / 1000), store));

/** Why the automatic operations of a step cannot run for this character, or null when they can (or it is not pinned). */
export function pinGate(entity: Entity, operations: readonly string[] | undefined): string | null {
  if (!operations?.length) return null;
  const check = checkOperationsFor(entity, operations, installedCatalog(), store);
  return check.allowed ? null : check.message;
}

/** The character with any definition it took on since it was pinned named in its lock (unchanged when there is none). */
export const extendPinnedLock = (entity: Entity): Entity => extendLockDefinitions(entity, installedCatalog(), store).entity;

export type VersionNotes = { pinned: boolean; lockedAt: number | null; differences: string[] };
/** What the character was resolved with against what is installed, as the desktop sheet tells it: each difference once (what could not be
 *  resolved exactly says it better than the plain difference), told and never applied. */
export function versionNotes(entity: Entity): VersionNotes {
  const lock = pinnedLockOf(entity);
  if (!lock) return { pinned: false, lockedAt: null, differences: [] };
  const installed = installedCatalog();
  const issues = resolvePinnedContent(entity, installed, store).issues;
  const said = new Set(issues.map(i => i.key));
  const differences = [...lockReport(entity, installed).filter(m => !said.has(m.key)).map(m => m.message), ...issues.map(i => i.message)];
  return { pinned: true, lockedAt: lock.lockedAt, differences };
}

/** The dnd5e operations each sheet step runs, as the desktop app's CharacterViewModel names them. */
export const STEP_OPERATIONS = {
  damage: ['dnd5e.apply_damage', 'dnd5e.damage_modifiers'],
  wildShapeDamage: ['dnd5e.wild_shape_damage'],
  heal: ['dnd5e.apply_healing'],
  conditions: ['dnd5e.conditions'],
  spellSlots: ['dnd5e.spell_slots'],
  equipment: ['dnd5e.equipment'],
  shortRest: ['dnd5e.short_rest'],
  longRest: ['dnd5e.long_rest'],
  endTurn: ['dnd5e.dawn_recharge'],
  levelUp: ['dnd5e.level_up', 'dnd5e.hit_point_gain', 'dnd5e.proficiency_bonus'],
  deathSaves: ['dnd5e.death_saves'],
  tempHp: ['dnd5e.temp_hp'],
  companion: ['dnd5e.companion'],
  derivedStats: ['dnd5e.derived_stats'],
} as const;
