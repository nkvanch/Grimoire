import type { CampaignRules, RulesetId } from './primitives';

// ── 11. Campaign system ──────────────────────────────────────────────────────

/**
 * One device's identity.
 * deviceId is a UUID generated once on first install (stored in SecureStore).
 * No accounts or logins required.
 */
export type DeviceSession = {
  deviceId:   string;
  nickname:   string;   // "Nick's iPad" — user sets once
  role:       'dm' | 'player';
  campaignId: string | null;
};

/**
 * Item 14 (Sessions) — a real-world sit-down play session, distinct from
 * DeviceSession (the device identity). A
 * session is "active" precisely when the newest entry in
 * Campaign.sessionLog has `startedAt` set but no `endedAt` — deliberately
 * not a separate Campaign.activeSessionId field, so there's exactly one
 * source of truth for session state instead of two that could drift.
 * `startedAt`/`endedAt`/`attendedCharacterIds` are optional so every
 * existing hand-added "+ Add Session Note" entry (summary-only, no real
 * start/end) keeps parsing unchanged — those are just session notes not
 * tied to a tracked start/end, same as before this existed.
 */
export type SessionLogEntry = {
  id:        string;
  summary:   string;
  date:      number;   // timestamp — kept as the "when this entry was created" field, unchanged
  startedAt?: number;
  endedAt?:   number;
  /** Snapshot of campaign.characterIds at the moment the session was
   *  started — "who was expected," not a live minute-by-minute attendance
   *  log (the app has no per-player join/leave tracking). */
  attendedCharacterIds?: string[];
};

export type Quest = {
  id:          string;
  name:        string;
  description: string;
  status:      'active' | 'completed' | 'failed';
};

/** A campaign is owned by one DM device and is offline state on it. Playing over LAN is a Live Session (src/session). */
export type Campaign = {
  id:           string;
  name:         string;
  dmDeviceId:   string;
  /** Unused: the room code of the removed campaign sync. Nothing sets it; campaigns saved earlier still carry one. */
  joinCode:     string;
  rules:        CampaignRules;
  playerIds:    string[];
  characterIds: string[];
  notes:        string;
  createdAt:    number;
  /** DM-authored session summaries, newest first. */
  sessionLog?:  SessionLogEntry[];
  /** Quest tracker — DM manages status. */
  quests?:      Quest[];
  /**
   * Item 15 (campaign content manifest) — InstalledPack.id values (see
   * src/db/packRegistryRepo.ts) the DM has banned from this specific
   * campaign. Deliberately scoped to whole homebrew packs, not individual
   * content or official content — see packDiagnostics.ts's
   * bannedContentIds() for the full reasoning. Optional/defaults to [] so
   * every existing campaign parses unchanged and is fully unrestricted.
   */
  bannedPackIds?: string[];
  /**
   * The content packs (ids and minimum versions) this campaign's ruleset needs, recorded when the campaign is made or its
   * ruleset changes, so a player who joins can be told what they have not installed. See content/requiredPacks.ts.
   */
  requiredPacks?: { id: string; minVersion?: string }[];
  /** Optional free-text blurb set at creation (CREATE_CAMPAIGN_FLOW_SPEC.md's Basics step). */
  description?:   string;
  /** The ruleset this campaign is built for. Optional — undefined means no restriction, same
   *  "unset = unrestricted" convention as everywhere else a RulesetId is optional in this file. */
  rulesetId?:     RulesetId;
  /** The revision `rulesetId` had when it was chosen (LIFE-004): the campaign is locked to that ruleset, and a later revision can be told apart. */
  rulesetRevision?: string;
};
