// Writes the shared parity fixtures the native (C++) desktop app is tested against. It does nothing in a normal test run:
//   GRIMOIRE_PARITY_OUT=D:/path/to/tests/fixtures npx jest src/engine/__tests__/parityExport
// Each case carries its inputs (the character exactly as the app exports it, plus any supplied dice), the operation, and the state the
// TypeScript engine produced. The native app must reproduce the same state; see docs/CONTRACTS.md in the C++ project.
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_RULES } from '../../store/characterStore';
import { recomputeDerived } from '../pipeline';
import { commitSpellPayment, restoreSpellSlot } from '../spellPayment';
import type { Entity } from '../types';
import { buildScenarios, buildHpCases, buildEquipmentScenarios } from './parityScenarios';
import { buildRestCases } from './parityRestScenarios';
import { buildSheetCases, buildWildShapeCases, runSheetOp } from './paritySheetScenarios';
import { resolveItemDefinition } from '../itemMechanics';
import { skillCheck } from '../skillCheck';
import { buildCreationCases } from './parityCreationScenarios';
import { buildSubraceCases, runSubraceCase } from './paritySubraceScenarios';
import { buildSpellListCases, runSpellListCase, buildSpellPoolCases } from './paritySpellListScenarios';
import { buildMonsterCases, runMonsterCase, spawnedEntity } from './parityMonsterScenarios';
import { buildCardScenarios, buildWildShapeCardScenarios } from './parityCardScenarios';
import { buildLevelCases, makeProviders, runLevelSteps, providerFor } from './parityLevelScenarios';
import { buildChoiceCases, runChoiceOp } from './parityChoiceScenarios';
import {
  testAfterEntity, buildTraitCases, runTraitCase, buildFeatCases, runFeatCase, buildSpellCases, runSpellCase, buildItemCases, runItemCase,
  buildClassCases, runClassCase, buildSubclassCases, runSubclassCase, buildHomebrewLevelCases,
  buildRaceCases, runRaceCase, buildBackgroundCases, runBackgroundCase, buildConditionCases, runConditionCase,
  buildChoiceDraftCases, runChoiceDraftCase, registriesForFixtures,
  buildFeaturePoolCases, runFeaturePoolCase, featurePoolStyles, FEATURE_POOL_STYLES_PREFIX, FEATURE_POOL_STYLES_OWNER,
} from './parityHomebrewScenarios';
import { featurePoolDraftToDefinition } from '../../content/featurePoolChoice';
import { buildPackageCases, runPackageCase } from './parityPackageScenarios';
import { collectTypedContentRefs } from '../packDiagnostics';
import { queueChoice, applyPoolChoiceToEntity } from '../leveling';
import { DEFAULT_RULES as BASE_RULES } from '../../store/characterStore';
import { applyActionCardUse } from '../actionUse';
import type { ActionCard } from '../types';
import { takeRest, takeDawn, spendHitDieManual, discardHitDie } from '../rest';
import { applyDamage, applyHealing, applyTempHP } from '../combat';
import { activateOfficialPacks, clearOfficialPacks } from '../../content/officialPacks';
import { runSessionScenario } from './paritySessionScenarios';
import srd51 from '../../../assets/packs/grimoire.srd.5.1.json';
import srd521 from '../../../assets/packs/grimoire.srd.5.2.1.json';

// every skill the character has, as the skills list of the sheet states it
const skillChecksOf = (entity: Entity) => Object.fromEntries(Object.entries(entity.skills.skills).map(([name, entry]) => {
  const c = skillCheck(entity, name as never, entry.ability);
  return [name, { ability: entry.ability, bonus: c.bonus, state: c.state, expression: c.expression, sources: c.sources }];
}));

const OUT = process.env.GRIMOIRE_PARITY_OUT;
const run = OUT ? describe : describe.skip;

const CHARACTERS = path.resolve(__dirname, '../../../builds/test-characters');
const FIXTURE_VERSION = 1;

type Envelope = { format: string; version: number; exportedAt: number; entity: Entity };

// Anything that is not a pure function of the case (the export time) is fixed so a regenerated file differs only when behaviour does.
const withFixedTime = (env: Envelope): Envelope => ({ ...env, exportedAt: 0 });

