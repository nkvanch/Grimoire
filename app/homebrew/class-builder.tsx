// app/homebrew/class-builder.tsx
// Homebrew class builder — Phase 2 full authoring UI.
// Sections: Basics → Saving Throws → Proficiencies →
//           Spellcasting → Per-Level Features → ASI Levels → Save
import { useState, useEffect, useMemo } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollView } from '../../src/components/Lists';
import { Pressable } from '../../src/components/AccessibleControls';
import type { ContentOrigin } from '../../src/engine/types';
import { useLocalSearchParams } from 'expo-router';
import { CharClass, Ability, Entity, RulesetId } from '../../src/engine/types';
import {
  ChoiceDefinitionEditorModal, DraftChoice, newDraftChoice,
} from '../../src/components/homebrew/ChoiceDefinitionEditor';
import { useHomebrewStore } from '../../src/store/homebrewStore';
import { usePendingSelectionStore } from '../../src/store/pendingSelectionStore';
import { Alert } from '../../src/utils/alert';
import { mergeItemIndex, resolveItemById } from '../../src/content/contentResolution';
import { useSafeGoBack } from '../../src/hooks/useSafeGoBack';
import { useEdited } from '../../src/hooks/useDiscardGuard';
import { useLeaveGuard } from '../../src/hooks/useLeaveGuard';
import { poolChoicesBefore } from '../../src/content/classes/knownResources';
import { newDraftTrait, TraitEditorModal, disambiguateId } from '../../src/components/homebrew/TraitEditor';
import { globalContentDB } from '../../src/content/classes/library';
import { getProgressionForClass } from '../../src/content/classes/progressions';
import { simulate } from '../../src/engine/simulate';
import { applyGrant } from '../../src/engine/levelingGrants';
import { buildFeatSummaryRows } from '../../src/components/FeatPreviewModal';
import { HomebrewTestModal, Row } from '../../src/components/homebrew/HomebrewTestModal';
import { useCharacterStore } from '../../src/store/characterStore';
import { makeEmptyEntity, DEFAULT_RULES } from '../../src/engine/defaults';
import { mergeHomebrewDefinition } from '../../src/engine/homebrewRoundTrip';
import { compileClassFields, multiclassNeedsDraft } from '../../src/content/homebrewCompile';
import { hydrateLeveledChoices, serializeLeveledChoices } from '../../src/engine/homebrewNestedSerializers';
import { picturesOf, withPictures, type RecordPictures } from '../../src/content/recordPictures';
import { styles } from '../../src/components/homebrew/classBuilder/classBuilderStyles';
import { LevelFeature, LevelChoice, DEFAULT_ASI_LEVELS, normalizeLevelFeature, toId } from '../../src/components/homebrew/classBuilder/classBuilderModel';
import { BasicsSection } from '../../src/components/homebrew/classBuilder/BasicsSection';
import { SavingThrowsSection } from '../../src/components/homebrew/classBuilder/SavingThrowsSection';
import { StartingProficienciesSection } from '../../src/components/homebrew/classBuilder/StartingProficienciesSection';
import { MulticlassSection } from '../../src/components/homebrew/classBuilder/MulticlassSection';
import { StartingEquipmentSection } from '../../src/components/homebrew/classBuilder/StartingEquipmentSection';
import { SpellcastingSection } from '../../src/components/homebrew/classBuilder/SpellcastingSection';
import { LevelFeaturesSection } from '../../src/components/homebrew/classBuilder/LevelFeaturesSection';
import { LevelChoicesSection } from '../../src/components/homebrew/classBuilder/LevelChoicesSection';
import { AsiLevelsSection } from '../../src/components/homebrew/classBuilder/AsiLevelsSection';
import { ClassBuilderFooter } from '../../src/components/homebrew/classBuilder/ClassBuilderFooter';

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ClassBuilderScreen() {
  const goBack   = useSafeGoBack('/(tabs)');
  const saveItem = useHomebrewStore(s => s.saveItem);
  const homebrewItems = useHomebrewStore(s => s.items);
  const homebrewClasses = useHomebrewStore(s => s.classes);
  const savedSpellLists = useHomebrewStore(s => s.spellLists);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editing = editId ? homebrewClasses.find(c => c.id === editId) ?? null : null;
  const draftRulesetId = useCharacterStore(s => s.draft?.rulesetId);
  const [rulesetId, setRulesetId] = useState<RulesetId | undefined>(() => editing ? editing.rulesetId : draftRulesetId);

  // ── Basics
  const [name,        setName]        = useState('');
  const [pictures, setPictures] = useState<RecordPictures>({});
  const [origin, setOrigin] = useState<ContentOrigin | undefined>(undefined);
  const [hitDie,      setHitDie]      = useState<4|6|8|10|12>(8);
  const [hpAbility,   setHpAbility]   = useState<Ability>('con');
  const [description, setDescription] = useState('');

  // ── Saving Throws
  const [savingThrows, setSavingThrows] = useState<Ability[]>([]);

  // ── Proficiencies
  const [armorProfs,  setArmorProfs]  = useState<string[]>([]);
  const [weaponProfs, setWeaponProfs] = useState<string[]>([]);
  const [toolProfs,   setToolProfs]   = useState<string[]>([]);
  // What taking the class as a second class grants (the reduced multiclassing table).
  const [mcArmor,   setMcArmor]   = useState<string[]>([]);
  const [mcWeapons, setMcWeapons] = useState<string[]>([]);
  const [mcTools,   setMcTools]   = useState('');
  // The abilities needed to take the class with another (all, or any one), compiled to multiclassPrerequisites.
  const [mcNeeds,   setMcNeeds]   = useState<Ability[]>([]);
  const [mcNeedMin, setMcNeedMin] = useState('13');
  const [mcNeedAny, setMcNeedAny] = useState(false);
  const [newTool,     setNewTool]     = useState('');

  // ── Starting Equipment
  const [startingEquipment, setStartingEquipment] = useState<{ id: string; name: string }[]>([]);
  const [equipSearch, setEquipSearch] = useState('');
  // Purely descriptive — deliberately NOT added to startingEquipment (which
  // holds real item ids the engine grants via a 'starting_item' Grant). A
  // fake item id here would push an unresolvable inventory entry onto any
  // character who takes this class — broken, not just incomplete. This is
  // shown as flavor text instead, same honest tradeoff as the background
  // builder's equipment field.
  const [equipmentNotes, setEquipmentNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testRows, setTestRows] = useState<Row[]>([]);

  // ── Spellcasting
  const [isCaster,        setIsCaster]        = useState(false);
  // Multi-select: 1 selected = fixed ability (backward-compat behavior); 2+
  // selected = the player picks at creation (spellcastingAbilityOptions).
  const [spellAbilities,  setSpellAbilities]  = useState<Ability[]>(['cha']);
  const [spellStyle,      setSpellStyle]      = useState<'full'|'half'|'pact'>('full');
  const [spellPrepPolicy, setSpellPrepPolicy] = useState<'known'|'spellbook_prepared'|'full_list_prepared'>('known');
  const [spellStartLevel, setSpellStartLevel] = useState('1');
  // Where this class's spell choices come from: 'own' (spells tagged for this class), another class's
  // spell list ('class:<id>'), or one of the player's saved Spell Lists ('list:<id>').
  const [spellSource, setSpellSource] = useState<string>('own');
  // Classes whose spell list can be borrowed: every spellcasting class, official or homebrew (not this one).
  const borrowableClasses = useMemo(() => {
    const all = [...globalContentDB.classes, ...homebrewClasses.filter(c => !globalContentDB.classes.some(o => o.id === c.id))];
    return all.filter(c => c.id !== editing?.id && (c.spellcastingAbility || (c.spellcastingAbilityOptions?.length ?? 0) > 0 || c.spellcastingStyle));
  }, [homebrewClasses, editing?.id]);

  // ── Per-level features
  const [levelFeatures, setLevelFeatures] = useState<LevelFeature[]>([]);
  const [addLevel, setAddLevel] = useState('1');
  const [addName,  setAddName]  = useState('');
  const [openFeatureId, setOpenFeatureId] = useState<string | null>(null);

  // ── Per-level player choices (Expertise/Tool/Language)
  const [levelChoicesList, setLevelChoicesList] = useState<LevelChoice[]>([]);
  const [addChoiceLevel, setAddChoiceLevel] = useState('1');
  const [openChoiceId, setOpenChoiceId] = useState<string | null>(null);

  // ── ASI levels
  const [asiLevels, setAsiLevels] = useState<number[]>([...DEFAULT_ASI_LEVELS]);

  // Edit mode: CharClass already stores every authoring field directly (it's
  // the same simplified shape the builder writes), so reloading is a direct
  // 1:1 field copy — no reverse-engineering from the compiled progression
  // needed. Runs once when the existing class first resolves.
  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setPictures(picturesOf(editing));
    setOrigin(editing.origin);
    setRulesetId(editing.rulesetId);
    setHitDie(editing.hitDie as 4|6|8|10|12);
    setHpAbility(editing.hpAbility ?? 'con');
    setDescription(editing.description ?? '');
    setSavingThrows(editing.savingThrows ?? []);
    setArmorProfs(editing.armorProfs ?? []);
    setWeaponProfs(editing.weaponProfs ?? []);
    setToolProfs(editing.toolProfs ?? []);
    setMcArmor(editing.multiclassProficiencies?.armor ?? []);
    setMcWeapons(editing.multiclassProficiencies?.weapons ?? []);
    setMcTools((editing.multiclassProficiencies?.tools ?? []).join(', '));
    { const n = multiclassNeedsDraft(editing.multiclassPrerequisites); setMcNeeds(n.abilities); setMcNeedMin(String(n.minimum)); setMcNeedAny(n.any); }
    setStartingEquipment(
      (editing.startingEquipment ?? []).map(id => {
        // Bug fix (architecture review C9): this used to concat official +
        // homebrew with no dedup and official listed first, so a homebrew
        // item overriding an official one by id resolved to the official
        // name instead of the override — resolveItemById already centralizes
        // the correct homebrew-first precedence (contentResolution.ts).
        const found = resolveItemById(id, homebrewItems);
        return { id, name: found?.name ?? id };
      })
    );
    setEquipmentNotes(editing.equipmentNotes ?? '');
    setIsCaster(!!editing.spellcastingAbility || (editing.spellcastingAbilityOptions?.length ?? 0) > 0);
    setSpellAbilities(
      editing.spellcastingAbilityOptions?.length ? editing.spellcastingAbilityOptions
      : editing.spellcastingAbility ? [editing.spellcastingAbility]
      : ['cha']
    );
    setSpellStyle(editing.spellcastingStyle ?? 'full');
    setSpellPrepPolicy(
      editing.spellPreparationPolicy === 'spellbook_prepared' || editing.spellPreparationPolicy === 'full_list_prepared'
        ? editing.spellPreparationPolicy : 'known'
    );
    setSpellStartLevel(String(editing.spellcastingStartLevel ?? 1));
    setSpellSource(editing.spellListSource
      ? (editing.spellListSource.kind === 'list' ? `list:${editing.spellListSource.listId}` : `class:${editing.spellListSource.classId}`)
      : 'own');
    setLevelFeatures((editing.levelFeatures ?? []).map(normalizeLevelFeature));
    setAsiLevels(editing.asiLevels ?? [...DEFAULT_ASI_LEVELS]);
    // CHOICE-AUTHORING-1: CharClass.levelChoices stores already-compiled
    // ChoiceDefinition[] per level (unlike levelFeatures' draft-shaped
    // DraftTrait[]) — reconstruct via definitionToDraftChoice using the
    // exact idPrefix buildHomebrewClass() below composes at save time, so
    // re-saving without changes round-trips to the same ids.
    setLevelChoicesList(hydrateLeveledChoices(editing.levelChoices, editing.id));
  }, [editing?.id]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleSavingThrow(ab: Ability) {
    setSavingThrows(prev =>
      prev.includes(ab) ? prev.filter(a => a !== ab) : [...prev, ab]
    );
  }
  function toggleArmorProf(prof: string) {
    setArmorProfs(prev =>
      prev.includes(prof) ? prev.filter(p => p !== prof) : [...prev, prof]
    );
  }
  function toggleWeaponProf(prof: string) {
    setWeaponProfs(prev =>
      prev.includes(prof) ? prev.filter(p => p !== prof) : [...prev, prof]
    );
  }
  function addTool() {
    const t = newTool.trim();
    if (!t || toolProfs.includes(t)) return;
    setToolProfs(prev => [...prev, t]);
    setNewTool('');
  }
  function toggleTool(t: string) {
    setToolProfs(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }
  function removeTool(t: string) {
    setToolProfs(prev => prev.filter(x => x !== t));
  }
  function toggleSpellAbility(ab: Ability) {
    setSpellAbilities(prev =>
      prev.includes(ab)
        ? prev.length > 1 ? prev.filter(a => a !== ab) : prev  // keep at least 1 selected
        : [...prev, ab]
    );
  }
  function addStartingItem(id: string, name: string) {
    if (startingEquipment.some(i => i.id === id)) return;
    setStartingEquipment(prev => [...prev, { id, name }]);
    setEquipSearch('');
  }
  function removeStartingItem(id: string) {
    setStartingEquipment(prev => prev.filter(i => i.id !== id));
  }
  // Bug fix (architecture review C9): same unmerged-concat pattern as
  // above — mergeItemIndex already dedups by id (homebrew wins) instead of
  // showing a colliding homebrew/official pair as two separate rows.
  // BUILDER-PERF-1: mergeItemIndex (full ~891-item catalog merge) used to
  // rerun on every keystroke of equipSearch once it hit 2+ chars — split
  // into its own memo (only recomputes when homebrewItems actually
  // changes) so each keystroke only pays for the filter/slice, not the
  // full merge.
  const allItemIndex = useMemo(() => mergeItemIndex(homebrewItems), [homebrewItems]);
  const equipResults = useMemo(() => equipSearch.trim().length >= 2
    ? allItemIndex
        .filter(i => i.name.toLowerCase().includes(equipSearch.trim().toLowerCase()))
        .slice(0, 12)
    : [], [allItemIndex, equipSearch]);
  function toggleAsiLevel(lvl: number) {
    setAsiLevels(prev =>
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl].sort((a, b) => a - b)
    );
  }
  function addFeature() {
    const lvl = parseInt(addLevel, 10);
    const nm  = addName.trim();
    if (!nm || isNaN(lvl) || lvl < 1 || lvl > 20) return;
    const f: LevelFeature = { ...newDraftTrait(nm), level: lvl };
    setLevelFeatures(prev => [...prev, f]);
    setAddName('');
    setOpenFeatureId(f.localId); // auto-open the editor — same pattern as race traits
  }
  function updateFeature(f: LevelFeature) {
    setLevelFeatures(prev => prev.map(x => x.localId === f.localId ? f : x));
  }
  function deleteFeature(localId: string) {
    setLevelFeatures(prev => prev.filter(x => x.localId !== localId));
    setOpenFeatureId(null);
  }

  function addLevelChoice() {
    const lvl = parseInt(addChoiceLevel, 10);
    if (isNaN(lvl) || lvl < 1 || lvl > 20) return;
    const d: LevelChoice = { ...newDraftChoice('tool'), level: lvl };
    setLevelChoicesList(prev => [...prev, d]);
    setOpenChoiceId(d.localId);
  }
  function updateLevelChoice(d: DraftChoice) {
    setLevelChoicesList(prev => prev.map(x => x.localId === d.localId ? { ...x, ...d } : x));
  }
  function deleteLevelChoice(localId: string) {
    setLevelChoicesList(prev => prev.filter(x => x.localId !== localId));
    setOpenChoiceId(null);
  }

  // ── Build / Save ───────────────────────────────────────────────────────────

  function buildHomebrewClass(): CharClass {
    const startLvl = parseInt(spellStartLevel, 10);
    // HOMEBREW-ID-COLLISION-1: see race-builder.tsx's identical fix for the
    // full explanation — auto-generated ids had no collision check against
    // official content.
    const takenClassIds = new Set([
      ...globalContentDB.classes.map(c => c.id),
      ...homebrewClasses.filter(c => c.id !== editing?.id).map(c => c.id),
    ]);
    const id = editing?.id ?? disambiguateId(toId(name) || 'homebrew_class', takenClassIds);
    const levelChoices = serializeLeveledChoices(editing?.levelChoices, levelChoicesList, id, { sourceKind: 'class', sourceRefId: id, classId: id });
    // What follows from the builder's inputs is compiled in content/homebrewCompile.ts (shared with the desktop app).
    const fields = compileClassFields({
      name, origin, hitDie, hpAbility, description, savingThrows, armorProfs, weaponProfs, toolProfs,
      multiclassArmor: mcArmor, multiclassWeapons: mcWeapons,
      multiclassTools: mcTools.split(',').map(t => t.trim()).filter(Boolean),
      multiclassNeeds: mcNeeds, multiclassNeedsMinimum: Number(mcNeedMin), multiclassNeedsAny: mcNeedAny,
      startingEquipment: startingEquipment.map(i => i.id), equipmentNotes, isCaster, spellAbilities: spellAbilities,
      spellStyle, spellPrepPolicy, spellStartLevel, spellSource, levelFeatures, asiLevels, rulesetId,
    }, id);
    return withPictures(pictures, mergeHomebrewDefinition(editing, {
      ...fields,
      features:    editing?.features ?? [],
      levelChoices,
      // Re-audit A39: this builder has no UI to author or edit either field
      // (both are import-only — an imported advanced class's full hand-
      // authored progression, or its PHB multiclass proficiency package).
      // Previously omitted from the returned object entirely, so editing an
      // imported class (even a rename-only save) silently deleted its real
      // progression/multiclass rules. Passed through unconditionally from
      // `editing` — there is nothing in this screen that could ever
      // intentionally change either, so no touched/dirty tracking is needed
      // here (unlike the trait-editor fields above).
      rawProgression:           editing?.rawProgression,
      // The builder authors armor, weapons and tools; languages an imported package carried are kept as they were.
      multiclassProficiencies:  fields.multiclassProficiencies || editing?.multiclassProficiencies?.languages?.length
        ? { ...(fields.multiclassProficiencies ?? {}), ...(editing?.multiclassProficiencies?.languages?.length ? { languages: editing.multiclassProficiencies.languages } : {}) }
        : undefined,
    }));
  }

  // Read-only test: reuses getProgressionForClass() — the SAME compile
  // function real class selection calls (progressions.ts:227) — to turn
  // the draft's simplified fields (savingThrows/armorProfs/levelFeatures/
  // spellcasting config/etc.) into real LevelEntry grants, so this test
  // can never drift from what picking the class for real would actually
  // produce. Same "combine every authored level at once, ignore the real
  // level-gate" approach as subclass-builder.tsx's runTest (verified safe
  // there: collectAllEffects only gates on Feature.isActive, never on
  // level) — a caster class's spell_slots grants specifically OVERWRITE
  // (not add to) the slot table each level (leveling.ts's "always zero
  // ALL tiers before applying the new row" comment), so applying every
  // level in order and keeping the LAST one is exactly right: it shows
  // the class's max slot table, not a broken accumulation. Only `entry
  // .grants` are applied — `entry.choices` (ASI/subclass-unlock/spellcasting-
  // ability picks) are skipped entirely, same as subclass-builder, since
  // none of them are specific to what THIS class's authored content does.
  function runTest() {
    const cls = buildHomebrewClass();
    const progression = getProgressionForClass(cls);
    const empty = makeEmptyEntity('homebrew-test');
    const scratch: Entity = { ...empty, identity: { ...empty.identity, level: 1 } };
    const { before, after } = simulate(scratch, e => {
      let updated = e;
      for (const entry of progression.entries) {
        for (const grant of entry.grants) {
          updated = applyGrant(updated, grant, entry.level, cls.id);
        }
      }
      return updated;
    }, DEFAULT_RULES);
    const rows = buildFeatSummaryRows(before, after);
    const beforeFeatureIds = new Set(before.features.map(f => f.id));
    for (const f of after.features) {
      if (!beforeFeatureIds.has(f.id)) rows.push({ label: `New feature: ${f.name}` });
    }
    const beforeResourceIds = new Set(before.resources.custom.map(r => r.id));
    for (const r of after.resources.custom) {
      if (!beforeResourceIds.has(r.id)) rows.push({ label: `New resource: ${r.name} (${r.maximum})` });
    }
    // Armor/weapon/tool proficiencies and starting equipment aren't part of
    // buildFeatSummaryRows either (it only diffs skill/save proficiencies) —
    // the 'proficiency' grant writes straight to entity.proficiencies.*,
    // never through a Feature, so it would otherwise be invisible here.
    const armorGained   = after.proficiencies.armor.filter(a => !before.proficiencies.armor.includes(a));
    const weaponsGained = after.proficiencies.weapons.filter(w => !before.proficiencies.weapons.includes(w));
    const toolsGained   = after.proficiencies.tools.filter(t => !before.proficiencies.tools.includes(t));
    if (armorGained.length > 0)   rows.push({ label: `Armor proficiency: ${armorGained.join(', ')}` });
    if (weaponsGained.length > 0) rows.push({ label: `Weapon proficiency: ${weaponsGained.join(', ')}` });
    if (toolsGained.length > 0)   rows.push({ label: `Tool proficiency: ${toolsGained.join(', ')}` });
    if (startingEquipment.length > 0) {
      rows.push({ label: `Starting equipment: ${startingEquipment.map(i => i.name).join(', ')}` });
    }
    // Spell slots aren't part of buildFeatSummaryRows/DERIVED_NUMERIC_KEYS —
    // show the class's eventual max slot table (the last level's grant,
    // per the "always overwrites" note above) same per-tier shape
    // LevelUpPreviewModal/RestPreviewModal already use.
    if (after.spellcasting) {
      for (const tier of ['1','2','3','4','5','6','7','8','9'] as const) {
        const total = after.spellcasting.slots[tier]?.total ?? 0;
        if (total > 0) rows.push({ label: `Level ${tier} slots (max): ${total}` });
      }
    } else if (isCaster && spellAbilities.length >= 2) {
      // Multi-ability casting defers the actual ability to a player choice
      // at creation (a non-auto-resolvable ChoiceDefinition, deliberately
      // not resolved by this test — see the comment above) — without an
      // init_spellcasting grant, the spell_slots grants that follow it all
      // no-op (leveling.ts's spell_slots case: "if (!entity.spellcasting)
      // return entity"), so slots can't be shown for this specific case.
      rows.push({ label: "This class lets the player choose a spellcasting ability at creation — spell slots aren't shown here since that choice isn't resolved in this test." });
    }
    if (rows.length > 0) {
      rows.push({ label: 'Shown combined across all authored levels (1-20) at once — not what a level 1 character of this class would actually have yet.' });
    }
    setTestRows(rows);
    setTestOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const cls = buildHomebrewClass();
    // Saves and navigates immediately rather than waiting on Alert's OK
    // button dismissal — React Native Web's Alert.alert has unreliable
    // callback-firing in some versions, so the actual save+navigate
    // shouldn't depend on it completing.
    try {
      await saveItem('class', cls);
      // SAVE-AND-ADD-1: tell class.tsx's class picker which class to
      // navigate to on return. No-op for any other caller.
      usePendingSelectionStore.getState().setPending('class_picker', cls.id);
      leave();
      goBack();
    } catch (e) {
      console.error('[class-builder] save failed:', e);
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Check the console for details.');
    } finally {
      setSaving(false);
    }
  }

  // ── Feature list grouped by level ─────────────────────────────────────────

  const featuresByLevel = new Map<number, LevelFeature[]>();
  levelFeatures.forEach(f => {
    if (!featuresByLevel.has(f.level)) featuresByLevel.set(f.level, []);
    featuresByLevel.get(f.level)!.push(f);
  });
  const sortedLevels = Array.from(featuresByLevel.keys()).sort((a, b) => a - b);
  const openFeature = levelFeatures.find(f => f.localId === openFeatureId) ?? null;

  const EFFECT_KIND_LABELS: Record<string, string> = {
    none: 'Flavor only', ability_score: 'Ability score bonus', skill_proficiency: 'Skill proficiency',
    tool_proficiency: 'Tool proficiency', advantage_disadvantage: 'Advantage/Disadvantage',
    sense: 'Grants a sense', movement: 'Grants movement', resource_ability: 'Limited-use ability',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Leaving with unsaved edits asks first; the save itself does not (src/hooks/useDiscardGuard.ts).
  const edited = useEdited(() => buildHomebrewClass(), editing?.id);
  const leave = useLeaveGuard(edited);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Class' : 'New Class'}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        <BasicsSection
          pictures={pictures}
          setPictures={setPictures}
          name={name}
          setName={setName}
          origin={origin}
          setOrigin={setOrigin}
          rulesetId={rulesetId}
          setRulesetId={setRulesetId}
          draftRulesetId={draftRulesetId}
          hitDie={hitDie}
          setHitDie={setHitDie}
          hpAbility={hpAbility}
          setHpAbility={setHpAbility}
          description={description}
          setDescription={setDescription}
        />

        <SavingThrowsSection savingThrows={savingThrows} toggleSavingThrow={toggleSavingThrow} />

        <StartingProficienciesSection
          armorProfs={armorProfs}
          toggleArmorProf={toggleArmorProf}
          weaponProfs={weaponProfs}
          toggleWeaponProf={toggleWeaponProf}
          toolProfs={toolProfs}
          toggleTool={toggleTool}
          removeTool={removeTool}
          newTool={newTool}
          setNewTool={setNewTool}
          addTool={addTool}
        />

        <MulticlassSection
          mcArmor={mcArmor}
          setMcArmor={setMcArmor}
          mcWeapons={mcWeapons}
          setMcWeapons={setMcWeapons}
          mcTools={mcTools}
          setMcTools={setMcTools}
          mcNeeds={mcNeeds}
          setMcNeeds={setMcNeeds}
          mcNeedMin={mcNeedMin}
          setMcNeedMin={setMcNeedMin}
          mcNeedAny={mcNeedAny}
          setMcNeedAny={setMcNeedAny}
        />

        <StartingEquipmentSection
          startingEquipment={startingEquipment}
          removeStartingItem={removeStartingItem}
          equipSearch={equipSearch}
          setEquipSearch={setEquipSearch}
          equipResults={equipResults}
          addStartingItem={addStartingItem}
          equipmentNotes={equipmentNotes}
          setEquipmentNotes={setEquipmentNotes}
        />

        <SpellcastingSection
          setIsCaster={setIsCaster}
          isCaster={isCaster}
          spellAbilities={spellAbilities}
          toggleSpellAbility={toggleSpellAbility}
          spellStyle={spellStyle}
          setSpellStyle={setSpellStyle}
          spellPrepPolicy={spellPrepPolicy}
          setSpellPrepPolicy={setSpellPrepPolicy}
          spellSource={spellSource}
          setSpellSource={setSpellSource}
          savedSpellLists={savedSpellLists}
          borrowableClasses={borrowableClasses}
          spellStartLevel={spellStartLevel}
          setSpellStartLevel={setSpellStartLevel}
        />

        <LevelFeaturesSection
          sortedLevels={sortedLevels}
          featuresByLevel={featuresByLevel}
          setOpenFeatureId={setOpenFeatureId}
          EFFECT_KIND_LABELS={EFFECT_KIND_LABELS}
          deleteFeature={deleteFeature}
          addLevel={addLevel}
          setAddLevel={setAddLevel}
          addName={addName}
          setAddName={setAddName}
          addFeature={addFeature}
        />

        <LevelChoicesSection
          levelChoicesList={levelChoicesList}
          setOpenChoiceId={setOpenChoiceId}
          deleteLevelChoice={deleteLevelChoice}
          addChoiceLevel={addChoiceLevel}
          setAddChoiceLevel={setAddChoiceLevel}
          addLevelChoice={addLevelChoice}
        />

        <AsiLevelsSection asiLevels={asiLevels} toggleAsiLevel={toggleAsiLevel} />

      </ScrollView>

      <ClassBuilderFooter name={name} runTest={runTest} saving={saving} handleSave={handleSave} />

      {/* ── Feature effect editor — same component race traits use ───────────── */}
      <TraitEditorModal
        trait={openFeature}
        visible={!!openFeature}
        onChange={t => updateFeature(t as LevelFeature)}
        onDone={() => setOpenFeatureId(null)}
        onDelete={() => openFeature && deleteFeature(openFeature.localId)}
        resourceChoices={poolChoicesBefore(levelFeatures, openFeature)}
        allowRaise
      />

      <HomebrewTestModal
        visible={testOpen}
        title={`Testing: ${name.trim() || 'New Class'}`}
        rows={testRows}
        onClose={() => setTestOpen(false)}
      />

      <ChoiceDefinitionEditorModal
        draft={levelChoicesList.find(c => c.localId === openChoiceId) ?? null}
        visible={!!openChoiceId}
        onChange={updateLevelChoice}
        onDone={() => setOpenChoiceId(null)}
        onDelete={() => openChoiceId && deleteLevelChoice(openChoiceId)}
        allowPools
      />

    </KeyboardAvoidingView>
  );
}

