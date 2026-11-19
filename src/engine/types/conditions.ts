// ── 4. Condition system ──────────────────────────────────────────────────────

/**
 * Structured duration tracker.
 * Every expirable effect (conditions, spells, buffs) uses this shape.
 */
export type DurationTracker = {
  unit:       'rounds' | 'minutes' | 'hours' | 'until_rest' | 'permanent';
  remaining:  number;
  expiresAt?: number;   // Absolute round number, for display
};

/**
 * A condition currently applied to an entity.
 * suppressedBy holds IDs of features that silence this condition's effects
 * WITHOUT removing the condition (e.g. Blindsight suppresses Blinded penalties).
 */
export type ActiveCondition = {
  id:           string;
  sourceId:     string;
  duration:     DurationTracker | null;
  suppressedBy: string[];
};

/**
 * Live condition state on an entity.
 * exhaustion is tracked as a numeric level (0–6), separate from the condition list.
 * flags is a runtime boolean map: "rage_active", "concentrating", etc.
 *   These gate conditional passive effects in collectAllEffects().
 */
export type ConditionMonitor = {
  active:     ActiveCondition[];
  exhaustion: number;
  flags:      Record<string, boolean>;
};
