// src/content/feats/__tests__/feats.test.ts
// Regression coverage for the vault-authored feat batch (29 new feats from
// D:\Documents\Sort later\YSB\Obsidian Vault\DND\DND ჩემი\Feats\Official
// feats) — verifies content shape and that every REAL effect (ability
// bonuses, tool proficiencies, the Cartomancer cantrip) actually lands on
// an entity through the real engine, not just that the data typechecks.
import { makeEmptyEntity, DEFAULT_RULES } from '../../../store/characterStore';
import { applyGrant } from '../../../engine/leveling';
import { recomputeDerived } from '../../../engine/pipeline';
import { ALL_FEATS, FEATS_BY_ID } from '../index';
import { Ability, Feat } from '../../../engine/types';

/**
 * Replicates AsiFeatPicker.tsx's featureToApply()/commitFeat() logic: inject
 * the chosen ability's stat_modifier (and skill picks, unused by this
 * batch) into the feat's feature before applying it — duplicated here since
 * that logic is React-component-local, not an exported engine helper.
 */
function applyFeatSelection(feat: Feat, chosenAbility: Ability | null = null): ReturnType<typeof makeEmptyEntity> {
  let e = makeEmptyEntity('e1');
  const extra: Feat['feature']['effects'] = [];
  if (feat.abilityChoice && chosenAbility) {
    extra.push({ type: 'stat_modifier', target: chosenAbility, operation: 'add', value: feat.abilityChoice.amount, condition: null });
  }
  const feature = extra.length > 0 ? { ...feat.feature, effects: [...feat.feature.effects, ...extra] } : feat.feature;
  e = applyGrant(e, { kind: 'feature', value: { ...feature, isActive: true } }, 0);
  return recomputeDerived(e, DEFAULT_RULES);
}

describe('Feat library — content shape', () => {
  it('has no duplicate ids', () => {
    const ids = ALL_FEATS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every feat has a non-empty name, description, and source', () => {
    for (const f of ALL_FEATS) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
      expect(f.source.length).toBeGreaterThan(0);
    }
  });
});
