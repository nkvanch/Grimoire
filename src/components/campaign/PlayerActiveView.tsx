import { useState } from 'react';
import { View, Text } from 'react-native';
import { ScrollView } from '../Lists';
import { campaignAdmission } from '../../engine/campaignLock';
import { useCampaignStore } from '../../store/campaignStore';
import { useCharacterStore } from '../../store/characterStore';
import { identityLabelsFor } from '../../store/identityLabelsFor';
import { Alert } from '../../utils/alert';
import { Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { CampaignPacksNote } from '../CampaignPacksNote';
import { showError } from './campaignHelpers';
import { QuestsSection, SessionLogSection, PartySection } from './CampaignSections';
import { styles } from './campaignsStyles';

// ── Player Active View ────────────────────────────────────────────────────────
// A campaign this device joined in the past, kept as it was last saved. Nothing here reaches the DM's device.

export function PlayerActiveView() {
  const activeCampaign = useCampaignStore(s => s.activeCampaign);
  const leaveCampaign  = useCampaignStore(s => s.leaveCampaign);
  const assignCharacter = useCampaignStore(s => s.assignCharacterToCampaign);
  const characters     = useCharacterStore(s => s.characters);
  const [claimOpen, setClaimOpen] = useState(false);

  if (!activeCampaign) return null;

  const quests = activeCampaign.quests ?? [];
  const log    = activeCampaign.sessionLog ?? [];
  const myChar = characters.find(c => activeCampaign.characterIds.includes(c.id)) ?? null;
  const campaignId = activeCampaign.id;

  async function claim(characterId: string) {
    try {
      await assignCharacter(characterId, campaignId);
      setClaimOpen(false);
    } catch (e) { showError('Not added', e instanceof Error ? e.message : String(e)); }
  }

  function confirmClose() {
    Alert.alert('Close Campaign', '"' + activeCampaign!.name + '" stays saved on this device; you can reopen it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close Campaign', onPress: () => { void leaveCampaign(); } },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <CampaignPacksNote campaign={activeCampaign} />

      <View style={styles.campaignCard}>
        <Text style={styles.campaignName}>{activeCampaign.name}</Text>
        <Text style={styles.campaignMeta}>Saved copy of a campaign you joined. It no longer updates from the DM.</Text>
      </View>

      {/* Your character */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>YOUR CHARACTER</Text>
        {myChar ? (
          <View style={styles.partyCard}>
            <View style={styles.partyInfo}>
              <Text style={styles.partyName}>{myChar.identity.name || 'Unnamed'}</Text>
              <Text style={styles.partySub}>Lv {myChar.identity.level} · {identityLabelsFor(myChar).class || '—'}</Text>
            </View>
            <Pressable onPress={() => setClaimOpen(true)}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setClaimOpen(true)}>
            <Text style={styles.addBtnTxt}>+ Choose your character</Text>
          </Pressable>
        )}
      </View>

      {/* Overview sections — read-only */}
      {quests.length > 0 && (
        <QuestsSection
          quests={quests}
          editable={false}
          onUpdate={() => {}}
        />
      )}
      {log.length > 0 && (
        <SessionLogSection
          log={log}
          editable={false}
          onUpdate={() => {}}
        />
      )}
      <PartySection characterIds={activeCampaign.characterIds} />

      <Pressable style={styles.leaveBtn} onPress={confirmClose}>
        <Text style={styles.leaveBtnTxt}>↩ Close Campaign</Text>
      </Pressable>

      {/* Character picker modal */}
      <Modal visible={claimOpen} transparent animationType="slide" onRequestClose={() => setClaimOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setClaimOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose Your Character</Text>
            {characters.length === 0 ? (
              <Text style={styles.emptyNote}>You have no characters yet. Create one first.</Text>
            ) : (
              characters.map(c => { const refusal = myChar?.id === c.id ? '' : campaignAdmission(activeCampaign, c); return (
                <Pressable key={c.id} style={[styles.pickRow, !!refusal && { opacity: 0.5 }]} disabled={!!refusal} onPress={() => { void claim(c.id); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partyName}>{c.identity.name || 'Unnamed'}</Text>
                    <Text style={styles.partySub}>Lv {c.identity.level} · {identityLabelsFor(c).class || '—'}</Text>
                    {!!refusal && <Text style={styles.partySub}>{refusal}</Text>}
                  </View>
                  {myChar?.id === c.id && <Text style={styles.changeLink}>✓</Text>}
                </Pressable>
              ); })
            )}
            <Pressable style={styles.cancelBtn} onPress={() => setClaimOpen(false)}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}
