// ============================================================================
// FILE: src/store/campaignStore.ts
// Campaign + DM identity state management. A campaign is persistent, offline
// DM state on this device. Playing it live over the network is a separate,
// temporary live session (src/session): the DM hosts one from the campaign
// screen and attaches this campaign to it there.
// ============================================================================
import { requiredPacksForRuleset } from '../content/requiredPacks';
import { installedOfficialPacks } from '../content/officialPackService';
import { create } from 'zustand';
import { Campaign, CampaignRules, RulesetId } from '../engine/types';
import { saveCampaign, loadAllCampaigns, deleteCampaign, loadCampaign } from '../db/campaignRepo';
import { useSessionStore } from './sessionStore';
import { DEFAULT_RULES } from './characterStore';

// ── Defaults ──────────────────────────────────────────────────────────────────
// DEFAULT_RULES is defined once in characterStore and imported here so a single
// edit to the book defaults (incl. houseRules) propagates everywhere.

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Store ─────────────────────────────────────────────────────────────────────

type CampaignStore = {
  campaigns:      Campaign[];
  activeCampaign: Campaign | null;
  isLoading:      boolean;

  /** True when the logged-in device owns the active campaign. */
  isDm: boolean;

  /** Load all campaigns from SQLite. Called after initDb(). */
  loadCampaigns: () => Promise<void>;

  /**
   * Create a new campaign: persistent, offline DM state. The caller is the DM device. It persists to SQLite, sets activeCampaign and
   * the local DM context, and does NOT touch the network. `rules`, when given, becomes the campaign's own
   * persistent effective configuration (e.g. copied from a chosen CustomRuleProfile by the
   * caller) — editing the original profile later never silently rewrites it.
   */
  createCampaign: (opts: {
    name: string; description?: string; rulesetId?: RulesetId;
    rules?: CampaignRules; bannedPackIds?: string[];
  }) => Promise<Campaign>;

  /** Assign a character to a campaign. */
  assignCharacterToCampaign: (characterId: string, campaignId: string) => Promise<void>;

  /** Set the active campaign (e.g. after joining). */
  setActiveCampaign: (campaign: Campaign | null) => void;

  /** Update campaign fields (name, rules, notes, etc.). */
  updateCampaign: (id: string, updater: (c: Campaign) => Campaign) => Promise<void>;

  /**
   * Close the active campaign — does NOT delete it. The campaign stays in
   * `campaigns` (and SQLite) and can be reopened later via switchToCampaign.
   */
  leaveCampaign: () => Promise<void>;

  /**
   * Permanently delete a campaign — SQLite row and local list entry both
   * gone, unrecoverable. Deliberately separate from leaveCampaign so the
   * routine "I'm done for tonight" action never destroys data by accident
   * (this used to be exactly what leaveCampaign did for a DM). Leaves the
   * campaign first if it's currently active.
   */
  deleteCampaignPermanently: (id: string) => Promise<void>;

  /**
   * A DM can own/keep several campaigns; one is active at a time. Switches
   * which LOCALLY KNOWN campaign is active. Only an unknown campaign id throws.
   */
  switchToCampaign: (campaignId: string) => Promise<void>;
};

