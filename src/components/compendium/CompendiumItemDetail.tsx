// src/components/compendium/CompendiumItemDetail.tsx
// The expanded body of an item row in the Compendium. Loads the full record (the browser only holds the index, which has no
// features), as CompendiumSpellDetail does for spells.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Item } from '../../engine/types';
import { itemRepo } from '../../content/itemRepo';
import { itemRequiresAttunement } from '../../engine/itemMechanics';
import { Colors, FontSize, FontWeight } from '../../theme';

export function CompendiumItemDetail({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<Item | undefined>(() => itemRepo.getItemSync(itemId));
  useEffect(() => {
    let live = true;
    itemRepo.ensureLoaded([itemId]).then(() => { if (live) setItem(itemRepo.getItemSync(itemId)); }).catch(() => {});
    return () => { live = false; };
  }, [itemId]);
  if (!item) return null;
  const stats = [
    item.cost && item.cost !== '—' ? ['Cost', item.cost] : null,
    item.weight ? ['Weight', `${item.weight} lb`] : null,
    item.properties.length ? ['Properties', item.properties.join(', ')] : null,
  ].filter((s): s is string[] => !!s);
  return (
    <View style={styles.box}>
      {stats.map(([label, value]) => <Text key={label} style={styles.stat}><Text style={styles.statLabel}>{label}: </Text>{value}</Text>)}
      {itemRequiresAttunement(item) && <Text style={styles.stat}>Requires attunement</Text>}
      {item.features.map(f => (
        <Text key={f.id} style={styles.desc}><Text style={styles.statLabel}>{f.name}. </Text>{f.description}</Text>
      ))}
      {stats.length === 0 && item.features.length === 0 && <Text style={styles.desc}>Nothing more is recorded for this item.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  stat: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statLabel: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
});
