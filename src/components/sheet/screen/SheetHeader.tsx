import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { Identity, Entity, DerivedStats, ResourceBlock, Issue } from '../../../engine/types';
import { UndoEntry } from '../../../store/characterStore';
import { identityLabelsFor } from '../../../store/identityLabelsFor';
import { VersionNotes } from '../../../store/pinningService';
import { Colors } from '../../../theme';
import { Pressable } from '../../AccessibleControls';
import { Modal } from '../../AppModal';
import { RecordIcon } from '../../RecordPicture';
import { MenuAction } from './MenuAction';
import { styles } from './sheetScreenStyles';

export function SheetHeader({
  goBack, identity, setRenameOpen, undoStack, id, undo, redoStack, redo, setHeaderMenuOpen, setInfoOpen, entity, hpColor, headerHpCurrent,
  headerHpMax, wildShaped, derived, resources, headerMenuOpen, setHistoryOpen, setRulesetChangeOpen, freeEditAllowed, setFreeEditOpen,
  versions, setVersionsOpen, exporting, setExportSheetOpen, issues, setIssuesOpen,
}: {
  goBack: () => void;
  identity: Identity;
  setRenameOpen: Dispatch<SetStateAction<boolean>>;
  undoStack: UndoEntry[];
  id: string;
  undo: () => void;
  redoStack: UndoEntry[];
  redo: () => void;
  setHeaderMenuOpen: Dispatch<SetStateAction<boolean>>;
  setInfoOpen: Dispatch<SetStateAction<boolean>>;
  entity: Entity;
  hpColor: string;
  headerHpCurrent: number;
  headerHpMax: number;
  wildShaped: boolean | undefined;
  derived: DerivedStats;
  resources: ResourceBlock;
  headerMenuOpen: boolean;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setRulesetChangeOpen: Dispatch<SetStateAction<boolean>>;
  freeEditAllowed: boolean;
  setFreeEditOpen: Dispatch<SetStateAction<boolean>>;
  versions: VersionNotes | null;
  setVersionsOpen: Dispatch<SetStateAction<boolean>>;
  exporting: boolean;
  setExportSheetOpen: Dispatch<SetStateAction<boolean>>;
  issues: Issue[];
  setIssuesOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* Header — name + always-visible HP / AC / Speed */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backTxt}>← Back</Text>
          </Pressable>
          <RecordIcon record={{ imageUri: identity.portraitUri }} size={32} />
          <Pressable style={styles.charNameBtn} onPress={() => setRenameOpen(true)} accessibilityRole="button" accessibilityLabel={`Rename ${identity.name || 'character'}`} accessibilityHint="Opens a box to change the character's name">
            <Text style={styles.charName} numberOfLines={1} ellipsizeMode="tail">{identity.name || 'Unnamed'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" testID="character-undo" accessibilityLabel="Undo" style={styles.headerIconBtn} disabled={undoStack[0]?.entityId !== id} onPress={undo}><Text style={[styles.headerIcon,undoStack[0]?.entityId!==id&&styles.undoRedoTxtDisabled]}>↶</Text></Pressable>
          <Pressable accessibilityRole="button" testID="character-redo" accessibilityLabel="Redo" style={styles.headerIconBtn} disabled={redoStack[0]?.entityId !== id} onPress={redo}><Text style={[styles.headerIcon,redoStack[0]?.entityId!==id&&styles.undoRedoTxtDisabled]}>↷</Text></Pressable>
          <Pressable accessibilityRole="button" testID="character-more" accessibilityLabel="More character actions" style={styles.headerIconBtn} onPress={()=>setHeaderMenuOpen(true)}><Text style={styles.headerIcon}>⋮</Text></Pressable>
        </View>
        <View style={styles.headerStats}>
          <Pressable onPress={() => setInfoOpen(true)} style={styles.charSubBtn} accessibilityRole="button" accessibilityLabel="Character info" accessibilityHint="Shows class, subclass, species, background and feats">
            <Text style={styles.charSub}>
              Lv {identity.level}  ·  {(entity ? identityLabelsFor(entity).class : '') || identity.classId || '—'}  ⓘ
            </Text>
          </Pressable>
          <View style={styles.statPills}>
            {/* HP */}
            <View style={[styles.statPill, { borderColor: hpColor + '88' }]}>
              <Text style={[styles.statPillValue, { color: hpColor }]}>
                {headerHpCurrent}
                <Text style={styles.statPillMax}>/{headerHpMax}</Text>
              </Text>
              <Text style={styles.statPillLabel}>{wildShaped ? 'BEAST HP' : 'HP'}</Text>
            </View>
            {/* AC */}
            <View style={styles.statPill}>
              <Text style={styles.statPillValue}>{derived.ac}</Text>
              <Text style={styles.statPillLabel}>AC</Text>
            </View>
            {/* Speed */}
            <View style={styles.statPill}>
              <Text style={styles.statPillValue}>{derived.speed}</Text>
              <Text style={styles.statPillLabel}>ft</Text>
            </View>
            {/* Temp HP badge — only when active */}
            {resources.hp.temp > 0 && (
              <View style={[styles.statPill, { borderColor: Colors.blue + '88' }]}>
                <Text style={[styles.statPillValue, { color: Colors.blue }]}>
                  +{resources.hp.temp}
                </Text>
                <Text style={styles.statPillLabel}>TMP</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <Modal visible={headerMenuOpen} transparent animationType="fade" onRequestClose={()=>setHeaderMenuOpen(false)}><Pressable style={styles.menuBackdrop} onPress={()=>setHeaderMenuOpen(false)}><View style={styles.headerMenu}>
        <MenuAction icon="ⓘ" label="Character info" onPress={()=>{setHeaderMenuOpen(false);setInfoOpen(true)}} />
        <MenuAction icon="✎" label="Rename" onPress={()=>{setHeaderMenuOpen(false);setRenameOpen(true)}} />
        <MenuAction icon="🕘" label="History" onPress={()=>{setHeaderMenuOpen(false);setHistoryOpen(true)}} />
        <MenuAction icon="🌐" label="Rules" onPress={()=>{setHeaderMenuOpen(false);setRulesetChangeOpen(true)}} />
        <MenuAction icon={freeEditAllowed?'✎':'🔒'} label={freeEditAllowed?'Free Edit':'Free Edit locked'} disabled={!freeEditAllowed} onPress={()=>{setHeaderMenuOpen(false);setFreeEditOpen(true)}} />
        <MenuAction icon={versions?.differences.length ? '⚠️' : '📌'} label={versions?.differences.length ? `Versions (${versions.differences.length})` : 'Versions'} onPress={()=>{setHeaderMenuOpen(false);setVersionsOpen(true)}} />
        <MenuAction icon="📤" label="Export Character" disabled={exporting} onPress={()=>{setHeaderMenuOpen(false);setExportSheetOpen(true)}} />
        {issues.length>0&&<MenuAction icon={issues.some(i=>i.severity==='error')?'⛔':'⚠️'} label={`Diagnostics (${issues.length})`} onPress={()=>{setHeaderMenuOpen(false);setIssuesOpen(true)}} />}
      </View></Pressable></Modal>
    </>
  );
}
