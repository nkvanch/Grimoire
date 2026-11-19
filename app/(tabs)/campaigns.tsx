// ============================================================================
// FILE: app/(tabs)/campaigns.tsx
// Campaigns tab — create, open and manage offline campaigns; join a Live Session.
//
// State machine:
//   NO CAMPAIGN  → [Create Campaign], [Open Existing Campaign] or [Join Live Session]
//   DM ACTIVE    → campaign overview (notes/quests/log/party) + Host Live Table
//   PLAYER ACTIVE → read-only overview of a campaign this device joined in the past
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useCampaignStore }  from '../../src/store/campaignStore';
import { useDeviceStore }   from '../../src/store/deviceStore';
import { JoinModal as LiveJoinModal } from '../../src/components/live/LiveSessionStart';
import { styles } from '../../src/components/campaign/campaignsStyles';
import { CreateModal } from '../../src/components/campaign/CreateModal';
import { PlayerActiveView } from '../../src/components/campaign/PlayerActiveView';
import { OpenCampaignModal } from '../../src/components/campaign/OpenCampaignModal';
import { NoCampaignView } from '../../src/components/campaign/NoCampaignView';
import { DmActiveView } from '../../src/components/campaign/DmActiveView';

// ── Campaigns Screen ──────────────────────────────────────────────────────────

export default function CampaignsScreen() {
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const isDm           = useCampaignStore(s => s.isDm);
  const loadCampaigns  = useCampaignStore(s => s.loadCampaigns);
  const session        = useDeviceStore(s => s.session);
  const setNickname    = useDeviceStore(s => s.setNickname);
  const { action }     = useLocalSearchParams<{ action?: string }>();

  const [createOpen,       setCreateOpen]       = useState(false);
  const [openExistingOpen, setOpenExistingOpen] = useState(false);
  const [joinLiveOpen,     setJoinLiveOpen]     = useState(false);
  const [nickname,         setLocalNick]        = useState(session?.nickname ?? '');

  const actionHandled = useRef(false);
  useEffect(() => {
    if (action === 'join' && !actionHandled.current) {
      actionHandled.current = true;
      setJoinLiveOpen(true);
    }
  }, [action]);

  useEffect(() => { void loadCampaigns(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (session?.nickname !== undefined) setLocalNick(session.nickname);
  }, [session?.nickname]);

  const handleNicknameChange = useCallback((n: string) => {
    setLocalNick(n);
    void setNickname(n);
  }, [setNickname]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Campaigns</Text>
      </View>

      {activeCampaign ? (
        isDm ? <DmActiveView /> : <PlayerActiveView />
      ) : (
        <NoCampaignView
          nickname={nickname}
          onNicknameChange={handleNicknameChange}
          onCreate={() => setCreateOpen(true)}
          onOpenExisting={() => setOpenExistingOpen(true)}
          onJoinLive={() => setJoinLiveOpen(true)}
        />
      )}

      <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
      <OpenCampaignModal visible={openExistingOpen} onClose={() => setOpenExistingOpen(false)} />
      <LiveJoinModal visible={joinLiveOpen} onClose={() => setJoinLiveOpen(false)} nickname={nickname} />
    </View>
  );
}