const requiredFor = (ruleset: RulesetId | undefined) => requiredPacksForRuleset(ruleset, installedOfficialPacks());

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  campaigns:      [],
  activeCampaign: null,
  isLoading:      false,
  isDm:           false,

  loadCampaigns: async () => {
    set({ isLoading: true });
    try {
      const campaigns = await loadAllCampaigns();
      const session   = useSessionStore.getState().session;
      const active    = campaigns.find(c => c.id === session?.campaignId) ?? null;
      const isDm      = !!active && !!session && active.dmDeviceId === session.deviceId;
      // Room codes belong to live sessions, which never outlive the app; an older version may have stored one on the campaign.
      if (active && isDm && active.joinCode) { active.joinCode = ''; void saveCampaign(active).catch(() => undefined); }
      set({ campaigns, activeCampaign: active, isDm, isLoading: false });
    } catch (e) {
      console.error('[campaignStore] loadCampaigns failed:', e);
      set({ isLoading: false });
    }
  },

  createCampaign: async (opts) => {
    const session = useSessionStore.getState().session;
    if (!session) throw new Error('No device session. Call initSession() first.');

    const campaign: Campaign = {
      id:           genId(),
      name:         opts.name,
      dmDeviceId:   session.deviceId,
      joinCode:     '',  // kept for file compatibility; live sessions carry their own room code
      rules:        opts.rules ? { ...opts.rules } : { ...DEFAULT_RULES },
      playerIds:    [],
      characterIds: [],
      notes:        '',
      createdAt:    Date.now(),
      ...(opts.description?.trim() ? { description: opts.description.trim() } : {}),
      ...(opts.rulesetId ? { rulesetId: opts.rulesetId } : {}),
      ...(opts.bannedPackIds && opts.bannedPackIds.length > 0 ? { bannedPackIds: opts.bannedPackIds } : {}),
      // The content packs this campaign's ruleset needs, so a player who joins can be told what they lack (content/requiredPacks.ts).
      ...(requiredFor(opts.rulesetId).length > 0 ? { requiredPacks: requiredFor(opts.rulesetId) } : {}),
    };

    // Offline by design: no server, no room code. A live session is started on purpose later, from the campaign screen.
    await saveCampaign(campaign);
    await useSessionStore.getState().setCampaignId(campaign.id);

    set(state => ({
      campaigns:      [...state.campaigns, campaign],
      activeCampaign: campaign,
      isDm:           true,
    }));

    return campaign;
  },

  assignCharacterToCampaign: async (characterId, campaignId) => {
    const campaign = await loadCampaign(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found.`);

    if (!campaign.characterIds.includes(characterId)) {
      const updated: Campaign = {
        ...campaign,
        characterIds: [...campaign.characterIds, characterId],
      };

      await saveCampaign(updated);

      set(state => ({
        campaigns: state.campaigns.map(c => c.id === campaignId ? updated : c),
        activeCampaign:
          state.activeCampaign?.id === campaignId ? updated : state.activeCampaign,
      }));
    }
  },

  setActiveCampaign: (campaign) => {
    const session = useSessionStore.getState().session;
    const isDm = !!campaign && !!session && campaign.dmDeviceId === session.deviceId;
    set({ activeCampaign: campaign, isDm });
  },

  updateCampaign: async (id, updater) => {
    const { campaigns } = get();
    const existing = campaigns.find(c => c.id === id);
    if (!existing) return;

    const updated = updater(existing);
    await saveCampaign(updated);

    set(state => ({
      campaigns: state.campaigns.map(c => c.id === id ? updated : c),
      activeCampaign:
        state.activeCampaign?.id === id ? updated : state.activeCampaign,
    }));
  },

  leaveCampaign: async () => {
    const { activeCampaign } = get();
    if (!activeCampaign) return;

    // Closing never deletes: the campaign's record is untouched and can be
    // reopened via switchToCampaign. See deleteCampaignPermanently.
    set({ activeCampaign: null, isDm: false });
    await useSessionStore.getState().setCampaignId(null);
  },

  deleteCampaignPermanently: async (id) => {
    const { activeCampaign, leaveCampaign } = get();
    if (activeCampaign?.id === id) {
      // Close it first so the session pointer doesn't name a deleted campaign.
      await leaveCampaign();
    }
    await deleteCampaign(id);
    set(state => ({ campaigns: state.campaigns.filter(c => c.id !== id) }));
  },

  switchToCampaign: async (campaignId) => {
    const { campaigns, activeCampaign } = get();
    const session = useSessionStore.getState().session;
    if (!session) throw new Error('No device session. Call initSession() first.');
    if (activeCampaign?.id === campaignId) return; // already active

    const target = campaigns.find(c => c.id === campaignId);
    if (!target) throw new Error(`Campaign ${campaignId} not found locally.`);

    const isDm = target.dmDeviceId === session.deviceId;
    set({ activeCampaign: target, isDm });
    await useSessionStore.getState().setCampaignId(target.id);
  },
}));
