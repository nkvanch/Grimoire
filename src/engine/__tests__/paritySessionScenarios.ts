// A scripted live session for the native-parity fixtures: the real SessionHost (src/session/host.ts) driven frame by frame, with every
// frame it sends recorded in order. The desktop app's host replays the same client frames and must send the same ones back.
import { SessionHost } from '../../session/host';
import type { Connection, ServerTransport } from '../../session/transport';

export type SessionStep =
  | { kind: 'registerLocalHost'; id: string; nickname: string; extra: string[]; token: string }
  | { kind: 'connect'; conn: string }
  | { kind: 'frame'; conn: string; frame: string }
  | { kind: 'close'; conn: string };

export type SessionOut = { conn: string; frame?: string; close?: true };

class FakeConn implements Connection {
  private frameCb: ((f: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  closed = false;
  constructor(readonly id: string, private readonly log: SessionOut[]) {}
  send(frame: string): void {
    if (this.closed) return;
    this.log.push({ conn: this.id, frame });
  }
  onFrame(cb: (frame: string) => void): void { this.frameCb = cb; }
  onClose(cb: () => void): void { this.closeCb = cb; }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.log.push({ conn: this.id, close: true });
    this.closeCb?.();
  }
  deliver(frame: string): void { if (!this.closed) this.frameCb?.(frame); }
  clientClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.closeCb?.();
  }
}

