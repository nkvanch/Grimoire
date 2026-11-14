// Contracts LIVE-067 (hidden values never leak through logs, errors or metadata) and SESSION-002 (a player never learns what the DM
// keeps hidden): one session runs every operation that carries something hidden, then everything a player received, holds and keeps
// is searched for it. A marker that turns up anywhere is a leak, whatever path it took (an event, a log line, a snapshot, an error).
import { newRig, addDm, addPlayer, seedPrep } from '../testing/harness';

const MONSTER = 'Zorvath Of The Sunken Vault';
const RESOURCE = 'Zorvath Legendary Resistance';
const EXACT_CURRENT = 48213;
const EXACT_MAX = 48257;
const CURSE = ['Hidden Curse', 'the amulet is cursed', 'Cursed amulet', 'until remove curse'];
const PRIVATE_REQUEST = 'Bob only: drink the vial';
const PRIVATE_REWARD = 'Bob only: the black key';

async function sessionWithSecrets() {
  const rig = await newRig();
  const dm = await addDm(rig);
  const alice = await addPlayer(rig, 'alice');
  const bob = await addPlayer(rig, 'bob');
  const prep = await seedPrep(dm);
  // the table's default hides a monster from the moment it is added
  await dm.prep.edit(prep.campaignId, p => ({ ...p, rules: { ...p.rules!, monsterHpVisibilityDefault: 'hidden' } }));
  await dm.peer.selectCampaign(prep.campaignId);
  await dm.peer.activateEncounter(prep.campaignId, 'enc-bridge');
  await rig.settle();
  const encounterId = Object.keys(rig.host.debugState().encounters)[0];

  // every encounter operation on the hidden monster
  dm.peer.addCombatant(encounterId, { id: 'zorvath', name: MONSTER, ac: 19 });
  await rig.settle();
  dm.peer.setCombatantExactHp(encounterId, 'zorvath', EXACT_CURRENT, EXACT_MAX);
  dm.peer.setCombatantConditions(encounterId, 'zorvath', ['paralyzed']);
  dm.peer.setCombatantResources(encounterId, 'zorvath', [{ id: 'lr', name: RESOURCE, current: 3, maximum: 3 }]);
  dm.peer.setCombatantHpState(encounterId, 'zorvath', 'bloodied');
  dm.peer.setTurnOrder(encounterId, ['zorvath', ...rig.host.debugState().encounters[encounterId].combatants.filter(c => c.id !== 'zorvath').map(c => c.id)]);
  dm.peer.nextTurn(encounterId);
  dm.peer.removeCombatant(encounterId, 'zorvath');
  // a secret effect on Alice, and things meant for Bob alone
  await dm.peer.applyPreparedEffect(prep.campaignId, 'fx-curse', ['alice']);
  dm.peer.tickRounds(1);
  dm.peer.requestChange('bob', PRIVATE_REQUEST, [{ kind: 'hp', delta: -1 }]);
  dm.peer.grantReward('bob', 'campaign_boon', PRIVATE_REWARD);
  // an operation a player may not do: the refusal must not carry anything either
  alice.peer.sendRaw({ kind: 'dm.set_combatant_exact_hp', encounterId, combatantId: 'zorvath', current: 1, max: 1 } as never);
  await rig.settle();
  await alice.peer.flush();
  return { rig, dm, alice, bob };
}

describe('nothing the DM keeps hidden reaches a player (LIVE-067, SESSION-002)', () => {
  it('a hidden monster, its numbers and resources, a secret effect and another player\'s request and reward never reach Alice', async () => {
    const { rig, dm, alice } = await sessionWithSecrets();
    const markers = [MONSTER, RESOURCE, String(EXACT_CURRENT), String(EXACT_MAX), ...CURSE, PRIVATE_REQUEST, PRIVATE_REWARD];
    const places = {
      wire: rig.net.receivedBy('alice').join('\n'),
      replica: JSON.stringify(alice.peer.view),
      persisted: JSON.stringify(await alice.kv.get('session.peer.alice')),
    };
    const leaks = Object.entries(places).flatMap(([place, text]) => markers.filter(m => text.includes(m)).map(m => `${place}: ${m}`));
    expect(leaks).toEqual([]);
    // the DM's own copy has them, so the markers were really in play
    expect(JSON.stringify(dm.peer.view)).toContain(String(EXACT_CURRENT));
  });

  it('Bob sees his own request and reward, and still nothing of the monster or of Alice\'s curse', async () => {
    const { rig, bob } = await sessionWithSecrets();
    const wire = rig.net.receivedBy('bob').join('\n');
    expect(wire).toContain(PRIVATE_REQUEST);
    expect(wire).toContain(PRIVATE_REWARD);
    for (const m of [MONSTER, RESOURCE, String(EXACT_CURRENT), ...CURSE]) expect(wire).not.toContain(m);
  });
});
