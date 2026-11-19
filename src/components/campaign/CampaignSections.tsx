import { useState, useEffect } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { loadInstalledPacks } from '../../db/packRegistryRepo';
import { InstalledPack } from '../../engine/contentRecords';
import { Quest, SessionLogEntry } from '../../engine/types';
import { useCharacterStore } from '../../store/characterStore';
import { identityLabelsFor } from '../../store/identityLabelsFor';
import { Colors } from '../../theme';
import { Alert } from '../../utils/alert';
import { TextInput, Pressable } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { NAME_INPUT } from '../nameInput';
import { genId, formatDate } from './campaignHelpers';
import { styles } from './campaignsStyles';

// Joining is now exclusively through Live Session (see LiveJoinModal, wired below) — a Player
// no longer attaches directly to a DM's persistent campaignStore campaign by room code. They
// join the temporary live room, and get that campaign's content once the DM attaches it there
// (CAMPAIGN_DM_AUTHORITY_RULES.md / JOIN_SESSION_FLOW_SPEC.md). The old per-campaign join modal
// that lived here is gone; CreateModal above is unaffected since campaign creation/management is
// still local-first and independent of any live room.

// ── Campaign Overview Sections ────────────────────────────────────────────────
// Used by both DM and Player views; editable=true only for the DM.

// ── Notes Section ─────────────────────────────────────────────────────────────

export function NotesSection({ notes, editable, onChange }: {
  notes: string; editable: boolean; onChange: (n: string) => void;
}) {
  // The DM's notes never leave the DM's device (a Live Session host never receives them), so the section says so.
  const [local, setLocal] = useState(notes);
  useEffect(() => setLocal(notes), [notes]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>DM NOTES (PRIVATE, NOT SENT TO PLAYERS)</Text>
      {editable ? (
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={local}
          onChangeText={setLocal}
          onBlur={() => onChange(local)}
          placeholder="Add notes, world details, reminders…"
          placeholderTextColor={Colors.textDim}
          multiline
          textAlignVertical="top"
        />
      ) : local ? (
        <Text style={styles.notesReadOnly}>{local}</Text>
      ) : (
        <Text style={styles.emptyNote}>No campaign notes yet.</Text>
      )}
    </View>
  );
}

// ── Quest Status Chip ─────────────────────────────────────────────────────────

const QUEST_STATUS_COLORS: Record<Quest['status'], string> = {
  active:    Colors.green,
  completed: Colors.gold,
  failed:    Colors.red,
};
const QUEST_STATUS_LABELS: Record<Quest['status'], string> = {
  active: 'Active', completed: 'Done', failed: 'Failed',
};

function QuestChip({ status }: { status: Quest['status'] }) {
  const color = QUEST_STATUS_COLORS[status];
  return (
    <View style={[styles.questChip, { borderColor: color + '66', backgroundColor: color + '22' }]}>
      <Text style={[styles.questChipTxt, { color }]}>{QUEST_STATUS_LABELS[status]}</Text>
    </View>
  );
}

// ── Quests Section ────────────────────────────────────────────────────────────

