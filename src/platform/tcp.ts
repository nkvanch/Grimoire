// ============================================================================
// FILE: src/platform/tcp.ts
// Whether live sessions can open network connections on this device: the native TCP module is linked on a phone, or the desktop
// app's bridge is present (see platform/desktop.ts). A plain browser has neither.
// ============================================================================
import { NativeModules } from 'react-native';
import { desktopBridge } from './desktop';

export function tcpAvailable(): boolean {
  return !!NativeModules.TcpSockets || !!desktopBridge()?.tcp;
}
