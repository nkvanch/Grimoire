import { Dispatch, SetStateAction } from 'react';
import { View, Text } from 'react-native';
import type { SpellIndexEntry } from '../../../content/spellRepo.types';
import { Entity } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { SpellRow } from './SpellRow';
import { styles } from './spellsScreenStyles';

export function SpellPickLists({
  targets, setCantripsOpen, cantripsDone, pickedCantrips, cantripsOpen, cantripPool, homebrewSpellIds, draft, toggleCantrip, setSpellsOpen,
  spellsDone, pickedSpells, spellsOpen, spellPool, toggleSpell,
}: {
  targets: { cantrips: number; spells: number; };
  setCantripsOpen: Dispatch<SetStateAction<boolean>>;
  cantripsDone: boolean;
  pickedCantrips: string[];
  cantripsOpen: boolean;
  cantripPool: SpellIndexEntry[];
  homebrewSpellIds: Set<string>;
  draft: Entity;
  toggleCantrip: (id: string) => void;
  setSpellsOpen: Dispatch<SetStateAction<boolean>>;
  spellsDone: boolean;
  pickedSpells: string[];
  spellsOpen: boolean;
  spellPool: SpellIndexEntry[];
  toggleSpell: (id: string) => void;
}) {
  return (
    <>
      {targets.cantrips > 0 && (
        <View style={styles.choiceBlock}>
          <Pressable style={styles.levelHeaderRow} onPress={() => setCantripsOpen(o => !o)}>
            <Text style={styles.levelHeader}>CANTRIPS</Text>
            <View style={styles.levelHeaderLine} />
            <Text style={[styles.levelHeaderCount, cantripsDone && styles.choiceCountDone]}>
              {pickedCantrips.length}/{targets.cantrips}
            </Text>
            <Text style={styles.levelHeaderChevron}>{cantripsOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {cantripsOpen && (cantripPool.length === 0
            ? <Text style={styles.emptyNote}>No matching cantrips.</Text>
            : cantripPool.map(s => (
              <SpellRow
                key={s.id}
                spell={s}
                selected={pickedCantrips.includes(s.id)}
                disabled={!pickedCantrips.includes(s.id) && pickedCantrips.length >= targets.cantrips}
                isHomebrew={homebrewSpellIds.has(s.id)}
                rulesetId={draft?.rulesetId}
                onToggle={() => toggleCantrip(s.id)}
              />
            )))}
        </View>
      )}

      {targets.spells > 0 && (
        <View style={styles.choiceBlock}>
          <Pressable style={styles.levelHeaderRow} onPress={() => setSpellsOpen(o => !o)}>
            <Text style={styles.levelHeader}>1ST-LEVEL SPELLS</Text>
            <View style={styles.levelHeaderLine} />
            <Text style={[styles.levelHeaderCount, spellsDone && styles.choiceCountDone]}>
              {pickedSpells.length}/{targets.spells}
            </Text>
            <Text style={styles.levelHeaderChevron}>{spellsOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {spellsOpen && (spellPool.length === 0
            ? <Text style={styles.emptyNote}>No matching spells.</Text>
            : spellPool.map(s => (
              <SpellRow
                key={s.id}
                spell={s}
                selected={pickedSpells.includes(s.id)}
                disabled={!pickedSpells.includes(s.id) && pickedSpells.length >= targets.spells}
                isHomebrew={homebrewSpellIds.has(s.id)}
                rulesetId={draft?.rulesetId}
                onToggle={() => toggleSpell(s.id)}
              />
            )))}
        </View>
      )}
    </>
  );
}
