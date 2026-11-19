// src/store/__tests__/campaignStore.test.ts
// First test coverage for this store. Locks in the fix for a real data-loss
// bug: leaveCampaign used to permanently DELETE the campaign whenever the
// DM left, which meant a DM could never own more than one campaign at a
// time — creating a second campaign required destroying the first, since
// there was no other way to "leave" one. Leaving is now non-destructive for
// both roles; deleteCampaignPermanently is the new, separate, explicit
// action for actual deletion; switchToCampaign lets a DM (or player) move
// between locally-known campaigns without losing any of them.
import { useCampaignStore } from '../campaignStore';
import { useDeviceStore } from '../deviceStore';
import * as campaignRepo from '../../db/campaignRepo';
import { useCharacterStore } from '../characterStore';
import { DEFAULT_RULES, makeEmptyEntity } from '../../engine/defaults';
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
  let setCampaignIdSpy: jest.SpyInstance;

  beforeEach(() => {
    saveCampaignSpy   = jest.spyOn(campaignRepo, 'saveCampaign').mockResolvedValue(undefined);
    deleteCampaignSpy = jest.spyOn(campaignRepo, 'deleteCampaign').mockResolvedValue(undefined);
    setCampaignIdSpy  = jest.spyOn(useDeviceStore.getState(), 'setCampaignId').mockResolvedValue(undefined);
    // setState below copies the spy into a new state object, which restoreAllMocks cannot reach: start each test with no calls.
    setCampaignIdSpy.mockClear();
    useDeviceStore.setState({ session: dmSession() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
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

    it('a player leaving also keeps the campaign in the list (unchanged behavior)', async () => {
      const campaign = makeCampaign({ dmDeviceId: 'someone-else' });
      useDeviceStore.setState({ session: { ...dmSession(), deviceId: 'player-device' } });
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

  describe('deleteCampaignPermanently — the new, explicit destructive action', () => {
    it('actually removes the campaign from SQLite and the local list', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().deleteCampaignPermanently('camp1');

      expect(deleteCampaignSpy).toHaveBeenCalledWith('camp1');
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });

    it('leaves the campaign first if it is currently active, before deleting it', async () => {
      const campaign = makeCampaign();
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().deleteCampaignPermanently('camp1');

      expect(setCampaignIdSpy).toHaveBeenCalledWith(null);
      expect(useCampaignStore.getState().activeCampaign).toBeNull();
      expect(useCampaignStore.getState().isDm).toBe(false);
      expect(useCampaignStore.getState().campaigns).toEqual([]);
    });
  });

  describe('switchToCampaign — a device keeps several campaigns, one active at a time', () => {
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

    it('opens a campaign this device does not own as a player, not as its DM', async () => {
      const joined = makeCampaign({ id: 'joined1', dmDeviceId: 'the-real-dm', joinCode: 'ZZZ9999' });
      useCampaignStore.setState({ campaigns: [joined], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().switchToCampaign('joined1');

      expect(useCampaignStore.getState().activeCampaign?.id).toBe('joined1');
      expect(useCampaignStore.getState().isDm).toBe(false);
      expect(setCampaignIdSpy).toHaveBeenCalledWith('joined1');
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
    it('adds the character to the saved campaign and to the active copy, once', async () => {
      const campaign = makeCampaign();
      const loadSpy = jest.spyOn(campaignRepo, 'loadCampaign').mockResolvedValue(campaign);
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: false });

      await useCampaignStore.getState().assignCharacterToCampaign('char1', 'camp1');

      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'camp1', characterIds: ['char1'] }));
      expect(useCampaignStore.getState().activeCampaign?.characterIds).toEqual(['char1']);
      expect(useCampaignStore.getState().campaigns[0].characterIds).toEqual(['char1']);

      loadSpy.mockResolvedValue(makeCampaign({ characterIds: ['char1'] }));
      await useCampaignStore.getState().assignCharacterToCampaign('char1', 'camp1');
      expect(saveCampaignSpy).toHaveBeenCalledTimes(1);
    });

    it('a campaign locked to a ruleset refuses a character of another one, and changes nothing (LIFE-004)', async () => {
      jest.spyOn(campaignRepo, 'loadCampaign').mockResolvedValue(makeCampaign({ rulesetId: 'dnd5e-2024' as never, rulesetRevision: '1' }));
      const old = makeEmptyEntity('char2014', 'character');
      useCharacterStore.setState({ characters: [{ ...old, rulesetId: 'dnd5e-2014' as never }, { ...old, id: 'char2024', rulesetId: 'dnd5e-2024' as never }] });
      useCampaignStore.setState({ isDm: false });

      await expect(useCampaignStore.getState().assignCharacterToCampaign('char2014', 'camp1'))
        .rejects.toThrow('This campaign is locked to dnd5e-2024, and this character is dnd5e-2014.');
      expect(saveCampaignSpy).not.toHaveBeenCalled();
      await useCampaignStore.getState().assignCharacterToCampaign('char2024', 'camp1');
      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ characterIds: ['char2024'] }));
      useCharacterStore.setState({ characters: [] });
    });
  });

  describe('createCampaign — Create Campaign wizard options (CREATE_CAMPAIGN_FLOW_SPEC.md)', () => {
    it('persists description, rulesetId and bannedPackIds when given, and omits them when not', async () => {
      const full = await useCampaignStore.getState().createCampaign({
        name: 'Full Campaign', description: 'A tale of woe', rulesetId: 'dnd5e-2024' as never, bannedPackIds: ['pack1'],
      });
      expect(full.description).toBe('A tale of woe');
      expect(full.rulesetId).toBe('dnd5e-2024');
      expect(full.rulesetRevision).toBe('1');          // the campaign is locked to the ruleset at the revision it has now (LIFE-004)
      expect(full.bannedPackIds).toEqual(['pack1']);

      const bare = await useCampaignStore.getState().createCampaign({ name: 'Bare Campaign' });
      expect(bare.description).toBeUndefined();
      expect(bare.rulesetId).toBeUndefined();
      expect(bare.rulesetRevision).toBeUndefined();
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

  describe('a campaign is offline state', () => {
    it('createCampaign persists the campaign with no room code, makes it active and sets the DM context', async () => {
      const c = await useCampaignStore.getState().createCampaign({ name: 'Offline Campaign' });
      expect(c.joinCode).toBe('');
      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, joinCode: '' }));
      const state = useCampaignStore.getState();
      expect(state.activeCampaign?.id).toBe(c.id);
      expect(state.isDm).toBe(true);
      expect(setCampaignIdSpy).toHaveBeenCalledWith(c.id);
    });

    it('the active campaign is restored after a restart, with the DM context', async () => {
      const created = makeCampaign({ id: 'camp1', joinCode: '' });
      jest.spyOn(campaignRepo, 'loadAllCampaigns').mockResolvedValue([created]);
      useDeviceStore.setState({ session: dmSession() });
      useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });

      await useCampaignStore.getState().loadCampaigns();

      const state = useCampaignStore.getState();
      expect(state.campaigns).toEqual([created]);
      expect(state.activeCampaign?.id).toBe('camp1');
      expect(state.isDm).toBe(true);
    });

    it('updateCampaign saves the change and updates both the list and the active copy', async () => {
      const campaign = makeCampaign({ notes: 'old notes' });
      useCampaignStore.setState({ campaigns: [campaign], activeCampaign: campaign, isDm: true });

      await useCampaignStore.getState().updateCampaign('camp1', c => ({ ...c, notes: 'new notes' }));

      expect(saveCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'camp1', notes: 'new notes' }));
      expect(useCampaignStore.getState().campaigns[0].notes).toBe('new notes');
      expect(useCampaignStore.getState().activeCampaign?.notes).toBe('new notes');
    });
  });
});