export async function runSessionScenario(): Promise<{
  options: { sessionId: string; roomName: string; maxParticipants: number; dmPolicy: string };
  steps: SessionStep[]; expected: SessionOut[];
}> {
  const expected: SessionOut[] = [];
  const steps: SessionStep[] = [];
  let t = 1000;
  let tokenCounter = 0;
  const options = { sessionId: 'sess1', roomName: 'Cinder Road', maxParticipants: 4, dmPolicy: 'auto-first' };
  const host = new SessionHost({
    sessionId: options.sessionId, roomName: options.roomName, maxParticipants: options.maxParticipants,
    dmPolicy: 'auto-first', now: () => (t += 10), newToken: () => `tok${++tokenCounter}`,
  });
  let accept: ((c: Connection) => void) | null = null;
  const server: ServerTransport = { listen: async cb => { accept = cb; }, close: () => { /* none */ } };
  await host.start(server);

  const conns = new Map<string, FakeConn>();
  const register = (id: string, nickname: string, extra: string[] = []) => {
    const token = host.registerLocalHost(id, nickname, extra as never);
    steps.push({ kind: 'registerLocalHost', id, nickname, extra, token });
  };
  const connect = (label: string) => {
    const c = new FakeConn(label, expected);
    conns.set(label, c);
    steps.push({ kind: 'connect', conn: label });
    accept!(c);
  };
  const send = (label: string, msg: unknown) => {
    const frame = typeof msg === 'string' ? msg : JSON.stringify(msg);
    steps.push({ kind: 'frame', conn: label, frame });
    conns.get(label)!.deliver(frame);
  };
  const close = (label: string) => {
    steps.push({ kind: 'close', conn: label });
    conns.get(label)!.clientClose();
  };

  const seq: Record<string, number> = {};
  const op = (label: string, pid: string, body: unknown, opId?: string, forceSeq?: number) => {
    seq[pid] = (seq[pid] ?? 0) + 1;
    send(label, { type: 'op', op: { opId: opId ?? `${pid}-op${seq[pid]}`, seq: forceSeq ?? seq[pid], body } });
  };
  const hello = (label: string, pid: string, nickname: string, caps: string[], token: string | null = null, characterId: string | null = null) =>
    send(label, { type: 'hello', participantId: pid, token, nickname, requestedCapabilities: caps, characterId, lastRevision: 0 });

  const vitals = (hp: number) => ({
    tempHp: 0, speed: 30, exhaustion: 0, conditions: hp < 10 ? ['poisoned'] : [], concentration: hp < 10 ? 'bless' : null,
    deathSaves: { successes: 0, failures: 0, stable: false }, resources: [{ id: 'rage', name: 'Rage', current: 2, maximum: 3 }],
    spellSlots: { '1': { total: 4, used: 1 } }, passives: { perception: 13, investigation: 10, insight: 11 },
  });

  // the Host device itself
  register('host1', 'Table');

  // someone asks about the room, and leaves without joining
  connect('peek');
  send('peek', { type: 'peek' });
  close('peek');

  // a frame before anyone has said hello, and one that is not JSON
  connect('stranger');
  send('stranger', { type: 'resync' });
  send('stranger', 'this is not json');
  close('stranger');

  // the DM and two players join; a second player also asks to be DM and has to wait
  connect('dm');
  hello('dm', 'dm1', 'Brindle (DM)', ['dm']);
  connect('p1');
  hello('p1', 'p1', 'Aster', ['player'], null, 'char-aster');
  connect('p2');
  hello('p2', 'p2', 'Tamsin', ['player', 'dm'], null, 'char-tamsin');

  // the fight
  op('dm', 'dm1', { kind: 'dm.activate_encounter', encounter: { id: 'e1', name: 'Ambush on the Cinder Road', combatants: [
    { id: 'm1', name: 'Goblin A', hpState: 'healthy', ac: 15, visibility: { name: true, hpState: true, exactHp: false, ac: true, conditions: true } },
    { id: 'm2', name: 'Goblin Boss', hpState: 'healthy', ac: 17, visibility: { name: false, hpState: false, exactHp: false, ac: false, conditions: false } },
  ] } });
  op('p1', 'p1', { kind: 'player.report_character', characterId: 'char-aster', revision: 1, summary: { name: 'Aster Vale', hp: 31, maxHp: 38, ac: 14 }, vitals: vitals(31) });
  op('p2', 'p2', { kind: 'player.report_character', characterId: 'char-tamsin', revision: 1, summary: { name: 'Tamsin', hp: 8, maxHp: 27, ac: 12 }, vitals: vitals(8) });
  op('dm', 'dm1', { kind: 'dm.set_turn_order', encounterId: 'e1', order: ['m1', 'p1', 'm2', 'p2'] });
  op('dm', 'dm1', { kind: 'dm.next_turn', encounterId: 'e1' });
  op('dm', 'dm1', { kind: 'dm.next_turn', encounterId: 'e1' });
  op('dm', 'dm1', { kind: 'dm.set_combatant_hp', encounterId: 'e1', combatantId: 'm1', hpState: 'bloodied' });
  op('dm', 'dm1', { kind: 'dm.set_combatant_exact_hp', encounterId: 'e1', combatantId: 'm2', current: 12, max: 21 });
  op('dm', 'dm1', { kind: 'dm.set_combatant_conditions', encounterId: 'e1', combatantId: 'm1', conditions: ['poisoned'] });
  op('dm', 'dm1', { kind: 'dm.set_combatant_resources', encounterId: 'e1', combatantId: 'm2', resources: [{ id: 'leg', name: 'Legendary actions', current: 3, maximum: 3 }] });
  // reveal the boss: players are told by a fresh snapshot
  op('dm', 'dm1', { kind: 'dm.set_combatant_visibility', encounterId: 'e1', combatantId: 'm2', visibility: { name: true, hpState: true, exactHp: true, ac: true, conditions: true } });
  op('dm', 'dm1', { kind: 'dm.add_combatant', encounterId: 'e1', combatant: { id: 'm3', name: 'Wolf', hpState: 'healthy', ac: 12 } });
  op('dm', 'dm1', { kind: 'dm.remove_combatant', encounterId: 'e1', combatantId: 'm1' });
  op('dm', 'dm1', { kind: 'dm.previous_turn', encounterId: 'e1' });
  op('p1', 'p1', { kind: 'player.report_character', characterId: 'char-aster', revision: 2, summary: { name: 'Aster Vale', hp: 22, maxHp: 38, ac: 14 }, vitals: vitals(22) });

  // refusals and the retry rules
  op('p1', 'p1', { kind: 'dm.next_turn', encounterId: 'e1' });                        // a player cannot
  op('dm', 'dm1', { kind: 'dm.next_turn', encounterId: 'nope' });                     // no such encounter
  op('dm', 'dm1', { kind: 'dm.set_turn_order', encounterId: 'e1', order: ['m2', 'm2'] });
  op('dm', 'dm1', { kind: 'dm.set_combatant_exact_hp', encounterId: 'e1', combatantId: 'm2', current: 99, max: 21 });
  op('p1', 'p1', { kind: 'player.report_character', characterId: 'char-aster', revision: 1, summary: { name: 'Aster Vale', hp: 40, maxHp: 38, ac: 14 } });   // stale
  op('p1', 'p1', { kind: 'player.report_character', characterId: 'char-aster', revision: 2, summary: { name: 'Aster Vale', hp: 22, maxHp: 38, ac: 14 }, vitals: vitals(22) });   // same again
  send('p1', { type: 'op', op: { opId: 'p1-op1', seq: 1, body: { kind: 'player.report_character', characterId: 'char-aster', revision: 1, summary: { name: 'Aster Vale', hp: 31, maxHp: 38, ac: 14 }, vitals: vitals(31) } } });   // a repeat of the first
  // an op that arrives ahead of the one before it waits, then both are applied
  seq['dm1'] = (seq['dm1'] ?? 0);
  const next = seq['dm1'] + 1;
  send('dm', { type: 'op', op: { opId: 'dm1-late', seq: next + 1, body: { kind: 'dm.set_combatant_hp', encounterId: 'e1', combatantId: 'm3', hpState: 'down' } } });
  send('dm', { type: 'op', op: { opId: 'dm1-early', seq: next, body: { kind: 'dm.set_combatant_hp', encounterId: 'e1', combatantId: 'm3', hpState: 'bloodied' } } });
  seq['dm1'] = next + 1;
  send('p1', { type: 'resync' });
  send('p1', { type: 'nonsense' });

  // effects: public, for one player, and secret; time passing; a late target; a reveal
  const mod = (stat: string, value: number) => ({ stat, operation: 'add', value });
  op('dm', 'dm1', { kind: 'dm.apply_effect', targets: ['p1', 'p2'], effect: { id: 'bless', name: 'Bless', description: 'A d4 on attacks and saves.', source: 'Cleric',
    visibility: 'public', components: [mod('save', 1)], duration: { unit: 'rounds', total: 10, remaining: 3 } } });
  op('dm', 'dm1', { kind: 'dm.apply_effect', targets: ['p1'], effect: { id: 'armor', name: 'Mage Armor', description: null, source: null,
    visibility: 'target', components: [mod('ac', 3)], duration: { unit: 'manual' } } });
  op('dm', 'dm1', { kind: 'dm.apply_effect', targets: ['p2'], effect: { id: 'hex', name: null, description: null, source: null,
    visibility: 'secret', components: [mod('speed', -10)], duration: { unit: 'rounds', total: 5, remaining: 5 } } });
  op('dm', 'dm1', { kind: 'dm.apply_effect', targets: ['p2'], effect: { id: 'bless', name: 'Bless', description: null, source: null, visibility: 'public', components: [], duration: { unit: 'manual' } } });   // exists
  op('dm', 'dm1', { kind: 'dm.apply_effect', targets: ['ghost'], effect: { id: 'x', name: 'X', description: null, source: null, visibility: 'public', components: [], duration: { unit: 'manual' } } });
  op('dm', 'dm1', { kind: 'dm.tick_rounds', rounds: 2 });
  op('dm', 'dm1', { kind: 'dm.mark_due', applicationId: 'bless:p1' });
  op('dm', 'dm1', { kind: 'dm.add_effect_target', effectId: 'armor', targetId: 'p2' });
  op('dm', 'dm1', { kind: 'dm.end_effect', effectId: 'bless', applicationId: 'bless:p2' });
  op('dm', 'dm1', { kind: 'dm.convert_effect_visibility', effectId: 'hex', visibility: 'target', identity: { name: 'Hex', description: 'Disadvantage on Strength checks.', source: 'Warlock' } });
  op('dm', 'dm1', { kind: 'dm.end_effect', effectId: 'armor' });

  // changes the DM asks for, and what a player may do with them
  op('dm', 'dm1', { kind: 'dm.request_change', requestId: 'rq1', targetId: 'p1', baseRevision: 2, label: 'Fireball',
    changes: [{ kind: 'hp', delta: -8 }, { kind: 'condition_add', conditionId: 'on-fire' }, { kind: 'temp_hp', amount: 4 }] });
  op('p1', 'p1', { kind: 'player.respond', requestId: 'rq1', decision: 'accept', currentRevision: 2 });
  op('dm', 'dm1', { kind: 'dm.request_change', requestId: 'rq2', targetId: 'p2', baseRevision: 1, label: 'Poison dart', changes: [{ kind: 'hp', delta: -5 }, { kind: 'exhaustion', delta: 1 }] });
  op('p2', 'p2', { kind: 'player.respond', requestId: 'rq2', decision: 'accept', currentRevision: 4 });                       // the character changed: stale
  op('p2', 'p2', { kind: 'player.respond', requestId: 'rq2', decision: 'modify', currentRevision: 4, acknowledgeStale: true, modified: [{ kind: 'hp', delta: -2 }] });
  op('dm', 'dm1', { kind: 'dm.request_change', requestId: 'rq3', targetId: 'p1', baseRevision: 2, label: 'Never mind', changes: [{ kind: 'stabilize' }] });
  op('dm', 'dm1', { kind: 'dm.cancel_request', requestId: 'rq3' });
  op('dm', 'dm1', { kind: 'dm.request_change', requestId: 'rq4', targetId: 'p1', baseRevision: 2, label: 'Nothing', changes: [] });          // malformed
  op('p1', 'p1', { kind: 'player.respond', requestId: 'rq2', decision: 'reject', currentRevision: 2 });                       // not theirs

  // a player's public persona, then a report that must not clear it
  op('p1', 'p1', { kind: 'player.set_persona', persona: { enabled: true, name: 'The Stranger', hp: 38, maxHp: 38, ac: 10 } });
  op('p1', 'p1', { kind: 'player.report_character', characterId: 'char-aster', revision: 3, summary: { name: 'Aster Vale', hp: 14, maxHp: 38, ac: 14 }, vitals: vitals(14) });

  // rule suggestions
  op('p2', 'p2', { kind: 'player.suggest_rule', suggestionId: 'rs1', rule: 'Flanking', proposedValue: 'Advantage when flanking', note: 'It speeds up combat.' });
  op('dm', 'dm1', { kind: 'dm.resolve_rule_suggestion', suggestionId: 'rs1', decision: 'modify', dmResponse: 'Only +2 to hit.' });
  op('dm', 'dm1', { kind: 'dm.resolve_rule_suggestion', suggestionId: 'rs1', decision: 'accept' });                          // already resolved

  // rewards, tiers that replace each other, one withdrawn, and the campaign policy that applies them at once
  op('dm', 'dm1', { kind: 'dm.grant_reward', rewardId: 'w1', targetId: 'p1', rewardKind: 'reward_tier', label: 'Mark of the Forge I', tierTrack: 'Forge' });
  op('p1', 'p1', { kind: 'player.respond_reward', rewardId: 'w1', decision: 'accept' });
  op('dm', 'dm1', { kind: 'dm.grant_reward', rewardId: 'w2', targetId: 'p1', rewardKind: 'reward_tier', label: 'Mark of the Forge II', tierTrack: 'Forge', description: 'The second tier.' });
  op('p1', 'p1', { kind: 'player.respond_reward', rewardId: 'w2', decision: 'modify', note: 'I would rather have it on my shield.' });
  op('dm', 'dm1', { kind: 'dm.grant_reward', rewardId: 'w3', targetId: 'p2', rewardKind: 'resource', label: 'A potion' });
  op('dm', 'dm1', { kind: 'dm.cancel_reward', rewardId: 'w3' });
  op('dm', 'dm1', { kind: 'dm.select_campaign', campaignRevision: 1, policy: { campaignId: 'c1', name: 'The Cinder Road', bannedPackIds: [], bannedSubclassIds: [], requiredPacks: [],
    permanentRewardsAutomatic: true, monsterHpVisibilityDefault: 'minimal', ruleSuggestionsEnabled: false } });
  op('dm', 'dm1', { kind: 'dm.grant_reward', rewardId: 'w4', targetId: 'p2', rewardKind: 'campaign_boon', label: 'The crow remembers you' });
  op('dm', 'dm1', { kind: 'dm.add_combatant', encounterId: 'e1', combatant: { id: 'm4', name: 'Crow', hpState: 'healthy' } });   // the campaign default visibility
  op('p2', 'p2', { kind: 'player.suggest_rule', suggestionId: 'rs2', rule: 'Crits', proposedValue: 'Max damage', note: '' });      // suggestions are off
  op('dm', 'dm1', { kind: 'dm.add_session_log', entryId: 'log1', logKind: 'milestone', text: 'The party crossed the ford.' });
  op('dm', 'dm1', { kind: 'dm.unlink_campaign' });

  // a player drops and comes back
  close('p2');
  connect('p2b');
  hello('p2b', 'p2', 'Tamsin', ['player'], 'tok4', 'char-tamsin');
  connect('p2c');
  hello('p2c', 'p2', 'Tamsin', ['player'], 'wrong');   // wrong token

  // the room fills up (host + dm + 2 players are there; maxParticipants counts the connected ones)
  connect('p3');
  hello('p3', 'p3', 'Orrin', ['player']);
  connect('p4');
  hello('p4', 'p4', 'Late', ['player']);
  connect('p5');
  hello('p5', 'p5', 'Later', ['player']);

  // the Host connects as itself, and the fight ends, then the session
  connect('host');
  hello('host', 'host1', 'Table', [], 'tok1');
  op('host', 'host1', { kind: 'host.assign_capabilities', participantId: 'p2', capabilities: ['player', 'dm'] });
  op('host', 'host1', { kind: 'dm.next_turn', encounterId: 'e1' });   // a host that is not a DM cannot
  op('dm', 'dm1', { kind: 'dm.end_encounter', encounterId: 'e1' });
  op('host', 'host1', { kind: 'host.end_session' });
  op('dm', 'dm1', { kind: 'dm.next_turn', encounterId: 'e1' });   // after the end

  return { options, steps, expected };
}
