import { View, Text } from 'react-native';
import { Pressable } from '../../AccessibleControls';
import { SafeBottomView } from '../../SafeBottomView';
import { styles } from './classBuilderStyles';

export function ClassBuilderFooter({ name, runTest, saving, handleSave }: {
  name: string;
  runTest: () => void;
  saving: boolean;
  handleSave: () => Promise<void>;
}) {
  return (
    <>
      {/* Footer: Test + Save */}
      <SafeBottomView>
        <View style={styles.footer}>
          <Pressable
            style={[styles.testBtn, !name.trim() && styles.btnDisabled]}
            onPress={runTest}
            disabled={!name.trim()}
          >
            <Text style={styles.testBtnTxt}>🧪 Test</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, (!name.trim() || saving) && styles.btnDisabled]}
            onPress={() => { void handleSave(); }}
            disabled={!name.trim() || saving}
          >
            <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save Class'}</Text>
          </Pressable>
        </View>
      </SafeBottomView>
    </>
  );
}
