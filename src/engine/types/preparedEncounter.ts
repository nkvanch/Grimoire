// ── Prepared Encounters ──────────────────────────────────────────────────────
// Planning data, deliberately separate from runtime combat state
// (CombatState/InitiativeEntry in engine/combat.ts — the "ActiveEncounter").
// A PreparedEncounter never holds live HP/conditions/derived stats; it holds
// enough to INSTANTIATE those via preparedEncounter.ts's
// instantiatePreparedEncounter(), which spawns fresh Entity instances the
// same way monsters.tsx's "spawn into encounter" already does. Starting the
// same template twice must produce two independent sets of entities, and
// starting it must never write back into the template.

export type EncounterStatus = 'draft' | 'ready' | 'completed' | 'archived';

export type PreparedCombatantHpMode = 'average' | 'max' | 'roll' | 'manual';

/**
 * One row in a prepared encounter's combatant list. `quantity` avoids
 * needing N identical rows for "Goblin x6" — expanded into N entities at
 * instantiation, each independently mutable afterward (that expansion, not
 * this row, is where "duplicates become independent" actually happens).
 */
export type PreparedCombatant = {
  id:          string;              // stable id within this encounter, NOT the monster's own id
  monsterId:   string;              // MonsterTemplate.id (official or homebrew)
  displayName?: string;             // e.g. "Goblin (Lookout)" instead of the template's own name
  quantity:    number;
  hpMode:      PreparedCombatantHpMode;
  manualHp?:   number;              // used when hpMode === 'manual'
  groupId?:    string;              // EncounterGroup.id — DM-UI organization only
  waveId?:     string;              // EncounterWave.id — undefined means "present from the start"
  startingConditionIds?: string[];  // Condition ids applied at instantiation
  /** Resource pool id -> current value to start at (e.g. a meter that starts at 2 rather than its maximum of 3). Clamped to 0..maximum. */
  startingResources?: Record<string, number>;
  notes?:      string;
  hidden?:     boolean;             // DM-only — not yet revealed to players
  initiativePreference?: number;    // fixed initiative instead of rolling, if set
};

/** DM-UI organization only — see PreparedEncounter's own doc comment. */
export type EncounterGroup = {
  id:   string;
  name: string;
};

/**
 * A reinforcement wave. Deployment is manual-first (a Deploy button) —
 * triggerKind is informational/organizational, not a scripting engine. A
 * 'descriptive' trigger (e.g. "when the alarm bell rings") is just stored
 * as text; the DM still presses Deploy when it happens at the table.
 */
export type EncounterWaveTriggerKind = 'manual' | 'round' | 'descriptive';

export type EncounterWave = {
  id:            string;
  name:          string;
  triggerKind:   EncounterWaveTriggerKind;
  triggerRound?: number;   // used when triggerKind === 'round' (shown as a reminder, not auto-fired)
  triggerNote?:  string;   // free text — the 'descriptive' trigger text, or flavor for any kind
};

export type EncounterEnvironmentEntry = {
  id:          string;
  label:       string;        // "Difficult terrain", "Darkness", "Poison gas", or custom text
  description?: string;
  /** 'secret' = DM-only (never shown to players, e.g. a hidden Collapse Counter hazard); undefined/'public' = visible to all. */
  visibility?: 'public' | 'secret';
  /** Optional link to a real Condition for an actual mechanical effect
   *  (e.g. an environmental hazard that behaves like a Condition already
   *  in the compendium). Left unset, this stays purely descriptive — never
   *  auto-applied to anyone, matching the "disclosed, not automated"
   *  pattern used throughout this app for content the engine can't safely
   *  auto-resolve on its own. */
  conditionId?: string;
};

export type EncounterRewardKind = 'xp' | 'currency' | 'item' | 'custom';

export type EncounterReward = {
  id:      string;
  kind:    EncounterRewardKind;
  label:   string;     // "150 XP", "50 gp", "Potion of Healing x2", or custom text
  amount?: number;     // numeric amount for xp/currency, optional even then
  itemId?: string;     // for kind 'item', links to a real Item id
};

export type PreparedEncounter = {
  id:           string;
  /** Undefined = a reusable template, not tied to one campaign. */
  campaignId?:  string;
  /** Item 14 (Sessions) — the SessionLogEntry.id active when this encounter
   *  was created, if any (see SessionLogEntry's own doc comment). Lets a
   *  DM later see which encounters were prepared/run during a given
   *  session. Undefined for an encounter created outside an active
   *  session, or one created before this field existed. */
  sessionId?:   string;
  name:         string;
  description?: string;
  location?:    string;
  dmNotes?:     string;
  tags:         string[];
  status:       EncounterStatus;
  combatants:   PreparedCombatant[];
  groups:       EncounterGroup[];
  waves:        EncounterWave[];
  environment:  EncounterEnvironmentEntry[];
  tacticsNotes?:     string;
  victoryNotes?:     string;
  rewards:           EncounterReward[];
  expectedPartyNote?: string;   // e.g. "4 players, level 5" — free text, no enforcement
  createdAt:    number;
  updatedAt:    number;
  /** Informational only — does not block re-starting the same template
   *  again (starting twice must produce two independent active encounters). */
  lastStartedAt?: number;
  /** Set when a DM marks this completed after combat. The template's own
   *  combatant list is never overwritten with live HP/conditions — see
   *  preparedEncounter.ts's own doc comment. */
  completedAt?:   number;
};

/** A single event recorded in the combat log during a session. */
export type CombatEventType =
  | 'damage' | 'heal' | 'condition_apply' | 'condition_remove'
  | 'cast' | 'action_used' | 'death' | 'revive' | 'dm_override' | 'note';

export type CombatLogEntry = {
  id:        string;
  sessionId: string;
  round:     number;
  timestamp: number;
  type:      CombatEventType;
  actorId:   string;
  targetId:  string | null;
  /** Human-readable summary e.g. "Aric cast Fireball — roll 8d6 fire" */
  label:     string;
  value:     number | null;
};
