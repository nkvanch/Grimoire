// New characters, as the phone app's createCharacter makes them from the SRD packs: the native creation is held to the same entity.
import type { Entity, Subrace } from '../types';
import { compileSubraceFields } from '../../content/homebrewCompile';
import { DEFAULT_RULES } from '../../store/characterStore';
import { createCharacter } from '../../content/provider/createCharacter';
import type { Providers } from './parityLevelScenarios';

export type CreationSpec = { id: string; name: string; rulesetId: string; classId: string; raceId: string; backgroundId: string; level: number; subclassId?: string; subraceId?: string };
export type CreationCase = { name: string; spec: CreationSpec; stats: Record<string, number>; entity: Entity; /** a standalone subrace the native catalog must be given (an embedded one is read from its species) */ subrace?: Subrace };

const STATS = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 8 };

export function buildCreationCases(providers: Providers): CreationCase[] {
  const out: CreationCase[] = [];
  const make = (name: string, tag: '5e' | '5e24', classId: string, raceId: string, backgroundId: string, level: number, subclassId?: string,
    pickSubrace?: (race: { subraces?: Subrace[] }) => { subrace: Subrace; standalone: boolean }) => {
    const p = tag === '5e' ? providers.p2014 : providers.p2024;
    const spec: CreationSpec = {
      id: `new-${name}`, name: `New ${name}`, rulesetId: tag === '5e' ? 'dnd5e-2014' : 'dnd5e-2024',
      classId, raceId, backgroundId, level, ...(subclassId ? { subclassId } : {}),
    };
    const chosen = pickSubrace ? pickSubrace(p.getRace(raceId) as unknown as { subraces?: Subrace[] }) : undefined;
    if (chosen) spec.subraceId = chosen.subrace.id;
    const entity = createCharacter(p, { id: spec.id, name: spec.name, classId, raceId, backgroundId, stats: STATS as never, level, subclassId, subrace: chosen?.subrace }, DEFAULT_RULES);
    out.push({ name, spec, stats: STATS, entity, ...(chosen?.standalone ? { subrace: chosen.subrace } : {}) });
  };

  for (const [tag, p] of [['5e', providers.p2014], ['5e24', providers.p2024]] as const) {
    const race0 = p.races()[0].id;
    const bg0 = p.backgrounds()[0].id;
    // every class at its first level
    for (const cls of p.classes()) make(`${tag}-${cls.id}-1`, tag, cls.id, race0, bg0, 1);
    // every species, every background
    for (const race of p.races()) make(`${tag}-race-${race.id}`, tag, p.classes()[0].id, race.id, bg0, 1);
    for (const bg of p.backgrounds()) make(`${tag}-background-${bg.id}`, tag, p.classes()[0].id, race0, bg.id, 1);
    // a few higher levels with the first subclass taken
    for (const cls of p.classes().slice(0, 4)) {
      const sub = p.subclassesOf(cls.id)[0];
      if (sub) make(`${tag}-${cls.id}-5-${sub.id}`, tag, cls.id, race0, bg0, 5, sub.id);
    }
  }
  // a species' own subraces, and one attached to it from outside
  const embedded = (id: string) => (race: { subraces?: Subrace[] }) => {
    const sr = (race.subraces ?? []).find(x => x.id === id);
    if (!sr) throw new Error('no subrace ' + id);
    return { subrace: sr, standalone: false };
  };
  make('5e-elf-high-elf', '5e', 'wizard', 'elf', providers.p2014.backgrounds()[0].id, 1, undefined, embedded('high_elf'));
  make('5e-dwarf-hill-dwarf', '5e', 'cleric', 'dwarf', providers.p2014.backgrounds()[0].id, 3, undefined, embedded('hill_dwarf'));
  make('5e-halfling-lightfoot', '5e', 'rogue', 'halfling', providers.p2014.backgrounds()[0].id, 1, undefined, embedded('lightfoot_halfling'));
  const attached = compileSubraceFields({
    name: 'Ash Elf', abiBonuses: { str: '', dex: '', con: '1', int: '', wis: '1', cha: '' },
    traits: [], rulesetId: 'dnd5e-2014' as never,
    pendingChoices: [{ localId: 'p1', kind: 'language', count: '1', prompt: '', poolMode: 'all', categories: [], restrictedIds: [] }],
  }, 'elf');
  make('5e-elf-attached-ash-elf', '5e', 'fighter', 'elf', providers.p2014.backgrounds()[0].id, 2, undefined, () => ({ subrace: attached, standalone: true }));
  const replacing: Subrace = { ...attached, id: 'elf_replacer', name: 'Replacer', replacesBaseFeatureIds: ['elf_asi'] } as Subrace;
  make('5e-elf-replaces-a-base-feature', '5e', 'wizard', 'elf', providers.p2014.backgrounds()[0].id, 1, undefined, () => ({ subrace: replacing, standalone: true }));
  return out;
}
