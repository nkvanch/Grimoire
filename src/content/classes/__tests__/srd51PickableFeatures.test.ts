// SRD 5.1 class features that ask the player to pick something carry a real choice, and the features that only named themselves
// ("You adopt a particular style of fighting as your specialty.") say what they do. Found 2026-11-11: a level-7 Ranger got Fighting
// Style, Favored Enemy and Natural Explorer with nothing to pick, and the Acolyte's Shelter of the Faithful never said what it gives.
import { ALL_PROGRESSIONS } from '..';
import { FULL_SUBCLASS_LIBRARY } from '../../subclasses';
import { bgAcolyte } from '../../backgrounds';
import { ChoiceDefinition, Feature } from '../../../engine/types';

const choicesAt = (classId: string, level: number): ChoiceDefinition[] =>
  ALL_PROGRESSIONS[classId].entries.filter(e => e.level === level).flatMap(e => e.choices);

const poolLabels = (c: ChoiceDefinition | undefined): string[] =>
  (Array.isArray(c?.pool) ? c.pool : []).map(o => o.label);

const poolChoice = (classId: string, level: number, idPart: string): ChoiceDefinition | undefined =>
  choicesAt(classId, level).find(c => c.kind === 'feature_pool' && c.id.includes(idPart));

const featureText = (classId: string, featureId: string): string => {
  for (const e of ALL_PROGRESSIONS[classId].entries) {
    for (const g of e.grants) {
      const v = g.value as Feature;
      if (g.kind === 'feature' && v.id === featureId) return v.description;
    }
  }
  throw new Error(`${classId} has no feature ${featureId}`);
};

