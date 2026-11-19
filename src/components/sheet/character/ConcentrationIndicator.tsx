import { View, Text } from 'react-native';
import { spellRepo } from '../../../content/spellRepo';
import { concentrationLinkedEffectNames } from '../../../engine/concentration';
import { SpellcastingBlock, Entity } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { confirmEndConcentration } from '../spellTabUi';
import { styles } from '../tabCharacterStyles';

export function ConcentrationIndicator({ spellcasting, entity, onEndConcentration }: {
  spellcasting: SpellcastingBlock | null;
  entity: Entity;
  onEndConcentration: (spellName: string) => void;
}) {
  return (
    <>
      {/* Concentration indicator */}
      {spellcasting?.concentrating && (
        <View style={[styles.concIndicator, styles.concIndicatorRow]}>
          <Text style={[styles.concIndicatorTxt, styles.concIndicatorLabel]}>
            🧠 Concentrating on: {spellRepo.getSpellSync(spellcasting.concentrating)?.name ?? spellcasting.concentrating}
            {spellcasting.concentratingDuration?.unit === 'rounds' && ` · ${spellcasting.concentratingDuration.remaining}r`}
          </Text>
          <Pressable
            style={styles.concEndBtn}
            hitSlop={6}
            accessibilityLabel="End concentration"
            onPress={() => {
              const name = spellRepo.getSpellSync(spellcasting.concentrating!)?.name ?? spellcasting.concentrating!;
              confirmEndConcentration(name, concentrationLinkedEffectNames(entity), () => onEndConcentration(name));
            }}
          >
            <Text style={styles.concEndBtnTxt}>End</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