export function QuestsSection({ quests, editable, onUpdate }: {
  quests: Quest[];
  editable: boolean;
  onUpdate: (quests: Quest[]) => void;
}) {
  const [addModal, setAddModal] = useState(false);
  const [addName,  setAddName]  = useState('');
  const [addDesc,  setAddDesc]  = useState('');

  function addQuest() {
    if (!addName.trim()) return;
    const newQuest: Quest = {
      id: genId(), name: addName.trim(),
      description: addDesc.trim(), status: 'active',
    };
    onUpdate([...quests, newQuest]);
    setAddName(''); setAddDesc(''); setAddModal(false);
  }

  function cycleStatus(id: string) {
    const cycle: Record<Quest['status'], Quest['status']> = {
      active: 'completed', completed: 'failed', failed: 'active',
    };
    onUpdate(quests.map(q => q.id === id ? { ...q, status: cycle[q.status] } : q));
  }

  function deleteQuest(id: string) {
    Alert.alert('Remove Quest?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onUpdate(quests.filter(q => q.id !== id)) },
    ]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>QUESTS</Text>

      {quests.length === 0 ? (
        <Text style={styles.emptyNote}>{editable ? 'No quests yet. Add one below.' : 'No quests yet.'}</Text>
      ) : (
        quests.map(q => (
          <View key={q.id} style={styles.questRow}>
            <QuestChip status={q.status} />
            <View style={styles.questBody}>
              <Text style={styles.questName}>{q.name}</Text>
              {q.description ? <Text style={styles.questDesc} numberOfLines={2}>{q.description}</Text> : null}
            </View>
            {editable && (
              <View style={styles.questActions}>
                <Pressable style={styles.questActionBtn} onPress={() => cycleStatus(q.id)} hitSlop={8}>
                  <Text style={styles.questActionTxt}>↻</Text>
                </Pressable>
                <Pressable style={styles.questActionBtn} onPress={() => deleteQuest(q.id)} hitSlop={8}>
                  <Text style={[styles.questActionTxt, { color: Colors.red }]}>✕</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      {editable && (
        <Pressable style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Text style={styles.addBtnTxt}>+ Add Quest</Text>
        </Pressable>
      )}

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropTapArea} onPress={() => setAddModal(false)} />
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New Quest</Text>
            <TextInput {...NAME_INPUT} style={styles.input} value={addName} onChangeText={setAddName}
              placeholder="Quest name…" placeholderTextColor={Colors.textDim} autoFocus />
            <TextInput style={[styles.input, styles.notesInput]} value={addDesc} onChangeText={setAddDesc}
              placeholder="Description (optional)…" placeholderTextColor={Colors.textDim}
              multiline textAlignVertical="top" />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 2 }, !addName.trim() && styles.btnDisabled]}
                onPress={addQuest} disabled={!addName.trim()}>
                <Text style={styles.primaryBtnTxt}>Add Quest</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Session Log Section ───────────────────────────────────────────────────────

export function SessionLogSection({ log, editable, onUpdate }: {
  log: SessionLogEntry[];
  editable: boolean;
  onUpdate: (log: SessionLogEntry[]) => void;
}) {
  const [addModal,  setAddModal]  = useState(false);
  const [addText,   setAddText]   = useState('');
  const [collapsed, setCollapsed] = useState(true);   // show only 3 entries initially

  function addEntry() {
    if (!addText.trim()) return;
    const entry: SessionLogEntry = { id: genId(), summary: addText.trim(), date: Date.now() };
    onUpdate([entry, ...log]);   // newest first
    setAddText(''); setAddModal(false); setCollapsed(false);
  }

  function deleteEntry(id: string) {
    onUpdate(log.filter(e => e.id !== id));
  }

  const visible = collapsed ? log.slice(0, 3) : log;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>SESSION LOG</Text>

      {log.length === 0 ? (
        <Text style={styles.emptyNote}>
          {editable ? 'No sessions logged yet. Add a summary after each session.' : 'No sessions logged yet.'}
        </Text>
      ) : (
        <>
          {visible.map(entry => (
            <View key={entry.id} style={styles.logEntry}>
              <View style={styles.logEntryHeader}>
                <Text style={styles.logDate}>{formatDate(entry.date)}</Text>
                {editable && (
                  <Pressable onPress={() => deleteEntry(entry.id)} hitSlop={8}>
                    <Text style={styles.logDeleteTxt}>✕</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.logSummary}>{entry.summary}</Text>
            </View>
          ))}
          {log.length > 3 && (
            <Pressable onPress={() => setCollapsed(v => !v)}>
              <Text style={styles.showMoreTxt}>
                {collapsed ? `Show ${log.length - 3} more…` : 'Show less'}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {editable && (
        <Pressable style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Text style={styles.addBtnTxt}>+ Add Session Note</Text>
        </Pressable>
      )}

      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdropTapArea} onPress={() => setAddModal(false)} />
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Session Note</Text>
            <Text style={styles.modalSub}>{formatDate(Date.now())}</Text>
            <TextInput style={[styles.input, styles.notesInput]} value={addText}
              onChangeText={setAddText}
              placeholder="What happened this session? Key events, decisions, loot…"
              placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" autoFocus />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 2 }, !addText.trim() && styles.btnDisabled]}
                onPress={addEntry} disabled={!addText.trim()}>
                <Text style={styles.primaryBtnTxt}>Save Entry</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Campaign Content Section (item 15 — campaign content manifest) ─────────────
// DM-only: ban specific installed homebrew packs from this campaign. Native-
// only (SQLite-backed loadInstalledPacks, same as homebrew.tsx's
// InstalledPacksPanel it mirrors) — renders nothing on web or when no packs
// are installed, rather than showing a permanently-empty section.

export function CampaignContentSection({ bannedPackIds, onUpdate }: {
  bannedPackIds: string[];
  onUpdate: (ids: string[]) => void;
}) {
  const [packs, setPacks] = useState<InstalledPack[]>([]);

  useEffect(() => {
    loadInstalledPacks().then(setPacks).catch(e => console.error('[campaigns] loadInstalledPacks failed:', e));
  }, []);

  if (packs.length === 0) return null;

  function toggle(packId: string) {
    onUpdate(bannedPackIds.includes(packId) ? bannedPackIds.filter(id => id !== packId) : [...bannedPackIds, packId]);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>CAMPAIGN CONTENT</Text>
      <Text style={styles.emptyNote}>
        Ban an installed homebrew pack from this campaign — banned content won't appear when players build or level up a character here.
      </Text>
      {packs.map(pack => {
        const banned = bannedPackIds.includes(pack.id);
        return (
          <Pressable key={pack.id} style={styles.packRow} onPress={() => toggle(pack.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.packName}>{pack.name}</Text>
              <Text style={styles.packMeta}>{pack.itemRefs.length} item{pack.itemRefs.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={[styles.packToggle, banned && styles.packToggleBanned]}>
              <Text style={[styles.packToggleTxt, banned && styles.packToggleTxtBanned]}>
                {banned ? 'Banned' : 'Allowed'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Party Section ─────────────────────────────────────────────────────────────

export function PartySection({ characterIds }: { characterIds: string[] }) {
  const characters = useCharacterStore(s => s.characters);
  const partyChars = characters.filter(c => characterIds.includes(c.id));
  if (partyChars.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>PARTY</Text>
      {partyChars.map(c => {
        const hpPct   = c.resources.hp.maximum > 0
          ? c.resources.hp.current / c.resources.hp.maximum : 0;
        const hpColor = hpPct > 0.5 ? Colors.green : hpPct > 0.25 ? Colors.gold : Colors.red;
        return (
          <View key={c.id} style={styles.partyCard}>
            <View style={styles.partyInfo}>
              <Text style={styles.partyName}>{c.identity.name || 'Unnamed'}</Text>
              <Text style={styles.partySub}>
                Lv {c.identity.level} · {identityLabelsFor(c).class || '—'}
              </Text>
            </View>
            <View style={styles.partyRight}>
              <Text style={[styles.hpTxt, { color: hpColor }]}>
                {c.resources.hp.current}/{c.resources.hp.maximum} HP
              </Text>
              <View style={styles.hpBarOuter}>
                <View style={[styles.hpBarFill, {
                  width: `${Math.round(Math.max(0, Math.min(1, hpPct)) * 100)}%` as any,
                  backgroundColor: hpColor,
                }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
