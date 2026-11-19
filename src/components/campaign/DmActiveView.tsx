import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { LAN_SESSIONS_AVAILABLE } from '../../platform/features';
import { useCampaignStore } from '../../store/campaignStore';
import { useDeviceStore } from '../../store/deviceStore';
import { Colors } from '../../theme';
import { Alert } from '../../utils/alert';
import { Pressable } from '../AccessibleControls';
import { CampaignPacksNote } from '../CampaignPacksNote';
import { HostModal } from '../live/LiveSessionStart';
import { NotesSection, QuestsSection, SessionLogSection, CampaignContentSection, PartySection } from './CampaignSections';
import { styles } from './campaignsStyles';

// ── DM Active View ────────────────────────────────────────────────────────────

export function DmActiveView() {
  const router         = useRouter();
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const updateCampaign = useCampaignStore(s => s.updateCampaign);
  const leaveCampaign  = useCampaignStore(s => s.leaveCampaign);
  const liveNickname   = useDeviceStore(s => s.session?.nickname ?? '');
  const [hostOpen, setHostOpen] = useState(false);

  if (!activeCampaign) return null;

  const quests     = activeCampaign.quests ?? [];
  const log        = activeCampaign.sessionLog ?? [];
  const campaignId = activeCampaign.id;   // captured after null guard for closure safety

  function save(patch: Partial<typeof activeCampaign>) {
    void updateCampaign(campaignId, c => ({ ...c, ...patch }));
  }

  // Leaves this campaign without deleting it: the Campaigns page returns to Create / Open Existing, so a DM can start or open
  // another campaign. The campaign stays saved and can be reopened.
  function confirmClose() {
    Alert.alert(
      'Close Campaign',
      '"' + activeCampaign!.name + '" stays saved; you can reopen it or start another campaign.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close Campaign', onPress: () => { void leaveCampaign(); } },
      ],
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <CampaignPacksNote campaign={activeCampaign} />

      <View style={styles.campaignCard}>
        <Text style={styles.campaignName}>{activeCampaign.name}</Text>

        <View style={styles.noNetworkNotice}>
          <Text style={styles.noNetworkTxt}>
            {LAN_SESSIONS_AVAILABLE
              ? 'This campaign works offline: the DM dashboard, rules and encounters need no network. Host a live table when you want players to join.'
              : 'This campaign works offline: the DM dashboard, rules and encounters need no network.'}
          </Text>
        </View>

        <Pressable style={styles.dmBtn} onPress={() => router.push('/dm/dashboard')}>
          <Text style={styles.dmBtnTxt}>🎲 Open DM Dashboard</Text>
        </Pressable>
        {LAN_SESSIONS_AVAILABLE && (
          <Pressable style={[styles.dmBtn, styles.dmBtnSecondary]} onPress={() => setHostOpen(true)} testID="campaign-host-live-session">
            <Text style={[styles.dmBtnTxt, { color: Colors.textPrimary }]}>🛰 Host Live Table</Text>
          </Pressable>
        )}
        <Pressable style={[styles.dmBtn, styles.dmBtnSecondary]} onPress={confirmClose} testID="campaign-close">
          <Text style={[styles.dmBtnTxt, { color: Colors.textPrimary }]}>↩ Close Campaign / Switch</Text>
        </Pressable>
      </View>

      {/*
        Per HOST_SESSION_FLOW_SPEC.md: "Create Campaign = persistent DM workspace. Host Session =
        temporary live room." The campaign itself is offline; a Live Session is the temporary room,
        started here from inside an already-open campaign and pre-set to Host + DM since a campaign
        is already in hand. Attaching THIS campaign's content to the room is then done from the DM
        screen's own link-campaign action once hosting starts.
      */}
      <HostModal visible={hostOpen} onClose={() => setHostOpen(false)} nickname={liveNickname} initialRole="host+dm" />

      {/* Overview sections */}
      <NotesSection
        notes={activeCampaign.notes}
        editable
        onChange={notes => save({ notes })}
      />
      <QuestsSection
        quests={quests}
        editable
        onUpdate={q => save({ quests: q })}
      />
      <SessionLogSection
        log={log}
        editable
        onUpdate={l => save({ sessionLog: l })}
      />
      <CampaignContentSection
        bannedPackIds={activeCampaign.bannedPackIds ?? []}
        onUpdate={ids => save({ bannedPackIds: ids })}
      />
      <PartySection characterIds={activeCampaign.characterIds} />

    </ScrollView>
  );
}
