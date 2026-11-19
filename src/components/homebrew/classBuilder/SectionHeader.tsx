import { View, Text } from 'react-native';
import { styles } from './classBuilderStyles';

// ── Section header component ───────────────────────────────────────────────────

export function SectionHeader({ title, n }: { title: string; n: number }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionNum}><Text style={styles.sectionNumTxt}>{n}</Text></View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}
