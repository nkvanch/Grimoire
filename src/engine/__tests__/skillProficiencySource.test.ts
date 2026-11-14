// The creation Skills step names where an already-trained skill came from: a Half-Orc's Intimidation is the species', not the
// background's (it used to say "From background" for every trained skill).
import { buildSrd51Pack } from '../../content/packs/srdPacks';
import { packContentProvider, InstalledPack } from '../../content/provider/contentProvider';
import { createCharacter } from '../../content/provider/createCharacter';
import { DEFAULT_RULES } from '../defaults';
import { skillProficiencySource } from '../skillCheck';
import type { RulesetId } from '../types';

const provider = packContentProvider([JSON.parse(JSON.stringify(buildSrd51Pack())) as InstalledPack], 'dnd5e-2014' as RulesetId);
const e = createCharacter(provider, { id: 'o', name: 'O', classId: 'sorcerer', raceId: 'half_orc', backgroundId: 'acolyte',
  stats: { str: 10, dex: 12, con: 11, int: 11, wis: 12, cha: 17 }, level: 1 }, DEFAULT_RULES);
const names = { race: 'Half-Orc', subrace: null, background: 'Acolyte', class: 'Sorcerer' };

it('names the species, the background, or nothing', () => {
  expect(skillProficiencySource(e, 'intimidation', names)).toBe('Half-Orc');
  expect(skillProficiencySource(e, 'insight', names)).toBe('Acolyte');
  expect(skillProficiencySource(e, 'stealth', names)).toBeNull();
});
