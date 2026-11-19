import { itemRepo } from '../content/itemRepo';
import { isMartialWeapon } from '../content/items/itemBrowse';
import { modifier } from './abilityMath';
import { resolveItemDefinition, isItemMechanicallyActive, effectiveWeaponAttackFeatures, wornGearOf } from './itemMechanics';
import { getClassEntry } from './multiclass';
import { MARTIAL_ARTS } from './ruleset/dnd5e';
import { Entity, AttackBonus } from './types';

/**
 * Re-audit A18: whether the entity is actually proficient with this specific
 * weapon — either by name (a racial/feat grant naming an exact weapon, e.g.
 * Elf Weapon Training's "longsword") or by category ('simple'/'martial',
 * granted by class/background/race — the same entity.proficiencies.weapons
 * array applyGrant('proficiency', ...) and the grant_proficiency Effect
 * reconciler both write into). Reuses itemBrowse.ts's already-built
 * isMartialWeapon() classifier (name-table lookup, falling back to
 * property-text parsing) rather than a second one — weapon items carry no
 * "simple weapon"/"martial weapon" property tag of their own to check
 * directly.
 */
function isProficientWithWeapon(entity: Entity, def: { name: string; properties: string[] }): boolean {
  const weaponProfs = entity.proficiencies.weapons.map(w => w.toLowerCase());
  if (weaponProfs.includes(def.name.toLowerCase())) return true;
  const martial = isMartialWeapon({
    id: '', name: def.name, weight: 0, cost: '', properties: def.properties,
    hasDamageEffect: true, weaponRange: null,
  });
  return weaponProfs.includes(martial ? 'martial' : 'simple');
}

/**
 * Computes to-hit and damage info for every equipped weapon. Single source
 * of truth — TabCharacter's ATTACKS section and each weapon's action card
 * both read this instead of recomputing (they used to, independently, and
 * had drifted: one used max(str,dex) for ranged weapons, which is wrong
 * per RAW, and one read raw base stats instead of effect-modified ones).
 */
const APPLIED_STYLES = ['archery', 'dueling', 'great weapon fighting', 'two-weapon fighting'] as const;
const styleOf = (name: string) => name.replace(/^fighting style:\s*/i, '').trim().toLowerCase();
/** A fighting style applied by its name, though its feature carries no effect: pickers must not call it flavor. */
export const isAppliedFightingStyle = (name: string): boolean => (APPLIED_STYLES as readonly string[]).includes(styleOf(name));

function hasFightingStyle(entity: Entity, style: typeof APPLIED_STYLES[number]): boolean {
  return entity.features.some(f => f.isActive !== false && (f.source.kind === 'class' || f.source.kind === 'subclass' || f.source.kind === 'feat')
    && styleOf(f.name) === style);
}

