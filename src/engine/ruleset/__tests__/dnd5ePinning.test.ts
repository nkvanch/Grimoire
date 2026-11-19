// A D&D character's lock and the exact definitions it was resolved with (the desktop app's tests/test_pinning_dnd5e.cpp and
// test_pinned_content_dnd5e.cpp, on this app's characters and the SRD packs).
import { buildSrd51Pack, buildSrd521Pack } from '../../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../../content/provider/contentProvider';
import { createCharacter } from '../../../content/provider/createCharacter';
import { pinningCatalog } from '../../../content/pinningCatalog';
import { DEFAULT_RULES } from '../../defaults';
import { canonicalJson } from '../../contentPackManifest';
import { MemoryRevisionStore, revisionKeyOf, getRevision } from '../../pinning/revisionStore';
import { lockToJson } from '../../pinning/lock';
import {
  currentLockFor, pinnedLockOf, attachLock, lockReport, resolvePinnedContent, catalogWithPinned, checkOperationsFor,
  extendLockDefinitions, definitionsOf,
} from '../dnd5ePinning';
import type { Entity, RulesetId } from '../../types';

const file = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const packs = (): InstalledPack[] => [file(buildSrd521Pack()), file(buildSrd51Pack())] as InstalledPack[];
const STATS = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 10 };
const make = (classId: string, level = 1, ruleset: RulesetId = 'dnd5e-2014' as RulesetId, raceId = 'human', backgroundId = 'acolyte'): Entity =>
  createCharacter(packContentProvider(packs(), ruleset), { id: `${classId}-${level}`, name: classId, classId, raceId, backgroundId, stats: STATS, level }, DEFAULT_RULES);

/** The installed packs with the fighter class edited, as a pack update would. */
const withEditedFighter = (): InstalledPack[] => {
  const list = packs();
  const srd = list.find(p => p.manifest.id === 'grimoire.srd.5.1')!;
  const classes = (srd.homebrew!.classes as unknown as Record<string, unknown>[]);
  const i = classes.findIndex(c => c.id === 'fighter');
  classes[i] = { ...classes[i], description: 'Edited by a later version of the pack.' };
  return list;
};

describe('the lock a D&D character keeps', () => {
  it('names its ruleset, the packs of that ruleset, every definition it depends on, and every operation at this app\'s revision', () => {
    const made = make('wizard', 3);
    // a spell the wizard knows (a new character has not picked its spells yet)
    const wizard = { ...made, spellcasting: { ...made.spellcasting!, known: [...made.spellcasting!.known, 'magic_missile'] } } as Entity;
    const lock = currentLockFor(wizard, pinningCatalog(packs()), 1700000000);
    expect(lock).toMatchObject({ rulesetId: 'dnd5e-2014', rulesetRevision: '1', lockedAt: 1700000000 });
    expect(Object.keys(lock.content)).toEqual(['pack:grimoire.srd.5.1']);            // the 5.2.1 pack is for the other ruleset
    expect(lock.definitions).toEqual(expect.objectContaining({ 'class:wizard': expect.stringMatching(/^sha256:[0-9a-f]{64}$/), 'race:human': expect.any(String), 'background:acolyte': expect.any(String) }));
    expect(lock.definitions['spell:magic_missile']).toMatch(/^sha256:/);
    expect(Object.keys(lock.operations)).toHaveLength(27);
    expect(lock.operations['dnd5e.level_up']).toBe(3);
    // a revision is the hash of the record's canonical JSON, as the pack has it
    const wizardRecord = (packs()[1].homebrew!.classes as unknown as Record<string, unknown>[]).find(c => c.id === 'wizard')!;
    expect(lock.definitions['class:wizard']).toBe(revisionKeyOf(canonicalJson(wizardRecord)));
  });

  it('keeps the text of every revision it names when it is kept, and reads back from the character', () => {
    const store = new MemoryRevisionStore();
    const fighter = attachLock(make('fighter'), currentLockFor(make('fighter'), pinningCatalog(packs()), 5, store));
    const lock = pinnedLockOf(fighter)!;
    for (const key of Object.values(lock.definitions)) expect(getRevision(store, key).status).toBe('found');
    expect(lockToJson(lock)).toEqual((fighter as unknown as { pins: unknown }).pins);
    expect(pinnedLockOf(make('fighter'))).toBeNull();                               // not pinned until it is kept
  });

  it('reads a first-version lock\'s homebrew fingerprints as definitions', () => {
    const e = { ...make('fighter'), pins: { ruleset: { id: 'dnd5e-2014', revision: '1' }, content: { 'pack:x': '1.0.0', 'homebrew:item:blade': 'sha256:' + 'b'.repeat(64) }, operations: {}, lockedAt: 1 } } as unknown as Entity;
    expect(pinnedLockOf(e)).toMatchObject({ content: { 'pack:x': '1.0.0' }, definitions: { 'item:blade': 'sha256:' + 'b'.repeat(64) } });
  });
});

