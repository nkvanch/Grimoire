import { projectState } from '../../session/state';
import { ViewState } from '../../session/types';
import { Card, Body, Muted } from './LiveUi';

// ── Preview as Player (DM_SCREEN_SPEC.md item 17) ─────────────────────────────
// The DM's own ViewState IS the full unredacted canonical state (projectState's 'dm' branch
// clones every field — see state.ts), so recomputing a chosen Player's authorized projection
// needs no new op or round trip: just call the SAME pure projectState() the Host itself uses,
// locally, with that Player's id/capabilities. Read-only by construction — nothing here can
// change state, only render whatever projectState already decided that Player may see.

export function PlayerPreviewPanel({ view, playerId, nameOf }: { view: ViewState; playerId: string; nameOf: (id: string) => string }) {
  const preview = projectState(view, { id: playerId, capabilities: ['player'] });
  const encounters = Object.values(preview.encounters).filter(e => e.active);
  const effects = Object.values(preview.effects);
  const characters = Object.values(preview.characters);
  const requests = Object.values(preview.requests).filter(r => r.targetId === playerId);
  const rewards = Object.values(preview.rewards).filter(r => r.targetId === playerId);
  const me = characters.find(c => c.participantId === playerId);
  const others = characters.filter(c => c.participantId !== playerId);

  return (
    <Card tone="secret" testID={`dm-preview-panel-${playerId}`}>
      <Body bold>What {nameOf(playerId)} currently sees</Body>
      {me && <Muted>Own character: {me.summary.name} · HP {me.summary.hp}/{me.summary.maxHp} · AC {me.summary.ac}</Muted>}
      {others.map(c => (
        <Muted key={c.participantId}>{nameOf(c.participantId)}'s public info: {c.summary.name} · HP {c.summary.hp}/{c.summary.maxHp} · AC {c.summary.ac}</Muted>
      ))}
      {encounters.length === 0 && <Muted>No active encounter visible.</Muted>}
      {encounters.map(e => (
        <Muted key={e.id}>⚔ {e.name}: {e.combatants.map(c => c.name).join(', ') || 'no visible combatants'}</Muted>
      ))}
      {effects.length === 0 && <Muted>No effects visible.</Muted>}
      {effects.map((eff, i) => (
        <Muted key={i}>Effect: {eff.definition.name ?? '(secret — mechanics only)'}</Muted>
      ))}
      {requests.length > 0 && <Muted>Pending requests: {requests.map(r => r.label).join(', ')}</Muted>}
      {rewards.filter(r => r.status === 'PENDING').length > 0 && (
        <Muted>Rewards awaiting response: {rewards.filter(r => r.status === 'PENDING').map(r => r.label).join(', ')}</Muted>
      )}
    </Card>
  );
}
