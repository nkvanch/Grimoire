import { View, Text } from 'react-native';
import { hasActiveOverride } from '../../../engine/dmOverride';
import { DerivedStats, Entity, ActionCard, SpellCastingContext } from '../../../engine/types';
import { Pressable } from '../../AccessibleControls';
import { ActionCardRow } from '../ActionCardRow';
import { actionCardIdentity } from '../actionCardUi';
import { toggleFavoriteTag } from '../TabActions';
import { styles } from '../tabCharacterStyles';

export function StatRowSection({ derived, entity, openAudit, favoriteCards, handleUseFavorite, onEntityUpdate }: {
  derived: DerivedStats;
  entity: Entity;
  openAudit: (stat: string, label: string) => void;
  favoriteCards: ActionCard[];
  handleUseFavorite: (card: ActionCard, bypassSpellPreparation?: boolean, selectedSpellCastingContext?: SpellCastingContext, bypassIncapacitated?: boolean, castMode?: "ritual") => void;
  onEntityUpdate: (updated: Entity) => void;
}) {
  return (
    <>
      {/* Stat Row */}
      <View style={styles.statRow}>
        {[
          { label: 'AC',    value: derived.ac,               stat: 'ac' },
          { label: 'Speed', value: `${derived.speed}ft`,     stat: 'speed' },
          { label: 'Init',  value: derived.initiative >= 0 ? `+${derived.initiative}` : String(derived.initiative), stat: 'initiative' },
          { label: 'Perc',  value: derived.passivePerception, stat: 'passivePerception' },
        ].map(({ label, value, stat }) => {
          const hasOv = hasActiveOverride(entity, stat);
          return (
            <Pressable key={stat} style={[styles.statBox, hasOv && styles.statBoxOverride]} onPress={() => openAudit(stat, label)}>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{value}</Text>
                {hasOv && <Text style={styles.overrideStar}>✱</Text>}
              </View>
              <Text style={styles.statLabel}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Favorites — starred on the Actions tab, quick-access here so a
          go-to ability doesn't need a tab switch mid-combat. */}
      {favoriteCards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FAVORITES</Text>
          {favoriteCards.map(c => (
            <ActionCardRow
              key={actionCardIdentity(c)}
              card={c}
              entity={entity}
              onUse={handleUseFavorite}
              isFavorite
              onToggleFavorite={c => onEntityUpdate(toggleFavoriteTag(entity, c))}
            />
          ))}
        </View>
      )}
    </>
  );
}
