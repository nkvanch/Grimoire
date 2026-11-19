// The 2014 backgrounds' starting equipment and gold, as a choice queued with the background (the same kind of choice the 2024
// backgrounds use: its items go to Carried, its gold to the purse). Items with no catalog entry (incense, vestments, common clothes,
// a trophy, a letter) are named in the prompt only. A background with a pick (an instrument, artisan's tools, a gaming set) gets one
// option per pick, each carrying the whole kit.
import { Background, ChoiceDefinition, BACKGROUND_CHOICE_PREFIX } from '../../engine/types';
import { ALL_TOOLS } from '../tools';

/** The catalog id of a tool: its name as an id ("Carpenter's Tools" is carpenter_s_tools). */
const itemIdOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

type Kit = { says: string; items: string[]; gold: number; pick?: { says: string; options: { label: string; items: string[] }[] } };

const KITS: Record<string, Kit> = {
  acolyte: { says: 'a holy symbol, a prayer book, 5 sticks of incense, vestments, common clothes and a pouch with 15 gp', items: ['holy_symbol', 'book', 'pouch'], gold: 15 },
};

export function startingKit2014(bgId: string): ChoiceDefinition | null {
  const kit = KITS[bgId];
  if (!kit) return null;
  const pool = kit.pick
    ? kit.pick.options.map(o => ({ id: itemIdOf(o.label), label: o.label, value: [...kit.items, ...o.items], gold: kit.gold }))
    : [{ id: 'kit', label: `Take it: ${kit.says}`, value: kit.items, gold: kit.gold }];
  return {
    id: `${BACKGROUND_CHOICE_PREFIX}${bgId}_equipment`,
    prompt: `Starting equipment from your background: ${kit.says}.${kit.pick ? ` Choose ${kit.pick.says}.` : ''}`,
    kind: 'equipment', equipmentStyle: 'exact_options', count: 1, grants: [], required: true, resolved: false, pool,
  };
}

/** A 2014 background with its starting equipment queued alongside its other choices; any other background unchanged. */
export function withStartingKit(b: Background): Background {
  const kit = startingKit2014(b.id);
  return kit && !(b.pendingChoices ?? []).some(c => c.id === kit.id) ? { ...b, pendingChoices: [...(b.pendingChoices ?? []), kit] } : b;
}
