// ============================================================================
// FILE: src/engine/wildShapeForms.ts
// Which Beast forms a 2014 Druid can take with Wild Shape, from the Druid level and the features they have. The 2014 Druid has no
// list of known forms: any beast they have seen, up to the limit the level sets, so the picker is built from the form library at
// use time. A feature changes the limits through three effect targets (stat_modifier), so no feature is named in this module:
//   wild_shape_cr_floor        value N: forms up to Challenge Rating N, whatever the level
//   wild_shape_cr_divisor      value N: forms up to Challenge Rating (Druid level / N, rounded down)
//   wild_shape_bonus_action    any value: Wild Shape is a bonus action
// ============================================================================
import type { Entity, BeastForm, ActivationOption } from './types';
import { beastForms } from '../content/runtimeRules';
import { getClassLevels } from './multiclass';
import { collectAllEffects } from './pipeline';

export type WildShapeLimits = {
  druidLevel: number;
  /** Highest Challenge Rating of a form. */
  maxCr:      number;
  swim:       boolean;
  fly:        boolean;
  /** A feature lets the Druid change into a form with a bonus action. */
  bonusAction: boolean;
};

/** The limits for a 2014 Druid of 2nd level or higher; null for anyone else. */
export function wildShapeLimits(entity: Entity): WildShapeLimits | null {
  const druid = getClassLevels(entity).find(c => String(c.classId) === 'druid');
  if (!druid || druid.level < 2) return null;
  const level = druid.level;
  const effects = collectAllEffects(entity).map(ae => ae.effect);
  const valueOf = (target: string) => Math.max(0, ...effects.filter(e => e.target === target && typeof e.value === 'number').map(e => e.value as number));
  const base = level >= 8 ? 1 : level >= 4 ? 0.5 : 0.25;
  const divisor = valueOf('wild_shape_cr_divisor');
  const maxCr = Math.max(base, valueOf('wild_shape_cr_floor'), divisor > 0 ? Math.floor(level / divisor) : 0);
  return { druidLevel: level, maxCr, swim: level >= 4, fly: level >= 8, bonusAction: effects.some(e => e.target === 'wild_shape_bonus_action') };
}

const isBeastForm2014 = (f: BeastForm) => f.creatureType !== 'elemental' && !f.id.endsWith('_2024');

export function eligibleWildShapeForms(entity: Entity, forms: readonly BeastForm[] = beastForms()): BeastForm[] {
  const l = wildShapeLimits(entity);
  if (!l) return [];
  return forms
    .filter(f => isBeastForm2014(f) && f.challengeRating <= l.maxCr && (l.swim || !f.swimSpeed) && (l.fly || !f.flySpeed))
    .sort((a, b) => a.challengeRating - b.challengeRating || a.name.localeCompare(b.name));
}

const crText = (cr: number) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));

/** One picker row per form: name, CR and the numbers a player chooses on. */
export function wildShapeOptions(forms: readonly BeastForm[]): ActivationOption[] {
  return forms.map(f => {
    const speeds = [`${f.speed} ft.`, f.climbSpeed ? `climb ${f.climbSpeed}` : '', f.swimSpeed ? `swim ${f.swimSpeed}` : '', f.flySpeed ? `fly ${f.flySpeed}` : '']
      .filter(Boolean).join(', ');
    const attacks = f.attacks.map(a => (a.effect.type === 'damage' ? `${a.name} ${a.effect.dice}` : a.name)).join(', ');
    return {
      id: `form:${f.id}`,
      label: `${f.name} (CR ${crText(f.challengeRating)}, ${f.size})`,
      description: `AC ${f.ac} · HP ${f.hp} · ${speeds}${attacks ? ` · ${attacks}` : ''}`,
      transformFormId: f.id,
    };
  });
}
