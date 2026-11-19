import { currentContentExposure } from '../../../content/contentExposure';
import { ContentTypeId } from '../../../content/contentQuery';
import { Ability, Feat, ContentDB } from '../../../engine/types';

export const SCREEN_KEY = 'compendium';
export const ABILITY_LABELS: Record<Ability, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
export const ARMOR_LABELS: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shield' };
export const WEAPON_LABELS: Record<string, string> = { simple: 'Simple', martial: 'Martial' };
export const skillLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
// Stable empty-array reference — contentDB.feats is optional (ContentDB.feats?),
// so `?? []` would otherwise create a new array every render and break
// downstream useMemo referential-equality checks that depend on `feats`.
export const EMPTY_FEATS: Feat[] = [];
// PERF-COMPENDIUM-1: shared stable-reference empty array — returned by any
// per-type filter memo that's skipped this render (see `single` guards
// below), so skipping never allocates a fresh array and never breaks a
// downstream useMemo's referential-equality check.
export const EMPTY_RESULTS: never[] = [];
export const EMPTY_CONTENT_DB: ContentDB = {
  races: [], classes: [], backgrounds: [], spells: [], items: [], conditions: [], features: [], feats: [],
};

export const CONTENT_EXPOSURE = currentContentExposure();
/** Official mode never lists homebrew — passed wherever a sort option asks "is this entry homebrew?". */
export const notHomebrew = () => false;

export const CONTENT_TYPE_ORDER: ContentTypeId[] = [
  'race', 'subrace', 'class', 'subclass', 'background', 'feat', 'spell', 'item', 'monster', 'condition',
];
