// End-to-end regression for the Create Campaign device failure: completing the normal wizard must land on an OFFLINE DM campaign
// (Host Live Table offered, nothing hosting, no room code), and hosting happens only through the explicit Host Live Table button,
// which opens the live-session host sheet pre-set to Host + DM. The store tests alone passed while the device showed "Stop Hosting",
// because the screen drew an unconditional Stop Hosting button, so this renders the real screen and presses the real buttons.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('../components/live/LiveSessionStart', () => {
  const { Text } = require('react-native');
  return {
    HostModal: ({ visible, initialRole }: { visible: boolean; initialRole?: string }) => (visible ? <Text>{`HOST-SHEET ${initialRole ?? ''}`}</Text> : null),
    JoinModal: () => null,
  };
});
jest.mock('../components/live/LiveSessionStatus', () => { const { Text } = require('react-native'); return { LiveSessionStatus: () => <Text>LIVE-STATUS</Text> }; });
jest.mock('../components/CampaignPacksNote', () => ({ CampaignPacksNote: () => null }));
jest.mock('../db/packRegistryRepo', () => ({ loadInstalledPacks: () => Promise.resolve([]) }));
jest.mock('../db/customRuleProfileRepo', () => ({ loadCustomRuleProfiles: () => Promise.resolve([]), saveCustomRuleProfile: jest.fn(), deleteCustomRuleProfile: jest.fn() }));
jest.mock('../utils/alert', () => ({
  // confirmations are answered with the destructive/confirming button, as a user pressing it would
  Alert: { alert: jest.fn((_t: string, _m?: string, buttons?: { text: string; style?: string; onPress?: () => void }[]) => { (buttons?.find(b => b.style === 'destructive') ?? buttons?.find(b => b.style !== 'cancel'))?.onPress?.(); }) },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import CampaignsScreen from '../../app/(tabs)/campaigns';
import { useCampaignStore } from '../store/campaignStore';
import { useSessionStore } from '../store/sessionStore';
import { useSessionRuntime } from '../session/runtime';
import * as campaignRepo from '../db/campaignRepo';
import { Campaign } from '../engine/types';

const texts = (r: TestRenderer.ReactTestRenderer): string[] => {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') { out.push(n); return; }
    if (!n || typeof n !== 'object') return;
    ((n as { children?: unknown[] }).children ?? []).forEach(walk);
  };
  walk(r.toJSON());
  return out;
};
const screenText = (r: TestRenderer.ReactTestRenderer) => texts(r).join(' | ');
const byId = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function' || n.props.testID === id && typeof n.props.onChangeText === 'function')[0];
const hasId = (r: TestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id).length > 0;
const press = (r: TestRenderer.ReactTestRenderer, id: string) => act(async () => { await byId(r, id).props.onPress(); });
const pressLabel = (r: TestRenderer.ReactTestRenderer, label: string) => {
  const btn = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => c.children.includes(label)).length > 0)[0];
  if (!btn) throw new Error(`no pressable "${label}" in: ${screenText(r)}`);
  return act(async () => { await btn.props.onPress(); });
};

let saved: Campaign[];

function resetStores() {
  useCampaignStore.setState({ campaigns: [], activeCampaign: null, isDm: false });
  useSessionRuntime.setState({ mode: 'idle', roomCode: null, address: null, view: null, participantId: null, capabilities: [] });
}

beforeEach(() => {
  saved = [];
  jest.spyOn(campaignRepo, 'saveCampaign').mockImplementation(async c => { saved = [...saved.filter(x => x.id !== c.id), JSON.parse(JSON.stringify(c))]; });
  jest.spyOn(campaignRepo, 'loadAllCampaigns').mockImplementation(async () => JSON.parse(JSON.stringify(saved)));
  // the device session is persisted, so the active campaign id survives a restart exactly as it does on the device
  jest.spyOn(useSessionStore.getState(), 'setCampaignId').mockImplementation(async id => {
    useSessionStore.setState(st => ({ session: st.session ? { ...st.session, campaignId: id } : st.session }));
  });
  useSessionStore.setState({ session: { deviceId: 'dm-device', nickname: 'DM', role: 'dm', campaignId: null } as never });
  resetStores();
});
const mounted: TestRenderer.ReactTestRenderer[] = [];
afterEach(() => { for (const r of mounted.splice(0)) act(() => { r.unmount(); }); jest.restoreAllMocks(); resetStores(); });

async function createNamed(r: TestRenderer.ReactTestRenderer, name: string) {
  await pressLabel(r, '👑 Create Campaign');
  await act(async () => { byId(r, 'wiz-name').props.onChangeText(name); });
  for (let i = 0; i < 4; i++) await press(r, 'wiz-next');
  await press(r, 'wiz-create');
}

async function mountAndCreate(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<CampaignsScreen />); await Promise.resolve(); });
  mounted.push(r);
  expect(screenText(r)).toContain('No Active Campaign');
  await pressLabel(r, '👑 Create Campaign');
  await act(async () => { byId(r, 'wiz-name').props.onChangeText('OfflineAudit'); });
  for (let i = 0; i < 4; i++) await press(r, 'wiz-next');          // Basics, Rules, Permissions, Content, Review
  await press(r, 'wiz-create');
  return r;
}

