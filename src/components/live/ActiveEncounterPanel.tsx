// The 14 standard SRD conditions (src/content/conditions/index.ts) — a fixed picker rather than a
// live content-registry lookup, since the DM screen doesn't otherwise depend on content modules;
// a homebrew condition can still be added by typing its id directly in DM-only notes as a

import { useState } from 'react';
import { newId } from '../../engine/ids';
import { SessionPeer } from '../../session/peer';
import { PrepEncounter } from '../../session/prep';
import { formatContentId } from '../../session/roles';
import { MonsterVisibility, MONSTER_VISIBILITY_PRESETS, LiveEncounter, PublicParticipant } from '../../session/types';
import { Alert } from '../../utils/alert';
import { Card, Row, Body, Badge, Muted, Btn, Chip, Field } from './LiveUi';

// reminder, same disclosed tradeoff as everywhere else this wire deals in raw content ids.
export const SRD_CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible',
  'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious',
];

// ── Active encounter panel (initiative/turn tracking — DM_SCREEN_SPEC.md item 6) ─────────────
// No numeric initiative is tracked on the wire; the DM rolls/tracks it at the table and taps
// actors here in the resulting order. turnOrder entries are either a LiveCombatant id or a
// ParticipantId — a player's own character takes a turn too, not just monsters.

// Monster visibility presets (item 9) — a DM-UI convenience over MonsterVisibility; not a wire
// concept of their own, just named shortcuts for dm.set_combatant_visibility.
function presetOfVisibility(v: MonsterVisibility): 'hidden' | 'minimal' | 'standard' | 'full' | null {
  for (const [name, preset] of Object.entries(MONSTER_VISIBILITY_PRESETS)) {
    if (preset.name === v.name && preset.hpState === v.hpState && preset.exactHp === v.exactHp && preset.ac === v.ac && preset.conditions === v.conditions) {
      return name as 'hidden' | 'minimal' | 'standard' | 'full';
    }
  }
  return null;   // a custom combination the DM reached some other way
}

