// Revision pinning in the app (contract LIFE-004, the desktop app's CharacterViewModel lock services): a character is pinned when it is kept, an
// automatic step its pinned versions cannot run is refused with nothing changed (a free edit never is), every change names the content taken on
// since, and the person can see what differs and move the character onto what is installed.
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../../engine/defaults';
import { MemoryRevisionStore } from '../../engine/pinning/revisionStore';
import { pinnedLockOf } from '../../engine/ruleset/dnd5ePinning';
import type { Entity, RulesetId } from '../../engine/types';
import * as entityRepo from '../../db/entityRepo';
import * as draftRepo from '../../db/draftRepo';

let mockInstalled: InstalledPack[] = [];
jest.mock('../../content/officialPackService', () => ({
  ...jest.requireActual('../../content/officialPackService'),
  installedOfficialPacks: () => mockInstalled,
}));
import { useCharacterStore } from '../characterStore';
import { setRevisionStoreForTest, STEP_OPERATIONS, versionNotes, pinToInstalled } from '../pinningService';

const srd = (): InstalledPack => JSON.parse(JSON.stringify(buildSrd51Pack()));
const withEditedFighter = (): InstalledPack[] => {
  const p = srd();
  const classes = p.homebrew!.classes as unknown as Record<string, unknown>[];
  const i = classes.findIndex(c => c.id === 'fighter');
  classes[i] = { ...classes[i], description: 'Edited by a later version of the pack.' };
  return [p];
};
const fighter = (): Entity => createCharacter(packContentProvider([srd()], 'dnd5e-2014' as RulesetId),
  { id: 'f1', name: 'Fighter', classId: 'fighter', raceId: 'human', backgroundId: 'acolyte', stats: { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 10 }, level: 1 },
  DEFAULT_RULES);

beforeEach(() => {
  jest.useFakeTimers();
  mockInstalled = [srd()];
  setRevisionStoreForTest(new MemoryRevisionStore());
  jest.spyOn(entityRepo, 'saveEntity').mockResolvedValue(undefined);
  jest.spyOn(draftRepo, 'clearDraftState').mockResolvedValue(undefined);
  useCharacterStore.setState({ characters: [], undoStack: [], redoStack: [], draft: null });
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

async function keep(e: Entity): Promise<Entity> {
  useCharacterStore.setState({ draft: e });
  expect(await useCharacterStore.getState().saveDraft()).toBe(true);
  return useCharacterStore.getState().characters[0];
}

it('a character is pinned to what is mockInstalled when it is kept, and is saved with its lock', async () => {
  const kept = await keep(fighter());
  const lock = pinnedLockOf(kept)!;
  expect(lock.content).toEqual({ 'pack:grimoire.srd.5.1': expect.any(String) });
  expect(lock.definitions['class:fighter']).toMatch(/^sha256:/);
  expect(entityRepo.saveEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1', pins: kept.pins }));
});

it('a step whose pinned content cannot be had is refused and changes nothing; a free edit and a step that reads nothing go on', async () => {
  const kept = await keep(fighter());
  mockInstalled = withEditedFighter();
  setRevisionStoreForTest(new MemoryRevisionStore());                     // the kept revisions are gone
  const store = useCharacterStore.getState();
  const refusal = store.updateCharacter('f1', e => ({ ...e, notes: 'rested' }), 'Long Rest', 'rest', STEP_OPERATIONS.longRest);
  expect(refusal).toMatch(/class:fighter/);
  expect(useCharacterStore.getState().characters[0]).toBe(kept);
  expect(useCharacterStore.getState().undoStack).toHaveLength(0);
  expect(store.updateCharacter('f1', e => ({ ...e, notes: 'healed' }), 'Healed 3', 'combat', STEP_OPERATIONS.heal)).toBeNull();
  expect(store.updateCharacter('f1', e => ({ ...e, notes: 'typed' }), 'Free edit', 'other')).toBeNull();
  expect(useCharacterStore.getState().characters[0].notes).toBe('typed');
});

it('content a pinned character takes on is named in its lock by the same change; what the lock named stays', async () => {
  const kept = await keep(fighter());
  const before = pinnedLockOf(kept)!.definitions;
  mockInstalled = withEditedFighter();
  useCharacterStore.getState().updateCharacter('f1', e => ({
    ...e, inventory: { ...e.inventory, carried: [...e.inventory.carried, { ...e.inventory.carried[0], id: 'inst-x', itemId: 'healers_kit' }] },
  }), 'Added Healer\'s Kit', 'inventory');
  const after = pinnedLockOf(useCharacterStore.getState().characters[0])!.definitions;
  expect(after['item:healers_kit']).toMatch(/^sha256:/);
  expect(after['class:fighter']).toBe(before['class:fighter']);
});

it('the sheet tells what differs, and moving onto the mockInstalled versions is the person\'s own step', async () => {
  const kept = await keep(fighter());
  expect(versionNotes(kept)).toMatchObject({ pinned: true, differences: [] });
  mockInstalled = withEditedFighter();
  expect(versionNotes(kept).differences).toEqual([expect.stringMatching(/class:fighter/)]);
  const moved = pinToInstalled(kept);
  expect(versionNotes(moved).differences).toEqual([]);
  expect(versionNotes({ ...kept, pins: undefined })).toEqual({ pinned: false, lockedAt: null, differences: [] });
});
