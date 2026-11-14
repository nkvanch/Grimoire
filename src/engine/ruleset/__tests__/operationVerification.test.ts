// Operation verification (contract LIFE-004, the desktop app's tests/test_operation_verification_dnd5e.cpp): a revision is not verified because it
// has a name and a number. Every operation the ruleset registers, at every revision this app can run, has a probe that runs the operation on fixed
// characters and fingerprints what it did; a change in what an operation does fails here until its revision is raised (dnd5eOperations.ts) and its
// fingerprint renewed on purpose. The fingerprints are this app's own (its engine is not the desktop's); the characters are made from the SRD packs
// as committed in a080b8a (fixtures/), so a fingerprint changes when an operation does, not when the shipped content does.
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { packContentProvider, InstalledPack, ContentProvider } from '../../../content/provider/contentProvider';
import { createCharacter } from '../../../content/provider/createCharacter';
import { getProgressionForClass } from '../../../content/classes/progressions';
import { BEAST_FORMS_2014 } from '../../../content/beastforms/beastforms2014Data';
import { DEFAULT_RULES } from '../../defaults';
import { canonicalJson } from '../../contentPackManifest';
import { sha256Hex } from '../../sha256';
import { modifier, proficiencyBonus, recomputeDerived } from '../../pipeline';
import {
  applyDamage, applyHealing, applyTempHP, applyWildShapeDamage, recordDeathSave, startWildShape, endWildShape, playerEndTurn,
} from '../../combat';
import { takeRest, takeDawn } from '../../rest';
import { levelUp, calculateLevelUpHpGain, resolveChoice, applyAsiToEntity, swapBackground } from '../../leveling';
import { commitSpellPayment, restoreSpellSlot } from '../../spellPayment';
import { isSpellPreparationLegal, resolveSpellCastingContexts } from '../../actionCards';
import { equipItem, unequipItem, toggleAttunement } from '../../inventory';
import { applyCondition, removeCondition } from '../../conditions';
import { setWeaponMasteryPicks } from '../../weaponMastery';
import { createCompanion, type CompanionTemplate } from '../../companion';
import { applyCharacterOverride } from '../../characterOverride';
import { applyDmOverride } from '../../dmOverride';
import { STANDARD_POINT_BUY, pointBuySpent, validatePointBuy } from '../../pointBuy';
import { DND5E_OPERATIONS } from '../dnd5eOperations';
import { multiclassLacks, multiclassRequirementApplies } from '../../multiclassPrerequisites';
import type { CampaignRules, Entity, Feature, RulesetId } from '../../types';

