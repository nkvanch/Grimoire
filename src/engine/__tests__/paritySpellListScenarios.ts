// Spell lists for the native-parity fixtures: what a list draft compiles to, and which spells a spell-choice picker offers with a list
// in play (the class's own source, or the list the player opted into). The executors are the app's own code.
import type { Entity, SpellList, ChoiceState } from '../types';
import { compileSpellListFields, type SpellListDraft } from '../../content/homebrewCompile';
import { validateSpellList } from '../homebrewValidator';
import { spellPickerPool } from '../../content/spellChoiceFilter';
import { extraClassSpellIds } from '../spellModifiers';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../../store/characterStore';
import type { Providers } from './parityLevelScenarios';

export type SpellListCase = { name: string; id: string; draft: SpellListDraft };

export function buildSpellListCases(): SpellListCase[] {
  const base = (over: Partial<SpellListDraft> = {}): SpellListDraft => ({ name: 'Ashen Rites', description: '', classId: null, spellIds: [], ...over });
  return [
    { name: 'empty', id: 'ashen_rites', draft: base() },
    { name: 'for-a-class', id: 'ashen_rites', draft: base({ description: ' Fire and ruin. ', classId: 'wizard', spellIds: ['firebolt', 'burning_hands', 'fireball'], rulesetId: 'dnd5e-2014' as never }) },
    { name: 'no-name', id: 'nameless', draft: base({ name: '  ', spellIds: ['shield'] }) },
    { name: 'repeated-spell', id: 'twice', draft: base({ name: 'Twice', spellIds: ['shield', 'shield'] }) },
  ];
}

export function runSpellListCase(c: SpellListCase) {
  const list = compileSpellListFields(c.draft, c.id);
  return { fields: list, validation: validateSpellList(list) };
}

export type SpellPoolCase = {
  name: string;
  entity: Entity;
  ruleset: 'dnd5e-2014' | 'dnd5e-2024';
  spellLists: SpellList[];
  activeSpellListId: string | null;
  /** The class's own chosen source, as a class record would carry it. */
  classSource: { kind: 'list'; listId: string } | { kind: 'class'; classId: string } | null;
  classId: string;
  /** choice id -> the spell ids the picker offers */
  expected: Record<string, string[]>;
};

const STATS = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };

export function buildSpellPoolCases(providers: Providers): SpellPoolCase[] {
  const out: SpellPoolCase[] = [];
  const make = (
    name: string, tag: 'p2014' | 'p2024', classId: string, level: number,
    spellLists: SpellList[], activeSpellListId: string | null, classSource: SpellPoolCase['classSource'],
  ) => {
    const p = providers[tag];
    const entity = createCharacter(p, {
      id: 'pool-' + name, name: 'Pool ' + name, classId, raceId: p.races()[0].id, backgroundId: p.backgrounds()[0].id, stats: STATS as never, level,
    }, DEFAULT_RULES);
    const sc = entity.spellcasting;
    let maxCastableLevel = 0;
    if (sc) {
      for (const t of ['9', '8', '7', '6', '5', '4', '3', '2', '1'] as const) {
        if ((sc.slots[t]?.total ?? 0) > 0 || (sc.pactSlots?.[t]?.total ?? 0) > 0) { maxCastableLevel = Number(t); break; }
      }
    }
    const known = new Set([...(sc?.cantrips ?? []), ...(sc?.known ?? [])]);
    const all = p.spells().map(s => ({ id: s.id, level: s.level, school: s.school, ritual: !!s.ritual, classes: (s as { classes?: string[] }).classes }));
    const expected: Record<string, string[]> = {};
    for (const c of entity.choices as ChoiceState[]) {
      if (c.resolved || c.definition.kind !== 'spell') continue;
      const owner = c.definition.forClassId ?? entity.identity.classId;
      expected[c.id] = spellPickerPool({
        allSpells: all, def: c.definition, classId: owner, maxCastableLevel, known, activeSpellListId, spellLists,
        classSource, extraSpellIds: extraClassSpellIds(entity, owner),
      }).map(s => s.id).sort();
    }
    out.push({ name, entity, ruleset: tag === 'p2014' ? 'dnd5e-2014' : 'dnd5e-2024', spellLists, activeSpellListId, classSource, classId, expected });
  };

  const wizardList: SpellList = { id: 'ash_list', name: 'Ash', classId: 'wizard', spellIds: ['firebolt', 'mage_hand', 'shield', 'burning_hands', 'thunderwave', 'fireball'] };
  const oddList: SpellList = { id: 'odd_list', name: 'Odd', spellIds: ['guidance', 'cure_wounds', 'bless', 'not_a_real_spell'] };
  make('wizard-default', 'p2014', 'wizard', 1, [wizardList], null, null);
  make('wizard-picked-list', 'p2014', 'wizard', 1, [wizardList], 'ash_list', null);
  make('wizard-picked-list-from-another-class', 'p2014', 'wizard', 1, [wizardList, oddList], 'odd_list', null);
  make('wizard-picked-list-that-is-gone', 'p2014', 'wizard', 1, [wizardList], 'missing', null);
  make('wizard-class-source-list', 'p2014', 'wizard', 3, [wizardList], null, { kind: 'list', listId: 'ash_list' });
  make('wizard-class-source-missing-list', 'p2014', 'wizard', 3, [], null, { kind: 'list', listId: 'gone' });
  make('wizard-class-source-another-class', 'p2014', 'wizard', 3, [], null, { kind: 'class', classId: 'cleric' });
  make('wizard-level-5-default', 'p2014', 'wizard', 5, [], null, null);
  make('cleric-picked-list', 'p2014', 'cleric', 1, [oddList], 'odd_list', null);
  make('2024-wizard-default', 'p2024', 'wizard_2024', 1, [], null, null);
  make('2024-wizard-picked-list', 'p2024', 'wizard_2024', 1, [{ id: 'new_list', name: 'New', spellIds: ['fireball', 'shield', 'magic_missile', 'light', 'mage_hand'] }], 'new_list', null);
  return out;
}