run('parity fixtures', () => {
  it('writes the cases', async () => {
    const files = fs.readdirSync(CHARACTERS).filter(f => f.endsWith('.json')).sort();
    fs.mkdirSync(path.join(OUT!, 'characters'), { recursive: true });
    fs.mkdirSync(path.join(OUT!, 'parity'), { recursive: true });
    const cases: unknown[] = [];

    for (const file of files) {
      const envelope = withFixedTime(JSON.parse(fs.readFileSync(path.join(CHARACTERS, file), 'utf8')) as Envelope);
      const id = file.replace(/\.json$/, '');
      fs.writeFileSync(path.join(OUT!, 'characters', file), JSON.stringify(envelope, null, 2));

      const recomputed = recomputeDerived(envelope.entity, DEFAULT_RULES);
      cases.push({
        id: `${id}/derived`,
        kind: 'derived',
        character: `characters/${file}`,
        expected: {
          derived: recomputed.derived,
          hp: recomputed.resources.hp,
          spellSlots: recomputed.spellcasting ? recomputed.spellcasting.slots : null,
          skillChecks: skillChecksOf(recomputed),
        },
      });

      if (envelope.entity.spellcasting) {
        const sc = envelope.entity.spellcasting;
        const tiers = (['1', '2', '3', '4'] as const);
        for (const tier of tiers) {
          const spent = commitSpellPayment(envelope.entity, { kind: 'normal', tier });
          cases.push({
            id: `${id}/spend-slot-${tier}`,
            kind: 'operation',
            character: `characters/${file}`,
            operation: { name: 'spendSpellSlot', args: { kind: 'normal', tier } },
            expected: { spellSlots: spent.spellcasting!.slots, changed: spent !== envelope.entity },
          });
          const withUsed: Entity = { ...envelope.entity, spellcasting: { ...sc, slots: { ...sc.slots, [tier]: { ...sc.slots[tier], used: Math.min(1, sc.slots[tier]?.total ?? 0) } } } };
          const restored = restoreSpellSlot(withUsed.spellcasting!, { kind: 'normal', tier });
          cases.push({
            id: `${id}/restore-slot-${tier}`,
            kind: 'operation',
            character: `characters/${file}`,
            preState: { spellSlots: withUsed.spellcasting!.slots },
            operation: { name: 'restoreSpellSlot', args: { kind: 'normal', tier } },
            expected: { spellSlots: restored.slots },
          });
        }
      }
    }

    // synthetic characters: a real character plus features that exercise the effect pipeline one rule at a time
    fs.mkdirSync(path.join(OUT!, 'synthetic'), { recursive: true });
    const baseEnvelope = withFixedTime(JSON.parse(fs.readFileSync(path.join(CHARACTERS, 'TEST-Wizard-5.json'), 'utf8')) as Envelope);
    const scenarios = [
      ...buildScenarios(baseEnvelope.entity).map(scenario => ({ scenario, packs: false })),
      // equipment resolves against the installed content packs, as it does in the app
      ...buildEquipmentScenarios(baseEnvelope.entity).map(scenario => ({ scenario, packs: true })),
    ];
    for (const { scenario, packs } of scenarios) {
      const envelope: Envelope = { ...baseEnvelope, entity: scenario.entity };
      const file = `synthetic/${scenario.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify(envelope, null, 2));
      if (packs) activateOfficialPacks([srd51, srd521]);
      const recomputed = recomputeDerived(scenario.entity, DEFAULT_RULES);
      const checks = skillChecksOf(recomputed);
      if (packs) clearOfficialPacks();
      cases.push({
        id: `synthetic/${scenario.name}/derived`,
        kind: 'derived',
        character: file,
        expected: { derived: recomputed.derived, hp: recomputed.resources.hp, spellSlots: recomputed.spellcasting ? recomputed.spellcasting.slots : null, skillChecks: checks },
      });
    }

    // hit point operations: the character is prepared in the file, the operation is applied by each engine
    for (const c of buildHpCases(baseEnvelope.entity)) {
      const envelope: Envelope = { ...baseEnvelope, entity: c.entity };
      const file = `synthetic/${c.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify(envelope, null, 2));
      const { amount, damageType } = c.op.args;
      const after = c.op.name === 'applyDamage' ? applyDamage(c.entity, amount, DEFAULT_RULES, damageType)
        : c.op.name === 'applyHealing' ? applyHealing(c.entity, amount, DEFAULT_RULES)
        : applyTempHP(c.entity, amount, DEFAULT_RULES);
      cases.push({
        id: `synthetic/${c.name}/operation`,
        kind: 'hp-operation',
        character: file,
        operation: c.op,
        expected: {
          hp: after.resources.hp,
          deathSaves: after.resources.deathSaves,
          damageLog: after.damageLog ?? null,
          suspensions: after.suspensions ?? null,
          changed: after !== c.entity,
        },
      });
    }

    // rests, hit dice, dawn and the recompute itself: the whole entity after the operation is the expectation (minus the action cards)
    for (const c of buildRestCases(baseEnvelope.entity)) {
      const envelope: Envelope = { ...baseEnvelope, entity: c.entity };
      const file = `synthetic/${c.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify(envelope, null, 2));
      activateOfficialPacks([srd51, srd521]);
      let after: Entity;
      switch (c.op.name) {
        case 'takeRest': after = takeRest(c.entity, c.op.args.kind, DEFAULT_RULES, c.op.args.allocation); break;
        case 'spendHitDieManual': after = spendHitDieManual(c.entity, c.op.args.roll, DEFAULT_RULES, c.op.args.dieSize); break;
        case 'discardHitDie': after = discardHitDie(c.entity, DEFAULT_RULES, c.op.args.dieSize); break;
        case 'takeDawn': after = takeDawn(c.entity, DEFAULT_RULES); break;
        default: after = recomputeDerived(c.entity, DEFAULT_RULES);
      }
      clearOfficialPacks();
      const { actionCards: _cards, ...entity } = after as Entity & { actionCards?: unknown };
      void _cards;
      cases.push({
        id: `synthetic/${c.name}/rest-operation`,
        kind: 'entity-operation',
        character: file,
        operation: c.op,
        expected: { entity, unchanged: after === c.entity },
      });
    }

    // the sheet's own changes: equipping, attuning, the bag, coin, conditions and death saves; the whole entity after is the expectation
    const druidEnvelope = withFixedTime(JSON.parse(fs.readFileSync(path.join(CHARACTERS, 'TEST-Druid-4.json'), 'utf8')) as Envelope);
    for (const c of [...buildSheetCases(baseEnvelope.entity), ...buildWildShapeCases(druidEnvelope.entity)]) {
      const envelope: Envelope = { ...baseEnvelope, entity: c.entity };
      const file = `synthetic/sheet-${c.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify(envelope, null, 2));
      activateOfficialPacks([srd51, srd521]);
      const after = runSheetOp(c.entity, c.op, c.items ?? [], id => resolveItemDefinition(id));
      clearOfficialPacks();
      const { actionCards: _cards, ...entity } = after as Entity & { actionCards?: unknown };
      void _cards;
      cases.push({
        id: `synthetic/sheet-${c.name}/sheet-operation`,
        kind: 'sheet-operation',
        character: file,
        operation: c.op,
        items: c.items ?? [],
        expected: { entity, unchanged: after === c.entity },
      });
    }

    // monsters: what a draft compiles to, and the live entity a template spawns into (the packs' own, and the ones made from drafts)
    for (const c of buildMonsterCases()) {
      const run = runMonsterCase(c);
      cases.push({ id: `homebrew/monster/${c.name}`, kind: 'homebrew-monster', input: { id: c.id, draft: c.draft }, expected: run });
      if (run.validation.valid) {
        cases.push({ id: `monster-spawn/draft-${c.name}`, kind: 'monster-spawn', input: { template: run.fields }, expected: { entity: spawnedEntity(run.fields) } });
      }
    }
    {
      const packMonsters = [...(srd51 as unknown as { homebrew: { monsters: Record<string, unknown>[] } }).homebrew.monsters,
        ...(srd521 as unknown as { homebrew: { monsters: Record<string, unknown>[] } }).homebrew.monsters] as unknown as import('../../content/monsters/types').MonsterTemplate[];
      const wanted = new Set(['goblin', 'chimera', 'ghost', 'adult_red_dragon', 'lich', 'tarrasque', 'giant_spider', 'owlbear', 'mummy_lord', 'beholder']);
      const picked = packMonsters.filter((m, i) => wanted.has(m.id) || i % 17 === 0);
      for (const m of picked) {
        cases.push({ id: `monster-spawn/pack-${m.id}`, kind: 'monster-spawn', input: { template: m }, expected: { entity: spawnedEntity(m) } });
      }
    }

    // standalone subraces: what a draft compiles to
    for (const c of buildSubraceCases()) {
      cases.push({ id: `homebrew/subrace/${c.name}`, kind: 'homebrew-subrace', input: { parentId: c.parentId, draft: c.draft }, expected: runSubraceCase(c) });
    }

    // spell lists: what a draft compiles to, and which spells the pickers offer with a list in play
    for (const c of buildSpellListCases()) {
      cases.push({ id: `homebrew/spelllist/${c.name}`, kind: 'homebrew-spelllist', input: { id: c.id, draft: c.draft }, expected: runSpellListCase(c) });
    }
    {
      const poolProviders = makeProviders([srd521, srd51] as never);
      for (const c of buildSpellPoolCases(poolProviders)) {
        const file = `synthetic/pool-${c.name}.json`;
        fs.writeFileSync(path.join(OUT!, file), JSON.stringify({ ...baseEnvelope, entity: c.entity }));
        cases.push({
          id: `spell-pool/${c.name}`, kind: 'spell-pool', character: file,
          input: { classId: c.classId, spellLists: c.spellLists, activeSpellListId: c.activeSpellListId, classSource: c.classSource },
          expected: c.expected,
        });
      }
    }

    // new characters: the spec, and the whole character the app's creation path makes from the SRD packs
    {
      const creationProviders = makeProviders([srd521, srd51] as never);
      for (const c of buildCreationCases(creationProviders)) {
        const { actionCards: _cards, ...entity } = c.entity as Entity & { actionCards?: unknown };
        void _cards;
        cases.push({
          id: `creation/${c.name}`,
          kind: 'creation',
          spec: { ...c.spec, stats: c.stats },
          ...(c.subrace ? { subrace: c.subrace } : {}),
          expected: { entity },
        });
      }
    }

    // action cards and using them: the card list the engine generates, and the character after one use of one card
    const projectCard = (c: ActionCard) => ({
      featureId: c.featureId, name: c.name, cardType: c.cardType, available: c.available, unavailableReason: c.unavailableReason ?? null,
      preparationOverridable: c.preparationOverridable ?? null, incapacitatedOverridable: c.incapacitatedOverridable ?? null,
      ritualEligible: c.ritualEligible ?? null, isWeaponAttack: c.isWeaponAttack ?? null, sourceKind: c.sourceKind ?? null, sourceId: c.sourceId ?? null,
      resourceCost: c.resourceCost ?? null, actionType: c.activation.actionType,
      spellCastingContext: c.spellCastingContext ?? null, spellCastingContexts: c.spellCastingContexts ?? null,
    });
    for (const scenario of [...buildCardScenarios(baseEnvelope.entity), ...buildWildShapeCardScenarios(druidEnvelope.entity)]) {
      activateOfficialPacks([srd51, srd521]);
      const prepared = recomputeDerived(scenario.entity, DEFAULT_RULES);
      const file = `synthetic/${scenario.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify({ ...baseEnvelope, entity: prepared }, null, 2));
      cases.push({
        id: `synthetic/${scenario.name}/cards`,
        kind: 'card-list',
        character: file,
        expected: { cards: (prepared.actionCards ?? []).map(projectCard) },
      });
      scenario.uses.forEach((u, i) => {
        const card = (prepared.actionCards ?? []).find(c => c.featureId === u.featureId && (!u.sourceId || c.sourceId === u.sourceId));
        let after: Entity = prepared;
        if (card) {
          const option = u.optionId ? card.activation.options?.find(o => o.id === u.optionId) : undefined;
          const ctx = u.contextKey && card.spellCastingContext ? { ...card.spellCastingContext, contextKey: u.contextKey } : undefined;
          after = applyActionCardUse(
            prepared, card, DEFAULT_RULES, option, u.payment as never, u.bypassPrep, ctx as never, {}, u.bypassIncap,
            u.ritual ? 'ritual' : undefined, u.sequenceId ? { sequenceId: u.sequenceId } as never : undefined,
          );
        }
        const { actionCards: _cards, ...entity } = after as Entity & { actionCards?: unknown };
        void _cards;
        cases.push({
          id: `synthetic/${scenario.name}/use-${i}-${u.featureId}`,
          kind: 'card-use',
          character: file,
          use: u,
          expected: { entity, unchanged: after === prepared, cardExists: !!card },
        });
      });
      clearOfficialPacks();
    }

    // homebrew authoring: drafts compiled to the content records the apps share, and the validator's verdict on them
    for (const c of buildTraitCases()) {
      cases.push({ id: `homebrew/trait/${c.name}`, kind: 'homebrew-trait', input: { traits: c.traits, opts: c.opts }, expected: { built: runTraitCase(c) } });
    }
    for (const c of buildFeatCases()) {
      cases.push({ id: `homebrew/feat/${c.name}`, kind: 'homebrew-feat', input: { id: c.id, draft: c.draft }, expected: runFeatCase(c) });
    }
    for (const c of buildSpellCases()) {
      cases.push({ id: `homebrew/spell/${c.name}`, kind: 'homebrew-spell', input: { id: c.id, draft: c.draft }, expected: runSpellCase(c) });
    }
    for (const c of buildItemCases()) {
      cases.push({ id: `homebrew/item/${c.name}`, kind: 'homebrew-item', input: { id: c.id, draft: c.draft }, expected: runItemCase(c) });
    }

    for (const c of buildClassCases()) {
      cases.push({ id: `homebrew/class/${c.name}`, kind: 'homebrew-class', input: { id: c.id, draft: c.draft }, expected: runClassCase(c) });
    }
    cases.push({ id: 'homebrew/registries', kind: 'homebrew-registries', expected: registriesForFixtures() });
    // the builders' Test: what the record does to a throwaway level 1 character
    {
      const strip = (e: Entity) => { const { actionCards: _a, ...rest } = e as Entity & { actionCards?: unknown }; void _a; return rest; };
      const testCase = (kind: 'feat' | 'class' | 'subclass' | 'race' | 'background' | 'condition' | 'subrace', name: string, id: string, fields: Record<string, unknown>, input: Record<string, unknown>) => {
        cases.push({ id: `homebrew-test/${kind}/${name}`, kind: 'homebrew-test', input: { type: kind, id, ...input }, expected: { entity: strip(testAfterEntity(kind, fields)) } });
      };
      for (const c of buildFeatCases()) testCase('feat', c.name, c.id, (runFeatCase(c) as { fields: unknown }).fields as Record<string, unknown>, { draft: c.draft });
      for (const c of buildClassCases()) testCase('class', c.name, c.id, runClassCase(c).fields as unknown as Record<string, unknown>, { draft: c.draft });
      for (const c of buildSubclassCases()) testCase('subclass', c.name, c.id, runSubclassCase(c).fields as unknown as Record<string, unknown>, { hitDie: c.hitDie, draft: c.draft });
      for (const c of buildRaceCases()) testCase('race', c.name, c.id, runRaceCase(c).fields as unknown as Record<string, unknown>, { draft: c.draft });
      for (const c of buildSubraceCases()) {
        const sr = runSubraceCase(c);
        if (sr.validation.valid) testCase('subrace', c.name, sr.fields.id, sr.fields as unknown as Record<string, unknown>, { draft: c.draft, parentId: c.parentId });
      }
      for (const c of buildConditionCases()) testCase('condition', c.name, c.id, runConditionCase(c).fields as unknown as Record<string, unknown>, { draft: c.draft });
      for (const c of buildBackgroundCases()) testCase('background', c.name, c.id, runBackgroundCase(c).fields as unknown as Record<string, unknown>, { draft: c.draft });
    }
    for (const c of buildChoiceDraftCases()) {
      cases.push({ id: `homebrew/choice/${c.name}`, kind: 'homebrew-choice', input: { prefix: c.prefix, draft: c.draft }, expected: runChoiceDraftCase(c) });
    }
    for (const c of buildFeaturePoolCases()) {
      cases.push({ id: `homebrew/featurepool/${c.name}`, kind: 'homebrew-featurepool', input: { prefix: c.prefix, owner: c.owner, draft: c.draft }, expected: runFeaturePoolCase(c) });
    }
    // the content a character refers to by id (what an uninstalled pack would leave unresolved), for every character file and for one that
    // refers to content that exists nowhere
    {
      const e = baseEnvelope.entity;
      const ghost: Entity = {
        ...e,
        identity: {
          ...e.identity, raceId: 'ghost_race' as never, classId: 'ghost_class', backgroundId: 'ghost_background' as never,
          classes: (e.identity.classes ?? []).map(c => ({ ...c, classId: 'ghost_class' as never, subclassId: 'ghost_subclass' as never })),
        },
        inventory: { ...e.inventory, carried: [...e.inventory.carried, { id: 'item:ghost', itemId: 'ghost_item', quantity: 1 } as never] },
        // a spell is held through an entitlement (the recompute rebuilds the known list from them), so that is where the ghost goes
        entitlements: [...(e.entitlements ?? []), { kind: 'spell_access', key: 'ghost_spell', sourceKind: 'class', sourceId: 'ghost_class' } as never],
        spellcasting: e.spellcasting ? { ...e.spellcasting, known: [...e.spellcasting.known, 'ghost_spell'] } : e.spellcasting,
      };
      fs.writeFileSync(path.join(OUT!, 'synthetic', 'missing-content.json'), JSON.stringify({ ...baseEnvelope, entity: ghost }, null, 2));
      for (const f of [...files.map(x => `characters/${x}`), 'synthetic/missing-content.json']) {
        const entity = f.startsWith('synthetic/')
          ? ghost
          : withFixedTime(JSON.parse(fs.readFileSync(path.join(CHARACTERS, f.replace('characters/', '')), 'utf8')) as Envelope).entity;
        cases.push({ id: `content-refs/${f}`, kind: 'content-refs', character: f, expected: { refs: collectTypedContentRefs(entity) } });
      }
    }
    // package import: what the review screen checks and shows, and the plan that is saved
    for (const c of buildPackageCases()) {
      cases.push({
        id: `package-import/${c.name}`, kind: 'package-import',
        input: { pack: c.pack, local: c.local, official: c.official, knownRulesets: c.knownRulesets, resolutions: c.resolutions },
        expected: runPackageCase(c),
      });
    }
    // a pool authored this way, queued on a character and resolved through the path the packs' own pools use
    {
      activateOfficialPacks([srd51, srd521]);
      const def = featurePoolDraftToDefinition(featurePoolStyles(), FEATURE_POOL_STYLES_PREFIX, FEATURE_POOL_STYLES_OWNER);
      const queued = queueChoice(baseEnvelope.entity, def, 3, 'homebrew', { kind: 'class', id: 'wizard' });
      const choiceId = queued.choices[queued.choices.length - 1].id;
      const ids = (def.pool as { id: string }[]).map(o => o.id);
      const attempts: [string, string[]][] = [
        ['ok', [ids[0], ids[1]]], ['level-gated', [ids[0], ids[2]]], ['level-met', [ids[0], ids[3]]],
      ];
      for (const [name, selections] of attempts) {
        const file = `synthetic/featurepool-${name}.json`;
        fs.writeFileSync(path.join(OUT!, file), JSON.stringify({ ...baseEnvelope, entity: queued }));
        let after: Entity = queued;
        let refused = '';
        try { after = applyPoolChoiceToEntity(queued, choiceId, selections, BASE_RULES); } catch (e) { refused = (e as Error).message; }
        const { actionCards: _c, ...entity } = after as Entity & { actionCards?: unknown };
        void _c;
        cases.push({
          id: `synthetic/featurepool-${name}/pool`, kind: 'featurepool-resolve', character: file,
          operation: { choiceId, selections }, expected: { entity, refused },
        });
      }
      clearOfficialPacks();
    }
    for (const c of buildRaceCases()) {
      cases.push({ id: `homebrew/race/${c.name}`, kind: 'homebrew-race', input: { id: c.id, draft: c.draft }, expected: runRaceCase(c) });
    }
    for (const c of buildBackgroundCases()) {
      cases.push({ id: `homebrew/background/${c.name}`, kind: 'homebrew-background', input: { id: c.id, draft: c.draft }, expected: runBackgroundCase(c) });
    }
    for (const c of buildConditionCases()) {
      cases.push({ id: `homebrew/condition/${c.name}`, kind: 'homebrew-condition', input: { id: c.id, draft: c.draft }, expected: runConditionCase(c) });
    }
    for (const c of buildSubclassCases()) {
      cases.push({ id: `homebrew/subclass/${c.name}`, kind: 'homebrew-subclass', input: { id: c.id, hitDie: c.hitDie, draft: c.draft }, expected: runSubclassCase(c) });
    }

    // leveling: characters the app's creation path builds from the packs, then sequences of level-ups
    activateOfficialPacks([srd51, srd521]);
    const providers = makeProviders([srd521, srd51] as never);
    for (const c of buildLevelCases(providers)) {
      const file = `synthetic/${c.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify({ ...baseEnvelope, entity: c.entity }));
      const { entity: after, log } = runLevelSteps(c.entity, c.steps, c.rules, providerFor(c.entity, providers));
      const { actionCards: _cards, ...entity } = after as Entity & { actionCards?: unknown };
      void _cards;
      cases.push({
        id: `synthetic/${c.name}/level`,
        kind: 'level-steps',
        character: file,
        operation: { rules: c.rules, steps: c.steps },
        expected: { entity, log },
      });
    }
    for (const c of buildHomebrewLevelCases(providers)) {
      const file = `synthetic/${c.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify({ ...baseEnvelope, entity: c.entity }));
      const { entity: after, log } = runLevelSteps(c.entity, c.steps, c.rules, providerFor(c.entity, providers), { classes: c.homebrew.classes });
      const { actionCards: _cards, ...entity } = after as Entity & { actionCards?: unknown };
      void _cards;
      cases.push({
        id: `synthetic/${c.name}/level`,
        kind: 'level-steps',
        character: file,
        operation: { rules: c.rules, steps: c.steps, homebrew: { classes: c.homebrew.classes } },
        expected: { entity, log },
      });
    }
    clearOfficialPacks();

    // pending choices: the resolutions a player makes, replayed one operation at a time
    activateOfficialPacks([srd51, srd521]);
    const choiceProviders = makeProviders([srd521, srd51] as never);
    for (const c of buildChoiceCases(choiceProviders)) {
      const file = `synthetic/${c.name}.json`;
      fs.writeFileSync(path.join(OUT!, file), JSON.stringify({ ...baseEnvelope, entity: c.entity }));
      const provider = providerFor(c.entity, choiceProviders);
      const rules = { ...BASE_RULES, maxAbilityScore: c.rules.maxAbilityScore };
      let after: Entity = c.entity;
      for (const op of c.ops) after = runChoiceOp(after, op, rules, provider);
      const { actionCards: _cards, ...entity } = after as Entity & { actionCards?: unknown };
      void _cards;
      cases.push({
        id: `synthetic/${c.name}/choices`,
        kind: 'choice-ops',
        character: file,
        operation: { rules: c.rules, ops: c.ops },
        expected: { entity, skipped: c.skipped },
      });
    }
    clearOfficialPacks();

    fs.writeFileSync(
      path.join(OUT!, 'parity', 'cases.json'),
      JSON.stringify({ fixtureVersion: FIXTURE_VERSION, generatedBy: 'src/engine/__tests__/parityExport.test.ts', cases }, null, 2),
    );
    expect(cases.length).toBeGreaterThan(0);

    // the live session: the real host driven frame by frame
    const session = await runSessionScenario();
    fs.writeFileSync(path.join(OUT!, 'parity', 'session.json'), JSON.stringify({ fixtureVersion: FIXTURE_VERSION, ...session }, null, 2));
    expect(session.expected.length).toBeGreaterThan(10);
  });
});
