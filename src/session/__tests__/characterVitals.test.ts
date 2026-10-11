// Party Dashboard vitals (DM_SCREEN_SPEC.md item 2) — temp HP, speed, conditions, exhaustion,
// concentration, death saves, custom resources, spell slots, reported alongside the bare
// CharacterSummary. See CharacterVitals's own doc comment in types.ts for why this is DM-
// dashboard-only data, never sent to a peer player and never given a Public Persona override.
import { newRig, addDm, addPlayer } from '../testing/harness';
import { describeChanges } from '../roles';

describe('player.report_character with vitals', () => {
  it('a real adapter (FakeCharacter) reports vitals, visible to the DM', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.character!.conditions = ['poisoned'];
    alice.character!.speed = 25;
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    expect(dm.peer.view!.characters.alice.vitals).toMatchObject({ speed: 25, conditions: ['poisoned'] });
  });

  it('a peer sees an ally\'s visible status (conditions, concentration, dying) but never the rest of the vitals', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    alice.character!.conditions = ['poisoned'];
    alice.character!.concentrating = 'bless';
    alice.character!.speed = 25;
    alice.character!.resources = [{ id: 'secret_pool', name: 'Secret Pool', current: 1, maximum: 3 }];
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob).not.toHaveProperty('vitals');
    expect(seenByBob.status).toEqual({ conditions: ['poisoned'], concentrating: true, dying: null });
    const bobWire = rig.net.receivedBy('bob').join('\n');
    expect(bobWire).not.toContain('Secret Pool');
    expect(bobWire).not.toContain('secret_pool');
    expect(bobWire).not.toContain('"speed":25');
  });

  it('a character at 0 HP shows as dying, stable or dead to the table', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    const seen = () => bob.peer.partyView().find(c => c.participantId === 'alice')!.status!.dying;
    alice.character!.hp = 0;
    alice.character!.revision += 1; alice.peer.reportCharacter(); await rig.settle();
    expect(seen()).toBe('dying');
    alice.character!.deathSaves = { successes: 3, failures: 1, stable: true };
    alice.character!.revision += 1; alice.peer.reportCharacter(); await rig.settle();
    expect(seen()).toBe('stable');
    alice.character!.deathSaves = { successes: 0, failures: 3, stable: false };
    alice.character!.revision += 1; alice.peer.reportCharacter(); await rig.settle();
    expect(seen()).toBe('dead');
  });

  it('a Public Persona hides the status from peers', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const bob = await addPlayer(rig, 'bob');
    alice.peer.setPersona({ enabled: true, name: 'Stranger', hp: 10, maxHp: 10, ac: 12 });
    await rig.settle();
    const before = rig.net.receivedBy('bob').length;
    alice.character!.conditions = ['poisoned'];
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    const seenByBob = bob.peer.partyView().find(c => c.participantId === 'alice')!;
    expect(seenByBob).not.toHaveProperty('status');
    expect(rig.net.receivedBy('bob').slice(before).join('\n')).not.toContain('poisoned');
  });

  it('the DM also gets passive scores, defenses and running effects when the adapter reports them', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const base = alice.character!.vitals.bind(alice.character!);
    alice.character!.vitals = () => ({
      ...base(),
      passives: { perception: 14, investigation: 11, insight: 13 },
      defenses: { resistances: ['fire'], immunities: [], vulnerabilities: ['radiant'], conditionImmunities: [], critsNegated: false },
      effects: ['rage'],
    });
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    expect(dm.peer.view!.characters.alice.vitals).toMatchObject({
      passives: { perception: 14, insight: 13 }, defenses: { resistances: ['fire'], vulnerabilities: ['radiant'] }, effects: ['rage'],
    });
  });

  it('malformed Live Play fields are rejected', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const base = alice.character!.vitals.bind(alice.character!);
    alice.character!.vitals = () => ({ ...base(), passives: { perception: 'x' } as never });
    alice.character!.revision += 1;
    const opId = alice.peer.reportCharacter()!;
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('rejected');
  });

  it('a Host-only participant sees no character vitals (characters is empty for that level)', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    alice.character!.conditions = ['poisoned'];
    alice.character!.revision += 1;
    alice.peer.reportCharacter();
    await rig.settle();
    expect(rig.hostPeer.view!.characters).toEqual({});
  });

  it('rejects malformed vitals (exhaustion out of range)', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({
      kind: 'player.report_character', characterId: 'char_alice', revision: 99,
      summary: { name: 'Mira', hp: 10, maxHp: 10, ac: 14 },
      vitals: { tempHp: 0, speed: 30, exhaustion: 7, conditions: [], concentration: null, deathSaves: { successes: 0, failures: 0, stable: false }, resources: [], spellSlots: null },
    });
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('rejects malformed vitals (wrong resource shape)', async () => {
    const rig = await newRig();
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({
      kind: 'player.report_character', characterId: 'char_alice', revision: 99,
      summary: { name: 'Mira', hp: 10, maxHp: 10, ac: 14 },
      vitals: { tempHp: 0, speed: 30, exhaustion: 0, conditions: [], concentration: null, deathSaves: { successes: 0, failures: 0, stable: false }, resources: [{ name: 'Ki' } as never], spellSlots: null },
    });
    await rig.settle();
    expect(alice.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('a character with no reported vitals at all still reports normally (vitals is optional)', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const opId = alice.peer.sendRaw({ kind: 'player.report_character', characterId: 'char_alice', revision: 99, summary: { name: 'Mira', hp: 10, maxHp: 10, ac: 14 } });
    await rig.settle();
    expect(alice.peer.resultOf(opId)?.status).toBe('applied');
    expect(dm.peer.view!.characters.alice.vitals).toBeUndefined();
  });
});

describe('new CharacterChange kinds: condition_add/remove, concentration_break, stabilize', () => {
  it('a DM-requested condition is applied once accepted', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    const { requestId } = dm.peer.requestChange('alice', 'Poisoned', [{ kind: 'condition_add', conditionId: 'poisoned' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.conditions).toEqual(['poisoned']);
  });

  it('removing a condition and breaking concentration both apply', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.character!.conditions = ['prone'];
    alice.character!.concentrating = 'bless';
    const { requestId } = dm.peer.requestChange('alice', 'Clear', [{ kind: 'condition_remove', conditionId: 'prone' }, { kind: 'concentration_break' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.conditions).toEqual([]);
    expect(alice.character!.concentrating).toBeNull();
  });

  it('stabilize resets death saves and marks stable', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    const alice = await addPlayer(rig, 'alice');
    alice.character!.deathSaves = { successes: 1, failures: 2, stable: false };
    const { requestId } = dm.peer.requestChange('alice', 'Stabilize', [{ kind: 'stabilize' }]);
    await rig.settle();
    alice.peer.respond(requestId, 'accept');
    await rig.settle();
    expect(alice.character!.deathSaves).toEqual({ successes: 0, failures: 0, stable: true });
  });

  it('dm.request_change rejects a condition_add with a missing conditionId', async () => {
    const rig = await newRig();
    const dm = await addDm(rig);
    await addPlayer(rig, 'alice');
    const opId = dm.peer.sendRaw({ kind: 'dm.request_change', requestId: 'r1', targetId: 'alice', baseRevision: 1, label: 'Bad', changes: [{ kind: 'condition_add' } as never] });
    await rig.settle();
    expect(dm.peer.resultOf(opId)).toMatchObject({ status: 'rejected', reason: 'malformed' });
  });

  it('describeChanges renders the new kinds in human-readable form', () => {
    expect(describeChanges([{ kind: 'condition_add', conditionId: 'poisoned' }])).toBe('Add condition: Poisoned');
    expect(describeChanges([{ kind: 'condition_remove', conditionId: 'prone' }])).toBe('Remove condition: Prone');
    expect(describeChanges([{ kind: 'concentration_break' }])).toBe('Break concentration');
    expect(describeChanges([{ kind: 'stabilize' }])).toBe('Stabilize');
  });
});
