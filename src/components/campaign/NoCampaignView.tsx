import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { ScrollView } from '../Lists';
import { LAN_SESSIONS_AVAILABLE } from '../../platform/features';
import { Colors } from '../../theme';
import { TextInput, Pressable } from '../AccessibleControls';
import { NAME_INPUT } from '../nameInput';
import { styles } from './campaignsStyles';

// ── No Campaign View ──────────────────────────────────────────────────────────

export function NoCampaignView({
  nickname, onNicknameChange, onCreate, onOpenExisting, onJoinLive,
}: {
  nickname: string; onNicknameChange: (n: string) => void;
  onCreate: () => void; onOpenExisting: () => void; onJoinLive: () => void;
}) {
  const router = useRouter();
  // A campaign is offline state on this device, so it works everywhere, a browser included. Only live sessions need the local
  // network (raw TCP, which a browser cannot open): their buttons show where LAN_SESSIONS_AVAILABLE says they can work.

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentCenter}>
      <Text style={styles.emptyIcon}>🗺️</Text>
      <Text style={styles.emptyHeading}>No Active Campaign</Text>

        <>
          <View style={[styles.nicknameRow, { alignSelf: 'stretch' }]}>
            <Text style={styles.nickLabel}>YOUR NAME</Text>
            <TextInput {...NAME_INPUT} style={styles.nickInput} value={nickname}
              onChangeText={onNicknameChange}
              placeholder="Enter your name…" placeholderTextColor={Colors.textDim} />
          </View>

          <View style={styles.actionGroup}>
            <Pressable style={styles.primaryBtn} onPress={onCreate}>
              <Text style={styles.primaryBtnTxt}>👑 Create Campaign</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={onOpenExisting} testID="campaign-open-existing">
              <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>
                Open Existing Campaign
              </Text>
            </Pressable>
            {LAN_SESSIONS_AVAILABLE && (
              <Pressable style={[styles.primaryBtn, styles.secondaryBtn]} onPress={onJoinLive} testID="live-join-campaign">
                <Text style={[styles.primaryBtnTxt, { color: Colors.textPrimary }]}>
                  🗡 Join Live Session
                </Text>
              </Pressable>
            )}
          </View>

          {/*
            Host-only (no campaign attached) is deliberately not one of the three primary
            actions above — per CAMPAIGN_PAGE_MODEL_SPEC.md, Host belongs either inside an
            existing campaign (Host + DM, see DmActiveView) or, for a Host with no campaign at
            all, its own Live Session screen rather than campaign creation.
          */}
          {LAN_SESSIONS_AVAILABLE && (
            <Pressable style={styles.liveHostLink} onPress={() => router.push('/live')} testID="live-open-standalone">
              <Text style={styles.liveHostLinkTxt}>Hosting without a campaign? Open Live Session →</Text>
            </Pressable>
          )}
        </>

      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>How it works</Text>
        <Text style={styles.howItem}>• Create or open a campaign to prepare and manage it offline</Text>
        <Text style={styles.howItem}>• Start a Live Session only when you want to play over LAN</Text>
        <Text style={styles.howItem}>• Players or DMs join with a 7-character room code or QR</Text>
        <Text style={styles.howItem}>• HP, effects, conditions, and approved live changes sync during the session</Text>
        <Text style={styles.howItem}>• Campaigns and characters persist offline — no internet required</Text>
      </View>
    </ScrollView>
  );
}
