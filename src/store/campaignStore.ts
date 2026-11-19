// ============================================================================
// FILE: src/store/campaignStore.ts
// Campaign + DM identity state management. A campaign is offline state on this
// device; playing over LAN is a Live Session (src/session).
// ============================================================================
import { requiredPacksForRuleset } from '../content/requiredPacks';
import { installedOfficialPacks } from '../content/officialPackService';
import { create } from 'zustand';
import { Campaign, CampaignRules, RulesetId } from '../engine/types';
import { saveCampaign, loadAllCampaigns, deleteCampaign, loadCampaign } from '../db/campaignRepo';
import { useDeviceStore } from './deviceStore';
import { useCharacterStore } from './characterStore';
import { DEFAULT_RULES } from '../engine/defaults';
import { campaignAdmission } from '../engine/campaignLock';
import { RULESET_REVISION } from '../engine/ruleset/dnd5eOperations';

// ── Defaults ──────────────────────────────────────────────────────────────────
// DEFAULT_RULES is defined once in engine/defaults.ts and imported here so a single
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

  /** Set the active campaign. */
  setActiveCampaign: (campaign: Campaign | null) => void;

  /** Update campaign fields (name, rules, notes, etc.). */
  updateCampaign: (id: string, updater: (c: Campaign) => Campaign) => Promise<void>;

  /**
   * Clear the active campaign — does NOT delete it. The campaign stays in `campaigns` (and SQLite) and can be opened again
   * later via switchToCampaign.
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
   * A device can keep several campaigns but has one active at a time. Switches which LOCALLY KNOWN campaign is active;
   * only an unknown campaign id throws.
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
      const session   = useDeviceStore.getState().session;
      const active    = campaigns.find(c => c.id === session?.campaignId) ?? null;
      const isDm      = !!active && !!session && active.dmDeviceId === session.deviceId;
      set({ campaigns, activeCampaign: active, isDm, isLoading: false });
    } catch (e) {
      console.error('[campaignStore] loadCampaigns failed:', e);
      set({ isLoading: false });
    }
  },

  createCampaign: async (opts) => {
    const session = useDeviceStore.getState().session;
    if (!session) throw new Error('No device session. Call initSession() first.');

    const campaign: Campaign = {
      id:           genId(),
      name:         opts.name,
      dmDeviceId:   session.deviceId,
      joinCode:     '',
      rules:        opts.rules ? { ...opts.rules } : { ...DEFAULT_RULES },
      playerIds:    [],
      characterIds: [],
      notes:        '',
      createdAt:    Date.now(),
      ...(opts.description?.trim() ? { description: opts.description.trim() } : {}),
      ...(opts.rulesetId ? { rulesetId: opts.rulesetId, rulesetRevision: RULESET_REVISION[opts.rulesetId] ?? '1' } : {}),
      ...(opts.bannedPackIds && opts.bannedPackIds.length > 0 ? { bannedPackIds: opts.bannedPackIds } : {}),
      // The content packs this campaign's ruleset needs (content/requiredPacks.ts).
      ...(requiredFor(opts.rulesetId).length > 0 ? { requiredPacks: requiredFor(opts.rulesetId) } : {}),
    };

    await saveCampaign(campaign);
    await useDeviceStore.getState().setCampaignId(campaign.id);

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
      // a campaign locked to a ruleset admits only characters of it (LIFE-004)
      const character = useCharacterStore.getState().characters.find(c => c.id === characterId);
      const refusal = character ? campaignAdmission(campaign, character) : '';
      if (refusal) throw new Error(refusal);
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
    const session = useDeviceStore.getState().session;
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
    if (!get().activeCampaign) return;
    // Leaving only clears the active reference; the campaign's own record is untouched (see deleteCampaignPermanently).
    set({ activeCampaign: null, isDm: false });
    await useDeviceStore.getState().setCampaignId(null);
  },

  deleteCampaignPermanently: async (id) => {
    const { activeCampaign, leaveCampaign } = get();
    if (activeCampaign?.id === id) await leaveCampaign();
    await deleteCampaign(id);
    set(state => ({ campaigns: state.campaigns.filter(c => c.id !== id) }));
  },

  switchToCampaign: async (campaignId) => {
    const { campaigns, activeCampaign } = get();
    const session = useDeviceStore.getState().session;
    if (!session) throw new Error('No device session. Call initSession() first.');
    if (activeCampaign?.id === campaignId) return; // already active

    const target = campaigns.find(c => c.id === campaignId);
    if (!target) throw new Error(`Campaign ${campaignId} not found locally.`);

    set({ activeCampaign: target, isDm: target.dmDeviceId === session.deviceId });
    await useDeviceStore.getState().setCampaignId(target.id);
  },
}));
