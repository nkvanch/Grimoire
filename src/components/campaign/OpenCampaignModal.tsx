import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View, ActivityIndicator } from 'react-native';
import { Campaign } from '../../engine/types';
import { useCampaignStore } from '../../store/campaignStore';
import { useDeviceStore } from '../../store/deviceStore';
import { Colors } from '../../theme';
import { Alert } from '../../utils/alert';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { styles } from './campaignsStyles';

// ── Open Existing Campaign ────────────────────────────────────────────────────
// Per CAMPAIGN_PAGE_MODEL_SPEC.md: "Continue one of your existing campaigns" — a DM can own/keep
// several but only hosts one at a time, and this is also how a device gets back to a campaign it
// was playing in as a Player (campaignStore's switchToCampaign/leaveCampaign — leaving used to
// permanently delete a DM's campaign, so this had nothing to show before that was fixed).

export function OpenCampaignModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const campaigns         = useCampaignStore(s => s.campaigns);
  const switchToCampaign  = useCampaignStore(s => s.switchToCampaign);
  const deleteCampaign    = useCampaignStore(s => s.deleteCampaignPermanently);
  const session           = useDeviceStore(s => s.session);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  async function handleResume(id: string) {
    if (switchingId) return;
    setSwitchingId(id);
    try {
      await switchToCampaign(id);
      onClose();
    } catch (e: any) {
      Alert.alert('Couldn’t open campaign', e?.message ?? String(e));
    } finally {
      setSwitchingId(null);
    }
  }

  function confirmDelete(c: Campaign) {
    Alert.alert('Delete Campaign', `Permanently delete "${c.name}"? This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void deleteCampaign(c.id); } },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdropTapArea} onPress={onClose} />
        <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Open Existing Campaign</Text>
          {campaigns.length === 0 ? (
            <Text style={styles.emptyNote}>No saved campaigns yet — create one first.</Text>
          ) : (
            campaigns.map(c => {
              const isDm = session?.deviceId === c.dmDeviceId;
              return (
                <View key={c.id} style={styles.savedRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => { void handleResume(c.id); }} disabled={switchingId !== null}>
                    <Text style={styles.savedRowName}>{c.name}</Text>
                    <Text style={styles.savedRowMeta}>{isDm ? '👑 You DM this' : '🗡 You play in this'}</Text>
                  </Pressable>
                  {switchingId === c.id ? (
                    <ActivityIndicator color={Colors.gold} />
                  ) : (
                    <Pressable style={styles.savedRowDelete} onPress={() => confirmDelete(c)} hitSlop={8}>
                      <Text style={styles.savedRowDeleteTxt}>🗑</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
