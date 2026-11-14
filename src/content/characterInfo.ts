// ============================================================================
// FILE: src/content/characterInfo.ts
// What a character was built from, as rows for the sheet's Character info page: the rules, level, each class with its level and
// subclass, species and subrace, background and its origin feat, the feats taken, alignment and experience. Names and descriptions
// come from the same merged official + homebrew content the rest of the app reads; an id that resolves to nothing is shown as a
// readable version of itself, never a blank. Presentation only: nothing here changes the character.
// ============================================================================
import type { Entity, Race, CharClass, Background, Feat, HomebrewSubclass } from '../engine/types';
import { getClassLevels } from '../engine/multiclass';
import { getSubclassEntryMerged } from './subclasses/subclassBrowse';
import { prettyId } from './identityLabels';
import { rulesetLabel } from './rulesets';

export type InfoRow = { key: string; label: string; value: string; detail?: string };
type Db = { races: readonly Race[]; classes: readonly CharClass[]; backgrounds: readonly Background[]; feats?: readonly Feat[] };

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const descriptionOf = (x: unknown): string | undefined => text((x as { description?: unknown } | undefined)?.description);

export function characterInfoRows(entity: Entity, db: Db, homebrewSubclasses: readonly HomebrewSubclass[] = []): InfoRow[] {
  const { identity } = entity;
  const rows: InfoRow[] = [];
  const add = (row: InfoRow) => { if (row.value) rows.push(row); };

  add({ key: 'rules', label: 'Rules', value: rulesetLabel(entity.rulesetId) ?? 'Not set' });
  add({ key: 'level', label: 'Level', value: String(identity.level) });

  const levels = getClassLevels(entity);
  const classes = levels.length ? levels : identity.classId ? [{ classId: identity.classId, subclassId: identity.subclassId, level: identity.level }] : [];
  classes.forEach((l, i) => {
    const cls = db.classes.find(c => c.id === l.classId);
    add({ key: `class:${i}`, label: classes.length > 1 ? `Class ${i + 1}` : 'Class', value: `${cls?.name ?? prettyId(l.classId)}${classes.length > 1 ? `, level ${l.level}` : ''}`, detail: descriptionOf(cls) });
    if (l.subclassId) {
      const sub = getSubclassEntryMerged(l.classId, l.subclassId, homebrewSubclasses as HomebrewSubclass[], entity.rulesetId);
      add({ key: `subclass:${i}`, label: 'Subclass', value: sub?.name ?? prettyId(l.subclassId), detail: text(sub?.blurb) });
    }
  });

  const race = db.races.find(r => r.id === identity.raceId);
  add({ key: 'race', label: 'Species', value: race?.name ?? (identity.raceId ? prettyId(identity.raceId) : ''), detail: descriptionOf(race) });
  if (identity.subRaceId) {
    const subrace = (race?.subraces ?? db.races.flatMap(r => r.subraces ?? [])).find(s => s.id === identity.subRaceId);
    add({ key: 'subrace', label: 'Subrace', value: subrace?.name ?? prettyId(identity.subRaceId), detail: descriptionOf(subrace) });
  }

  const background = db.backgrounds.find(b => b.id === identity.backgroundId);
  add({ key: 'background', label: 'Background', value: background?.name ?? (identity.backgroundId ? prettyId(identity.backgroundId) : ''), detail: descriptionOf(background) });

  const shown = new Set<string>();
  const originId = (background as { originFeat?: string } | undefined)?.originFeat;
  if (originId) {
    const feat = db.feats?.find(f => f.id === originId);
    const name = feat?.name ?? prettyId(originId);
    shown.add(name.toLowerCase());
    add({ key: 'origin-feat', label: 'Origin feat', value: name, detail: text(feat?.description) ?? descriptionOf(feat?.feature) });
  }
  for (const f of entity.features ?? []) {
    if (f.source?.kind !== 'feat' || shown.has(f.name.toLowerCase())) continue;
    shown.add(f.name.toLowerCase());
    add({ key: `feat:${f.id}`, label: 'Feat', value: f.name, detail: text(f.description) });
  }

  if (identity.alignment) add({ key: 'alignment', label: 'Alignment', value: identity.alignment });
  add({ key: 'xp', label: 'Experience', value: (identity.xp ?? 0).toLocaleString('en-US') });
  return rows;
}
