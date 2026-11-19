import { useState } from 'react';
import { SessionPeer } from '../../session/peer';
import { describeEffectComponent } from '../../session/prepEdit';
import { LiveEffect, PublicParticipant } from '../../session/types';
import { Card, Row, Body, Badge, Muted, Field, Btn, Chip } from './LiveUi';

// ── Effect card (shared by the public/secret effect lists) ───────────────────

export function EffectCard({ effectId, displayName, secret, effect, players, nameOf, offline, peer, run }: {
  effectId: string;
  displayName: string;
  secret: { description: string; notes: string } | null;
  effect: LiveEffect;
  players: PublicParticipant[];
  nameOf: (id: string) => string;
  offline: boolean;
  peer: SessionPeer;
  run: (fn: () => unknown) => void;
}) {
  const [addingTarget, setAddingTarget] = useState(false);
  const [revealing, setRevealing] = useState<'public' | 'target' | null>(null);
  const [revealName, setRevealName] = useState('');
  const [revealDescription, setRevealDescription] = useState('');
  const alreadyTargeted = new Set(Object.values(effect.applications).filter(a => a.state !== 'ENDED').map(a => a.targetId));
  const addable = players.filter(p => !alreadyTargeted.has(p.id));
  const visibility = effect.definition.visibility;

  return (
    <Card tone={visibility === 'secret' ? 'secret' : 'default'} testID={`dm-live-effect-${displayName}`}>
      <Row wrap>
        <Body bold>{visibility === 'secret' ? '🔒 ' : ''}{displayName}</Body>
        <Badge label={visibility} tone={visibility === 'secret' ? 'secret' : 'default'} />
      </Row>
      {secret && <Muted>DM only: {secret.description}{secret.notes ? ` · ${secret.notes}` : ''}</Muted>}
      {!!effect.definition.source && <Muted>Source: {effect.definition.source}</Muted>}
      <Muted>{effect.definition.components.map(describeEffectComponent).join(', ') || 'no numeric change'}</Muted>

      {revealing ? (
        <Card testID={`dm-reveal-editor-${displayName}`}>
          <Muted>Reveal as {revealing === 'public' ? 'public' : 'target-only'} — confirm or edit the identity everyone{revealing === 'target' ? ' who is a target' : ''} will now see.</Muted>
          <Field label="Name" value={revealName} onChangeText={setRevealName} testID={`dm-reveal-name-${displayName}`} />
          <Field label="Description (optional)" value={revealDescription} onChangeText={setRevealDescription} multiline testID={`dm-reveal-description-${displayName}`} />
          <Row wrap>
            <Btn small label="Reveal" disabled={offline || !revealName.trim()} testID={`dm-reveal-confirm-${displayName}`}
              onPress={() => {
                run(() => peer.convertEffectVisibility(effectId, revealing, { name: revealName.trim(), description: revealDescription.trim() }));
                setRevealing(null);
              }} />
            <Btn small kind="ghost" label="Cancel" onPress={() => setRevealing(null)} />
          </Row>
        </Card>
      ) : (
        <Row wrap>
          <Muted>Visibility:</Muted>
          <Chip label="Public" active={visibility === 'public'} testID={`dm-convert-public-${displayName}`}
            onPress={() => {
              if (visibility === 'public') return;
              if (visibility === 'secret') { setRevealing('public'); setRevealName(displayName); setRevealDescription(secret?.description ?? ''); }
              else run(() => peer.convertEffectVisibility(effectId, 'public'));
            }} />
          <Chip label="Target only" active={visibility === 'target'} testID={`dm-convert-target-${displayName}`}
            onPress={() => {
              if (visibility === 'target') return;
              if (visibility === 'secret') { setRevealing('target'); setRevealName(displayName); setRevealDescription(secret?.description ?? ''); }
              else run(() => peer.convertEffectVisibility(effectId, 'target'));
            }} />
          <Chip label="Secret" active={visibility === 'secret'} testID={`dm-convert-secret-${displayName}`}
            onPress={() => { if (visibility !== 'secret') run(() => peer.convertEffectVisibility(effectId, 'secret')); }} />
        </Row>
      )}
      {Object.values(effect.applications).map(a => (
        <Row wrap key={a.id}>
          <Body>{nameOf(a.targetId)}</Body>
          <Badge label={a.state === 'DUE_TO_END' ? 'due to end' : a.state.toLowerCase()} tone={a.state === 'ACTIVE' ? 'good' : a.state === 'DUE_TO_END' ? 'warn' : 'bad'} />
          {a.remaining !== null && a.state !== 'ENDED' && <Muted>{a.remaining} rd</Muted>}
          {a.state === 'ACTIVE' && <Btn small kind="ghost" label="Due" disabled={offline} onPress={() => run(() => peer.markDue(a.id))} testID={`dm-due-${displayName}-${nameOf(a.targetId)}`} />}
          {a.state !== 'ENDED' && <Btn small kind="danger" label={`End for ${nameOf(a.targetId)}`} disabled={offline} onPress={() => run(() => peer.endEffect(effectId, a.id))} testID={`dm-end-${displayName}-${nameOf(a.targetId)}`} />}
        </Row>
      ))}
      {Object.values(effect.applications).filter(a => a.state !== 'ENDED').length > 1 && (
        <Btn small kind="danger" label="End for everyone" disabled={offline} onPress={() => run(() => peer.endEffect(effectId))} testID={`dm-end-all-${displayName}`} />
      )}
      {addable.length > 0 && (
        addingTarget ? (
          <Row wrap>
            {addable.map(p => (
              <Chip key={p.id} label={p.nickname} onPress={() => { run(() => peer.addEffectTarget(effectId, p.id)); setAddingTarget(false); }} testID={`dm-add-target-${displayName}-${p.nickname}`} />
            ))}
            <Btn small kind="ghost" label="Cancel" onPress={() => setAddingTarget(false)} />
          </Row>
        ) : (
          <Btn small kind="ghost" label="+ Add target" disabled={offline} onPress={() => setAddingTarget(true)} testID={`dm-add-target-open-${displayName}`} />
        )
      )}
    </Card>
  );
}
