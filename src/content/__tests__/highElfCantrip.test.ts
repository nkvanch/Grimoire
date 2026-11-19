import { makeEmptyEntity, DEFAULT_RULES } from '../../engine/defaults';
import { applyPoolChoiceToEntity } from '../../engine/levelingPoolChoices';
import { queueChoice } from '../../engine/levelingGrants';
import { hasEntitlement } from '../../engine/entitlements';
import { ALL_RACES } from '../races';
import { FULL_SPELL_LIBRARY } from '../spells/index';
import { RACE_CHOICE_PREFIX, Feature } from '../../engine/types';

describe('High Elf cantrip', () => {
  const highElf = ALL_RACES.find(r => r.id === 'elf')!.subraces!.find(s => s.id === 'high_elf')!;
  const choice = highElf.pendingChoices!.find(c => c.id === `${RACE_CHOICE_PREFIX}high_elf_cantrip`)!;
  const pool = choice.pool as { id: string; label: string; value: Feature }[];

  it('offers one pick from the SRD wizard cantrips', () => {
    expect(choice.kind).toBe('feature_pool');
    expect(choice.count).toBe(1);
    expect(pool.length).toBeGreaterThan(0);
    for (const option of pool) {
      const id = option.value.effects[0].cantripIds![0];
      const spell = FULL_SPELL_LIBRARY.find(s => s.id === id)!;
      expect(spell).toMatchObject({ level: 0, srd: true });
      expect(spell.classes).toContain('wizard');
    }
  });

  it('teaches the picked cantrip, cast with Intelligence, as a race feature', () => {
    const queued = queueChoice(makeEmptyEntity('t'), choice, 0);
    const picked = applyPoolChoiceToEntity(queued, queued.choices[0].id, ['high_elf_cantrip_firebolt'], DEFAULT_RULES);
    const feature = picked.features.find(f => f.id === 'high_elf_cantrip_firebolt')!;
    expect(feature.source).toEqual({ kind: 'race', refId: 'high_elf' });
    expect(feature.effects[0]).toMatchObject({ type: 'grant_spell', cantripIds: ['firebolt'], spellcastingAbility: 'int' });
    expect(hasEntitlement(picked, 'cantrip_access', 'firebolt')).toBe(true);
  });
});
