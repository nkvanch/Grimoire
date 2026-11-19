import { ImperativeRouter } from 'expo-router';
import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { Entity } from '../../../engine/types';
import { scrollBottomPadding, Spacing } from '../../../theme';
import { Pressable } from '../../AccessibleControls';
import { Modal } from '../../AppModal';
import { AddSpellModal } from '../../sheet/AddSpellModal';
import { AdditionalSpellFlow } from './spellsScreenModel';
import { styles } from './spellsScreenStyles';

export function AdditionalSpellSection({ draft, setAdditionalFlow, additionalFlow, handleAddAdditionalSpell, insets, router }: {
  draft: Entity | null;
  setAdditionalFlow: Dispatch<SetStateAction<AdditionalSpellFlow>>;
  additionalFlow: AdditionalSpellFlow;
  handleAddAdditionalSpell: (spellId: string, isCantrip: boolean) => void;
  insets: EdgeInsets;
  router: ImperativeRouter;
}) {
  if (!draft!.spellcasting) return null;
  return (
    <View style={styles.additionalSpellSection}>
      <Pressable style={styles.addSpellBtn} onPress={() => setAdditionalFlow('menu')}>
        <Text style={styles.addSpellBtnTxt}>+ Add Additional Spell</Text>
      </Pressable>

      {additionalFlow === 'library' && (
        <AddSpellModal
          visible
          entity={draft!}
          initialOfficialFilter="official"
          onAdd={handleAddAdditionalSpell}
          onClose={() => setAdditionalFlow('closed')}
        />
      )}
      {additionalFlow === 'homebrew' && (
        <AddSpellModal
          visible
          entity={draft!}
          initialOfficialFilter="homebrew"
          onAdd={handleAddAdditionalSpell}
          onClose={() => setAdditionalFlow('closed')}
        />
      )}
      {additionalFlow === 'menu' && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAdditionalFlow('closed')}>
          <Pressable style={styles.backdrop} onPress={() => setAdditionalFlow('closed')}>
            <Pressable style={[styles.menuSheet, { paddingBottom: scrollBottomPadding(insets.bottom, Spacing.md) }]} onPress={e => e.stopPropagation()}>
              <Text style={styles.menuTitle}>Add Additional Spell</Text>
              <Text style={styles.menuSub}>Browses the whole spell library — doesn't use up your class's spell picks.</Text>
              <Pressable style={styles.menuBtn} onPress={() => setAdditionalFlow('library')}>
                <Text style={styles.menuBtnTxt}>Browse Spell Library</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => setAdditionalFlow('homebrew')}>
                <Text style={styles.menuBtnTxt}>Browse Homebrew</Text>
              </Pressable>
              <Pressable style={styles.menuBtn} onPress={() => { setAdditionalFlow('closed'); router.push('/homebrew/spell-builder'); }}>
                <Text style={styles.menuBtnTxt}>Create New Homebrew Spell</Text>
              </Pressable>
              <Pressable style={styles.menuCancel} onPress={() => setAdditionalFlow('closed')}>
                <Text style={styles.menuCancelTxt}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
