import { useState, useEffect } from 'react';
import { Text, View, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { ScrollView } from '../Lists';
import { gameIdForRuleset } from '../../content/rulesets';
import { loadInstalledPacks } from '../../db/packRegistryRepo';
import { InstalledPack } from '../../engine/contentRecords';
import { profilesForRuleset, sanitizeProfileRules } from '../../engine/customRuleProfiles';
import { DEFAULT_RULES } from '../../engine/defaults';
import { RulesetId, CampaignRules } from '../../engine/types';
import { useCampaignStore } from '../../store/campaignStore';
import { useCustomRuleProfileStore } from '../../store/customRuleProfileStore';
import { useDeviceStore } from '../../store/deviceStore';
import { Spacing, Colors } from '../../theme';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { GameRulesetPicker } from '../homebrew/GameRulesetPicker';
import { NAME_INPUT } from '../nameInput';
import { showError } from './campaignHelpers';
import { styles } from './campaignsStyles';

// ── Create/Join Campaign Modals ───────────────────────────────────────────────
// Restored: these drive the persistent, DM-owned campaign (its rules, the DM
// dashboard/encounter tracker under app/dm/*) — a different, independent concern from the
// Live Session card below, which is the temporary Host/DM/Player network room. A campaign is
// not owned by a Host; keeping these two entry points separate (instead of merging Create
// Campaign into Host Session) is what keeps that distinction real instead of just documented.

// ── Wizard primitives ─────────────────────────────────────────────────────────

function WizChip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable style={[styles.wizChip, active && styles.wizChipActive]} onPress={onPress} testID={testID}>
      <Text style={[styles.wizChipTxt, active && styles.wizChipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

function WizToggle({ label, hint, value, onChange, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable style={styles.wizToggleRow} onPress={() => onChange(!value)} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={styles.wizToggleLabel}>{label}</Text>
        {hint && <Text style={styles.wizToggleHint}>{hint}</Text>}
      </View>
      <View style={[styles.wizSwitch, value && styles.wizSwitchOn]}>
        <View style={[styles.wizSwitchKnob, value && styles.wizSwitchKnobOn]} />
      </View>
    </Pressable>
  );
}

// ── Create Campaign wizard (CREATE_CAMPAIGN_FLOW_SPEC.md) ────────────────────
// 5 steps: Basics -> Rules -> Permissions -> Content -> Review. Per the spec's own "important
// rules": never creates a Host session or room code here (createCampaign makes the persistent
// campaign object only; a live session is a separate later step, DmActiveView's "Host Live Table" button), and the chosen rule profile is COPIED into
// the campaign's own `rules`, not referenced — editing the original profile later never
// silently rewrites an existing campaign (createCampaign already enforces this; the wizard just
// decides what to copy in).
const WIZ_STEPS = ['Basics', 'Rules', 'Permissions', 'Content', 'Review'] as const;
type WizStep = typeof WIZ_STEPS[number];

export function CreateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const createCampaign = useCampaignStore(s => s.createCampaign);
  const session        = useDeviceStore(s => s.session);
  const profiles        = useCustomRuleProfileStore(s => s.profiles);
  const loadProfiles    = useCustomRuleProfileStore(s => s.load);

  const [step, setStep] = useState<WizStep>('Basics');
  const [loading, setLoading] = useState(false);

  // Step 1 — Basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(undefined);

  // Step 2 — Rules
  const [profileId, setProfileId] = useState<string | null>(null);   // null = Defaults
  const [maxLevel, setMaxLevel] = useState<number | null>(DEFAULT_RULES.maxLevel);
  const [allowMulticlass, setAllowMulticlass] = useState(DEFAULT_RULES.allowMulticlass);

  // Step 3 — Permissions. ruleSuggestionsEnabled and permanentRewardsAutomatic are real values
  // stored on the campaign, but disclosed here rather than silently: nothing on the DM/live
  // side reads either yet (Rule Suggestions and Rewards are both still-unbuilt DM cockpit
  // subsystems) — Player Free Edit (customRules.lockPlayerFreeEdit) is the one of the three with
  // a real, already-wired consumer (houseRules.ts's canPlayerFreeEdit()).
  const [ruleSuggestions,   setRuleSuggestions]   = useState(true);
  const [rewardsAutomatic,  setRewardsAutomatic]  = useState(false);
  const [playerFreeEdit,    setPlayerFreeEdit]    = useState(true);

  // Step 4 — Content
  const [installedPacks, setInstalledPacks] = useState<InstalledPack[]>([]);
  const [bannedPackIds, setBannedPackIds] = useState<string[]>([]);
  const [homebrewNeedsApproval, setHomebrewNeedsApproval] = useState(false);

  useEffect(() => { if (visible) { void loadProfiles(); void loadInstalledPacks().then(setInstalledPacks); } }, [visible, loadProfiles]);
  useEffect(() => {
    if (!visible) {
      setStep('Basics'); setName(''); setDescription(''); setRulesetId(undefined);
      setProfileId(null); setMaxLevel(DEFAULT_RULES.maxLevel); setAllowMulticlass(DEFAULT_RULES.allowMulticlass);
      setRuleSuggestions(true); setRewardsAutomatic(false); setPlayerFreeEdit(true);
      setBannedPackIds([]); setHomebrewNeedsApproval(false);
    }
  }, [visible]);

  const compatibleProfiles = profilesForRuleset(profiles, rulesetId);
  // Picking a profile pre-fills the quick toggles from it; the DM can still adjust them after —
  // this effect only fires on profile CHANGE, never overwriting a toggle the DM already touched
  // for the currently-selected profile.
  useEffect(() => {
    const profile = profileId ? profiles.find(p => p.id === profileId) : null;
    const resolved = profile ? sanitizeProfileRules(profile.rules) : {};
    setMaxLevel(resolved.maxLevel !== undefined ? resolved.maxLevel : DEFAULT_RULES.maxLevel);
    setAllowMulticlass(resolved.allowMulticlass ?? DEFAULT_RULES.allowMulticlass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  function buildRules(): CampaignRules {
    const profile = profileId ? profiles.find(p => p.id === profileId) : null;
    const resolved = profile ? sanitizeProfileRules(profile.rules) : {};
    return {
      ...DEFAULT_RULES, ...resolved,
      maxLevel, allowMulticlass,
      customRules: {
        ...DEFAULT_RULES.customRules, ...(resolved.customRules ?? {}),
        lockPlayerFreeEdit: !playerFreeEdit,
        ruleSuggestionsEnabled: ruleSuggestions,
        permanentRewardsAutomatic: rewardsAutomatic,
        homebrewNeedsApproval,
      },
    };
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || !session) return;
    setLoading(true);
    try {
      // createCampaign is offline state only: it opens no server and allocates no room code (a Live Session does that later).
      await createCampaign({
        name: trimmed, description, rulesetId, rules: buildRules(),
        bannedPackIds,
      });
      onClose();
    } catch (e) { showError('Error', String(e)); }
    finally { setLoading(false); }
  }

  const stepIndex = WIZ_STEPS.indexOf(step);
  const canNext = step !== 'Basics' || !!name.trim();
  function goNext() { if (canNext) setStep(WIZ_STEPS[Math.min(stepIndex + 1, WIZ_STEPS.length - 1)]); }
  function goBack() { setStep(WIZ_STEPS[Math.max(stepIndex - 1, 0)]); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropTapArea} onPress={onClose} accessible={false} />
        <View style={[styles.modalSheet, styles.wizSheet]}>
          <Text style={styles.wizStepLabel}>Step {stepIndex + 1} of {WIZ_STEPS.length}</Text>
          <Text style={styles.modalTitle}>{step === 'Basics' ? 'New Campaign' : step}</Text>

          <ScrollView style={styles.wizScroll} keyboardShouldPersistTaps="handled">
            {step === 'Basics' && (
              <View style={{ gap: Spacing.sm }}>
                <TextInput {...NAME_INPUT} style={styles.input} value={name} onChangeText={setName}
                  placeholder="Campaign name…" placeholderTextColor={Colors.textDim} autoFocus testID="wiz-name" />
                <TextInput style={[styles.input, styles.notesInput]} value={description} onChangeText={setDescription}
                  placeholder="Description (optional)…" placeholderTextColor={Colors.textDim} multiline textAlignVertical="top" testID="wiz-description" />
                <Text style={styles.wizFieldLabel}>Ruleset (optional)</Text>
                <GameRulesetPicker value={rulesetId} onChange={setRulesetId} defaultGameId={gameIdForRuleset(rulesetId)} />
              </View>
            )}

            {step === 'Rules' && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.wizFieldLabel}>Rule profile</Text>
                <View style={styles.wizChipRow}>
                  <WizChip label="Defaults" active={profileId === null} onPress={() => setProfileId(null)} testID="wiz-profile-default" />
                  {compatibleProfiles.map(p => (
                    <WizChip key={p.id} label={p.name} active={profileId === p.id} onPress={() => setProfileId(p.id)} testID={`wiz-profile-${p.name}`} />
                  ))}
                </View>
                {compatibleProfiles.length === 0 && <Text style={styles.wizHint}>No saved rule profiles for this ruleset yet — build one under Homebrew → Custom Rule Profile.</Text>}

                <Text style={styles.wizFieldLabel}>Max level</Text>
                <View style={styles.wizChipRow}>
                  {[null, 5, 10, 15, 20].map(lvl => (
                    <WizChip key={String(lvl)} label={lvl === null ? 'Uncapped' : `Lv ${lvl}`} active={maxLevel === lvl} onPress={() => setMaxLevel(lvl)} testID={`wiz-maxlevel-${lvl ?? 'uncapped'}`} />
                  ))}
                </View>
                <WizToggle label="Allow multiclassing" value={allowMulticlass} onChange={setAllowMulticlass} testID="wiz-multiclass" />
              </View>
            )}

            {step === 'Permissions' && (
              <View style={{ gap: Spacing.sm }}>
                <WizToggle label="Player rule suggestions" hint="Players can propose house-rule changes for you to review." value={ruleSuggestions} onChange={setRuleSuggestions} testID="wiz-rule-suggestions" />
                <WizToggle label="Player Free Edit" hint="Players can freely edit their own sheet without DM approval." value={playerFreeEdit} onChange={setPlayerFreeEdit} testID="wiz-free-edit" />
                <Text style={styles.wizFieldLabel}>Permanent DM rewards</Text>
                <View style={styles.wizChipRow}>
                  <WizChip label="Needs approval" active={!rewardsAutomatic} onPress={() => setRewardsAutomatic(false)} testID="wiz-rewards-approval" />
                  <WizChip label="Automatic" active={rewardsAutomatic} onPress={() => setRewardsAutomatic(true)} testID="wiz-rewards-automatic" />
                </View>
              </View>
            )}

            {step === 'Content' && (
              <View style={{ gap: Spacing.sm }}>
                <WizToggle label="Homebrew needs DM approval" hint="Off: a player's homebrew content is allowed automatically." value={homebrewNeedsApproval} onChange={setHomebrewNeedsApproval} testID="wiz-homebrew-approval" />
                {installedPacks.length > 0 && (
                  <>
                    <Text style={styles.wizFieldLabel}>Allowed homebrew packs</Text>
                    {installedPacks.map(pack => {
                      const banned = bannedPackIds.includes(pack.id);
                      return (
                        <Pressable key={pack.id} style={styles.packRow}
                          onPress={() => setBannedPackIds(ids => banned ? ids.filter(id => id !== pack.id) : [...ids, pack.id])}>
                          <View style={{ flex: 1 }}><Text style={styles.packName}>{pack.name}</Text></View>
                          <View style={[styles.packToggle, banned && styles.packToggleBanned]}>
                            <Text style={[styles.packToggleTxt, banned && styles.packToggleTxtBanned]}>{banned ? 'Banned' : 'Allowed'}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}
                {installedPacks.length === 0 && <Text style={styles.wizHint}>No homebrew packs installed on this device yet.</Text>}
              </View>
            )}

            {step === 'Review' && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Name: </Text>{name.trim() || '(not set)'}</Text>
                {!!description.trim() && <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Description: </Text>{description.trim()}</Text>}
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Ruleset: </Text>{rulesetId ?? 'Any'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Rule profile: </Text>{profileId ? (profiles.find(p => p.id === profileId)?.name ?? 'Custom') : 'Defaults'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Max level: </Text>{maxLevel ?? 'Uncapped'} · <Text style={styles.wizReviewLabel}>Multiclass: </Text>{allowMulticlass ? 'Allowed' : 'Off'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Rule suggestions: </Text>{ruleSuggestions ? 'On' : 'Off'} · <Text style={styles.wizReviewLabel}>Free Edit: </Text>{playerFreeEdit ? 'On' : 'Off'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Permanent rewards: </Text>{rewardsAutomatic ? 'Automatic' : 'Needs approval'}</Text>
                <Text style={styles.wizReviewLine}><Text style={styles.wizReviewLabel}>Homebrew: </Text>{homebrewNeedsApproval ? 'Needs approval' : 'Automatically allowed'}{bannedPackIds.length > 0 ? ` · ${bannedPackIds.length} pack(s) banned` : ''}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.wizFooter}>
            {step !== 'Basics' && (
              <Pressable style={styles.cancelBtn} onPress={goBack} testID="wiz-back">
                <Text style={styles.cancelTxt}>Back</Text>
              </Pressable>
            )}
            {step !== 'Review' ? (
              <Pressable style={[styles.primaryBtn, { flex: 2 }, !canNext && styles.btnDisabled]} onPress={goNext} disabled={!canNext} testID="wiz-next">
                <Text style={styles.primaryBtnTxt}>Next</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.primaryBtn, { flex: 2 }, (!name.trim() || loading) && styles.btnDisabled]}
                onPress={() => { void handleCreate(); }} disabled={!name.trim() || loading} testID="wiz-create">
                {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.primaryBtnTxt}>Create Campaign</Text>}
              </Pressable>
            )}
          </View>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
