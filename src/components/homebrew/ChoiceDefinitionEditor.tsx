// src/components/homebrew/ChoiceDefinitionEditor.tsx
// CHOICE-AUTHORING-1: shared homebrew authoring UI for structured
// ChoiceDefinitions (currently kinds 'expertise' | 'tool' | 'language' —
// see src/content/choiceDefinitionCompiler.ts's own header comment for how
// a future kind gets added). Mirrors TraitEditor.tsx's own split exactly:
// this file is the React layer, choiceDefinitionCompiler.ts is the plain-TS
// draft<->ChoiceDefinition compiler it wraps.
//
// Integration point: every builder that already manages a list of
// ChoiceDefinition-bearing content (Race/Subrace.pendingChoices,
// Background/Feat.pendingChoices, a ClassProgression/SubclassProgression
// level entry's own `choices`) renders <ChoiceDefinitionListEditor> and
// keeps `DraftChoice[]` as its own local state, compiling to
// `ChoiceDefinition[]` only at save time — same "draft state through the
// screen, compile once on save" shape TraitListEditor already established
// for DraftTrait/Feature.
import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import {
  AuthorableChoiceKind, PoolMode, DraftChoice,
  newDraftChoice, validateDraftChoice, registryFor, categoryOrderFor, idsForCategories,
  poolSizeForDraft, hasOptionPool,
} from '../../content/choiceDefinitionCompiler';
import { TraitListEditor } from './TraitEditor';
import type { ChoiceReplacePolicy } from '../../engine/types';
import { TOOL_CATEGORY_LABELS } from '../../content/tools';
import { LANGUAGE_CATEGORY_LABELS } from '../../content/languages';
import { SafeBottomView } from '../SafeBottomView';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../theme';
import { styles as traitStyles } from './TraitEditor';

export type { DraftChoice, AuthorableChoiceKind, PoolMode };
export { newDraftChoice };