export function ActiveEncounterPanel({ encounter, players, nameOf, offline, peer, run, prepEncounter }: {
  encounter: LiveEncounter;
  players: PublicParticipant[];
  nameOf: (id: string) => string;
  offline: boolean;
  peer: SessionPeer;
  run: (fn: () => unknown) => void;
  /** The prepared encounter this was activated from, if known on this device right now — see its
   *  own doc comment at the call site for why this is best-effort, not a wire-backed link. */
  prepEncounter: PrepEncounter | null;
}) {
  const [settingOrder, setSettingOrder] = useState(false);
  const [orderDraft, setOrderDraft] = useState<string[]>([]);
  const [addingCombatant, setAddingCombatant] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAc, setNewAc] = useState('');
  const [exactHpEditing, setExactHpEditing] = useState<string | null>(null);
  const [exactHpCurrent, setExactHpCurrent] = useState('');
  const [exactHpMax, setExactHpMax] = useState('');
  const [monsterDelta, setMonsterDelta] = useState<{ combatantId: string; kind: 'damage' | 'heal' } | null>(null);
  const [monsterDeltaAmount, setMonsterDeltaAmount] = useState('');
  const [addingMonsterCondition, setAddingMonsterCondition] = useState<string | null>(null);
  const [addingMonsterResource, setAddingMonsterResource] = useState<string | null>(null);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceMax, setNewResourceMax] = useState('');

  const actors = [
    ...encounter.combatants.map(c => ({ id: c.id, label: c.name })),
    ...players.map(p => ({ id: p.id, label: p.nickname })),
  ];
  const labelOf = (id: string) => actors.find(a => a.id === id)?.label ?? nameOf(id);
  const toggleDraft = (id: string) => setOrderDraft(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const HP_CYCLE: Record<'healthy' | 'bloodied' | 'down', 'healthy' | 'bloodied' | 'down'> = {
    healthy: 'bloodied', bloodied: 'down', down: 'healthy',
  };

  return (
    <Card testID={`dm-live-encounter-${encounter.name}`}>
      <Row wrap>
        <Body bold>⚔ {encounter.name} (live)</Body>
        {encounter.currentTurnIndex !== null && <Badge label={`Round ${encounter.round}`} tone="good" />}
      </Row>
      {!!prepEncounter?.dmNotes && <Muted>🔒 {prepEncounter.dmNotes}</Muted>}

      {encounter.turnOrder.length > 0 ? (
        <>
          <Row wrap>
            {encounter.turnOrder.map((id, i) => (
              <Badge key={id} label={`${i === encounter.currentTurnIndex ? '▶ ' : ''}${labelOf(id)}`} tone={i === encounter.currentTurnIndex ? 'good' : 'default'} />
            ))}
          </Row>
          <Row wrap>
            <Btn small kind="ghost" label="◂ Previous" disabled={offline} onPress={() => run(() => peer.previousTurn(encounter.id))} testID={`dm-prev-turn-${encounter.name}`} />
            <Btn small label="Next ▸" disabled={offline} onPress={() => run(() => peer.nextTurn(encounter.id))} testID={`dm-next-turn-${encounter.name}`} />
          </Row>
        </>
      ) : (
        <Muted>No turn order set yet.</Muted>
      )}

      {settingOrder ? (
        <>
          <Muted>Tap in turn order (the order you rolled at the table). Tap again to remove.</Muted>
          <Row wrap>
            {actors.map(a => {
              const pos = orderDraft.indexOf(a.id);
              return <Chip key={a.id} label={pos === -1 ? a.label : `${pos + 1}. ${a.label}`} active={pos !== -1} onPress={() => toggleDraft(a.id)} testID={`dm-order-pick-${a.label}`} />;
            })}
          </Row>
          <Row>
            <Btn small label="Set order" disabled={orderDraft.length === 0 || offline} testID={`dm-order-confirm-${encounter.name}`}
              onPress={() => { run(() => peer.setTurnOrder(encounter.id, orderDraft)); setSettingOrder(false); setOrderDraft([]); }} />
            <Btn small kind="ghost" label="Cancel" onPress={() => { setSettingOrder(false); setOrderDraft([]); }} />
          </Row>
        </>
      ) : (
        <Btn small kind="ghost" label={encounter.turnOrder.length > 0 ? 'Change turn order' : 'Set turn order'}
          onPress={() => { setSettingOrder(true); setOrderDraft(encounter.turnOrder); }} testID={`dm-order-open-${encounter.name}`} />
      )}

      <Muted>Combatants — tap a preset to change what players see:</Muted>
      {encounter.combatants.map(c => {
        const hp = c.hpState ?? 'healthy';
        const preset = presetOfVisibility(c.visibility);
        const editingHp = exactHpEditing === c.id;
        const prepNotes = prepEncounter?.combatants.find(pc => pc.id === c.id)?.dmNotes;
        return (
          <Card key={c.id}>
            <Row wrap>
              <Body bold>{c.name}</Body>
              <Badge label={hp} tone={hp === 'healthy' ? 'good' : hp === 'bloodied' ? 'warn' : 'bad'} />
              {c.ac !== undefined && <Muted>AC {c.ac}</Muted>}
              {c.exactHp && <Muted>{c.exactHp.current}/{c.exactHp.max} HP</Muted>}
            </Row>
            {!!prepNotes && <Muted>🔒 {prepNotes}</Muted>}
            <Row wrap>
              <Btn small kind="ghost" label="Cycle HP" disabled={offline} onPress={() => run(() => peer.setCombatantHpState(encounter.id, c.id, HP_CYCLE[hp]))} testID={`dm-cycle-hp-${c.name}`} />
              <Btn small kind="danger" label="Remove" disabled={offline} onPress={() => run(() => peer.removeCombatant(encounter.id, c.id))} testID={`dm-remove-combatant-${c.name}`} />
            </Row>
            {c.exactHp && (
              monsterDelta?.combatantId === c.id ? (
                <Row wrap>
                  <Field label="Amount" value={monsterDeltaAmount} onChangeText={setMonsterDeltaAmount} keyboardType="number-pad" testID={`dm-monster-delta-amount-${c.name}`} />
                  <Btn small label="Apply" disabled={offline || !monsterDeltaAmount.trim()} testID={`dm-monster-delta-apply-${c.name}`}
                    onPress={() => {
                      const n = Math.abs(Number(monsterDeltaAmount.trim()));
                      const { current, max } = c.exactHp!;
                      if (!Number.isFinite(n)) { Alert.alert('Invalid amount', 'Enter a whole number.'); return; }
                      const next = Math.max(0, Math.min(max, monsterDelta.kind === 'damage' ? current - n : current + n));
                      run(() => peer.setCombatantExactHp(encounter.id, c.id, next, max));
                      setMonsterDelta(null); setMonsterDeltaAmount('');
                    }} />
                  <Btn small kind="ghost" label="Cancel" onPress={() => { setMonsterDelta(null); setMonsterDeltaAmount(''); }} />
                </Row>
              ) : (
                <Row wrap>
                  <Btn small kind="danger" label="Damage" disabled={offline} onPress={() => { setMonsterDelta({ combatantId: c.id, kind: 'damage' }); setMonsterDeltaAmount(''); }} testID={`dm-monster-damage-${c.name}`} />
                  <Btn small label="Heal" disabled={offline} onPress={() => { setMonsterDelta({ combatantId: c.id, kind: 'heal' }); setMonsterDeltaAmount(''); }} testID={`dm-monster-heal-${c.name}`} />
                </Row>
              )
            )}
            {(c.conditions ?? []).length > 0 && (
              <Row wrap>
                {(c.conditions ?? []).map(cond => (
                  <Chip key={cond} label={formatContentId(cond)} active
                    onPress={() => run(() => peer.setCombatantConditions(encounter.id, c.id, (c.conditions ?? []).filter(x => x !== cond)))}
                    testID={`dm-monster-condition-${c.name}-${cond}`} />
                ))}
              </Row>
            )}
            {addingMonsterCondition === c.id ? (
              <Row wrap>
                {SRD_CONDITIONS.filter(cond => !(c.conditions ?? []).includes(cond)).map(cond => (
                  <Chip key={cond} label={formatContentId(cond)}
                    onPress={() => { run(() => peer.setCombatantConditions(encounter.id, c.id, [...(c.conditions ?? []), cond])); setAddingMonsterCondition(null); }}
                    testID={`dm-monster-addcondition-${c.name}-${cond}`} />
                ))}
                <Btn small kind="ghost" label="Cancel" onPress={() => setAddingMonsterCondition(null)} />
              </Row>
            ) : (
              <Btn small kind="ghost" label="+ Condition" disabled={offline} onPress={() => setAddingMonsterCondition(c.id)} testID={`dm-monster-addcondition-open-${c.name}`} />
            )}
            {(c.resources ?? []).length > 0 && (
              <>
                <Muted>Resources (DM-only, never sent to players):</Muted>
                {(c.resources ?? []).map(r => (
                  <Row wrap key={r.id}>
                    <Body>{r.name} {r.current}/{r.maximum}</Body>
                    <Btn small kind="ghost" label="Use" disabled={offline || r.current <= 0}
                      onPress={() => run(() => peer.setCombatantResources(encounter.id, c.id, (c.resources ?? []).map(x => x.id === r.id ? { ...x, current: Math.max(0, x.current - 1) } : x)))}
                      testID={`dm-resource-use-${c.name}-${r.name}`} />
                    <Btn small label="Recharge" disabled={offline || r.current >= r.maximum}
                      onPress={() => run(() => peer.setCombatantResources(encounter.id, c.id, (c.resources ?? []).map(x => x.id === r.id ? { ...x, current: x.maximum } : x)))}
                      testID={`dm-resource-recharge-${c.name}-${r.name}`} />
                    <Btn small kind="danger" label="Remove" disabled={offline}
                      onPress={() => run(() => peer.setCombatantResources(encounter.id, c.id, (c.resources ?? []).filter(x => x.id !== r.id)))}
                      testID={`dm-resource-remove-${c.name}-${r.name}`} />
                  </Row>
                ))}
              </>
            )}
            {addingMonsterResource === c.id ? (
              <Row wrap>
                <Field label="Name" value={newResourceName} onChangeText={setNewResourceName} placeholder="Legendary Actions" testID={`dm-resource-name-${c.name}`} />
                <Field label="Max" value={newResourceMax} onChangeText={setNewResourceMax} keyboardType="number-pad" testID={`dm-resource-max-${c.name}`} />
                <Btn small label="Add" disabled={offline || !newResourceName.trim() || !newResourceMax.trim()} testID={`dm-resource-add-${c.name}`}
                  onPress={() => {
                    const max = Number(newResourceMax.trim());
                    if (!Number.isFinite(max) || max < 1) { Alert.alert('Invalid max', 'Enter a whole number of at least 1.'); return; }
                    const resource = { id: `res_${Date.now().toString(36)}`, name: newResourceName.trim(), current: max, maximum: max };
                    run(() => peer.setCombatantResources(encounter.id, c.id, [...(c.resources ?? []), resource]));
                    setAddingMonsterResource(null); setNewResourceName(''); setNewResourceMax('');
                  }} />
                <Btn small kind="ghost" label="Cancel" onPress={() => setAddingMonsterResource(null)} />
              </Row>
            ) : (
              <Btn small kind="ghost" label="+ Resource" disabled={offline} onPress={() => setAddingMonsterResource(c.id)} testID={`dm-resource-open-${c.name}`} />
            )}
            <Muted>Visible to players:</Muted>
            <Row wrap>
              {(['hidden', 'minimal', 'standard', 'full'] as const).map(p => (
                <Chip key={p} label={p === 'full' ? 'Full Reveal' : p[0].toUpperCase() + p.slice(1)} active={preset === p}
                  onPress={() => run(() => peer.setCombatantVisibility(encounter.id, c.id, MONSTER_VISIBILITY_PRESETS[p]))} testID={`dm-vis-${p}-${c.name}`} />
              ))}
            </Row>
            {editingHp ? (
              <Row wrap>
                <Field label="Current HP" value={exactHpCurrent} onChangeText={setExactHpCurrent} keyboardType="number-pad" testID={`dm-exacthp-current-${c.name}`} />
                <Field label="Max HP" value={exactHpMax} onChangeText={setExactHpMax} keyboardType="number-pad" testID={`dm-exacthp-max-${c.name}`} />
                <Btn small label="Set" disabled={offline || !exactHpCurrent.trim() || !exactHpMax.trim()} testID={`dm-exacthp-save-${c.name}`}
                  onPress={() => {
                    const current = Number(exactHpCurrent.trim()); const max = Number(exactHpMax.trim());
                    if (Number.isFinite(current) && Number.isFinite(max) && max >= 1 && current >= 0 && current <= max) {
                      run(() => peer.setCombatantExactHp(encounter.id, c.id, current, max));
                      setExactHpEditing(null);
                    } else {
                      Alert.alert('Invalid HP', 'Current HP must be between 0 and Max HP.');
                    }
                  }} />
                <Btn small kind="ghost" label="Cancel" onPress={() => setExactHpEditing(null)} />
              </Row>
            ) : (
              <Btn small kind="ghost" label={c.exactHp ? 'Change exact HP' : 'Set exact HP'}
                onPress={() => { setExactHpEditing(c.id); setExactHpCurrent(String(c.exactHp?.current ?? '')); setExactHpMax(String(c.exactHp?.max ?? '')); }}
                testID={`dm-exacthp-open-${c.name}`} />
            )}
          </Card>
        );
      })}
      {encounter.combatants.length === 0 && <Muted>No combatants left.</Muted>}

      {addingCombatant ? (
        <Row wrap>
          <Field label="Name" value={newName} onChangeText={setNewName} testID={`dm-newcombatant-name-${encounter.name}`} />
          <Field label="AC (optional)" value={newAc} onChangeText={setNewAc} keyboardType="number-pad" testID={`dm-newcombatant-ac-${encounter.name}`} />
          <Btn small label="Add" disabled={!newName.trim() || offline} testID={`dm-newcombatant-confirm-${encounter.name}`}
            onPress={() => {
              const ac = newAc.trim() ? Number(newAc.trim()) : undefined;
              run(() => peer.addCombatant(encounter.id, { id: newId('c'), name: newName.trim(), ...(ac !== undefined && Number.isFinite(ac) ? { ac } : {}) }));
              setAddingCombatant(false); setNewName(''); setNewAc('');
            }} />
          <Btn small kind="ghost" label="Cancel" onPress={() => setAddingCombatant(false)} />
        </Row>
      ) : (
        <Btn small kind="ghost" label="+ Add combatant" onPress={() => setAddingCombatant(true)} testID={`dm-add-combatant-${encounter.name}`} />
      )}

      <Btn small kind="danger" label="End encounter" disabled={offline} onPress={() => run(() => peer.endEncounter(encounter.id))} testID={`dm-end-encounter-${encounter.name}`} />
    </Card>
  );
}
