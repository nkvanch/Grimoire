// src/content/companions/index.ts
// Registry of companion templates (Steel Defender, Eldritch Cannon, etc.),
// keyed by the id of the Feature that GRANTS access to summoning them.
// src/components/sheet/CompanionSection.tsx checks the owner's active
// features for a matching key to decide whether to show a "Summon X"
// button — this is a plain lookup table, not a new engine mechanism, so
// adding a companion later is just adding an entry here plus authoring the
import { CompanionTemplate } from '../../engine/companion';

export const COMPANION_TEMPLATES_BY_GRANT_FEATURE: Record<string, CompanionTemplate> = {
};
