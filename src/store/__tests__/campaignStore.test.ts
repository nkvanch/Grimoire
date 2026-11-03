// src/store/__tests__/campaignStore.test.ts
// Locks in the fix for a real data-loss bug: leaveCampaign used to
// permanently DELETE the campaign whenever the DM left, which meant a DM
// could never own more than one campaign at a time. Leaving is
// non-destructive for both roles; deleteCampaignPermanently is the separate,
// explicit action for actual deletion; switchToCampaign moves between
// locally-known campaigns without losing any of them.
//
// A campaign is offline state only. Playing it live is a separate live
// session (src/session), so nothing here opens a socket or a room code.
import { useCampaignStore } from '../campaignStore';
import { useSessionStore } from '../sessionStore';
import * as campaignRepo from '../../db/campaignRepo';
import { DEFAULT_RULES } from '../characterStore';
import { Campaign, DeviceSession } from '../../engine/types';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp1', name: 'Test Campaign', dmDeviceId: 'dm-device', joinCode: 'ABC1234',
    rules: { ...DEFAULT_RULES }, playerIds: [], characterIds: [], notes: '', createdAt: 0,
    ...overrides,
  };
}

function dmSession(): DeviceSession {
  return { deviceId: 'dm-device', nickname: 'DM', role: 'dm', campaignId: 'camp1' };
}

