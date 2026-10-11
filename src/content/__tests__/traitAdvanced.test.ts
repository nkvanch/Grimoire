// The builders' advanced trait fields: riders, timing, per-target effects, auras and derived-stat rules compile onto any trait.
import { newDraftTrait, buildTraitFeature, hasAdvancedFields } from '../traitCompiler';
import type { DraftTrait } from '../../engine/types';

const opts = { idPrefix: 't', sourceKind: 'class' as const, sourceRefId: 'x', level: 3 };
const build = (t: DraftTrait) => buildTraitFeature(t, opts);
const trait = (patch: Partial<DraftTrait> = {}): DraftTrait => ({ ...newDraftTrait('Thing'), ...patch });

describe('advanced trait fields', () => {
  it('a plain trait is untouched', () => {
    const t = trait();
    expect(hasAdvancedFields(t)).toBe(false);
    const { feature } = build(t);
    expect(feature.riders).toBeUndefined();
    expect(feature.aura).toBeUndefined();
    expect(feature.suspendOn).toBeUndefined();
    expect(feature.passive).toBe(true);
  });

  it('riders compile with their damage, limit, flags and the trait\'s own pool as the cost', () => {
    const { feature, resource } = build(trait({
      effectKind: 'resource_ability', uses: '2', recharge: 'long_rest',
      riders: [{ localId: 'r1', name: 'Searing Strike', on: 'weapon_attack', dice: '1d6', damageType: 'Fire', note: 'The target is lit.', limit: 'once_per_turn', requires: 'empowered', clears: 'empowered', usesPool: true }],
    }));
    expect(feature.riders).toHaveLength(1);
    expect(feature.riders![0]).toMatchObject({
      name: 'Searing Strike', on: 'weapon_attack', limit: 'once_per_turn', requires: 'empowered', clears: 'empowered',
      damage: { dice: '1d6', damageType: 'fire' }, note: 'The target is lit.',
    });
    expect(feature.riders![0].cost).toEqual({ resourceId: resource!.resourceId, quantity: 1 });
  });

  it('a rider with no name is dropped', () => {
    const { feature } = build(trait({ riders: [{ localId: 'r', name: '  ', on: 'any_damage', dice: '', damageType: '', note: '', limit: 'none', requires: '', clears: '', usesPool: false }] }));
    expect(feature.riders).toBeUndefined();
  });

  it('suspension compiles to suspendOn', () => {
    const { feature } = build(trait({ suspendDamageType: 'Fire', suspendUntil: 'end_of_this_turn' }));
    expect(feature.suspendOn).toEqual({ damageType: 'fire', until: 'end_of_this_turn' });
  });

  it('card effects make the trait an ability and carry the extras', () => {
    const { feature } = build(trait({
      actionType: 'bonus_action', tempHpDice: 'PBd6', healFromDamageFraction: '0.5', healFromDamageTurnsBack: '1',
      trackEffectName: 'Mark', trackRecords: true, trackUntil: 'end_of_next_turn', alsoCosts: 'action',
    }));
    expect(feature.passive).toBe(false);
    expect(feature.activation).toMatchObject({ actionType: 'bonus_action', alsoCosts: 'action' });
    expect(feature.abilityEffects).toEqual([
      { type: 'temp_hp', dice: 'PBd6' },
      { type: 'heal_from_damage_taken', fraction: 0.5, turnsBack: 1 },
      { type: 'track_effect', name: 'Mark', visibility: 'party', records: true, until: 'end_of_next_turn' },
    ]);
  });

  it('an aura compiles to effects with the source ability modifier', () => {
    const { feature } = build(trait({ auraEnabled: true, auraLabel: 'Warding Aura', auraRange: '10 feet', auraAffects: 'allies_and_self', auraStat: 'saves', auraAmount: '0', auraAddAbility: 'cha' }));
    expect(feature.aura).toMatchObject({ label: 'Warding Aura', range: '10 feet', affects: 'allies_and_self' });
    expect(feature.aura!.effects).toHaveLength(6);
    expect(feature.aura!.effects[0]).toMatchObject({ target: 'savingThrows.str', addAbilityModifier: 'cha' });
  });

  it('an aura of resistance needs a damage type', () => {
    expect(build(trait({ auraEnabled: true, auraStat: 'resistance', auraResistType: '' })).feature.aura).toBeUndefined();
    expect(build(trait({ auraEnabled: true, auraStat: 'resistance', auraResistType: 'Fire' })).feature.aura!.effects[0]).toMatchObject({ type: 'grant_resistance', target: 'fire' });
  });

  it('derived-stat rules add their effects, and the beast form flag marks AC and speed bonuses', () => {
    const { feature } = build(trait({
      effectKind: 'ac_bonus', acBonusAmount: '2', armorDexCap: true, critImmune: true, critRange: '19', appliesInBeastForm: true,
    }));
    const targets = feature.effects.map(e => e.target);
    expect(targets).toEqual(expect.arrayContaining(['ac', 'armor_dex_cap', 'critical_hits_against', 'crit_range']));
    expect(feature.effects.find(e => e.target === 'ac')!.appliesInBeastForm).toBe(true);
    expect(feature.effects.find(e => e.target === 'crit_range')!.value).toBe(19);
  });

  it('a crit range outside 2 to 19 is ignored', () => {
    expect(build(trait({ critRange: '20' })).feature.effects.some(e => e.target === 'crit_range')).toBe(false);
    expect(build(trait({ critRange: '1' })).feature.effects.some(e => e.target === 'crit_range')).toBe(false);
  });
});

