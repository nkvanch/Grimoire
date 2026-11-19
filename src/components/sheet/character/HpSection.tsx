import { Dispatch, SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { ResourceBlock } from '../../../engine/types';
import { Colors } from '../../../theme';
import { Pressable } from '../../AccessibleControls';
import { styles } from '../tabCharacterStyles';

export function HpSection({ setHpOpen, isDying, hpColor, resources, hpPct, setManualHpOpen, setMaxHpOpen, handleClearTempHp, setTempHpOpen }: {
  setHpOpen: Dispatch<SetStateAction<boolean>>;
  isDying: boolean;
  hpColor: string;
  resources: ResourceBlock;
  hpPct: number;
  setManualHpOpen: Dispatch<SetStateAction<boolean>>;
  setMaxHpOpen: Dispatch<SetStateAction<boolean>>;
  handleClearTempHp: () => void;
  setTempHpOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* HP Block */}
      <Pressable style={styles.hpBlock} onPress={() => setHpOpen(true)}>
        <Text style={styles.hpLabel}>HIT POINTS</Text>
        <View style={styles.hpNumbers}>
          <Text style={[styles.hpCurrent, { color: isDying ? Colors.red : hpColor }]}>
            {resources.hp.current}
          </Text>
          <Text style={styles.hpSep}>/</Text>
          <Text style={styles.hpMax}>{resources.hp.maximum}</Text>
          {resources.hp.temp > 0 && (
            <Text style={styles.hpTemp}>  +{resources.hp.temp} tmp</Text>
          )}
        </View>
        <View style={styles.hpBarOuter}>
          <View style={[styles.hpBarFill, { width: `${Math.round(hpPct * 100)}%` as any, backgroundColor: hpColor }]} />
        </View>
        {isDying
          ? <Text style={styles.dyingTxt}>💀 Dying — Roll Death Saves below</Text>
          : <Text style={styles.hpTapHint}>Tap to damage / heal</Text>
        }
      </Pressable>

      {/* HP utility row: manual set + temporary HP */}
      {!isDying && (
        <View style={styles.hpUtilRow}>
          <View style={styles.hpUtilBtns}>
            <Pressable style={styles.hpUtilBtn} onPress={() => setManualHpOpen(true)}>
              <Text style={styles.hpUtilTxt}>✎ Set HP</Text>
            </Pressable>
            <Pressable style={styles.hpUtilBtn} onPress={() => setMaxHpOpen(true)}>
              <Text style={styles.hpUtilTxt}>✎ Set Max</Text>
            </Pressable>
          </View>
          <View style={styles.tempHpControls}>
            <Text style={styles.tempHpLabel}>Temp HP: {resources.hp.temp}</Text>
            <Pressable style={styles.resBtn} onPress={handleClearTempHp} disabled={resources.hp.temp <= 0}>
              <Text style={[styles.resBtnTxt, resources.hp.temp <= 0 && styles.disabled]}>−</Text>
            </Pressable>
            <Pressable style={styles.resBtn} onPress={() => setTempHpOpen(true)}>
              <Text style={styles.resBtnTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}