const fixture = (name: string): InstalledPack =>
  JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json.gz`))).toString('utf8'));
const PACKS = [fixture('grimoire.srd.5.1'), fixture('grimoire.srd.5.2.1')];
const P2014 = packContentProvider(PACKS, 'dnd5e-2014' as RulesetId);
const P2024 = packContentProvider(PACKS, 'dnd5e-2024' as RulesetId);
const RULES: CampaignRules = { ...DEFAULT_RULES, hpMode: 'fixed' };
const STATS = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 10 };

const make = (provider: ContentProvider, classId: string, level: number, raceId = 'human', backgroundId = 'acolyte'): Entity =>
  createCharacter(provider, { id: `${classId}-${level}`, name: classId, classId, raceId, backgroundId, stats: STATS, level }, RULES);

// Item instances, overrides and timestamps are named at random or by the clock; the probes leave those out.
const VOLATILE = new Set(['id', 'instanceId', 'appliedAt', 'cancelledAt', 'createdAt', 'updatedAt', 'timestamp', 'at', 'conModApplied']);
const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, stable(x)])) : v;

/** What an operation did, in a fixed form. */
class Trace {
  private text = '';
  add(label: string, value: unknown) { this.text += `${label}=${typeof value === 'string' ? value : canonicalJson(stable(value) as never)}|`; return this; }
  /** That the operation really acted: a probe of an operation that did nothing verifies nothing. */
  changed(label: string, before: unknown, after: unknown) {
    if (canonicalJson(stable(before) as never) === canonicalJson(stable(after) as never)) throw new Error(`${label}: the operation did nothing`);
    return this.add(label, after);
  }
  finish(): string {
    if (this.text.length <= 40) throw new Error('a probe that shows nothing verifies nothing');
    return sha256Hex(this.text).slice(0, 16);
  }
}

const hp = (e: Entity) => e.resources.hp;
const dying = (e: Entity): Entity => ({ ...e, resources: { ...e.resources, hp: { ...hp(e), current: 0 } } });

const PROBES: Record<string, (revision: number) => string> = {
  'dnd5e.ability_modifier': () => new Trace().add('mods', Array.from({ length: 30 }, (_, i) => modifier(i + 1))).finish(),
  'dnd5e.proficiency_bonus': () => new Trace().add('pb', Array.from({ length: 20 }, (_, i) => proficiencyBonus(i + 1))).finish(),
  'dnd5e.hit_point_gain': () => {
    const f = make(P2014, 'fighter', 1);
    const t = new Trace();
    for (const mode of ['max', 'fixed'] as const) {
      for (const die of [6, 8, 10, 12]) t.add(`${mode} d${die}`, [calculateLevelUpHpGain(f, die, mode, RULES, 'con', false), calculateLevelUpHpGain(f, die, mode, RULES, 'con', true)]);
    }
    return t.add('manual', calculateLevelUpHpGain(f, 10, 'rolled', RULES, 'con', false, 7)).finish();
  },
  'dnd5e.derived_stats': () => {
    const w = make(P2014, 'wizard', 3), f = make(P2014, 'fighter', 5);
    return new Trace().add('wizard', recomputeDerived(w, RULES).derived).add('fighter', recomputeDerived(f, RULES).derived).finish();
  },
  'dnd5e.damage_modifiers': () => {
    const t = make(P2014, 'fighter', 3, 'tiefling');
    return new Trace().changed('fire resisted, cold not', hp(applyDamage(t, 10, RULES, 'cold')), hp(applyDamage(t, 10, RULES, 'fire'))).finish();
  },
  'dnd5e.apply_damage': () => {
    const f = applyTempHP(make(P2014, 'fighter', 3), 4, RULES);
    const hit = applyDamage(f, 9, RULES);
    const down = applyDamage(f, 200, RULES);
    return new Trace().changed('hit', hp(f), hp(hit)).add('down', [hp(down), down.resources.deathSaves]).finish();
  },
  'dnd5e.apply_healing': () => {
    const d = recordDeathSave(dying(make(P2014, 'fighter', 3)), 'failure', RULES);
    const healed = applyHealing(d, 5, RULES);
    return new Trace().changed('healed', [hp(d), d.resources.deathSaves], [hp(healed), healed.resources.deathSaves]).finish();
  },
  'dnd5e.temp_hp': () => {
    const f = make(P2014, 'fighter', 3);
    const a = applyTempHP(f, 5, RULES), b = applyTempHP(a, 3, RULES), c = applyTempHP(b, 8, RULES);
    return new Trace().changed('first', hp(f), hp(a)).add('lower', hp(b)).add('higher', hp(c)).finish();
  },
  'dnd5e.wild_shape_damage': () => {
    const d = startWildShape(make(P2014, 'druid', 2), BEAST_FORMS_2014[0].id, RULES);
    const hit = applyWildShapeDamage(d, 3, RULES), over = applyWildShapeDamage(d, (d.wildShapeState?.beastHp ?? 0) + 4, RULES);
    return new Trace().changed('hit', d.wildShapeState, hit.wildShapeState).add('over', [over.wildShapeState, hp(over)]).finish();
  },
  'dnd5e.death_saves': () => {
    let d = dying(make(P2014, 'fighter', 3));
    const t = new Trace();
    for (const o of ['success', 'failure', 'success', 'success'] as const) { const next = recordDeathSave(d, o, RULES); t.changed(o, d.resources.deathSaves, next.resources.deathSaves); d = next; }
    return t.finish();
  },
  'dnd5e.short_rest': () => {
    const w = commitSpellPayment(applyDamage(make(P2014, 'warlock', 3), 8, RULES), { kind: 'pact', tier: '2' } as never);
    const rested = takeRest(w, 'short', RULES);
    return new Trace().changed('rest', [hp(w), w.spellcasting, w.resources], [hp(rested), rested.spellcasting, rested.resources]).finish();
  },
  'dnd5e.long_rest': () => {
    const w = commitSpellPayment(applyDamage(make(P2014, 'wizard', 3), 8, RULES), { kind: 'normal', tier: '1' } as never);
    const rested = takeRest(w, 'long', RULES);
    return new Trace().changed('rest', [hp(w), w.spellcasting], [hp(rested), rested.spellcasting, rested.resources.hitDice]).finish();
  },
  'dnd5e.dawn_recharge': () => {
    const e = applyCondition(make(P2014, 'fighter', 3), 'poisoned', 'manual', RULES, undefined, { unit: 'rounds', remaining: 1 });
    const ended = playerEndTurn(e, RULES);
    return new Trace().changed('end of turn', e.conditions, ended.conditions).add('dawn', takeDawn(ended, RULES).resources).finish();
  },
  'dnd5e.level_up': revision => {
    const t = new Trace();
    for (const classId of ['fighter', 'wizard', 'cleric']) {
      const e = make(P2014, classId, 1);
      const up = levelUp(e, 2, getProgressionForClass(P2014.getClass(classId)!), RULES, P2014.classes());
      t.changed(classId, [e.identity, hp(e), e.features.map(f => f.id), e.spellcasting], [up.identity, hp(up), up.features.map(f => f.id), up.spellcasting, up.choices.map(c => c.id)]);
    }
    // revision 3: a new class is held to the multiclass ability requirements; revision 2 is not
    if (multiclassRequirementApplies(RULES, revision)) {
      const fighter = { ...make(P2014, 'fighter', 3), stats: { str: 14, dex: 10, con: 14, int: 8, wis: 12, cha: 10 } };
      t.add('multiclass', ['wizard', 'monk', 'cleric', 'barbarian'].map(id => multiclassLacks(fighter, id, P2014.classes())));
    }
    return t.finish();
  },
  'dnd5e.choice_resolution': () => {
    const f = make(P2014, 'fighter', 1);
    const choice = f.choices.find(c => !c.resolved && Array.isArray(c.definition.pool) && c.definition.pool.length >= c.definition.count)!;
    const pool = choice.definition.pool as { id: string }[];
    const resolved = resolveChoice(f, choice.id, pool.slice(0, choice.definition.count).map(o => o.id), RULES);
    return new Trace().add('choice', choice.id).changed('resolved', f.features.map(x => x.id), [resolved.features.map(x => x.id), resolved.choices]).finish();
  },
  'dnd5e.ability_score_improvement': () => {
    const f = make(P2014, 'fighter', 4);
    const asi = f.choices.find(c => c.definition.kind === 'asi')!;
    const after = applyAsiToEntity(f, asi.id, { str: 1, con: 1 }, RULES);
    return new Trace().add('choice', asi.id).changed('scores', [f.stats, f.derived], [after.stats, recomputeDerived(after, RULES).derived]).finish();
  },
  'dnd5e.spell_slots': () => {
    const w = make(P2014, 'wizard', 3);
    const spent = commitSpellPayment(w, { kind: 'normal', tier: '2' } as never);
    const back = { ...spent, spellcasting: restoreSpellSlot(spent.spellcasting!, { kind: 'normal', tier: '2' } as never) };
    return new Trace().changed('spent', w.spellcasting!.slots, spent.spellcasting!.slots).changed('restored', spent.spellcasting!.slots, back.spellcasting!.slots).finish();
  },
  'dnd5e.spell_access': () => {
    // each class's own preparation rule decides whether a spell it gives may be cast: prepared or not, and a cantrip never needs preparing
    const t = new Trace();
    for (const classId of ['wizard', 'cleric', 'sorcerer']) {
      const made = make(P2014, classId, 3);
      const access = (key: string, kind: 'spell_access' | 'cantrip_access') => ({ kind, key, sourceKind: 'class', sourceId: classId });
      const e = { ...made, entitlements: [...(made.entitlements ?? []), access('magic_missile', 'spell_access'), access('bless', 'spell_access'), access('light', 'cantrip_access')],
        spellcasting: { ...made.spellcasting!, known: [...made.spellcasting!.known, 'magic_missile', 'bless', 'light'], prepared: ['bless'] } } as Entity;
      t.add(classId, ['magic_missile', 'bless', 'light'].map(s => resolveSpellCastingContexts(e, s, P2014.classes()).map(c => [c.sourceKind, c.preparationPolicy, c.legal])));
    }
    const wizard = make(P2014, 'wizard', 3);
    const withAccess = { ...wizard, entitlements: [{ kind: 'spell_access', key: 'magic_missile', sourceKind: 'class', sourceId: 'wizard' }] } as Entity;
    return t.changed('unprepared', [isSpellPreparationLegal(wizard, 'magic_missile', P2014.classes())], [isSpellPreparationLegal(withAccess, 'magic_missile', P2014.classes())]).finish();
  },
  'dnd5e.equipment': () => {
    // a new character has picked no equipment yet: it carries one armor and one weapon
    const made = make(P2014, 'fighter', 3);
    const carried = ['chain_mail', 'longsword'].map(itemId => ({ id: `inst-${itemId}`, itemId, quantity: 1 }));
    const f = recomputeDerived({ ...made, inventory: { ...made.inventory, carried: carried as never } }, RULES);
    const worn = equipItem(equipItem(f, 'chain_mail', P2014.getItem('chain_mail'), RULES, 'inst-chain_mail'), 'longsword', P2014.getItem('longsword'), RULES, 'inst-longsword');
    const off = unequipItem(worn, 'chain_mail', RULES, 'inst-chain_mail');
    return new Trace().changed('equip', [f.inventory, f.derived.ac], [worn.inventory, recomputeDerived(worn, RULES).derived.ac])
      .changed('unequip', recomputeDerived(worn, RULES).derived.ac, recomputeDerived(off, RULES).derived.ac)
      .add('attune', toggleAttunement(worn, 'longsword', 'inst-longsword').inventory).finish();
  },
  'dnd5e.conditions': () => {
    const f = make(P2014, 'fighter', 3);
    const poisoned = applyCondition(f, 'poisoned', 'manual', RULES);
    const tired = applyCondition(applyCondition(poisoned, 'exhaustion', 'manual', RULES), 'exhaustion', 'manual', RULES);
    return new Trace().changed('poisoned', f.conditions, poisoned.conditions).add('exhaustion', [tired.conditions, recomputeDerived(tired, RULES).derived])
      .add('removed', removeCondition(tired, 'poisoned', RULES).conditions).finish();
  },
  'dnd5e.weapon_mastery': () => {
    const f = make(P2024, 'fighter_2024', 1, 'dwarf_2024', 'soldier_2024');
    const picked = setWeaponMasteryPicks(f, ['longsword', 'greataxe', 'longbow', 'handaxe', 'dagger', 'not_a_weapon']);
    return new Trace().changed('picks', f.weaponMastery ?? null, picked.weaponMastery ?? null).finish();
  },
  'dnd5e.wild_shape': () => {
    const d = make(P2014, 'druid', 2);
    const beast = startWildShape(d, BEAST_FORMS_2014[0].id, RULES);
    const back = endWildShape(beast, RULES);
    return new Trace().changed('start', d.wildShapeState ?? null, [beast.wildShapeState, beast.derived]).add('end', [back.wildShapeState, back.derived]).finish();
  },
  'dnd5e.companion': () => {
    // An original template of the probe's own, so the fingerprint follows the operation, not which companions the content ships
    // (the public tree has none: every shipped companion comes from a subclass outside the SRD).
    const template: CompanionTemplate = {
      id: 'probe_companion', name: 'Probe Companion', baseStats: { str: 14, dex: 12, con: 14, int: 6, wis: 12, cha: 6 }, speed: 40,
      syncAbilitiesFromOwner: ['wis'], hp: { base: 5, perOwnerLevel: 5 },
      features: [{ id: 'probe_companion_bite', name: 'Bite', description: '', source: { kind: 'class', refId: 'ranger' }, level: null,
        effects: [{ type: 'stat_modifier', target: 'ac', operation: 'add', value: 1, condition: null }], actions: [], choices: [], passive: true } as unknown as Feature],
    };
    const c = createCompanion(make(P2014, 'ranger', 3), template, RULES);
    return new Trace().add('grant', 'probe_companion').add('companion', [c.identity, hp(c), c.derived, c.stats]).finish();
  },
  'dnd5e.free_edit': () => {
    const f = make(P2014, 'fighter', 3);
    const own = applyCharacterOverride(f, { stat: 'str', value: 18 }, RULES);
    const dm = applyDmOverride(f, { stat: 'ac', value: 20, label: 'DM', expiresOn: 'manual' } as never, RULES);
    return new Trace().changed('own', f.derived, own.derived).changed('dm', f.derived, dm.derived).finish();
  },
  'dnd5e.background_swap': () => {
    const f = make(P2024, 'fighter_2024', 3, 'human_2024', 'soldier_2024');
    const sage = P2024.getBackground('sage_2024')!;
    const swapped = swapBackground(f, sage, RULES, undefined, undefined, sage.originFeat ? P2024.getFeat(sage.originFeat) : undefined);
    return new Trace().changed('swap', [f.identity, f.skills, f.features.map(x => x.id)], [swapped.identity, swapped.skills, swapped.features.map(x => x.id)]).finish();
  },
  'dnd5e.point_buy': () => {
    const config = STANDARD_POINT_BUY, array = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    return new Trace().add('spent', [pointBuySpent(array, config), pointBuySpent(STATS, config)])
      .add('valid', [validatePointBuy(array, config), validatePointBuy({ ...array, str: 16 }, config), validatePointBuy(STATS, config)]).finish();
  },
  'dnd5e.character_creation': () => {
    const t = new Trace();
    for (const [p, classId, race, bg] of [[P2014, 'wizard', 'elf', 'acolyte'], [P2014, 'fighter', 'dwarf', 'acolyte'], [P2024, 'cleric_2024', 'human_2024', 'acolyte_2024']] as const) {
      const e = make(p, classId, 1, race, bg);
      t.add(classId, [e.identity, e.stats, hp(e), e.skills, e.features.map(x => x.id), e.choices.map(c => c.id), e.spellcasting, e.inventory.carried.map(i => i.itemId)]);
    }
    return t.finish();
  },
};

// If a fingerprint fails, the operation's behavior changed. Raise its revision in dnd5eOperations.ts and renew the fingerprint here on purpose.
// Recorded 2026-11-10 as this app's baseline at the current revisions.
const FINGERPRINTS: Record<string, string> = {
  'dnd5e.ability_modifier@1': '880ad160800b77b3',
  'dnd5e.proficiency_bonus@1': '134963662344db39',
  'dnd5e.hit_point_gain@1': 'de282fc74b6a4bef',
  'dnd5e.derived_stats@1': '2034c1c8ca6c6be1',
  'dnd5e.damage_modifiers@1': '19961ed80b9b07d6',
  'dnd5e.apply_damage@1': '9326481154966ecb',
  'dnd5e.apply_healing@1': 'cc79b4916f9d4a04',
  'dnd5e.temp_hp@1': 'fe1c10987c9375de',
  'dnd5e.wild_shape_damage@1': '6a9fad0691ba7c8b',
  'dnd5e.death_saves@1': '135635797d071a1c',
  'dnd5e.short_rest@1': '4ca5632d6f8f8223',
  'dnd5e.long_rest@1': '04dd3988620aaa44',
  'dnd5e.dawn_recharge@1': 'a1d47ce9efd71d50',
  'dnd5e.level_up@2': '59eddeccd8f680d7',
  'dnd5e.level_up@3': 'af1dabc5ef268e01',
  'dnd5e.choice_resolution@1': '46b5e33026846984',
  'dnd5e.ability_score_improvement@1': '84382282bab16c2a',
  'dnd5e.spell_slots@1': '5fdde1fd49dabdff',
  'dnd5e.spell_access@1': '620185ad46ee22c3',
  'dnd5e.equipment@1': '94e45efb52009619',
  'dnd5e.conditions@1': '083508db46d2e79f',
  'dnd5e.weapon_mastery@1': 'd1c5654d448cb5c1',
  'dnd5e.wild_shape@1': 'abe28c3ab845f04f',
  'dnd5e.companion@1': 'ba91f8cc5666d5ab',
  'dnd5e.free_edit@1': 'db3ce9a071664edc',
  'dnd5e.background_swap@1': 'a08659a553c03182',
  'dnd5e.point_buy@1': '4053e73ba47322be',
  'dnd5e.character_creation@3': '3acc78596888e074',
};

describe('operation verification', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });
  afterAll(() => jest.restoreAllMocks());

  it('every registered operation has a probe for every revision this app can run, and every probe a registered operation', () => {
    // one implementation, one revision (dnd5eOperations.ts), except level_up 2: revision 3 with the multiclass requirement off
    for (const op of DND5E_OPERATIONS.all) expect(op.available).toEqual(op.id === 'dnd5e.level_up' ? [2, op.current] : [op.current]);
    expect(Object.keys(PROBES).sort()).toEqual(DND5E_OPERATIONS.all.map(o => o.id).sort());
    expect(Object.keys(FINGERPRINTS).sort()).toEqual(DND5E_OPERATIONS.all.flatMap(o => o.available.map(r => `${o.id}@${r}`)).sort());
  });

  it('each operation still does what its revision says, every time, and shows something of its own', () => {
    const seen = new Map<string, string>();
    const got: Record<string, string> = {};
    for (const op of DND5E_OPERATIONS.all) {
      for (const revision of op.available) {
        const print = PROBES[op.id](revision);
        expect(PROBES[op.id](revision)).toBe(print);                         // repeatable
        expect(seen.get(print) ?? op.id).toBe(op.id);                        // no two operations the same
        seen.set(print, op.id);
        got[`${op.id}@${revision}`] = print;
      }
    }
    expect(got).toEqual(FINGERPRINTS);
  });
});
