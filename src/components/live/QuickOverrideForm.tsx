import { useState } from 'react';
import { SessionPeer } from '../../session/peer';
import { parseSignedInt } from '../../session/prepEdit';
import { EffectComponent, PublicParticipant, EffectDuration } from '../../session/types';
import { Card, Muted, Row, Chip, Field, Btn } from './LiveUi';

// ── Quick Override form (DM_SCREEN_SPEC.md item 12) ───────────────────────────────────────────
// Reuses the existing effect system (dm.apply_effect via peer.applyQuickEffect) — a Quick
// Override IS an effect, just built on the spot instead of pre-authored in DM Preparation.
// Disclosed limit: the effect component model is additive-only (no 'set exact value', so
// "speed becomes 0" isn't representable) and purely numeric (no "advantage on next save" /
// "immunity to one effect" — those stay a label-only override with no mechanical component,
// same as a prepared effect with no stat picked).

const QO_STATS: EffectComponent['stat'][] = ['ac', 'speed', 'initiative', 'save', 'spell_attack', 'spell_dc'];
const QO_STAT_LABEL: Record<EffectComponent['stat'], string> = { ac: 'AC', speed: 'Speed', initiative: 'Initiative', save: 'Saves', spell_attack: 'Spell attack', spell_dc: 'Spell save DC' };

export function QuickOverrideForm({ players, offline, peer, run, onDone }: {
  players: PublicParticipant[];
  offline: boolean;
  peer: SessionPeer;
  run: (fn: () => unknown) => void;
  onDone: () => void;
}) {
  const [targets, setTargets] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'target'>('public');
  const [stat, setStat] = useState<EffectComponent['stat'] | null>(null);
  const [value, setValue] = useState('1');
  const [rounds, setRounds] = useState('');

  const n = parseSignedInt(value);
  const r = rounds.trim() ? parseSignedInt(rounds) : null;
  const valid = name.trim().length > 0 && targets.length > 0 && (!stat || n !== null) && (rounds.trim() === '' || (r !== null && r >= 1));

  function toggleTarget(id: string) { setTargets(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id]); }

  function submit() {
    if (!valid) return;
    const components: EffectComponent[] = stat && n !== null ? [{ stat, operation: 'add', value: n }] : [];
    const duration: EffectDuration = r ? { unit: 'rounds', total: r, remaining: r } : { unit: 'manual' };
    run(() => peer.applyQuickEffect({ name: name.trim(), description: description.trim() || undefined, visibility, components, duration }, targets));
    onDone();
  }

  return (
    <Card testID="dm-quick-override-form">
      <Muted>Targets:</Muted>
      <Row wrap>{players.map(p => <Chip key={p.id} label={p.nickname} active={targets.includes(p.id)} onPress={() => toggleTarget(p.id)} testID={`dm-qo-target-${p.nickname}`} />)}</Row>
      <Field label="Label" value={name} onChangeText={setName} placeholder="Blessed Ground" testID="dm-qo-name" />
      <Field label="Note (optional)" value={description} onChangeText={setDescription} placeholder="Why — shown to whoever can see this override" testID="dm-qo-desc" />
      <Row wrap>
        <Chip label="Public" active={visibility === 'public'} onPress={() => setVisibility('public')} testID="dm-qo-vis-public" />
        <Chip label="Target only" active={visibility === 'target'} onPress={() => setVisibility('target')} testID="dm-qo-vis-target" />
      </Row>
      <Muted>Changes a number (optional):</Muted>
      <Row wrap>
        <Chip label="None" active={stat === null} onPress={() => setStat(null)} testID="dm-qo-stat-none" />
        {QO_STATS.map(s => <Chip key={s} label={QO_STAT_LABEL[s]} active={stat === s} onPress={() => setStat(s)} testID={`dm-qo-stat-${s}`} />)}
      </Row>
      {stat && <Field label="Amount (whole number, may be negative)" value={value} onChangeText={setValue} keyboardType="numbers-and-punctuation" testID="dm-qo-value" />}
      <Field label="Duration in rounds (blank = manual)" value={rounds} onChangeText={setRounds} keyboardType="number-pad" testID="dm-qo-rounds" />
      <Row>
        <Btn small label="Apply" disabled={!valid || offline} testID="dm-qo-apply" onPress={submit} />
        <Btn small kind="ghost" label="Cancel" onPress={onDone} />
      </Row>
    </Card>
  );
}
