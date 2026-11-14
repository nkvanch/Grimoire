// Contract LIVE-TRUST-002: live play says it is for networks you trust before a room is opened, when joining, and while one is open.
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-qrcode-svg', () => ({ __esModule: true, default: () => null }));
jest.mock('../../QrScannerModal', () => ({ QrScannerModal: () => null }));
jest.mock('../../../db/packRegistryRepo', () => ({ loadInstalledPacks: () => Promise.resolve([]) }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { HostModal, JoinModal } from '../LiveSessionStart';
import { LiveSessionStatus } from '../LiveSessionStatus';
import { useSessionRuntime } from '../../../session/runtime';
import { TRUSTED_NETWORK_NOTICE } from '../LiveUi';

const shows = async (element: React.ReactElement): Promise<boolean> => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(element); });
  const found = tree.root.findAll(n => n.props?.testID === 'live-trusted-network').length > 0;
  await act(async () => { tree.unmount(); });
  return found;
};

describe('the trusted-network notice (LIVE-TRUST-002)', () => {
  it('says what anyone on the network can do, and that a connection is protected only when both devices support it', () => {
    expect(TRUSTED_NETWORK_NOTICE).toMatch(/networks you trust/);
    expect(TRUSTED_NETWORK_NOTICE).toMatch(/protected only when both devices support it/);
  });

  it('is shown before hosting starts', async () => {
    expect(await shows(<HostModal visible onClose={() => undefined} nickname="Pat" />)).toBe(true);
  });

  it('is shown when joining', async () => {
    expect(await shows(<JoinModal visible onClose={() => undefined} nickname="Pat" />)).toBe(true);
  });

  it('is shown while a session is open', async () => {
    useSessionRuntime.setState({ mode: 'joined', status: 'connected', capabilities: ['player'], view: null, address: '10.0.0.5:7743' });
    expect(await shows(<LiveSessionStatus />)).toBe(true);
    useSessionRuntime.setState({ mode: 'idle', status: 'disconnected', capabilities: [], address: null });
  });
});
