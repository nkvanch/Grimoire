// ── 9. Audit trail system ────────────────────────────────────────────────────

/**
 * AuditEntry.sourceKind mirrors FeatureSource.kind plus 'base' and 'dm_override'.
 * 'subclass' is explicitly included to avoid type errors when reading fi.source.kind.
 */
export type AuditSourceKind =
  | 'base'        // raw stat, 10 + DEX, proficiency bonus formula
  | 'race'
  | 'class'
  | 'subclass'    // must be here — FeatureSource.kind includes 'subclass'
  | 'background'
  | 'feat'
  | 'item'
  | 'spell'
  | 'condition'
  | 'campaign'
  | 'manual'
  | 'dm_override'
  | 'character_override';

/** One contribution to a derived value. */
export type AuditEntry = {
  label:      string;           // "DEX modifier", "Chain shirt", "DM override — cursed"
  value:      number;           // the contribution (positive, negative, or zero for notes)
  sourceKind: AuditSourceKind;
  sourceId:   string | null;    // feature/item/override ID, or null for base values
  replacement?: { from: number; to: number }; // set override, not an additive +0
};

/** The full breakdown of how a derived value was computed. */
export type AuditTrail = {
  stat: string; total: number; entries: AuditEntry[];
  calculated?: number; override?: number | null; effective?: number;
};
