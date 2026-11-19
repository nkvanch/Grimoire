import { Entity, FeatureInstance, CustomResource } from './types';

// ── Recharge (e.g. "Recharge 5-6") ───────────────────────────────────────────

/**
 * Parses a "Recharge X-6" / "Recharge X" style recharge TAG (the exact,
 * short canonical form — CustomResource.recharge's open `| string` case,
 * see its own doc comment) into the minimum d6 face needed to succeed.
 * Callers use the null/non-null result to decide whether an app-roll
 * convenience even makes sense to offer for this resource. Table-first:
 * this only ever computes whether a roll WOULD succeed: the primary path
 * (manually marking a resource recharged) already exists via the
 * resource's own +/- controls / a dedicated [Recharge] button and never
 * goes through this function.
 *
 * Closure 3E: strict, ANCHORED parsing — the entire (trimmed) string must
 * be exactly "Recharge N" or "Recharge N-6" (case-insensitive, hyphen or
 * en-dash), N in 2-6. This used to be a loose, unanchored `.match()` that
 * accepted a match found anywhere inside a longer string (so "Recharge 5-6
 * extra junk," or any text merely containing the word "recharge" near a
 * digit, silently parsed) and treated "Recharge 4-5" as threshold 4 by
 * simply ignoring the non-matching "-5" suffix — a pattern this app's
 * engine has no "X-5" semantics for at all (5e recharge abilities are
 * always "Recharge N" or "Recharge N-6," nothing else). Returns null for
 * anything that isn't an exact match: rest-based recharge
 * ('short_rest'/'long_rest'/'dawn'/'never'/'start_of_turn'), freeform
 * homebrew text, or a malformed/partial recharge string.
 */
export function parseRechargeThreshold(recharge: string): number | null {
  const match = recharge.trim().match(/^recharge\s+(\d)(?:\s*[-–]\s*6)?$/i);
  if (!match) return null;
  const threshold = parseInt(match[1], 10);
  return threshold >= 2 && threshold <= 6 ? threshold : null;
}

/**
 * Closure 3A: extracts a monster feature's own "Recharge N[-6]." clause
 * from the START of its printed description — the standard SRD stat-block
 * convention (e.g. "Recharge 5-6. The dragon exhales fire in a..."). Used
 * ONLY at spawn time (monsterFactory.ts) to synthesize a matching
 * CustomResource + resourceCost for a feature that has neither today, so
 * using/recharging it flows through the SAME generic resource-spend/
 * availability machinery every other resource-gated feature (spell slots,
 * Legendary Actions) already uses — no new subsystem. Deliberately
 * anchored to the START of the description, not "found anywhere in it" —
 * the recharge notice is always the opening clause in real stat-block
 * text, and scraping a recharge-shaped substring out of the middle of
 * unrelated prose is exactly the over-permissive behavior closure 3E
 * disallows. Returns the canonical short tag (e.g. "Recharge 5-6", no
 * trailing period) — parseRechargeThreshold above accepts exactly this
 * format back, so the two functions share one definition of "valid."
 */
export function extractRechargeTag(description: string): string | null {
  const match = description.trim().match(/^recharge\s+(\d)(?:\s*[-–]\s*6)?\s*\./i);
  if (!match) return null;
  const threshold = parseInt(match[1], 10);
  if (threshold < 2 || threshold > 6) return null;
  return match[0].slice(0, -1).trim(); // drop the trailing "."
}

/**
 * Closure 2C: extracts a monster feature's "Recharge N[-6]" clause from a
 * canonical `"(Recharge N[-6])"` SUFFIX on its own NAME — real content,
 * e.g. the Ghost's `"Possession (Recharge 6)"`, has no recharge clause at
 * the start of its description at all; the notice is only in the name.
 * Anchored to the END of the (trimmed) name, requiring the exact
 * parenthesized form — controlled parsing, not a substring scan: a name
 * like `"Leadership (Recharges After a Short/Long Rest)"` (real content on
 * a different monster) does NOT match, since "Recharges" (plural) isn't
 * followed by whitespace+digit the way "Recharge 6)" is. Returns the same
 * canonical short tag format extractRechargeTag/parseRechargeThreshold
 * already use (e.g. "Recharge 6"), so all three functions agree on one
 * definition of "valid."
 */
export function extractRechargeTagFromName(name: string): string | null {
  const match = name.trim().match(/\(recharge\s+(\d)(?:\s*[-–]\s*6)?\)$/i);
  if (!match) return null;
  const threshold = parseInt(match[1], 10);
  if (threshold < 2 || threshold > 6) return null;
  return match[0].slice(1, -1).trim(); // drop the surrounding "(" / ")"
}

/**
 * Closure 2C: the single entry point monsterFactory.ts calls to resolve a
 * feature's recharge tag — combines extractRechargeTagFromName and
 * extractRechargeTag under one controlled priority order (the canonical
 * name-suffix form wins over a leading description clause when a feature
 * somehow carries both, so exactly one tag — and therefore exactly one
 * synthesized resource — is ever produced for a single feature). Real
 * content only ever has one or the other (Chimera's Fire Breath: leading
 * description only; Ghost's Possession: name suffix only), so this
 * ordering is defensive rather than something any current content
 * actually exercises both branches of.
 */
export function resolveFeatureRechargeTag(name: string, description: string): string | null {
  return extractRechargeTagFromName(name) ?? extractRechargeTag(description);
}

/**
 * Rolls 1d6 against a "Recharge X-6" threshold — the secondary app-roll
 * convenience. Does NOT restore the resource itself: callers apply the
 * SAME resource-restore mutation (e.g. onResourceChange in the UI, already
 * the resource's own manual "mark recharged" path) only when `success` is
 * true, so both paths always agree on how a resource actually gets
 * restored.
 */
export function rollRecharge(threshold: number): { roll: number; success: boolean } {
  const roll = Math.floor(Math.random() * 6) + 1;
  return { roll, success: roll >= threshold };
}

/**
 * Closure 2 (rechargeable monster ability live use): finds every feature
 * on `entity` whose OWN `activation.resourceCost` resolves to a
 * CustomResource whose `recharge` string parseRechargeThreshold
 * recognizes as a genuine "Recharge N[-6]" pool — e.g. a spawned Chimera's
 * Fire Breath or a spawned Ghost's Possession, both synthesized this way
 * by monsterFactory.ts's spawnMonster. This is the ONE shared discovery
 * used by app/dm/encounter.tsx's QuickPanel to build its "🔄 Rechargeable
 * Abilities" list — extracted here (rather than left as component-local
 * JSX logic) so it's independently testable with real spawned content,
 * proving the actual UI-facing path works, not just a hand-mutated
 * resource. Naturally excludes Legendary Actions' own pool
 * (recharge:'start_of_turn' never matches) and every rest-based/freeform
 * resource — nothing here duplicates another control.
 */
export function findRechargeableFeatures(entity: Entity): { feature: FeatureInstance; resource: CustomResource; threshold: number }[] {
  return entity.features
    .map(f => {
      const resourceId = f.activation?.resourceCost?.resourceId;
      const resource = resourceId ? entity.resources.custom.find(r => r.id === resourceId) : undefined;
      const threshold = resource ? parseRechargeThreshold(resource.recharge) : null;
      return resource && threshold !== null ? { feature: f, resource, threshold } : null;
    })
    .filter((x): x is { feature: FeatureInstance; resource: CustomResource; threshold: number } => x !== null);
}
