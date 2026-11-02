// Campaigns in personal backups: a lost or reset phone used to lose every campaign, since backups carried only
// characters and homebrew and there is no cloud copy by design.
import { createBackupPack, createContentPack, validateGrimoirePack, validatePackContents, countCampaignData, BackupCampaignData, GrimoirePack } from '../backup';
import { DEFAULT_RULES } from '../../store/characterStore';
import { Campaign, PreparedEncounter, CustomRuleProfile } from '../types';
import type { CampaignPrep } from '../../session/prep';

const campaign = (id: string): Campaign => ({
  id, name: `Campaign ${id}`, dmDeviceId: 'dev-a', joinCode: '', rules: { ...DEFAULT_RULES },
  playerIds: [], characterIds: ['c1'], notes: 'secret plot', createdAt: 1,
});

function data(): BackupCampaignData {
  return {
    campaigns: [campaign('k1'), campaign('k2')],
    preparedEncounters: [{ id: 'e1', name: 'Ambush', tags: [], status: 'draft', combatants: [], groups: [], waves: [] } as unknown as PreparedEncounter],
    customRuleProfiles: [{ id: 'p1', name: 'Gritty', gameId: 'dnd' as never, baseRulesetId: 'dnd5e-2014' as never, rules: {}, source: { kind: 'local' }, createdAt: 1, updatedAt: 1 } as CustomRuleProfile],
    livePrep: [{ schema: 1, campaignId: 'k1', name: 'Campaign k1' } as unknown as CampaignPrep],
  };
}

describe('campaign data in a personal backup', () => {
  it('createBackupPack carries it, and an envelope without it stays valid', () => {
    const pack = createBackupPack([], {}, 'dev-a', '0.2.4', data());
    expect(pack.campaignData?.campaigns.map(c => c.id)).toEqual(['k1', 'k2']);
    expect(pack.campaignData?.campaigns[0].notes).toBe('secret plot');   // the DM's own notes are part of the DM's own backup
    expect(validateGrimoirePack(pack)).toBeNull();
    expect(validatePackContents(pack)).toEqual([]);

    const old = createBackupPack([], {}, 'dev-a', '0.2.3');
    expect(old.campaignData).toBeUndefined();
    expect(validateGrimoirePack(old)).toBeNull();
  });

  it('survives a JSON round trip unchanged', () => {
    const pack = createBackupPack([], {}, 'dev-a', '0.2.4', data());
    const back = JSON.parse(JSON.stringify(pack)) as GrimoirePack;
    expect(back.campaignData).toEqual(pack.campaignData);
  });

  it('counts what it carries', () => {
    expect(countCampaignData(data())).toEqual({ campaigns: 2, encounters: 1, ruleProfiles: 1, livePrep: 1 });
    expect(countCampaignData(undefined)).toEqual({ campaigns: 0, encounters: 0, ruleProfiles: 0, livePrep: 0 });
  });

  it('a shared content pack may not carry campaigns', () => {
    const pack = { ...createContentPack({}, null, '0.2.4'), campaignData: data() };
    expect(validateGrimoirePack(pack)).toMatch(/Only a personal backup/);
  });

  it('a damaged campaign section is refused before anything is written', () => {
    const notObject = { ...createBackupPack([], {}, null, '0.2.4'), campaignData: 'oops' };
    expect(validateGrimoirePack(notObject)).toMatch(/damaged/);
    const notArray = { ...createBackupPack([], {}, null, '0.2.4'), campaignData: { campaigns: {} } };
    expect(validateGrimoirePack(notArray)).toMatch(/damaged/);
  });

  it('a campaign, encounter, profile or preparation missing its identity is reported', () => {
    const bad = data();
    bad.campaigns.push({ name: 'No id' } as unknown as Campaign);
    bad.preparedEncounters.push({ name: 'No id' } as unknown as PreparedEncounter);
    bad.customRuleProfiles.push({ id: 'p2', name: 'No rules' } as unknown as CustomRuleProfile);
    bad.livePrep.push({ name: 'No campaign' } as unknown as CampaignPrep);
    const problems = validatePackContents(createBackupPack([], {}, null, '0.2.4', bad));
    expect(problems).toHaveLength(4);
    expect(problems[0]).toMatch(/campaign "No id"/);
  });
});