describe('resolving a pinned character', () => {
  const pinnedFighter = (store: MemoryRevisionStore) => {
    const f = make('fighter');
    return attachLock(f, currentLockFor(f, pinningCatalog(packs()), 1, store));
  };

  it('nothing to lay over and nothing to report when what is installed is what it was pinned to', () => {
    const store = new MemoryRevisionStore();
    expect(resolvePinnedContent(pinnedFighter(store), pinningCatalog(packs()), store)).toEqual({ pinned: true, records: [], issues: [] });
    expect(lockReport(pinnedFighter(store), pinningCatalog(packs()))).toEqual([]);
  });

  it('a definition changed since is resolved from the kept revision, and the report says it changed', () => {
    const store = new MemoryRevisionStore();
    const fighter = pinnedFighter(store);
    const installed = pinningCatalog(withEditedFighter());
    const resolution = resolvePinnedContent(fighter, installed, store);
    expect(resolution.issues).toEqual([]);
    expect(resolution.records.map(r => `${r.type}:${r.id}`)).toEqual(['class:fighter']);
    expect(catalogWithPinned(installed, resolution).definition('class', 'fighter', 'dnd5e-2014')).not.toHaveProperty('description', 'Edited by a later version of the pack.');
    expect(lockReport(fighter, installed).map(m => `${m.kind} ${m.key}`)).toEqual(['content_changed class:fighter']);
  });

  it('a revision that is not kept, or damaged, is reported, and the installed version is only shown in its place', () => {
    const store = new MemoryRevisionStore();
    const fighter = pinnedFighter(store);
    const installed = pinningCatalog(withEditedFighter());
    const missing = resolvePinnedContent(fighter, installed, new MemoryRevisionStore());
    expect(missing.issues.map(i => `${i.kind} ${i.key} ${i.substituted}`)).toEqual(['revision_missing class:fighter true']);
    const key = pinnedLockOf(fighter)!.definitions['class:fighter'];
    store.corruptForTest(key, '{"id":"fighter","tampered":true}');
    expect(resolvePinnedContent(fighter, installed, store).issues.map(i => i.kind)).toEqual(['revision_invalid']);
  });

  it('a definition the character took on after it was pinned is reported as not pinned', () => {
    const store = new MemoryRevisionStore();
    const fighter = pinnedFighter(store);
    const withPotion = { ...fighter, inventory: { ...fighter.inventory, carried: [...fighter.inventory.carried, { ...fighter.inventory.carried[0], id: 'inst-x', itemId: 'healers_kit' }] } };
    expect(resolvePinnedContent(withPotion, pinningCatalog(packs()), store).issues.map(i => `${i.kind} ${i.key}`)).toEqual(['not_pinned item:healers_kit']);
  });
});

describe('the content gate', () => {
  it('refuses the automatic steps that read a definition whose pinned revision cannot be had, and nothing else', () => {
    const store = new MemoryRevisionStore();
    const f = make('fighter');
    const fighter = attachLock(f, currentLockFor(f, pinningCatalog(packs()), 1, store));
    const installed = pinningCatalog(withEditedFighter());
    // the kept revision is there: everything runs, on the pinned fighter
    expect(checkOperationsFor(fighter, ['dnd5e.long_rest', 'dnd5e.level_up'], installed, store).allowed).toBe(true);
    // it is not kept: a long rest and a level up read the class and are refused; healing and death saves read nothing and go on
    const lost = new MemoryRevisionStore();
    const check = checkOperationsFor(fighter, ['dnd5e.long_rest', 'dnd5e.level_up'], installed, lost);
    expect(check.allowed).toBe(false);
    expect(check.problems.map(p => `${p.operation} ${p.key}`)).toEqual(['dnd5e.long_rest class:fighter', 'dnd5e.level_up class:fighter']);
    expect(check.message).toMatch(/never used in place of it/);
    expect(checkOperationsFor(fighter, ['dnd5e.apply_healing', 'dnd5e.death_saves'], installed, lost).allowed).toBe(true);
    // a character that is not pinned is never held back
    expect(checkOperationsFor(f, ['dnd5e.level_up'], installed, lost).allowed).toBe(true);
  });
});

describe('extending a lock', () => {
  it('names a definition taken on since, keeps its text, and leaves every revision already named', () => {
    const store = new MemoryRevisionStore();
    const f = make('fighter');
    const fighter = attachLock(f, currentLockFor(f, pinningCatalog(packs()), 1, store));
    const before = pinnedLockOf(fighter)!.definitions;
    const withPotion = { ...fighter, inventory: { ...fighter.inventory, carried: [...fighter.inventory.carried, { ...fighter.inventory.carried[0], id: 'inst-x', itemId: 'healers_kit' }] } };
    const { entity, added } = extendLockDefinitions(withPotion, pinningCatalog(withEditedFighter()), store);
    expect(added).toBe(1);
    const after = pinnedLockOf(entity)!.definitions;
    expect(after['item:healers_kit']).toMatch(/^sha256:/);
    expect(after['class:fighter']).toBe(before['class:fighter']);                   // the edited class is not taken on behind the person's back
    expect(getRevision(store, after['item:healers_kit']).status).toBe('found');
  });

  it('leaves alone a character that is not pinned, or whose lock names no definitions', () => {
    const f = make('fighter');
    expect(extendLockDefinitions(f, pinningCatalog(packs()), new MemoryRevisionStore()).added).toBe(0);
    const legacy = { ...f, pins: { ruleset: { id: 'dnd5e-2014', revision: '1' }, content: {}, operations: {}, lockedAt: 1 } } as unknown as Entity;
    expect(extendLockDefinitions(legacy, pinningCatalog(packs()), new MemoryRevisionStore())).toEqual({ entity: legacy, added: 0 });
  });

  it('a 2024 character depends on 2024 definitions and its own ruleset\'s pack', () => {
    const fighter = make('fighter_2024', 1, 'dnd5e-2024' as RulesetId, 'dwarf_2024', 'soldier_2024');
    const keys = definitionsOf(fighter, pinningCatalog(packs())).map(r => `${r.type}:${r.id}`);
    expect(keys).toEqual(expect.arrayContaining(['class:fighter_2024', 'race:dwarf_2024', 'background:soldier_2024']));
    expect(Object.keys(currentLockFor(fighter, pinningCatalog(packs()), 1).content)).toEqual(['pack:grimoire.srd.5.2.1']);
  });
});