export const CHOICE_KIND_LABELS: Record<AuthorableChoiceKind, string> = {
  expertise: 'Expertise', tool: 'Tool Proficiency', language: 'Language', skill: 'Skill Proficiency',
  asi: 'Ability Improvement or Feat', spell: 'Spell', feature_pool: 'Feature Pool',
};
const KIND_ORDER: AuthorableChoiceKind[] = ['skill', 'expertise', 'tool', 'language', 'asi', 'spell'];
/** The spell lists a spell choice can name; none picked is the character's own list. */
const SPELL_LISTS = ['any', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
const REPLACE_LABELS: Record<'' | ChoiceReplacePolicy['timing'], string> = { '': 'Never', level_up: 'On a level up', rest: 'After a rest', long_rest: 'After a long rest' };

const POOL_MODE_LABELS: Record<PoolMode, string> = {
  all: 'All eligible options',
  category: 'Category',
  restricted: 'Restricted list',
};

function categoryLabelsFor(kind: AuthorableChoiceKind): Record<string, string> {
  return kind === 'tool' ? TOOL_CATEGORY_LABELS : kind === 'language' ? LANGUAGE_CATEGORY_LABELS : {};
}

function allPoolNote(kind: AuthorableChoiceKind): string {
  if (kind === 'expertise') return 'Legal targets are computed live from the character — currently proficient skills that aren\'t already Expertise.';
  if (kind === 'tool') return 'Any tool not already known.';
  return 'Any normally-selectable language not already known — secret languages (Thieves\' Cant, Druidic) are excluded from this default pool; use a restricted list to include them explicitly.';
}

export function summarizeDraftChoice(draft: DraftChoice): string {
  const count = parseInt(draft.count, 10) || 0;
  const kindLabel = CHOICE_KIND_LABELS[draft.kind];
  if (draft.kind === 'asi') return kindLabel;
  if (draft.kind === 'feature_pool') {
    const n = (draft.options ?? []).length;
    return `Choose ${count || '?'} of ${n} option${n === 1 ? '' : 's'}`;
  }
  if (draft.kind === 'spell') {
    const lists = draft.spellLists?.length ? draft.spellLists.map(l => (l === 'any' ? 'any list' : l)).join(', ') : 'own list';
    const levels = draft.spellLevels?.length ? draft.spellLevels.map(l => (l === 0 ? 'cantrips' : `level ${l}`)).join(', ') : 'any castable level';
    return `Choose ${count || '?'} · ${lists} · ${levels}`;
  }
  const poolLabel =
    draft.poolMode === 'all' ? 'any eligible' :
    draft.poolMode === 'category' ? (draft.categories.length > 0
      ? draft.categories.map(c => categoryLabelsFor(draft.kind)[c] ?? c).join(', ')
      : '(no category selected)') :
    `${draft.restrictedIds.length} option${draft.restrictedIds.length === 1 ? '' : 's'}`;
  return `Choose ${count || '?'} · ${kindLabel} · ${poolLabel}`;
}

// ── Editor modal — configures ONE ChoiceDefinition ─────────────────────────

export function ChoiceDefinitionEditorModal({ draft, visible, onChange, onDone, onDelete, allowPools }: {
  draft: DraftChoice | null;
  visible: boolean;
  onChange: (d: DraftChoice) => void;
  onDone: () => void;
  onDelete: () => void;
  /** Offer Feature Pool (options that are traits): a class's or subclass's own choices. */
  allowPools?: boolean;
}) {
  if (!draft) return null;
  const set = (patch: Partial<DraftChoice>) => onChange({ ...draft, ...patch });

  const poolModes: PoolMode[] = draft.kind === 'expertise' ? ['all', 'restricted'] : ['all', 'category', 'restricted'];
  const registry = registryFor(draft.kind);
  const categories = categoryOrderFor(draft.kind);
  const errors = validateDraftChoice(draft);
  const poolSize = poolSizeForDraft(draft);

  function setKind(kind: AuthorableChoiceKind) {
    if (kind === draft!.kind) return;
    // Pool selections don't carry meaning across kinds (a tool id isn't a
    // language id) — reset rather than risk a stale, silently-wrong pool.
    onChange({ ...draft!, kind, poolMode: 'all', categories: [], restrictedIds: [], ...(kind === 'asi' ? { count: '1' } : {}) });
  }
  const kinds = allowPools || draft.kind === 'feature_pool' ? [...KIND_ORDER, 'feature_pool' as const] : KIND_ORDER;
  const toggleIn = <T,>(list: T[] | undefined, v: T): T[] => ((list ?? []).includes(v) ? (list ?? []).filter(x => x !== v) : [...(list ?? []), v]);

  function toggleCategory(cat: string) {
    const active = draft!.categories.includes(cat);
    set({ categories: active ? draft!.categories.filter(c => c !== cat) : [...draft!.categories, cat] });
  }

  function toggleRestricted(id: string) {
    const active = draft!.restrictedIds.includes(id);
    set({ restrictedIds: active ? draft!.restrictedIds.filter(x => x !== id) : [...draft!.restrictedIds, id] });
  }

  // Group the restricted-pool checklist by category when the kind has one
  // (tool/language), otherwise a single flat list (expertise/skills).
  const grouped: { group: string | null; entries: typeof registry }[] = categories.length > 0
    ? categories.map(cat => ({ group: categoryLabelsFor(draft.kind)[cat] ?? cat, entries: registry.filter(o => o.category === cat) }))
    : [{ group: null, entries: registry }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={traitStyles.backdrop}>
        {/* SCROLL-TOUCH-1: backdrop is a sibling, not an ancestor, of the sheet (see TabInventory AddItemModal) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessible={false} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
        <View style={traitStyles.traitModalSheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={traitStyles.traitModalTitle}>Player Choice</Text>

            <Text style={traitStyles.fieldLabel}>Choice Type</Text>
            <View style={traitStyles.chipWrap}>
              {kinds.map(k => (
                <Pressable key={k} style={[traitStyles.chip, draft.kind === k && traitStyles.chipActive]} onPress={() => setKind(k)}>
                  <Text style={[traitStyles.chipTxt, draft.kind === k && traitStyles.chipTxtActive]}>{CHOICE_KIND_LABELS[k]}</Text>
                </Pressable>
              ))}
            </View>

            {draft.kind !== 'asi' && <View style={traitStyles.rowInline}>
              <Text style={traitStyles.inlineLabel}>Choose:</Text>
              <TextInput style={[traitStyles.input, traitStyles.smallInput]} value={draft.count}
                onChangeText={v => set({ count: v })} keyboardType="number-pad" />
            </View>}
            {draft.kind === 'asi' && <Text style={traitStyles.effectNote}>An Ability Score Improvement, or a feat where the table's rules allow one.</Text>}

            <Text style={traitStyles.fieldLabel}>Prompt (optional)</Text>
            <TextInput style={traitStyles.input} value={draft.prompt} onChangeText={v => set({ prompt: v })}
              placeholder="Shown to the player — defaults to a generic prompt if left blank"
              placeholderTextColor={Colors.textDim} />

            {draft.kind === 'spell' && (
              <View style={styles.poolPanel}>
                <Text style={traitStyles.effectGroupLabel}>From the spell list of</Text>
                <View style={traitStyles.chipWrap}>
                  {SPELL_LISTS.map(l => {
                    const active = (draft.spellLists ?? []).includes(l);
                    return (
                      <Pressable key={l} style={[traitStyles.chip, active && traitStyles.chipActive]}
                        onPress={() => set({ spellLists: l === 'any' ? (active ? [] : ['any']) : toggleIn(draft.spellLists, l).filter(x => x !== 'any') })}>
                        <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{l === 'any' ? 'Any spell' : l.charAt(0).toUpperCase() + l.slice(1)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={traitStyles.effectNote}>None picked: the character's own class list.</Text>
                <Text style={traitStyles.effectGroupLabel}>Spell levels</Text>
                <View style={traitStyles.chipWrap}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => {
                    const active = (draft.spellLevels ?? []).includes(l);
                    return (
                      <Pressable key={l} style={[traitStyles.chip, active && traitStyles.chipActive]} onPress={() => set({ spellLevels: toggleIn(draft.spellLevels, l) })}>
                        <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{l === 0 ? 'Cantrip' : String(l)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={traitStyles.effectNote}>None picked: level 1 up to what the character can cast.</Text>
              </View>
            )}

            {draft.kind === 'feature_pool' && (
              <View style={styles.poolPanel}>
                <Text style={traitStyles.effectGroupLabel}>Options</Text>
                <TraitListEditor
                  traits={(draft.options ?? []).map(o => o.trait)}
                  excludeKinds={['resource_ability', 'spell_grant']}
                  onChange={traits => set({ options: traits.map(t => ({ trait: t, minLevel: (draft.options ?? []).find(o => o.trait.localId === t.localId)?.minLevel ?? '' })) })}
                />
                {(draft.options ?? []).map(o => (
                  <View key={o.trait.localId} style={traitStyles.rowInline}>
                    <Text style={[traitStyles.inlineLabel, { flex: 1 }]} numberOfLines={1}>{o.trait.name || 'Option'}: from level</Text>
                    <TextInput style={[traitStyles.input, traitStyles.smallInput]} value={o.minLevel} keyboardType="number-pad" placeholder="1"
                      placeholderTextColor={Colors.textDim} accessibilityLabel={`Level ${o.trait.name} needs`}
                      onChangeText={v => set({ options: (draft.options ?? []).map(x => (x.trait.localId === o.trait.localId ? { ...x, minLevel: v } : x)) })} />
                  </View>
                ))}
                <Text style={traitStyles.effectGroupLabel}>Can a held option be swapped?</Text>
                <View style={traitStyles.chipWrap}>
                  {(Object.keys(REPLACE_LABELS) as ('' | ChoiceReplacePolicy['timing'])[]).map(t => {
                    const active = (draft.replaceTiming ?? '') === t;
                    return (
                      <Pressable key={t || 'never'} style={[traitStyles.chip, active && traitStyles.chipActive]} onPress={() => set({ replaceTiming: t })}>
                        <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{REPLACE_LABELS[t]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {hasOptionPool(draft.kind) && <>
            <Text style={traitStyles.fieldLabel}>Eligible Pool</Text>
            <View style={traitStyles.chipWrap}>
              {poolModes.map(m => (
                <Pressable key={m} style={[traitStyles.chip, draft.poolMode === m && traitStyles.chipActive]}
                  onPress={() => set({ poolMode: m })}>
                  <Text style={[traitStyles.chipTxt, draft.poolMode === m && traitStyles.chipTxtActive]}>{POOL_MODE_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>

            {draft.poolMode === 'all' && (
              <Text style={traitStyles.effectNote}>{allPoolNote(draft.kind)}</Text>
            )}

            {draft.poolMode === 'category' && (
              <View style={styles.poolPanel}>
                <View style={traitStyles.chipWrap}>
                  {categories.map(cat => {
                    const active = draft.categories.includes(cat);
                    return (
                      <Pressable key={cat} style={[traitStyles.chip, active && traitStyles.chipActive]} onPress={() => toggleCategory(cat)}>
                        <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{categoryLabelsFor(draft.kind)[cat] ?? cat}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={traitStyles.effectNote}>
                  Compiled to the specific {idsForCategories(draft.kind, draft.categories).length} option{idsForCategories(draft.kind, draft.categories).length === 1 ? '' : 's'} in
                  {' '}the selected categor{draft.categories.length === 1 ? 'y' : 'ies'} when saved.
                </Text>
              </View>
            )}

            {draft.poolMode === 'restricted' && (
              <View style={styles.poolPanel}>
                {grouped.map(g => (
                  <View key={g.group ?? '_'} style={{ gap: 4 }}>
                    {g.group && <Text style={traitStyles.effectGroupLabel}>{g.group}</Text>}
                    <View style={traitStyles.chipWrap}>
                      {g.entries.map(o => {
                        const active = draft.restrictedIds.includes(o.id);
                        return (
                          <Pressable key={o.id} style={[traitStyles.chip, active && traitStyles.chipActive]} onPress={() => toggleRestricted(o.id)}>
                            <Text style={[traitStyles.chipTxt, active && traitStyles.chipTxtActive]}>{o.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {draft.poolMode !== 'all' && (
              <Text style={styles.poolSizeNote}>Pool size: {poolSize}</Text>
            )}
            </>}

            {errors.length > 0 && (
              <View style={styles.errorPanel}>
                {errors.map((e, i) => <Text key={i} style={styles.errorTxt}>⚠ {e}</Text>)}
              </View>
            )}

            <SafeBottomView>
              <View style={traitStyles.traitModalBtnRow}>
                <Pressable style={traitStyles.traitDeleteBtn} onPress={onDelete}>
                  <Text style={traitStyles.traitDeleteTxt}>Delete Choice</Text>
                </Pressable>
                <Pressable style={traitStyles.traitDoneBtn} onPress={onDone}>
                  <Text style={traitStyles.traitDoneTxt}>Done</Text>
                </Pressable>
              </View>
            </SafeBottomView>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── List of choices + add flow ──────────────────────────────────────────────

export function ChoiceDefinitionListEditor({ choices, onChange, addLabel, allowPools }: {
  choices: DraftChoice[];
  onChange: (choices: DraftChoice[]) => void;
  addLabel?: string;
  allowPools?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  function addChoice() {
    const d = newDraftChoice('tool');
    onChange([...choices, d]);
    setOpenId(d.localId);
  }
  function updateChoice(d: DraftChoice) {
    onChange(choices.map(x => x.localId === d.localId ? d : x));
  }
  function deleteChoice(localId: string) {
    onChange(choices.filter(x => x.localId !== localId));
    setOpenId(null);
  }

  const open = choices.find(c => c.localId === openId) ?? null;

  return (
    <View style={{ gap: Spacing.xs }}>
      {choices.map(c => {
        const invalid = validateDraftChoice(c).length > 0;
        return (
          <Pressable key={c.localId} style={traitStyles.traitCard} onPress={() => setOpenId(c.localId)}>
            <View style={{ flex: 1 }}>
              <Text style={traitStyles.traitCardName}>{CHOICE_KIND_LABELS[c.kind]} choice{invalid ? ' ⚠' : ''}</Text>
              <Text style={traitStyles.traitCardMeta}>{summarizeDraftChoice(c)}</Text>
            </View>
            <Text style={traitStyles.traitCardCaret}>{'>'}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.addBtn} onPress={addChoice}>
        <Text style={styles.addBtnTxt}>{addLabel ?? '+ Add Player Choice'}</Text>
      </Pressable>

      <ChoiceDefinitionEditorModal
        draft={open}
        visible={!!open}
        onChange={updateChoice}
        onDone={() => setOpenId(null)}
        onDelete={() => open && deleteChoice(open.localId)}
        allowPools={allowPools}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  poolPanel: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  poolSizeNote: { fontSize: FontSize.xs, color: Colors.textDim, marginTop: 4 },
  errorPanel: {
    backgroundColor: Colors.red + '11', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '55',
    padding: Spacing.sm, gap: 4, marginTop: Spacing.sm,
  },
  errorTxt: { color: Colors.red, fontSize: FontSize.xs },
  addBtn: {
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', padding: Spacing.sm, alignItems: 'center',
  },
  addBtnTxt: { color: Colors.gold, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