describe('Create Campaign wizard, through the real screen', () => {
  it('finishing the wizard lands on an offline DM campaign: Host Live Table offered, nothing hosting', async () => {
    const r = await mountAndCreate();
    const t = screenText(r);

    // what the user sees
    expect(t).toContain('OfflineAudit');
    expect(t).toContain('Open DM Dashboard');
    expect(hasId(r, 'campaign-host-live-session')).toBe(true);
    expect(t).toContain('📡 Host Live Table');
    expect(t).not.toContain('Stop Hosting');
    expect(t).not.toContain('(advanced)');                       // one way to host, not two
    expect(hasId(r, 'campaign-host-session')).toBe(false);       // the old campaign-sync button is gone
    expect(t).not.toContain('ROOM CODE');
    expect(t).not.toContain('LIVE-STATUS');
    expect(t).toContain('Offline campaign. No live table running.');

    // what actually exists, independent of any button text
    const s = useCampaignStore.getState();
    expect(s.activeCampaign?.name).toBe('OfflineAudit');
    expect(s.isDm).toBe(true);
    expect(s.activeCampaign?.joinCode).toBe('');
    expect(saved).toHaveLength(1);
    expect(saved[0].joinCode).toBe('');
    expect(useSessionRuntime.getState().mode).toBe('idle');

    // the DM tools do not depend on a session
    await pressLabel(r, '🎲 Open DM Dashboard');
    expect(mockPush).toHaveBeenCalledWith('/dm/dashboard');
  });

  it('Host Live Table opens the live-session host sheet pre-set to Host + DM', async () => {
    const r = await mountAndCreate();
    expect(screenText(r)).not.toContain('HOST-SHEET');
    await press(r, 'campaign-host-live-session');
    expect(screenText(r)).toContain('HOST-SHEET host+dm');
  });

  it('while a live table runs, the campaign shows its status card and an Open Live Table button instead of Host', async () => {
    const r = await mountAndCreate();
    await act(async () => { useSessionRuntime.setState({ mode: 'hosting', roomCode: 'ROOM123' }); });

    const t = screenText(r);
    expect(t).toContain('LIVE-STATUS');
    expect(t).toContain('A live table is running on this device');
    expect(hasId(r, 'campaign-host-live-session')).toBe(false);
    await press(r, 'campaign-open-live-table');
    expect(mockPush).toHaveBeenCalledWith('/live');
  });
});

describe('restart', () => {
  async function coldBoot() {
    // a new process: the stores start empty, the database is what survives (the layout runs loadCampaigns)
    for (const m of mounted.splice(0)) act(() => { m.unmount(); });
    resetStores();
    await useCampaignStore.getState().loadCampaigns();
  }

  it('an offline campaign comes back offline: restored, DM-owned, nothing hosting', async () => {
    await mountAndCreate();
    await coldBoot();
    const s = useCampaignStore.getState();
    expect(s.activeCampaign?.name).toBe('OfflineAudit');
    expect(s.isDm).toBe(true);
    expect(useSessionRuntime.getState().mode).toBe('idle');
    const r = await (async () => { let x!: TestRenderer.ReactTestRenderer; await act(async () => { x = TestRenderer.create(<CampaignsScreen />); await Promise.resolve(); }); mounted.push(x); return x; })();
    expect(screenText(r)).not.toContain('Stop Hosting');
    expect(hasId(r, 'campaign-host-live-session')).toBe(true);
  });

  it('a room code an older version stored on the campaign is discarded on load', async () => {
    await mountAndCreate();
    saved = saved.map(c => ({ ...c, joinCode: 'OLD1234' }));

    await coldBoot();

    expect(useCampaignStore.getState().activeCampaign?.joinCode).toBe('');
    let x!: TestRenderer.ReactTestRenderer;
    await act(async () => { x = TestRenderer.create(<CampaignsScreen />); await Promise.resolve(); });
    mounted.push(x);
    expect(screenText(x)).not.toContain('OLD1234');
    expect(hasId(x, 'campaign-host-live-session')).toBe(true);
  });
});

describe('leaving a campaign (the navigation trap)', () => {
  it('Close Campaign returns to Create / Open Existing with the campaign kept, so a second campaign can be started or the first reopened', async () => {
    const r = await mountAndCreate();
    expect(hasId(r, 'campaign-close')).toBe(true);
    await press(r, 'campaign-close');

    let t = screenText(r);
    expect(t).toContain('No Active Campaign');
    expect(t).toContain('👑 Create Campaign');
    expect(t).toContain('Open Existing Campaign');
    expect(useCampaignStore.getState().activeCampaign).toBeNull();
    expect(useCampaignStore.getState().campaigns.map(c => c.name)).toEqual(['OfflineAudit']);   // kept, not deleted
    expect(saved.map(c => c.name)).toEqual(['OfflineAudit']);

    await createNamed(r, 'SecondCampaign');                                                       // a second, separate campaign
    t = screenText(r);
    expect(t).toContain('SecondCampaign');
    expect(useCampaignStore.getState().campaigns.map(c => c.name).sort()).toEqual(['OfflineAudit', 'SecondCampaign']);
    expect(hasId(r, 'campaign-host-live-session')).toBe(true);

    await press(r, 'campaign-close');
    await pressLabel(r, 'Open Existing Campaign');
    expect(screenText(r)).toContain('OfflineAudit');
    expect(screenText(r)).toContain('SecondCampaign');
  });
});
