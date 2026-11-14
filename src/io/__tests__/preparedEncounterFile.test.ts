// A prepared fight exported by the desktop app, read on the phone.
import { parsePreparedEncounterFile } from '../preparedEncounterFile';

const fight = {
  id: 'enc_desk_1', campaignId: 'camp_desk', sessionId: 'sess_desk', name: ' Goblin Ambush ', tags: ['road'], status: 'ready',
  combatants: [{ id: 'c1', monsterId: 'goblin', quantity: 4, hpMode: 'average' }],
  groups: [], waves: [{ id: 'w1', name: 'Reinforcements', combatantIds: [], trigger: 'manual' }], environment: [], rewards: [],
  createdAt: 1700000000000, updatedAt: 1700000000001, desktopOnly: { kept: true },
};
const file = (encounter: unknown, over: object = {}) => JSON.stringify({ format: 'grimoire-prepared-encounter', version: 1, exportedAt: 1, encounter, ...over });
const none = new Set<string>();

it('reads the desktop file as it is, keeping what it does not know', () => {
  const e = parsePreparedEncounterFile(file(fight), new Set(['camp_desk']), 5);
  expect(e.id).not.toBe('enc_desk_1');   // always a new id: an import never replaces a fight already here
  expect(e).toMatchObject({ name: 'Goblin Ambush', campaignId: 'camp_desk', status: 'ready', createdAt: 1700000000000, updatedAt: 5 });
  expect(e.combatants).toHaveLength(1);
  expect(e.waves[0].name).toBe('Reinforcements');
  expect((e as unknown as { desktopOnly: unknown }).desktopOnly).toEqual({ kept: true });
  expect(e.sessionId).toBeUndefined();
});

it('a campaign this device lacks makes it a template', () => {
  const e = parsePreparedEncounterFile(file(fight), none, 5);
  expect(e.campaignId).toBeUndefined();
});

it('fills the lists a file leaves out, and an unknown status is a draft', () => {
  const e = parsePreparedEncounterFile(file({ id: 'x', name: 'Bare', status: 'weird' }), none, 5);
  expect(e).toMatchObject({ status: 'draft', tags: [], combatants: [], groups: [], waves: [], environment: [], rewards: [] });
});

it('refuses what is not a prepared fight it can read, saying why', () => {
  expect(() => parsePreparedEncounterFile('not json', none)).toThrow(/not valid JSON/);
  expect(() => parsePreparedEncounterFile(JSON.stringify({ format: 'grimoire-character' }), none)).toThrow(/not a prepared fight/);
  expect(() => parsePreparedEncounterFile(file(fight, { version: 2 }), none)).toThrow(/version 2/);
  expect(() => parsePreparedEncounterFile(file({ ...fight, name: '' }), none)).toThrow(/no name/);
  expect(() => parsePreparedEncounterFile(file({ ...fight, combatants: [{ id: 'c' }] }), none)).toThrow(/no monster/);
  expect(() => parsePreparedEncounterFile(file({ ...fight, waves: 'x' }), none)).toThrow(/waves is not a list/);
});