describe('campaignStore', () => {
  let saveCampaignSpy: jest.SpyInstance;
  let deleteCampaignSpy: jest.SpyInstance;
  // A fresh mock per test, set on the store itself: a spy installed on one zustand state object is carried into
  // every later state object, so its calls would pile up across tests.
  let setCampaignIdSpy: jest.Mock;
  const originalSetCampaignId = useSessionStore.getState().setCampaignId;

  beforeEach(() => {
    saveCampaignSpy   = jest.spyOn(campaignRepo, 'saveCampaign').mockResolvedValue(undefined);
    deleteCampaignSpy = jest.spyOn(campaignRepo, 'deleteCampaign').mockResolvedValue(undefined);
    setCampaignIdSpy  = jest.fn().mockResolvedValue(undefined);
    useSessionStore.setState({ session: dmSession(), setCampaignId: setCampaignIdSpy });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
  });

  afterAll(() => {
    useSessionStore.setState({ setCampaignId: originalSetCampaignId });
  });

  describe('leaveCampaign — no longer destructive (the actual bug fix)', () => {
    it('a DM leaving keeps the campaign in the list — it used to be permanently deleted', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().leaveCampaign();

      expect(deleteCampaignSpy).not.toHaveBeenCalled();
      expect(useCampaignStore.getState().campaigns).toEqual([campaign]);
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
      expect(useCampaignStore.getState().isDm).toBe(false);
      expect(setCampaignIdSpy).toHaveBeenCalledWith(null);
    });

    it('a player leaving also keeps the campaign in the list', async () => {
      const campaign = makeCampaign({ dmDeviceId: 'someone-else' });
      useSessionStore.setState({ session: { ...dmSession(), deviceId: 'player-device' } });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().leaveCampaign();

      expect(deleteCampaignSpy).not.toHaveBeenCalled();
      expect(useCampaignStore.getState().campaigns).toEqual([campaign]);
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
    });

    it('is a no-op when there is no active campaign', async () => {
      await useCampaignStore.getState().leaveCampaign();
      expect(setCampaignIdSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteCampaignPermanently — the explicit destructive action', () => {
    it('actually removes the campaign from SQLite and the local list', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().deleteCampaignPermanently('camp1');

      expect(deleteCampaignSpy).toHaveBeenCalledWith('camp1');
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });

    it('closes the campaign first if it is currently active, before deleting it', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().deleteCampaignPermanently('camp1');

      expect(setCampaignIdSpy).toHaveBeenCalledWith(null);
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });
  });

  describe('switchToCampaign — a DM can own several campaigns, one active at a time', () => {
    it('opens the target campaign without losing either', async () => {
      const campaignA = makeCampaign({ id: 'campA', name: 'Campaign A' });
      const campaignB = makeCampaign({ id: 'campB', name: 'Campaign B', joinCode: '' });
      useCampaignStore.setState({ campaigns: [campaignA, campaignB], activeCampaign: campaignA, isDm: true });

      await useCampaignStore.getState().switchToCampaign('campB');

      expect(useCampaignStore.getState().activeCampaign?.id).toBe('campB');
      expect(useCampaignStore.getState().isDm).toBe(true);
      expect(setCampaignIdSpy).toHaveBeenCalledWith('campB');
      expect(useCampaignStore.getState().campaigns.map(c => c.id).sort()).toEqual(['campA', 'campB']);
    });

    it('is not the DM of a campaign this device does not own', async () => {
      const joined = makeCampaign({ id: 'joined1', dmDeviceId: 'the-real-dm', joinCode: 'ZZZ9999' });
      useCampaignStore.setState({ campaigns: [joined], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().switchToCampaign('joined1');

      expect(useCampaignStore.getState().activeCampaign?.id).toBe('joined1');
      expect(useCampaignStore.getState().isDm).toBe(false);
    });

    it('throws for a campaign id this device has never seen locally', async () => {
      useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
      await expect(useCampaignStore.getState().switchToCampaign('nope')).rejects.toThrow();
    });

    it('is a no-op when the target is already the active campaign', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().switchToCampaign('camp1');

      expect(setCampaignIdSpy).not.toHaveBeenCalled();
    });
  });

  describe('assignCharacterToCampaign', () => {
    it('adds the character to the campaign once and saves it', async () => {
      const campaign = makeCampaign();
      jest.spyOn(campaignRepo, 'loadCampaign').mockResolvedValue(campaign);
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().assignCharacterToCampaign('char1', 'camp1');

      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ characterIds: ['char1'] }));
      expect(useCampaignStore.getState().activeCampaign?.characterIds).toEqual(['char1']);
    });
  });

  describe('createCampaign — Create Campaign wizard options (CREATE_CAMPAIGN_FLOW_SPEC.md)', () => {
    it('persists description, rulesetId and bannedPackIds when given, and omits them when not', async () => {
      const full = await useCampaignStore.getState().createCampaign({
        name: 'Full Campaign', description: 'A tale of woe', rulesetId: 'dnd5e-2024' as never, bannedPackIds: ['pack1'],
      });
      expect(full.description).toBe('A tale of woe');
      expect(full.rulesetId).toBe('dnd5e-2024');
      expect(full.bannedPackIds).toEqual(['pack1']);

      const bare = await useCampaignStore.getState().createCampaign({ name: 'Bare Campaign' });
      expect(bare.description).toBeUndefined();
      expect(bare.rulesetId).toBeUndefined();
      expect(bare.bannedPackIds).toBeUndefined();
    });

    it('uses a given `rules` object verbatim instead of DEFAULT_RULES — the wizard\'s chosen profile is copied in, not referenced', async () => {
      const customRules = { ...DEFAULT_RULES, maxLevel: 10, allowMulticlass: true, customRules: { lockPlayerFreeEdit: true } };
      const campaign = await useCampaignStore.getState().createCampaign({ name: 'Low Level', rules: customRules });
      expect(campaign.rules).toEqual(customRules);
      expect(campaign.rules).not.toBe(customRules);   // saved via the normal campaign object, not aliased
    });

    it('with no `rules` given, falls back to DEFAULT_RULES exactly as before', async () => {
      const campaign = await useCampaignStore.getState().createCampaign({ name: 'Defaults Only' });
      expect(campaign.rules).toEqual(DEFAULT_RULES);
    });

    it('trims a blank description down to omitted rather than storing whitespace', async () => {
      const campaign = await useCampaignStore.getState().createCampaign({ name: 'Blank Desc', description: '   ' });
      expect(campaign.description).toBeUndefined();
    });
  });

  describe('offline campaign', () => {
    it('createCampaign works with no network: no room code, persisted, active, DM context set', async () => {
      const c = await useCampaignStore.getState().createCampaign({ name: 'Offline Campaign' });
      expect(c.joinCode).toBe('');
      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, joinCode: '' }));
      const state = useCampaignStore.getState();
      expect(state.activeCampaign?.id).toBe(c.id);
      expect(state.isDm).toBe(true);
      expect(setCampaignIdSpy).toHaveBeenCalledWith(c.id);
    });

    it('an offline campaign is restored after a restart as the active DM campaign', async () => {
      const created = makeCampaign({ id: 'camp1', joinCode: '' });
      jest.spyOn(campaignRepo, 'loadAllCampaigns').mockResolvedValue([created]);
      useSessionStore.setState({ session: dmSession() });

      await useCampaignStore.getState().loadCampaigns();

      const state = useCampaignStore.getState();
      expect(state.activeCampaign?.id).toBe('camp1');
      expect(state.isDm).toBe(true);
    });

    it('a room code an older version stored on the campaign is dropped when the DM campaign loads', async () => {
      jest.spyOn(campaignRepo, 'loadAllCampaigns').mockResolvedValue([makeCampaign({ joinCode: 'OLD1234' })]);
      await useCampaignStore.getState().loadCampaigns();
      expect(useCampaignStore.getState().activeCampaign?.joinCode).toBe('');
    });

    it('updateCampaign saves and updates both the list and the active campaign', async () => {
      const campaign = makeCampaign({ notes: 'old notes' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().updateCampaign('camp1', c => ({ ...c, notes: 'new notes' }));

      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ notes: 'new notes' }));
      expect(useCampaignStore.getState().campaigns[0].notes).toBe('new notes');
      expect(useCampaignStore.getState().activeCampaign?.notes).toBe('new notes');
    });
  });
});
