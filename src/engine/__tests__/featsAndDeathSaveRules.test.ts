// Two house rules the phone stored but did not apply (the desktop's docs/PHONE_APP_TODO.md): feats off, and death-save failures that persist.
import { makeEmptyEntity, DEFAULT_RULES } from '../defaults';
import { asiMode, featsEnabled } from '../houseRules';
import { applyDamage, applyHealing } from '../combatDamage';
import { takeRest } from '../rest';
import type { CampaignRules, Entity } from '../types';

const rules = (customRules: Record<string, unknown>): CampaignRules => ({ ...DEFAULT_RULES, customRules });

it('feats off: improvements are ability scores only, whatever the improvement rule says', () => {
  expect(featsEnabled(DEFAULT_RULES)).toBe(true);
  expect(asiMode(rules({ asiMode: 'feat_only' }))).toBe('feat_only');
  expect(asiMode(rules({ asiMode: 'feat_only', featsEnabled: false }))).toBe('asi_only');
  expect(asiMode(rules({ asiMode: 'both', featsEnabled: false }))).toBe('asi_only');
});

describe('death-save failures', () => {
  const dying = (): Entity => {
    const e = makeEmptyEntity('d');
    return { ...e, resources: { ...e.resources, hp: { ...e.resources.hp, current: 0, maximum: 20 }, deathSaves: { successes: 1, failures: 2, stable: false } } };
  };

  it('healing clears them by the book, keeps the failures under the house rule, and a long rest clears them', () => {
    expect(applyHealing(dying(), 5, DEFAULT_RULES).resources.deathSaves).toEqual({ successes: 0, failures: 0, stable: false });
    const persist = rules({ deathSavesPersist: true });
    const healed = applyHealing(dying(), 5, persist);
    expect(healed.resources.deathSaves).toEqual({ successes: 0, failures: 2, stable: false });
    expect(applyDamage(healed, 10, persist, 'slashing').resources.deathSaves.failures).toBe(2);   // dropped again: they carry over
    expect(takeRest(healed, 'long', persist).resources.deathSaves.failures).toBe(0);
  });
});
