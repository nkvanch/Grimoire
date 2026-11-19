import { useState } from 'react';
import { Text, View } from 'react-native';
import { Currency } from '../../engine/types';
import { Colors } from '../../theme';
import { Pressable, TextInput } from '../AccessibleControls';
import { Modal } from '../AppModal';
import { currStyles } from './inventoryStyles';

// ── Currency helpers ───────────────────────────────────────────────────────────

export const COIN_KEYS: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];
export const COIN_COLORS: Record<keyof Currency, string> = {
  pp: Colors.blue,
  gp: Colors.gold,
  ep: Colors.textSecondary,
  sp: Colors.textSecondary,
  cp: Colors.textSecondary,
};

// ── Currency Modal ─────────────────────────────────────────────────────────────

export function CurrencyModal({
  visible, currency, onSave, onClose,
}: {
  visible:  boolean;
  currency: Currency;
  onSave:   (c: Currency) => void;
  onClose:  () => void;
}) {
  const [values, setValues] = useState<Record<keyof Currency, string>>({
    pp: String(currency.pp),
    gp: String(currency.gp),
    ep: String(currency.ep),
    sp: String(currency.sp),
    cp: String(currency.cp),
  });

  function handleSave() {
    const next: Currency = {
      pp: Math.max(0, parseInt(values.pp, 10) || 0),
      gp: Math.max(0, parseInt(values.gp, 10) || 0),
      ep: Math.max(0, parseInt(values.ep, 10) || 0),
      sp: Math.max(0, parseInt(values.sp, 10) || 0),
      cp: Math.max(0, parseInt(values.cp, 10) || 0),
    };
    onSave(next);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={currStyles.backdrop} onPress={onClose}>
        <Pressable style={currStyles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={currStyles.title}>Edit Currency</Text>
          <View style={currStyles.grid}>
            {COIN_KEYS.map(key => (
              <View key={key} style={currStyles.coinEdit}>
                <Text style={[currStyles.coinLabel, { color: COIN_COLORS[key] }]}>
                  {key.toUpperCase()}
                </Text>
                <TextInput
                  style={currStyles.coinInput}
                  value={values[key]}
                  onChangeText={v => setValues(prev => ({ ...prev, [key]: v }))}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
            ))}
          </View>
          <View style={currStyles.btns}>
            <Pressable style={currStyles.cancelBtn} onPress={onClose}>
              <Text style={currStyles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable style={currStyles.saveBtn} onPress={handleSave}>
              <Text style={currStyles.saveTxt}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