export function computeWeaponAttackBonuses(
  entity:         Entity,
  effectiveStats: Entity['stats'],
  profBonus:      number,
  homebrewItems:  readonly import('./types').Item[] = [],
): AttackBonus[] {
  const strMod = modifier(effectiveStats.str);
  const dexMod = modifier(effectiveStats.dex);
  const result: AttackBonus[] = [];
  const archery = hasFightingStyle(entity, 'archery');
  const twoHanded = new Set<AttackBonus>();
  const versatile = new Set<AttackBonus>();
  const light = new Set<AttackBonus>();

  for (const inst of entity.inventory.equipped) {
    // A weapon that requires attunement and is not attuned is still a weapon: it attacks as its plain base weapon, without its
    // magic bonus (the rules leave an unattuned item its nonmagical benefits). Same flag as collectAllEffects and actionCards.ts.
    const attuned = isItemMechanicallyActive(inst, resolveItemDefinition(inst.itemId, homebrewItems));
    // itemRepo only ever holds the OFFICIAL catalog — a homebrew weapon's
    // definition lives in the explicit content snapshot instead, so it
    // needs the same fallback lookup as characterStore.ts's
    // hydrateItemFeatures, or every homebrew weapon silently gets no
    // to-hit bonus computed for it here.
    const def = itemRepo.getItemSync(inst.itemId)
      ?? homebrewItems.find(i => i.id === inst.itemId);
    if (!def) continue;

    // Prefer the instance's own (possibly infusion-augmented) features,
    // same fallback actionCards.ts's card generator already uses — older
    // saves may have only an itemId with no hydrated features.
    const ownFeats = effectiveWeaponAttackFeatures(inst, def, homebrewItems);
    // unattuned: the base weapon's attack when the name gives one, else the weapon's own first damage
    const baseFeats = attuned ? [] : effectiveWeaponAttackFeatures({ ...inst, features: [] }, { ...def, features: [] }, homebrewItems);
    const feats = baseFeats.some(f => f.abilityEffects?.some(e => e.type === 'damage')) ? baseFeats : ownFeats;
    let dice: string | null = null;
    let dmgType = '';
    let featureName = def.name;
    for (const f of feats) {
      const dmgFx = (f.abilityEffects ?? []).find(ae => ae.type === 'damage');
      if (dmgFx) { dice = dmgFx.dice; dmgType = dmgFx.damageType; featureName = f.name; break; }
    }
    if (!dice) continue;

    const props = def.properties.map(p => p.toLowerCase());
    const isFinesse = props.some(p => p.includes('finesse'));
    // Re-audit A18: ranged means "ammunition" ONLY — a thrown weapon's own
    // property text always reads like "thrown (range 20/60)", which
    // contains the substring "range" too, so the OLD second clause
    // (`thrown && range`) was true for EVERY thrown weapon, not just true
    // ranged ones. Per RAW, a thrown weapon uses the SAME ability modifier
    // whether thrown or swung in melee (finesse already lets it pick DEX
    // above; a non-finesse thrown weapon like a Handaxe is STR either way)
    // — there is no "thrown weapon used at range" ability distinction to
    // make here, since this app has no melee/ranged choice for thrown
    // attacks. `type` below still reflects true ranged weapons only.
    const isRanged = props.some(p => p.includes('ammunition'));

    let mod: number;
    let ability: 'str' | 'dex';
    if (isFinesse) {
      ability = dexMod >= strMod ? 'dex' : 'str';
      mod = Math.max(strMod, dexMod);
    } else if (isRanged) {
      ability = 'dex'; mod = dexMod;
    } else {
      ability = 'str'; mod = strMod;
    }

    // Magic bonus (+1/+2/+3), parsed from name/feature-name/properties text.
    const magicHay = [def.name, featureName, ...def.properties].join(' ');
    // the bonus the owner chose for a record that covers several ("Weapon, +1, +2, or +3"), else the one its name or text gives
    const magicBonus = attuned ? inst.magicBonus ?? parseInt(magicHay.match(/\+(\d)\b/)?.[1] ?? '0', 10) : 0;

    // Re-audit A18: proficiency bonus only applies when the character is
    // actually proficient with this weapon — it used to be added
    // unconditionally. Checks the same weapon-category/named-weapon
    // proficiency list entitlements already flow into
    // entity.proficiencies.weapons (category tags 'simple'/'martial' plus
    // any specific named weapons a feature/race/background grants).
    const isProficient = isProficientWithWeapon(entity, def);

    const attack: AttackBonus = {
      id:          inst.itemId,
      instanceId:  inst.id,
      name:        def.name,
      bonus:       (isProficient ? profBonus : 0) + mod + magicBonus + (archery && isRanged ? 2 : 0),
      type:        isRanged ? 'ranged' : 'melee',
      ability,
      damageBonus: mod + magicBonus,
      damageDice:  dice,
      damageType:  dmgType,
    };
    if (props.some(p => p.includes('two-handed'))) twoHanded.add(attack);
    if (props.some(p => p.startsWith('versatile'))) versatile.add(attack);
    if (props.includes('light')) light.add(attack);
    result.push(attack);
  }
  // Great Weapon Fighting: a melee weapon held in two hands (two-handed, or versatile with no shield and no other weapon)
  // rerolls a 1 or 2 once (2014) or counts it as a 3 (2024)
  if (hasFightingStyle(entity, 'great weapon fighting')) {
    const shield = wornGearOf(entity.inventory.equipped, id => resolveItemDefinition(id, homebrewItems)).shield;
    for (const a of result) {
      if (a.type === 'melee' && (twoHanded.has(a) || (versatile.has(a) && result.length === 1 && !shield))) {
        a.damageDieRule = entity.rulesetId === 'dnd5e-2024' ? 'min_3' : 'reroll_1_2';
      }
    }
  }
  // Two-weapon fighting: with two light melee weapons, either can make the off-hand attack, which adds no positive ability
  // modifier to its damage unless the character has the Two-Weapon Fighting style
  const lights = result.filter(a => a.type === 'melee' && light.has(a));
  if (lights.length >= 2) {
    const twf = hasFightingStyle(entity, 'two-weapon fighting');
    for (const a of lights) a.offHandDamageBonus = twf ? a.damageBonus : a.damageBonus - Math.max(0, a.ability === 'dex' ? dexMod : strMod);
  }
  // Dueling: a melee weapon in one hand and no other weapon (a versatile one counts as held in one hand; a shield is fine).
  if (hasFightingStyle(entity, 'dueling') && result.length === 1 && result[0].type === 'melee' && !twoHanded.has(result[0])) {
    result[0] = { ...result[0], damageBonus: result[0].damageBonus + 2 };
  }

  // Unarmed Strike — always available (PHB pg 195: 1 + STR mod bludgeoning),
  // regardless of what's equipped. Martial Arts (Monk) upgrades the die
  // (scaling with MONK level specifically, not total character level, so a
  // multiclassed monk/fighter still gets the right die) and unlocks DEX as
  // an option for the attack/damage roll, same finesse-style
  // max(str,dex) rule as a finesse weapon above.
  const hasMartialArts2024 = entity.features.some(f => f.id === MARTIAL_ARTS['2024'].featureId);
  const hasMartialArts = hasMartialArts2024 || entity.features.some(f => f.id === MARTIAL_ARTS['2014'].featureId);
  let unarmedDice = '1';
  let unarmedAbility: 'str' | 'dex' = 'str';
  let unarmedMod = strMod;
  if (hasMartialArts) {
    // the die scales with the class's own level (a multiclassed monk gets the right one), from the ruleset's table
    const art = MARTIAL_ARTS[hasMartialArts2024 ? '2024' : '2014'];
    const monkLevel = getClassEntry(entity, art.classId)?.level ?? entity.identity.level;
    unarmedDice = art.dice.find(([from]) => monkLevel >= from)![1];
    unarmedAbility = dexMod >= strMod ? 'dex' : 'str';
    unarmedMod = Math.max(strMod, dexMod);
  }
  result.push({
    id: 'unarmed_strike', name: 'Unarmed Strike',
    bonus: profBonus + unarmedMod, type: 'melee', ability: unarmedAbility,
    damageBonus: unarmedMod, damageDice: unarmedDice, damageType: 'bludgeoning',
  });

  return result;
}
