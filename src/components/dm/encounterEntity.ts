import { Entity } from '../../engine/types';

// Reads back the groupName a PreparedEncounter combatant was tagged with at
// spawn time (preparedEncounter.ts's withPrepMetadata writes it into the
// notes JSON blob alongside spawnMonster's own cr/size/type metadata) — the
// first runtime consumer of that field, used here to offer "select this
// group" as a multi-target shortcut. Best-effort: any entity without prep
// metadata (manually-added party members, monsters spawned outside a
// PreparedEncounter) simply has no group and isn't offered.
export function entityGroupName(entity: Entity): string | undefined {
  try {
    const parsed = JSON.parse(entity.notes || '{}') as Record<string, unknown>;
    return typeof parsed.groupName === 'string' ? parsed.groupName : undefined;
  } catch { return undefined; }
}

// Same withPrepMetadata blob as entityGroupName above, reading its two
// sibling keys that previously had no reader anywhere — a DM's "Hidden"
// flag and per-combatant tactics note were persisted at prep time but had
// zero effect the moment combat started (audit finding HIDDEN-META-1).
export function entityDmHidden(entity: Entity): boolean {
  try {
    const parsed = JSON.parse(entity.notes || '{}') as Record<string, unknown>;
    return parsed.dmHidden === true;
  } catch { return false; }
}
export function entityCombatantNotes(entity: Entity): string | undefined {
  try {
    const parsed = JSON.parse(entity.notes || '{}') as Record<string, unknown>;
    return typeof parsed.combatantNotes === 'string' ? parsed.combatantNotes : undefined;
  } catch { return undefined; }
}