describe('SRD 5.1 Fighting Style is a real pick', () => {
  it('Fighter at 1st level: all six styles', () => {
    expect(poolLabels(poolChoice('fighter', 1, 'fighting_style'))).toEqual(
      ['Archery', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Protection', 'Two-Weapon Fighting']);
  });
  it('Paladin at 2nd level: Defense, Dueling, Great Weapon Fighting, Protection', () => {
    expect(poolLabels(poolChoice('paladin', 2, 'fighting_style'))).toEqual(['Defense', 'Dueling', 'Great Weapon Fighting', 'Protection']);
  });
  it('Ranger at 2nd level: Archery, Defense, Dueling, Two-Weapon Fighting', () => {
    expect(poolLabels(poolChoice('ranger', 2, 'fighting_style'))).toEqual(['Archery', 'Defense', 'Dueling', 'Two-Weapon Fighting']);
  });
  it('the Champion picks a second style at 10th level from the same options', () => {
    const champion = FULL_SUBCLASS_LIBRARY.find(s => s.classId === 'fighter' && s.name === 'Champion')!;
    const choice = champion.entries.filter(e => e.level === 10).flatMap(e => e.choices).find(c => c.kind === 'feature_pool');
    expect(poolLabels(choice)).toEqual(poolLabels(poolChoice('fighter', 1, 'fighting_style')));
  });
  it('a style grants a feature that says what it does, the same feature wherever it is picked', () => {
    const defense = (poolChoice('paladin', 2, 'fighting_style')!.pool as { label: string; value: unknown }[]).find(o => o.label === 'Defense')!.value as Feature;
    expect(defense.description).toMatch(/\+1 bonus to AC/);
    expect(defense.effects[0]).toMatchObject({ target: 'ac', operation: 'add', value: 1 });
    const fighterDefense = (poolChoice('fighter', 1, 'fighting_style')!.pool as { label: string; value: unknown }[]).find(o => o.label === 'Defense')!.value as Feature;
    expect(fighterDefense.id).toBe(defense.id);
  });
});

describe('SRD 5.1 Ranger picks its favored enemies and terrains', () => {
  const enemies = ['Aberrations', 'Beasts', 'Celestials', 'Constructs', 'Dragons', 'Elementals', 'Fey', 'Fiends', 'Giants', 'Monstrosities', 'Oozes', 'Plants', 'Undead', 'Two humanoid races'];
  const terrains = ['Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark'];
  it('a favored enemy at 1st, 6th and 14th level', () => {
    for (const level of [1, 6, 14]) expect(poolLabels(poolChoice('ranger', level, 'favored_enemy'))).toEqual(enemies);
    for (const level of [2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20]) expect(poolChoice('ranger', level, 'favored_enemy')).toBeUndefined();
  });
  it('a favored terrain at 1st, 6th and 10th level', () => {
    for (const level of [1, 6, 10]) expect(poolLabels(poolChoice('ranger', level, 'favored_terrain'))).toEqual(terrains);
    for (const level of [2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) expect(poolChoice('ranger', level, 'favored_terrain')).toBeUndefined();
  });
  it('the same creature type is the same feature at every level, so it cannot be taken twice; another humanoid pair can', () => {
    const ids = (level: number) => (poolChoice('ranger', level, 'favored_enemy')!.pool as { id: string; value: unknown }[]).map(o => [o.id, (o.value as Feature).id]);
    expect(ids(6).slice(0, 13)).toEqual(ids(1).slice(0, 13));
    expect(new Set(ids(1).map(x => x[1])).size).toBe(enemies.length);
    // the SRD lets a ranger name another two humanoid races at 6th and 14th level: a different option and feature each time
    const humanoids = [1, 6, 14].map(level => ids(level)[13]);
    expect(new Set(humanoids.map(x => x[0])).size).toBe(3);
    expect(new Set(humanoids.map(x => x[1])).size).toBe(3);
  });
  it('Favored Enemy and Natural Explorer say what they give', () => {
    expect(featureText('ranger', 'favored_enemy')).toMatch(/advantage on Wisdom \(Survival\) checks to track/);
    expect(featureText('ranger', 'natural_explorer')).toMatch(/proficiency bonus is doubled/);
  });
});

describe('SRD 5.1 Metamagic and Pact Boon are real picks', () => {
  const metamagic = ['Careful Spell', 'Distant Spell', 'Empowered Spell', 'Extended Spell', 'Heightened Spell', 'Quickened Spell', 'Subtle Spell', 'Twinned Spell'];
  it('two Metamagic options at 3rd level, one more at 10th and at 17th', () => {
    expect(poolLabels(poolChoice('sorcerer', 3, 'metamagic'))).toEqual(metamagic);
    expect(poolChoice('sorcerer', 3, 'metamagic')!.count).toBe(2);
    expect(poolChoice('sorcerer', 10, 'metamagic')!.count).toBe(1);
    expect(poolChoice('sorcerer', 17, 'metamagic')!.count).toBe(1);
  });
  it('a Pact Boon at 3rd level', () => {
    expect(poolLabels(poolChoice('warlock', 3, 'pact_boon'))).toEqual(['Pact of the Chain', 'Pact of the Blade', 'Pact of the Tome']);
  });
});

describe('SRD 5.1 features say what they do', () => {
  // each feature that used to name itself only, with a phrase from the rule it grants
  const expectations: [string, string, RegExp][] = [
    ['fighter', 'fighting_style', /Archery, Defense, Dueling, Great Weapon Fighting, Protection/],
    ['fighter', 'martial_archetype', /Champion/],
    ['rogue', 'sneak_attack', /finesse or a ranged weapon/],
    ['rogue', 'thieves_cant', /four times longer/],
    ['rogue', 'rogue_archetype_feature', /Thief/],
    ['wizard', 'wizard_spellcasting', /Intelligence modifier \+ wizard level/],
    ['wizard', 'arcane_recovery', /half your wizard level/],
    ['wizard', 'wizard_tradition', /School of Evocation/],
    ['wizard', 'signature_spells', /3rd-level wizard spells/],
    ['cleric', 'cleric_spellcasting', /Wisdom modifier \+ cleric level/],
    ['cleric', 'divine_domain', /Life Domain/],
    ['cleric', 'destroy_undead', /Challenge Rating 1\/2 or lower/],
    ['barbarian', 'rage', /resistance to bludgeoning, piercing and slashing damage/],
    ['barbarian', 'danger_sense', /advantage on Dexterity saving throws/],
    ['barbarian', 'primal_path', /Path of the Berserker/],
    ['barbarian', 'relentless_rage', /DC 10 Constitution saving throw/],
    ['ranger', 'ranger_conclave', /Hunter/],
    ['ranger', 'fighting_style_ranger', /Archery, Defense, Dueling or Two-Weapon Fighting/],
    ['paladin', 'fighting_style_paladin', /Defense, Dueling, Great Weapon Fighting or Protection/],
    ['paladin', 'sacred_oath', /Oath of Devotion/],
    ['druid', 'druid_spellcasting', /Wisdom modifier \+ druid level/],
    ['druid', 'druidic', /DC 15 Wisdom \(Perception\)/],
    ['druid', 'druid_circle', /Circle of the Land/],
    ['druid', 'beast_spells', /material components/],
    ['druid', 'archdruid', /verbal and somatic components/],
    ['bard', 'bard_spellcasting', /Charisma modifier/],
    ['bard', 'bardic_inspiration', /ability check, attack roll or saving throw/],
    ['bard', 'song_of_rest', /extra 1d6 hit points/],
    ['bard', 'bard_college', /College of Lore/],
    ['monk', 'martial_arts', /bonus action/],
    ['monk', 'ki', /Flurry of Blows/],
    ['monk', 'monastic_tradition', /Way of the Open Hand/],
    ['monk', 'deflect_missiles', /1d10 \+ your Dexterity modifier \+ your monk level/],
    ['monk', 'slow_fall', /five times your monk level/],
    ['monk', 'stunning_strike', /stunned until the end of your next turn/],
    ['sorcerer', 'sorcerer_spellcasting', /Charisma modifier/],
    ['sorcerer', 'sorcerous_origin', /Draconic Bloodline/],
    ['sorcerer', 'font_of_magic', /sorcery points equal to your sorcerer level/],
    ['sorcerer', 'metamagic', /two Metamagic options/],
    ['warlock', 'otherworldly_patron', /the Fiend/],
    ['warlock', 'warlock_spellcasting', /short or long rest/],
    ['warlock', 'eldritch_invocations', /You pick two now/],
    ['warlock', 'pact_boon', /Pact of the Chain, Pact of the Blade or Pact of the Tome/],
  ];
  for (const [classId, featureId, phrase] of expectations) {
    it(`${classId} ${featureId}`, () => expect(featureText(classId, featureId)).toMatch(phrase));
  }
  it('the Acolyte\'s Shelter of the Faithful says what it gives', () => {
    expect(bgAcolyte.features.find(f => f.id === 'shelter_of_faithful')!.description).toMatch(/free healing and care at a temple/);
  });
});