describe('advanced trait fields added with the creator-audit work', () => {
  it('a movement speed for a while compiles to a grant_speed card effect', () => {
    const { feature } = build(trait({ grantSpeedType: 'fly', grantSpeedAmount: '40', grantSpeedUnit: 'minutes', grantSpeedFor: '10' }));
    expect(feature.passive).toBe(false);
    expect(feature.abilityEffects).toContainEqual({ type: 'grant_speed', speedType: 'fly', amount: 40, duration: { unit: 'minutes', remaining: 10 } });
  });
  it('an incomplete speed compiles to nothing', () => {
    expect(hasAdvancedFields(trait({ grantSpeedType: 'fly', grantSpeedAmount: '' }))).toBe(false);
    expect(hasAdvancedFields(trait({ grantSpeedType: '', grantSpeedAmount: '40' }))).toBe(false);
  });
  it('an outcome refund compiles against the trait\'s own pool', () => {
    const { feature, resource } = build(trait({
      effectKind: 'resource_ability', uses: '2', recharge: 'short_rest', outcomeOn: 'hit', outcomeRegain: '1',
    }));
    expect(feature.outcomes?.hit?.effects).toEqual([{ type: 'restore_resource', resourceId: resource!.resourceId, amount: 1 }]);
  });
  it('an outcome needs a pool to refill and is dropped without one', () => {
    const { feature } = build(trait({ outcomeOn: 'hit', outcomeRegain: '1' }));
    expect(feature.outcomes?.hit).toBeUndefined();
  });
  it('an infusion bonus compiles to the infusion_capacity effect', () => {
    const { feature } = build(trait({ infusionBonus: '2' }));
    expect(feature.effects).toContainEqual(expect.objectContaining({ type: 'stat_modifier', target: 'infusion_capacity', operation: 'add', value: 2 }));
  });
  it('the compiled outcome feature drives the real card flow', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { makeEmptyEntity, DEFAULT_RULES } = require('../../store/characterStore');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { recomputeDerived } = require('../../engine/pipeline');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateActionCard } = require('../../engine/actionCards');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyActionCardUse } = require('../../engine/actionUse');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { confirmOutcome, outcomeOffersForCard } = require('../../engine/outcomes');
    const { feature, resource } = build(trait({ effectKind: 'resource_ability', uses: '1', recharge: 'short_rest', outcomeOn: 'hit', outcomeRegain: '1' }));
    const base = makeEmptyEntity('b');
    const e0 = recomputeDerived({
      ...base, identity: { ...base.identity, level: 5 }, features: [{ ...feature, isActive: false }],
      resources: { ...base.resources, custom: [{ id: resource!.resourceId, name: 'Pool', current: 1, maximum: 1, recharge: 'short_rest' }] },
    }, DEFAULT_RULES);
    const card = generateActionCard(e0.features[0], e0);
    const used = applyActionCardUse(e0, card, DEFAULT_RULES);
    expect(used.resources.custom[0].current).toBe(0);
    expect(outcomeOffersForCard(used, card)).toHaveLength(1);
    expect(confirmOutcome(used, feature.id, 'hit', DEFAULT_RULES).resources.custom[0].current).toBe(1);
  });
});
