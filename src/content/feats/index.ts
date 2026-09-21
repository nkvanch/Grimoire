// ============================================================================
// FILE: src/content/feats/index.ts
// 5e feats, salvaged from the Obsidian vault (Feats 5e.md).
//
// Each feat is selectable in place of an Ability Score Increase. `feature`
// carries any AUTOMATED effects; only targets the pipeline is known to resolve
// are automated (ability scores, speed, initiative). Feats with ability CHOICES
// ("+1 Str or Dex") or non-numeric benefits apply as a named, described Feature
// the player tracks manually — the description states the full benefit.
// ============================================================================
import { Feat, Feature, Effect, Ability } from '../../engine/types';

// Reminder-only, same mechanism DerivedStats.advantageStates already uses
// elsewhere (e.g. infusions/index.ts, Barbarian's Feral Instinct) — shown to
// the player so they remember to roll 2d20, not auto-applied to any roll.
function advantage(target: string): Effect {
  return { type: 'stat_modifier', target, operation: 'advantage', value: null, condition: null };
}

function feat(
  id: string,
  name: string,
  prerequisite: string | null,
  description: string,
  source: string,
  effects: Effect[] = [],
  abilityChoice?: { options: Ability[]; amount: number; grantsSaveProficiency?: boolean },
  skillChoice?: { picks: { id: string; label: string; mode: 'proficiency' | 'expertise'; from: 'any' | 'proficient' }[] },
): Feat {
  const feature: Feature = {
    id: `feat_${id}`,
    name,
    description,
    source: { kind: 'feat', refId: id },
    level: null,
    effects,
    actions: [],
    choices: [],
    passive: true,
  };
  // SRD status: CONFIRMED via direct verification against the actual SRD 5.1
  // text (5thsrd.org, a faithful CC-BY mirror) on 2026-08-04. The SRD 5.1
  // Feats section contains ONLY Grappler — the "optional feats rule" framing
  // in the class text names Grappler as the sole worked example, unlike
  // classes/races/backgrounds/monsters which got much fuller treatment.
  // This CORRECTS an earlier optimistic guess (all 42 PHB feats) that was
  // based on a pattern from other content types that turned out NOT to
  // apply to feats. See docs/ROADMAP_1.0.md Phase 1 Step 1.4 for the full
  // verification writeup and links.
  const srd = id === 'grappler';
  return { id, name, prerequisite, description, source, feature, abilityChoice, skillChoice, srd };
}

const PHB = "Player's Handbook";

// ── feats ───────────────────────────────────────────────────────────────────

const allFeatEntries: Feat[] = [

  // "Pin a grappled creature" stays description-only — not a passive stat
  // bonus, no action/resource mechanism to automate it.
  feat('grappler', 'Grappler', 'Strength 13+',
    'You have advantage on attack rolls against a creature you are grappling, and can use your action to try to pin a grappled creature (restrained).',
    PHB, [advantage('attack rolls against a creature you are grappling')]),
];

/** Every feat, unfiltered. Prefer ALL_FEATS below in app code. */
export const FULL_FEAT_LIBRARY: Feat[] = allFeatEntries;

const SRD_ONLY = process.env.EXPO_PUBLIC_SRD_ONLY === 'true';

/**
 * The feat list the app should use — filtered to srd === true only on the
 * EAS `production` build profile (see eas.json). Same build-target-aware
 * pattern as spells/subclasses/races/backgrounds. srd is computed
 * automatically per-feat from its source constant (see the feat() helper
 * above) — see the HIGH-STAKES JUDGMENT CALL note on Feat.srd in
 * engine/types.ts before trusting this for a real public release.
 */
export const ALL_FEATS: Feat[] = SRD_ONLY
  ? FULL_FEAT_LIBRARY.filter(f => f.srd === true)
  : FULL_FEAT_LIBRARY;

/** Lookup map: featId → Feat. */
export const FEATS_BY_ID: Record<string, Feat> = Object.fromEntries(
  ALL_FEATS.map(f => [f.id, f]),
);
