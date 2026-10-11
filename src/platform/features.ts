// What the running platform can do. The web build (the PC version) has no raw network sockets or camera yet, so the
// live-session screens are hidden there instead of failing when tapped.
import { Platform } from 'react-native';

/** Hosting or joining a live session over the local network (TCP) and scanning a join QR code. */
export const LAN_SESSIONS_AVAILABLE = Platform.OS !== 'web';
